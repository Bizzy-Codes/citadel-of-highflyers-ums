import { supabase } from './supabaseClient';

// Phone / browser push notifications (patch_39). A person turns them on
// once on each device; the school's server can then reach that device
// even when the website is closed -- e.g. "you have a private message
// you haven't read".
//
// Needs VITE_VAPID_PUBLIC_KEY in the site's environment. Without it the
// switch simply doesn't appear.

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '';

export const pushConfigured = () => !!VAPID_PUBLIC_KEY;

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const urlBase64ToUint8Array = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export type PushState = 'unsupported' | 'not-configured' | 'blocked' | 'off' | 'on';

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (!pushConfigured()) return 'not-configured';
  if (Notification.permission === 'denied') return 'blocked';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js') ?? await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export async function enablePush(): Promise<{ error: string | null }> {
  if (!pushSupported()) return { error: 'This browser cannot show notifications. On an iPhone, first use Share > Add to Home Screen, then open the app from there.' };
  if (!pushConfigured()) return { error: 'Notifications are not set up on the server yet.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { error: 'Notifications were not allowed. You can allow them in your browser or phone settings for this site.' };
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const { error } = await registerSubscription(sub);
    if (error) return { error };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not turn notifications on.' };
  }
}

// Hands this phone/browser to whoever is logged in now. A phone belongs to
// one account at a time; patch_41's register_push takes it over from the
// previous account.
async function registerSubscription(sub: PushSubscription): Promise<{ error: string | null }> {
  const json = sub.toJSON();
  const { error } = await supabase.rpc('register_push', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_user_agent: navigator.userAgent.slice(0, 200),
  });
  return { error: error?.message ?? null };
}

// Called after every login. If this phone already allowed notifications
// (for any account) no question is needed: just make sure it is registered
// for the account that is logged in now. Returns the state afterwards.
export async function syncPushForLogin(): Promise<PushState> {
  const state = await currentPushState();
  if (state === 'unsupported' || state === 'not-configured' || state === 'blocked') return state;
  if (Notification.permission !== 'granted') return 'off';
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const { error } = await registerSubscription(sub);
    return error ? 'off' : 'on';
  } catch {
    return 'off';
  }
}

// On logout this phone stops receiving that account's notifications (the
// browser permission stays, so the next login re-registers silently).
export async function unlinkPushFromThisPhone(): Promise<void> {
  try {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration('/sw.js') ?? await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  } catch { /* best effort */ }
}

export async function disablePush(): Promise<{ error: string | null }> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js') ?? await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not turn notifications off.' };
  }
}
