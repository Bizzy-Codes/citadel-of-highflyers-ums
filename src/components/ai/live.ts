import { supabase } from '../../lib/supabaseClient';

// Citadel AI "Talk live": a real-time voice conversation with Gemini's
// Live API. The microphone streams straight to Gemini and the spoken
// answer streams straight back, so there is none of the
// record -> upload -> transcribe -> think -> synthesise wait of the
// normal voice path.
//
// The Gemini key never reaches the browser. The citadel-ai function
// hands out a single-use, short-lived token that is LOCKED to the model,
// instructions and tools the function chose -- the browser cannot change
// them (so a visitor's session simply does not contain any fee data).
//
// Spoken replies can't be filtered before they are heard like text can,
// so the live transcript is watched as it arrives and the session is cut
// off the moment it looks like a password or (for visitors) an amount.

export type LiveStatus = 'connecting' | 'listening' | 'thinking' | 'speaking';

export interface LiveHandlers {
  onStatus: (s: LiveStatus) => void;
  /** A finished turn: what the person said and what Citadel AI answered. */
  onTurn: (userText: string, botText: string) => void;
  /** Run a page/guide/lookup the model asked for; resolves with the result sent back to it. */
  onTool: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Called once when the session is over. `blocked` = cut off for safety. */
  onEnd: (reason: 'user' | 'closed' | 'error' | 'blocked' | 'idle', detail?: string) => void;
  /** True if this text must never be spoken to this person. */
  isForbidden: (botText: string) => boolean;
  context: () => Record<string, unknown>;
}

export interface LiveSession { stop: () => void }

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const MAX_SESSION_MS = 9 * 60 * 1000;
const IDLE_MS = 90 * 1000;

export const canUseLive = () =>
  typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia &&
  typeof WebSocket !== 'undefined' && typeof AudioContext !== 'undefined';

