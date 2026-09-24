import { supabase } from '../../lib/supabaseClient';

// Reading Citadel AI's answers aloud.
//
// First choice: Gemini's text-to-speech (via the citadel-ai function) --
// a warm, clear American voice with natural pauses, far easier for a
// child to follow than the browser's robotic default. Each clip is kept
// on the device (Cache Storage), so an answer heard before -- the
// greeting, the FAQ answers -- plays instantly the next time.
//
// Fallback, if that fails or is slow: the best natural-sounding English
// voice the device has, spoken sentence by sentence so it pauses at
// full stops instead of running everything together.

const CACHE_NAME = 'citadel-ai-voice-v1';
const MAX_WAIT_MS = 4000;   // personal answers: wait this long for Gemini's voice, then use the device's
const SAVED_WAIT_MS = 2500; // recorded lines: normally ~1 s from storage, instant from the device

let ctx: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;
let turn = 0; // bumps on every speak/stop so late clips don't play over newer ones

function audioContext(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

// Phones only let a page play sound it started during a tap. Call this
// from the tap (send, mic, suggestion) so the answer can play later.
export function unlockAudio() {
  const c = audioContext();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

// Gemini sends either a WAV file or raw 16-bit PCM ("audio/L16;rate=…");
// turn either into something the Web Audio API can play.
async function clipToBuffer(c: AudioContext, base64: string, mimeType: string): Promise<AudioBuffer> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (!/l16|pcm/i.test(mimeType)) return c.decodeAudioData(bytes.buffer);
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24000);
  const samples = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
  const buf = c.createBuffer(1, samples.length, rate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
  return buf;
}

async function cachedClip(text: string): Promise<{ audio: string; mimeType: string } | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(cacheUrl(text));
    return hit ? hit.json() : null;
  } catch {
    return null;
  }
}

async function saveClip(text: string, clip: { audio: string; mimeType: string }) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheUrl(text), new Response(JSON.stringify(clip), { headers: { 'Content-Type': 'application/json' } }));
  } catch { /* storage full or blocked -- fine, just not cached */ }
}

// Cache Storage wants a URL; derive a stable fake one from the text.
function cacheUrl(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return `/__citadel-ai-voice/${(h >>> 0).toString(36)}-${text.length}`;
}

// share: the words are the same for everyone (an FAQ answer, the fees),
// so the server may keep the clip for the next visitor. Never set for
// anything mentioning the person's own details.
// Saved clips live in the public "ai-voice" bucket under a hash of the
// voice and the words. KEEP IN SYNC with clipPath and TTS_VOICES in the
// citadel-ai function.
const SAVED_VOICE = 'Sulafat';
async function savedClipUrl(text: string): Promise<string | null> {
  if (!crypto?.subtle) return null; // http:// pages have no hashing; the function still works
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${SAVED_VOICE}|${text}`));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
  return supabase.storage.from('ai-voice').getPublicUrl(`${hex}.wav`).data.publicUrl;
}

async function bytesToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

type Clip = { audio: string; mimeType: string };

// A clip already recorded: on this device, or saved on the server.
// Never asks Gemini, so it's quick (a second at most) or null.
async function savedClip(text: string): Promise<Clip | null> {
  const local = await cachedClip(text);
  if (local) return local;
  const url = await savedClipUrl(text).catch(() => null);
  const res = url ? await fetch(url).catch(() => null) : null;
  if (!res?.ok) return null;
  const clip = { audio: await bytesToBase64(await res.arrayBuffer()), mimeType: 'audio/wav' };
  saveClip(text, clip);
  return clip;
}

// A fresh clip from Gemini (several seconds on the free tier).
async function generatedClip(text: string, share: boolean): Promise<Clip | null> {
  const { data, error } = await supabase.functions.invoke('citadel-ai', { body: { tts: text, share } });
  if (error || !data?.audio) return null;
  const clip = { audio: String(data.audio), mimeType: String(data.mimeType ?? '') };
  saveClip(text, clip);
  return clip;
}

// A same-for-everyone line that isn't recorded yet: record it now, in
// the background, so it's ready for the next person. Once per visit.
const recording = new Set<string>();
function recordLater(text: string) {
  if (recording.has(text)) return;
  recording.add(text);
  generatedClip(text, true).catch(() => {});
}

// Fetch the recorded clips for these lines onto the device ahead of
// time (e.g. the suggested questions when the panel opens), so they
// play instantly. Only already-recorded clips; never asks Gemini.
export async function prefetchVoices(texts: string[]) {
  for (const t of texts) {
    for (const piece of splitForSpeech(speechText(t))) {
      await savedClip(piece).catch(() => null);
    }
  }
}

// Speech takes about as long to generate as to play, so a long answer
// is voiced a sentence (or two short ones) at a time: the first starts
// within a few seconds, and each next piece is prepared while the
// current one plays. KEEP IN SYNC with splitForSpeech in the citadel-ai
// function -- saved clips are looked up by their exact text.
export function splitForSpeech(text: string): string[] {
  // A sentence ends at . ! or ? followed by a space -- so "gmail.com"
  // stays whole -- but not after a short title like "St." or "Mr.".
  const sentences: string[] = [];
  for (const part of text.split(/(?<=[.!?]["')\]]*)\s+/)) {
    const prev = sentences[sentences.length - 1];
    if (prev && /\b(St|Mr|Mrs|Ms|Dr|Rev|No|Int'l)\.$/.test(prev)) sentences[sentences.length - 1] = `${prev} ${part}`;
    else if (part.trim()) sentences.push(part.trim());
  }
  const pieces: string[] = [];
  for (const s of sentences) {
    const last = pieces[pieces.length - 1];
    if (last && (last.length < 40 || s.length < 25)) pieces[pieces.length - 1] = `${last} ${s}`;
    else pieces.push(s);
  }
  return pieces;
}

function playBuffer(c: AudioContext, buf: AudioBuffer): Promise<void> {
  return new Promise((resolve) => {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.onended = () => resolve();
    current = src;
    src.start();
  });
}

// Text as it should be spoken: no markdown, and "₦54,900" read as
// "54,900 naira" rather than a symbol.
export const speechText = (text: string) =>
  text.replace(/[*_#`]/g, '').replace(/₦\s?([\d,]+(?:\.\d+)?)/g, '$1 naira').trim();

