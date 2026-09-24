// Voice in and out.
//
// Speaking to Citadel AI works two ways:
//  1. The browser's own speech recognition (Chrome, Edge, Samsung
//     Internet on Android and desktop): free and instant.
//  2. Recording the voice and letting Gemini write down what was said
//     (via the citadel-ai function). Used wherever (1) is missing or
//     silently broken -- Firefox, some iPhones, in-app browsers that
//     ship the feature without Google's speech service behind it.
// If (1) doesn't start hearing within a couple of seconds we assume it's
// broken, switch to (2) for the rest of the visit, and say so.

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onaudiostart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const canRecord = () =>
  typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

let recognitionBroken = false;
try { recognitionBroken = sessionStorage.getItem('citadel-ai-stt-broken') === '1'; } catch { /* ignore */ }
function markRecognitionBroken() {
  recognitionBroken = true;
  try { sessionStorage.setItem('citadel-ai-stt-broken', '1'); } catch { /* ignore */ }
}

export const canUseVoice = () => !!recognitionCtor() || canRecord();

export type VoiceStatus =
  | { kind: 'listening'; text: string }            // browser recognition, words so far
  | { kind: 'recording'; seconds: number; level: number } // our own recording
  | { kind: 'transcribing' };

export interface VoiceCallbacks {
  onStatus: (s: VoiceStatus) => void;
  // Final words heard ('' if nothing), or an error code.
  onDone: (text: string, error?: string) => void;
  // Turns a recording into words (calls the server).
  transcribe: (audio: Blob) => Promise<string>;
}

export interface VoiceSession { stop: () => void; cancel: () => void }

export function startVoice(cb: VoiceCallbacks): VoiceSession {
  const Ctor = recognitionCtor();
  if (Ctor && !recognitionBroken && navigator.mediaDevices?.getUserMedia) {
    // Get microphone permission first, so the "is it broken?" timer in
    // startRecognition doesn't count the time spent on the permission
    // prompt.
    let inner: VoiceSession | null = null;
    let ended = false;
    cb.onStatus({ kind: 'listening', text: '' });
    navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
      s.getTracks().forEach((t) => t.stop());
      if (!ended) inner = startRecognition(Ctor, cb);
    }).catch((e: { name?: string }) => {
      if (ended) return;
      ended = true;
      cb.onDone('', e?.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture');
    });
    const endEarly = () => {
      if (inner) { inner.stop(); return; }
      if (ended) return;
      ended = true;
      cb.onDone('', 'aborted');
    };
    return { stop: endEarly, cancel: () => (inner ? inner.cancel() : endEarly()) };
  }
  if (Ctor && !recognitionBroken) return startRecognition(Ctor, cb);
  if (canRecord()) return startRecording(cb);
  cb.onDone('', 'unsupported');
  return { stop: () => {}, cancel: () => {} };
}

// ---- 1. browser speech recognition ---------------------------------

function startRecognition(Ctor: RecognitionCtor, cb: VoiceCallbacks): VoiceSession {
  const rec = new Ctor();
  rec.lang = 'en-NG'; // Nigerian English copes far better with local names and accents
  rec.interimResults = true;
  rec.continuous = false;
  let finalText = '';
  let heard = '';
  let error: string | undefined;
  let finished = false;
  let fellBack = false;
  let fallbackSession: VoiceSession | null = null;

  const finish = (text: string, err?: string) => {
    if (finished) return;
    finished = true;
    window.clearTimeout(watchdog);
    cb.onDone(text, err);
  };

  const fallBack = () => {
    if (finished || fellBack) return;
    fellBack = true;
    window.clearTimeout(watchdog);
    markRecognitionBroken();
    try { rec.abort(); } catch { /* ignore */ }
    if (canRecord()) fallbackSession = startRecording(cb);
    else finish('', 'unsupported');
  };

  // Broken builds accept start() and then never hear anything. If the
  // microphone hasn't opened within 2.5 s, stop waiting.
  const watchdog = window.setTimeout(fallBack, 2500);

  rec.onaudiostart = () => window.clearTimeout(watchdog);
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    heard = (finalText + interim).trim();
    cb.onStatus({ kind: 'listening', text: heard });
  };
  rec.onerror = (e) => {
    error = e.error;
    // 'network' / 'service-not-allowed' / 'language-not-supported' mean
    // the feature exists but can't work here -- record instead.
    if (['network', 'service-not-allowed', 'language-not-supported', 'audio-capture'].includes(e.error)) fallBack();
  };
  rec.onend = () => {
    if (fellBack) return;
    finish((finalText || heard).trim(), finalText || heard ? undefined : error);
  };

  cb.onStatus({ kind: 'listening', text: '' });
  try { rec.start(); } catch { fallBack(); }

  return {
    // Tap the mic again: use what we have so far, right now -- never
    // wait on the browser to confirm it stopped.
    stop: () => {
      if (fallbackSession) { fallbackSession.stop(); return; }
      try { rec.stop(); } catch { /* ignore */ }
      finish((finalText || heard).trim());
    },
    cancel: () => {
      if (fallbackSession) { fallbackSession.cancel(); return; }
      try { rec.abort(); } catch { /* ignore */ }
      finish('', 'aborted');
    },
  };
}

