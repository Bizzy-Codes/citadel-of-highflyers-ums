// Voice in and out using the browser's own speech features -- free, no
// extra service. Speech-to-text works in Chrome, Edge, Samsung Internet
// and Safari; not in Firefox, where the mic button simply isn't shown.

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => recognitionCtor() !== null;

// Listens once. onText gets the words as they're heard; onDone gets the
// final sentence (empty if nothing was caught).
export function listen(onText: (text: string) => void, onDone: (text: string, error?: string) => void) {
  const Ctor = recognitionCtor();
  if (!Ctor) { onDone('', 'unsupported'); return () => {}; }
  const rec = new Ctor();
  // Nigerian English first -- it copes far better with local names and
  // accents than the US default.
  rec.lang = 'en-NG';
  rec.interimResults = true;
  rec.continuous = false;
  let finalText = '';
  let error: string | undefined;
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    onText((finalText + interim).trim());
  };
  rec.onerror = (e) => { error = e.error; };
  rec.onend = () => onDone(finalText.trim(), error);
  try { rec.start(); } catch { onDone('', 'start-failed'); }
  return () => { try { rec.stop(); } catch { /* already stopped */ } };
}

let cachedVoice: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined && cachedVoice !== null) return cachedVoice;
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
