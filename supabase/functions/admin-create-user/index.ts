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

// Every account starts on the same easy-to-say default. Families were
// being handed a 10-character random string over the phone and couldn't
// type it in or remember it, so the school now reads out one short,
// memorable password they can't get wrong, and the parent changes it
// (or the admin sets a new one) from the portal afterwards.
//
// Change it here and it changes everywhere -- this is the only place a
// new account's password is decided. NOTE: editing this file is not
// enough on its own; the function has to be redeployed for it to take
// effect (`supabase functions deploy admin-create-user`). Keep this in
// sync with src/lib/accounts.ts, which carries its own copy for the
// browser bundle.
const DEFAULT_PASSWORD = 'citadel1234';

function isEmailTaken(message: string) {
  return /already been registered|already registered|already exists|duplicate/i.test(message);
}

// mum@gmail.com -> mum+ch4k2x9a@gmail.com. Keep in sync with
// siblingLoginEmail in src/lib/accounts.ts.
function siblingLoginEmail(email: string) {
  const at = email.lastIndexOf('@');
  const tag = 'ch' + crypto.randomUUID().replace(/-/g, '').slice(0, 6);
  return `${email.slice(0, at)}+${tag}${email.slice(at)}`;
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

  // Full account deletion. Deleting only the profiles row (the frontend's
  // only option, since it has no service_role key) left the auth.users
  // row behind forever -- and Supabase enforces unique emails there, so
  // every "deleted" test account permanently squatted on its email,
  // making it look used when someone tried to create a new account with
  // it. profiles.id references auth.users(id) on delete cascade, so
  // deleting the auth user here also removes the profile (and anything
  // that references it -- results, attendance, messages, etc.) in one
  // step; nothing else needs to run first.
  if (action === 'delete_user') {
    const { userId } = body;
    if (!userId) {
      return json({ error: 'A user id is required' }, 400);
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ ok: true });
  }

  const { name, email, role, grade } = body;
  if (!name || !email || !['student', 'teacher'].includes(role)) {
    return json({ error: 'Invalid input' }, 400);
  }

  const tempPassword = DEFAULT_PASSWORD;

  const create = (loginEmail: string) => adminClient.auth.admin.createUser({
    email: loginEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name, role, grade, contact_email: email },
  });

  let { data, error } = await create(email);

  // Siblings share a parent's email (patch_31). Auth still needs a
  // unique login address, so a pupil whose family email is taken gets a
  // plus-address of it; the profile keeps the real one. Pupils log in
  // by name or ID, so they never see the alias. Teachers still need
  // their own address -- they log in and reset passwords with it.
  if (error && role === 'student' && isEmailTaken(error.message)) {
    for (let attempt = 0; attempt < 3 && error; attempt++) {
      ({ data, error } = await create(siblingLoginEmail(email)));
      if (error && !isEmailTaken(error.message)) break;
    }
  }

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