// ---- 2. our own recording, written down by Gemini ------------------

const MAX_SECONDS = 20;
const SILENCE_MS = 1800;   // stop by itself after this long quiet...
const SPEECH_LEVEL = 0.04; // ...once they've said something this loud

function startRecording(cb: VoiceCallbacks): VoiceSession {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let audioCtx: AudioContext | null = null;
  let timer = 0;
  let cancelled = false;
  let stopped = false;
  let finished = false;
  const chunks: Blob[] = [];

  const finish = (text: string, err?: string) => {
    if (finished) return;
    finished = true;
    cb.onDone(text, err);
  };

  const cleanup = () => {
    window.clearInterval(timer);
    stream?.getTracks().forEach((t) => t.stop());
    audioCtx?.close().catch(() => {});
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else { cleanup(); finish('', cancelled ? 'aborted' : 'no-speech'); }
  };

  cb.onStatus({ kind: 'recording', seconds: 0, level: 0 });

  navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
    stream = s;
    if (stopped) { cleanup(); finish('', 'aborted'); return; }

    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t));
    recorder = new MediaRecorder(s, type ? { mimeType: type } : undefined);
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      cleanup();
      if (cancelled) { finish('', 'aborted'); return; }
      const blob = new Blob(chunks, { type: recorder?.mimeType || type || 'audio/webm' });
      if (blob.size < 2000) { finish('', 'no-speech'); return; }
      cb.onStatus({ kind: 'transcribing' });
      try { finish((await cb.transcribe(blob)).trim()); }
      catch { finish('', 'transcribe-failed'); }
    };
    recorder.start(250);

    // Level meter + stop-on-silence.
    const started = Date.now();
    let spokeAt = 0;
    let lastLoud = 0;
    try {
      audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      audioCtx.createMediaStreamSource(s).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      timer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const level = Math.sqrt(sum / buf.length);
        const now = Date.now();
        if (level > SPEECH_LEVEL) { lastLoud = now; if (!spokeAt) spokeAt = now; }
        cb.onStatus({ kind: 'recording', seconds: Math.floor((now - started) / 1000), level: Math.min(1, level * 8) });
        if ((spokeAt && now - lastLoud > SILENCE_MS) || now - started > MAX_SECONDS * 1000) stop();
      }, 100);
    } catch {
      // No level meter available -- still stop at the time limit.
      timer = window.setInterval(() => {
        const secs = Math.floor((Date.now() - started) / 1000);
        cb.onStatus({ kind: 'recording', seconds: secs, level: 0.3 });
        if (secs >= MAX_SECONDS) stop();
      }, 250);
    }
  }).catch((e: { name?: string }) => {
    stopped = true;
    finish('', e?.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture');
  });

  return {
    stop,
    cancel: () => { cancelled = true; stop(); },
  };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// ---- reading answers aloud ------------------------------------------

let cachedVoice: SpeechSynthesisVoice | null = null;
function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  cachedVoice = voices.find((v) => v.lang === 'en-NG')
    ?? voices.find((v) => v.lang === 'en-GB')
    ?? voices.find((v) => v.lang.startsWith('en'))
    ?? null;
  return cachedVoice;
}

export function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, ''));
    const voice = pickVoice();
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = 0.95;
    synth.speak(u);
  } catch { /* speech not available -- text is still on screen */ }
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}
