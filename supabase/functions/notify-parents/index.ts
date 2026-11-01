// Emails the parent / guardian contact address of pupils whose portal the
// admin has locked (patch_43). Admin only.
//
// Secrets (supabase secrets set ...):
//   RESEND_API_KEY   an API key from resend.com
//   RESEND_FROM      the verified sender, e.g. "Citadel of Highflyers <office@yourdomain.com>"
//   SCHOOL_PHONE     optional, shown in the email (default 07064970003)
// Without RESEND_API_KEY the function answers { notConfigured: true } and
// the admin screen falls back to the WhatsApp buttons.
//
// Deploy WITH jwt verification (the default): only a signed-in admin may call it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? '';
const SCHOOL_PHONE = Deno.env.get('SCHOOL_PHONE') ?? '07064970003';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return json({ error: 'Invalid session' }, 401);
  const { data: caller } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (caller?.role !== 'admin') return json({ error: 'Admins only' }, 403);

  let body: { studentIds?: string[] };
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const ids = (body.studentIds ?? []).slice(0, 300);
  if (ids.length === 0) return json({ error: 'No pupils selected' }, 400);

  if (!RESEND_API_KEY || !RESEND_FROM) return json({ notConfigured: true });

  // Only pupils whose portal is actually locked.
  const { data: locks } = await db.from('portal_locks').select('student_id').in('student_id', ids);
  const lockedIds = (locks ?? []).map((l: { student_id: string }) => l.student_id);
  if (lockedIds.length === 0) return json({ sent: 0, skipped: ids.length });

  const { data: pupils } = await db.from('profiles').select('id, name, email').in('id', lockedIds);
  let sent = 0;
  let skipped = 0;
  const notified: string[] = [];

  for (const p of pupils ?? []) {
    const email = (p.email ?? '').trim();
    if (!email || !email.includes('@')) { skipped++; continue; }
    const name = escapeHtml(p.name);
    const text =
      `Hello,\n\nThis is Citadel of Highflyers Int'l Academy.\n\n` +
      `The school portal for ${p.name} has been temporarily closed because there is an outstanding school fees balance.\n\n` +
      `Kindly contact the school accountant or secretary on ${SCHOOL_PHONE}, or send your payment receipt from the portal. ` +
      `The portal will be reopened once your payment is confirmed.\n\nThank you for partnering with us.`;
    const html =
      `<p>Hello,</p><p>This is Citadel of Highflyers Int'l Academy.</p>` +
      `<p>The school portal for <strong>${name}</strong> has been temporarily closed because there is an outstanding school fees balance.</p>` +
      `<p>Kindly contact the school accountant or secretary on <strong>${escapeHtml(SCHOOL_PHONE)}</strong>, or send your payment receipt from the portal. ` +
      `The portal will be reopened once your payment is confirmed.</p><p>Thank you for partnering with us.</p>`;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: RESEND_FROM, to: [email], subject: `School portal update for ${p.name}`, text, html }),
      });
      if (res.ok) { sent++; notified.push(p.id); } else { skipped++; console.warn('notify-parents: send failed', res.status, await res.text()); }
    } catch (err) {
      skipped++;
      console.warn('notify-parents: send error', (err as Error).message);
    }
  }

  if (notified.length > 0) {
    await db.from('portal_locks')
      .update({ parent_notified_at: new Date().toISOString(), parent_notified_by: user.id })
      .in('student_id', notified);
  }
  return json({ sent, skipped });
});
