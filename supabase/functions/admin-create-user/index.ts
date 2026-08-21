// Admin-only user management: create a new account directly (no email
// sent, account is usable immediately), or set an existing user's
// password directly. Runs server-side because both operations require
// the service_role key, which must never be shipped to the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// The frontend (Vercel) and this function (supabase.co) are different
// origins, and the client always sends a custom Authorization header,
// which forces the browser to preflight with OPTIONS first. Without
// these headers on every response -- OPTIONS included -- the browser
// blocks the request before it ever reaches the code below, and
// supabase-js reports that as a generic "Failed to send a request to
// the Edge Function", not as any error this function returns.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing authorization' }, 401);
  }

  // Scoped to the caller's own JWT -- used only to verify who is calling.
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return json({ error: 'Invalid session' }, 401);
  }

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (callerProfile?.role !== 'admin') {
    return json({ error: 'Admin only' }, 403);
  }

  const body = await req.json();
  const action = body.action ?? 'create';
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  if (action === 'set_password') {
    const { userId, newPassword } = body;
    if (!userId || typeof newPassword !== 'string' || newPassword.length < 6) {
      return json({ error: 'A user and a password of at least 6 characters are required' }, 400);
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ ok: true });
  }

  const { name, email, role, grade } = body;
  if (!name || !email || !['student', 'teacher'].includes(role)) {
    return json({ error: 'Invalid input' }, 400);
  }

  const tempPassword = generateTempPassword();

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name, role, grade },
  });

  if (error) {
    return json({ error: error.message }, 400);
  }

  // Admin-created accounts are pre-vetted, so a teacher added this way
  // skips the 'teacher_pending' approval step that self-registered
  // teachers go through.
  if (role === 'teacher' && data.user) {
    await adminClient.from('profiles').update({ role: 'teacher' }).eq('id', data.user.id);
  }

  return json({ id: data.user?.id, password: tempPassword });
});