export async function speak(text: string, { share = false }: { share?: boolean } = {}) {
  const clean = speechText(text);
  if (!clean) return;
  stopSpeaking();
  const mine = ++turn;
  const c = audioContext();
  if (!c) { browserSpeak(clean); return; }

  const pieces = splitForSpeech(clean);
  const clips: Promise<Clip | null>[] = [];
  // Same-for-everyone lines only ever use recorded clips (instant), so
  // nobody waits on Gemini for them; personal answers are generated.
  const clipFor = (i: number) => (clips[i] ??= (share ? savedClip(pieces[i]) : generatedClip(pieces[i], false)).catch(() => null));
  const fallBack = (from: number) => {
    browserSpeak(pieces.slice(from).join(' '));
    if (share) pieces.slice(from).forEach(recordLater);
  };

  // Never leave them waiting: if the natural voice isn't ready in time,
  // the device's own voice speaks now (and, for a shared line, the
  // natural one is recorded for next time).
  const first = await Promise.race([
    clipFor(0),
    new Promise<null>((r) => setTimeout(() => r(null), share ? SAVED_WAIT_MS : MAX_WAIT_MS)),
  ]);
  if (mine !== turn) return; // something newer started, or they pressed stop
  if (!first) { fallBack(0); return; }

  try {
    if (c.state === 'suspended') await c.resume();
    for (let i = 0; i < pieces.length; i++) {
      const clip = i === 0 ? first : await clipFor(i);
      if (mine !== turn) return;
      if (!clip) { fallBack(i); return; }
      if (i + 1 < pieces.length) clipFor(i + 1); // prepare the next piece while this one plays
      const buf = await clipToBuffer(c, clip.audio, clip.mimeType);
      if (mine !== turn) return;
      await playBuffer(c, buf);
      if (mine !== turn) return;
    }
  } catch {
    if (mine === turn) browserSpeak(clean);
  }
}

export function stopSpeaking() {
  turn++;
  try { current?.stop(); } catch { /* already finished */ }
  current = null;
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

// ---- fallback: the device's own voice, made as natural as it can be ----

// Names of the good voices on common devices, best first.
const PREFERRED = [/natural/i, /neural/i, /google us english/i, /samantha/i, /aria/i, /jenny/i, /ava/i, /allison/i, /google uk english female/i];

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  for (const re of PREFERRED) {
    const v = english.find((x) => re.test(x.name) && x.lang.toLowerCase() === 'en-us') ?? english.find((x) => re.test(x.name));
    if (v) return v;
  }
  return english.find((v) => v.lang.toLowerCase() === 'en-us') ?? english[0] ?? null;
}

function browserSpeak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const voice = pickVoice();
    // One utterance per sentence gives real pauses between them.
    const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
    for (const s of sentences) {
      const u = new SpeechSynthesisUtterance(s.trim());
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
      u.rate = 0.92;
      u.pitch = 1.05;
      synth.speak(u);
    }
  } catch { /* no speech on this device -- the text is on screen */ }
}
