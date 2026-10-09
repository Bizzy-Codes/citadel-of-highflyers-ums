// Phone / browser push notifications (patch_39 + patch_40).
//
// Two callers, both authenticated with the push_token in ai_settings:
//  * pg_cron every 30 minutes: { remind_unread: true, token }
//  * database triggers the moment something happens (patch_40):
//      { event: direct_message | class_message | assignment | test | notification, id, token }
//    The function works out who should hear about it and pushes to each
//    of their phones/browsers, whether or not the website is open.
//
// Unread reminder (cron):
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

const snippet = (s: string | null | undefined, n = 120) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

// Push one message to a set of people.
async function notifyUsers(userIds: string[], payload: Record<string, unknown>) {
  const ids = [...new Set(userIds)];
  let pushes = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data: subs } = await db.from('push_subscriptions')
      .select('id, endpoint, p256dh, auth').in('user_id', ids.slice(i, i + 200));
    if (subs?.length) pushes += await pushTo(subs as SubRow[], payload);
  }
  return json({ ok: true, people: ids.length, pushes });
}

async function idsWhere(role: string, column?: string, value?: string): Promise<string[]> {
  let q = db.from('profiles').select('id').eq('role', role);
  if (column && value) q = q.eq(column, value);
  const { data } = await q.limit(5000);
  return (data ?? []).map((r: { id: string }) => r.id);
}

async function handleEvent(event: string, id: string) {
  if (event === 'direct_message') {
    const { data: m } = await db.from('direct_messages').select('sender_id, recipient_id, content').eq('id', id).maybeSingle();
    if (!m) return json({ error: 'Not found' }, 404);
    const { data: s } = await db.from('profiles').select('name, role').eq('id', m.sender_id).maybeSingle();
    const from = s?.role === 'admin' ? 'the school admin' : (s?.name ?? 'someone');
    return notifyUsers([m.recipient_id], {
      title: 'New message', body: `From ${from}: ${snippet(m.content)}`,
      url: `${SITE}/portal/messages?chat=${m.sender_id}`, tag: `dm-${m.sender_id}`,
    });
  }
  if (event === 'class_message') {
    const { data: m } = await db.from('class_messages').select('class_name, sender_id, sender_name, content').eq('id', id).maybeSingle();
    if (!m) return json({ error: 'Not found' }, 404);
    const people = [
      ...await idsWhere('student', 'grade', m.class_name),
      ...await idsWhere('teacher', 'assigned_class', m.class_name),
    ].filter((u) => u !== m.sender_id);
    return notifyUsers(people, {
      title: `New message in ${m.class_name} group`, body: `${m.sender_name ?? 'Someone'}: ${snippet(m.content)}`,
      url: `${SITE}/portal/messages?group=1`, tag: `group-${m.class_name}`,
    });
  }
  if (event === 'assignment') {
    const { data: a } = await db.from('assignments').select('class_name, subject, title').eq('id', id).maybeSingle();
    if (!a) return json({ error: 'Not found' }, 404);
    return notifyUsers(await idsWhere('student', 'grade', a.class_name), {
      title: 'You have a new assignment', body: `${a.subject}: ${a.title}`,
      url: `${SITE}/portal/assignments`, tag: `assignment-${id}`,
    });
  }
  if (event === 'test') {
    const { data: t } = await db.from('tests').select('class_name, subject, title').eq('id', id).maybeSingle();
    if (!t) return json({ error: 'Not found' }, 404);
    return notifyUsers(await idsWhere('student', 'grade', t.class_name), {
      title: 'A test is open for you', body: `${t.subject}: ${t.title}`,
      url: `${SITE}/portal/tests`, tag: `test-${id}`,
    });
  }
  if (event === 'notification') {
    const { data: n } = await db.from('notifications').select('title, message, audience, recipient_id').eq('id', id).maybeSingle();
    if (!n) return json({ error: 'Not found' }, 404);
    let people: string[] = [];
    if (n.recipient_id) people = [n.recipient_id];
    else if (n.audience === 'students') people = await idsWhere('student');
    else if (n.audience === 'teachers') people = await idsWhere('teacher');
    else if (n.audience === 'admins') people = await idsWhere('admin');
    else people = [...await idsWhere('student'), ...await idsWhere('teacher'), ...await idsWhere('admin')];
    return notifyUsers(people, {
      title: n.title || 'Citadel of Highflyers', body: snippet(n.message),
      url: `${SITE}/portal/messages`, tag: `notice-${id}`,
    });
  }
  return json({ error: 'Unknown event' }, 400);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'VAPID keys are not set' }, 500);

  let body: { remind_unread?: boolean; token?: string; event?: string; id?: string };
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const { data: row } = await db.from('ai_settings').select('value').eq('key', 'push_token').maybeSingle();
  if (!row || !body.token || body.token !== row.value) return json({ error: 'Not allowed' }, 403);

  if (body.event && body.id) return await handleEvent(body.event, body.id);
  if (body.remind_unread) return await remindUnread();
  return json({ error: 'Nothing to do' }, 400);
});
