// Phone / browser push notifications (patch_39).
//
// Called every 30 minutes by pg_cron with { remind_unread: true, token }.
// It finds private messages that have gone unread for 2 days, pushes a
// reminder to the recipient's phone/browser (whether or not the website
// is open), and stamps the message so it is only reminded once.
//
// Secrets (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   from `npx web-push generate-vapid-keys`
//   VAPID_SUBJECT                          mailto:... or the site URL
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//
// Deploy with --no-verify-jwt: the cron job authenticates with the
// push_token stored in ai_settings, not a user login.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:citadelofhighflyersintlacademy@gmail.com';
if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const SITE = Deno.env.get('SITE_URL') ?? '';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface SubRow { id: string; endpoint: string; p256dh: string; auth: string }

async function pushTo(subs: SubRow[], payload: Record<string, unknown>) {
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 },
      );
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      // 404 / 410: the phone or browser has unsubscribed -- forget it.
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
      else console.warn('send-push: failed', code, (err as Error).message);
    }
  }
  return sent;
}

async function remindUnread() {
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: msgs, error } = await db.from('direct_messages')
    .select('id, sender_id, recipient_id, created_at')
    .is('read_at', null).is('reminded_at', null).lt('created_at', cutoff)
    .order('created_at').limit(500);
  if (error) return json({ error: error.message }, 500);
  if (!msgs?.length) return json({ ok: true, reminded: 0 });

  // One reminder per person, however many messages are waiting.
  const byRecipient = new Map<string, string[]>();
  for (const m of msgs) {
    const list = byRecipient.get(m.recipient_id) ?? [];
    list.push(m.id);
    byRecipient.set(m.recipient_id, list);
  }

  let pushes = 0;
  for (const [userId, ids] of byRecipient) {
    const { data: subs } = await db.from('push_subscriptions')
      .select('id, endpoint, p256dh, auth').eq('user_id', userId);
    if (subs?.length) {
      pushes += await pushTo(subs as SubRow[], {
        title: 'Citadel of Highflyers',
        body: ids.length === 1
          ? 'You have a private message you have not read yet.'
          : `You have ${ids.length} private messages you have not read yet.`,
        url: `${SITE}/portal/messages`,
        tag: 'unread-messages',
      });
    }
    // Stamp them either way: someone with no phone set up is not retried every 30 minutes.
    await db.from('direct_messages').update({ reminded_at: new Date().toISOString() }).in('id', ids);
  }
  return json({ ok: true, reminded: byRecipient.size, pushes });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'VAPID keys are not set' }, 500);

  let body: { remind_unread?: boolean; token?: string };
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const { data: row } = await db.from('ai_settings').select('value').eq('key', 'push_token').maybeSingle();
  if (!row || !body.token || body.token !== row.value) return json({ error: 'Not allowed' }, 403);

  if (body.remind_unread) return await remindUnread();
  return json({ error: 'Nothing to do' }, 400);
});
