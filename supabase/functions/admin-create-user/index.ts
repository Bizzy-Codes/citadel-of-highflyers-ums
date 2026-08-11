// Admin-only: invite a new student or teacher account by email.
// Runs server-side because creating a user directly (rather than
// having them self-register) requires the service_role key, which
// must never be shipped to the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
  }

  // Scoped to the caller's own JWT -- used only to verify who is calling.
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
  }

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (callerProfile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 });
  }

  const { name, email, role, grade } = await req.json();
  if (!name || !email || !['student', 'teacher'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400 });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { name, role, grade },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  // Admin-created accounts are pre-vetted, so a teacher invited this
  // way skips the 'teacher_pending' approval step that self-registered
  // teachers go through.
  if (role === 'teacher' && data.user) {
    await adminClient.from('profiles').update({ role: 'teacher' }).eq('id', data.user.id);
  }

  return new Response(JSON.stringify({ id: data.user?.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
