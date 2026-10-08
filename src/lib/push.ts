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

export async function enablePush(userId: string): Promise<{ error: string | null }> {
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
    const json = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      user_agent: navigator.userAgent.slice(0, 200),
    }, { onConflict: 'endpoint' });
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not turn notifications on.' };
  }
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
