// Live exam video: each pupil streams their webcam straight to the
// teacher's browser over a WebRTC peer connection. Signaling (offer /
// answer exchange) rides on the Supabase Realtime broadcast channel
// the test already uses -- no media ever touches Supabase.
//
// ICE candidates are NOT trickled: each side waits for gathering to
// finish and ships one complete SDP. That keeps it to two signaling
// messages per connection, well inside Realtime's per-client rate
// limit even with a whole class connecting at once.
import { supabase } from './supabaseClient';

export const rtcChannelName = (testId: string) => `test-rtc-${testId}`;

export type RtcSignal =
  | { kind: 'teacher-ready'; teacherId: string }
  | { kind: 'reinvite'; teacherId: string; attemptId: string }
  | { kind: 'pupil-ready'; attemptId: string; teacherId: string | null }
  | { kind: 'offer'; teacherId: string; attemptId: string; sdp: string }
  | { kind: 'answer'; teacherId: string; attemptId: string; sdp: string };

// A public STUN server is enough when teacher and pupils share the
// school network. If the teacher monitors from elsewhere, set the
// VITE_TURN_* vars to a TURN relay and it's picked up here.
export const iceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const turnUrls = (import.meta.env.VITE_TURN_URLS as string | undefined)?.split(',').map((s) => s.trim()).filter(Boolean);
  if (turnUrls && turnUrls.length > 0) {
    servers.push({
      urls: turnUrls,
      username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
    });
  }
  return servers;
};

export const openRtcChannel = (testId: string, onSignal: (s: RtcSignal) => void) => {
  const channel = supabase
    .channel(rtcChannelName(testId), { config: { broadcast: { self: false, ack: false } } })
    .on('broadcast', { event: 'rtc' }, ({ payload }) => onSignal(payload as RtcSignal));
  let ready = false;
  const queue: RtcSignal[] = [];
  channel.subscribe((status) => {
    ready = status === 'SUBSCRIBED';
    if (ready) { queue.splice(0).forEach((s) => channel.send({ type: 'broadcast', event: 'rtc', payload: s })); }
  });
  return {
    send: (s: RtcSignal) => {
      if (ready) channel.send({ type: 'broadcast', event: 'rtc', payload: s });
      else queue.push(s);
    },
    close: () => { supabase.removeChannel(channel); },
  };
};

// Resolve once ICE gathering completes, or after timeoutMs with whatever
// candidates exist so far (TURN lookups can be slow; a LAN finishes in
// well under a second).
export const waitForIceGathering = (pc: RTCPeerConnection, timeoutMs = 2500) =>
  new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    const timer = setTimeout(done, timeoutMs);
    function done() {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }
    function check() { if (pc.iceGatheringState === 'complete') done(); }
    pc.addEventListener('icegatheringstatechange', check);
  });

export const isHealthy = (pc: RTCPeerConnection | undefined) =>
  !!pc && (pc.connectionState === 'connected' || pc.connectionState === 'connecting' || pc.connectionState === 'new');