const toBase64 = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromBase64 = (b64: string) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// A tiny AudioWorklet that hands microphone samples to the page.
const WORKLET = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('tap', Tap);
`;

async function mintToken(context: Record<string, unknown>, attempt: number) {
  const { data, error } = await supabase.functions.invoke('citadel-ai', { body: { live: { attempt }, context } });
  if (error || !data?.token) throw new Error(error?.message ?? data?.error ?? 'Live voice is not available right now.');
  return data as { token: string; model: string; setup: Record<string, unknown> };
}

export async function startLive(h: LiveHandlers): Promise<LiveSession> {
  let stopped = false;
  let ended = false;
  let ws: WebSocket | null = null;
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let node: AudioWorkletNode | null = null;
  const playing = new Set<AudioBufferSourceNode>();
  let playHead = 0;
  let userText = '';
  let botText = '';
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  let ready = false;

  const finish = (reason: Parameters<LiveHandlers['onEnd']>[0], detail?: string) => {
    if (ended) return;
    ended = true;
    stopped = true;
    clearTimeout(idleTimer); clearTimeout(maxTimer);
    for (const s of playing) { try { s.stop(); } catch { /* already stopped */ } }
    playing.clear();
    try { node?.disconnect(); } catch { /* ignore */ }
    stream?.getTracks().forEach((t) => t.stop());
    try { ctx?.close(); } catch { /* ignore */ }
    try { ws?.close(); } catch { /* ignore */ }
    h.onEnd(reason, detail);
  };

  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => finish('idle'), IDLE_MS);
  };

  const stopSpeaking = () => {
    for (const s of playing) { try { s.stop(); } catch { /* ignore */ } }
    playing.clear();
    playHead = 0;
  };

  const play = (pcm: Uint8Array) => {
    if (!ctx) return;
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
    const buf = ctx.createBuffer(1, samples.length, OUTPUT_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    playHead = Math.max(playHead, ctx.currentTime + 0.02);
    src.start(playHead);
    playHead += buf.duration;
    playing.add(src);
    src.onended = () => {
      playing.delete(src);
      if (!playing.size && !stopped) h.onStatus('listening');
    };
  };

  const send = (msg: unknown) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };

  // ---- microphone first, so a refusal shows before anything is spent ----
  h.onStatus('connecting');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
  } catch {
    finish('error', 'mic');
    return { stop: () => {} };
  }

  let creds: Awaited<ReturnType<typeof mintToken>>;
  try {
    creds = await mintToken(h.context(), 0);
  } catch (e) {
    finish('error', e instanceof Error ? e.message : 'token');
    return { stop: () => {} };
  }

  ctx = new AudioContext();
  await ctx.resume();
  try {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
  } catch {
    finish('error', 'audio');
    return { stop: () => {} };
  }
  const source = ctx.createMediaStreamSource(stream);
  node = new AudioWorkletNode(ctx, 'tap');
  source.connect(node);

  const ratio = ctx.sampleRate / INPUT_RATE;
  node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
    if (!ready || stopped) return;
    const input = ev.data;
    // Plain averaging down-sample to 16 kHz, 16-bit.
    const outLen = Math.floor(input.length / ratio);
    const out = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const start = Math.floor(i * ratio), end = Math.min(input.length, Math.floor((i + 1) * ratio));
      let sum = 0;
      for (let j = start; j < end; j++) sum += input[j];
      const v = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
      out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    send({ realtimeInput: { audio: { data: toBase64(new Uint8Array(out.buffer)), mimeType: `audio/pcm;rate=${INPUT_RATE}` } } });
  };

  const open = (creds: Awaited<ReturnType<typeof mintToken>>, attempt: number) => {
  const socket = new WebSocket(
    `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(creds.token)}`,
  );
  ws = socket;

  socket.onopen = () => {
    send({ setup: creds.setup });
  };

  socket.onmessage = async (ev) => {
    if (stopped) return;
    let msg: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      const text = typeof ev.data === 'string' ? ev.data : await (ev.data as Blob).text();
      msg = JSON.parse(text);
    } catch { return; }

    if (msg.setupComplete) {
      ready = true;
      h.onStatus('listening');
      resetIdle();
      maxTimer = setTimeout(() => finish('closed'), MAX_SESSION_MS);
      return;
    }

    if (msg.goAway) { finish('closed'); return; }

    if (msg.toolCall?.functionCalls) {
      h.onStatus('thinking');
      const responses = [];
      for (const call of msg.toolCall.functionCalls as { id: string; name: string; args?: Record<string, unknown> }[]) {
        let response: Record<string, unknown>;
        try { response = await h.onTool(call.name, call.args ?? {}); }
        catch { response = { error: 'That did not work.' }; }
        responses.push({ id: call.id, name: call.name, response });
      }
      send({ toolResponse: { functionResponses: responses } });
      return;
    }

    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.interrupted) { stopSpeaking(); h.onStatus('listening'); }

    if (sc.inputTranscription?.text) { userText += sc.inputTranscription.text; resetIdle(); h.onStatus('thinking'); }

    if (sc.outputTranscription?.text) {
      botText += sc.outputTranscription.text;
      // The audio of a forbidden answer may already be playing: cut it off now.
      if (h.isForbidden(botText)) { stopSpeaking(); finish('blocked'); return; }
    }

    const parts = sc.modelTurn?.parts as { inlineData?: { data: string } }[] | undefined;
    for (const p of parts ?? []) {
      if (p.inlineData?.data) { h.onStatus('speaking'); resetIdle(); play(fromBase64(p.inlineData.data)); }
    }

    if (sc.turnComplete) {
      const u = userText.trim(), b = botText.trim();
      userText = ''; botText = '';
      if (u || b) h.onTurn(u, b);
    }
  };

  // A model that is busy or retired closes the connection before it is
  // ready: try the next model once before giving up.
  const failed = async (reason: 'error' | 'closed') => {
    if (ended || ws !== socket) return;
    if (!ready && attempt < 1) {
      try { open(await mintToken(h.context(), attempt + 1), attempt + 1); return; } catch { /* fall through */ }
    }
    finish(reason, 'connection');
  };
  socket.onerror = () => { failed('error'); };
  socket.onclose = () => { failed('closed'); };
  };
  open(creds, 0);

  return { stop: () => finish('user') };
}
