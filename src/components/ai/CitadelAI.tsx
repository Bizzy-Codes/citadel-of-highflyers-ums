import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, X, Mic, Send, Volume2, VolumeX, RotateCcw, Loader2, Square } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { DATA_TOOLS_BY_ROLE, SUGGESTIONS, openingLine, pagesFor, type AiRole } from './catalog';
import { guidesFor, type Guide } from './guides';
import GuideOverlay from './GuideOverlay';
import { blobToBase64, canUseVoice, startVoice, type VoiceSession, type VoiceStatus } from './voice';
import { prefetchVoices, speak, stopSpeaking, unlockAudio } from './speak';
import { instantAnswer } from './instant';
import { loadFaqs, matchFaq, type FaqRow } from './faq';

// Every question goes into the log admins see (words only, no name or
// account) -- it's what the two-weekly FAQ learning reads. Best effort:
// a failed log never gets in the visitor's way.
function logQuestion(question: string, role: AiRole, handled: 'instant' | 'faq' | 'cache' | 'gemini') {
  supabase.rpc('log_ai_question', { p_question: question.slice(0, 300), p_role: role, p_handled: handled })
    .then(({ error }) => { if (error) console.warn('Citadel AI: could not log question', error.message); });
}
import './CitadelAI.css';

// Citadel AI: the floating helper on every page of the website and
// portal. Visitors type or speak; the citadel-ai Edge Function asks
// Gemini, which answers and/or asks us to open a page, start a guided
// walkthrough, or look something up. We do those here, in the browser,
// under the visitor's own login -- see supabase/functions/citadel-ai.

// Gemini's conversation format, kept as-is so it can be sent back.
interface Part {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  [key: string]: unknown;
}
interface Content { role: 'user' | 'model'; parts: Part[] }

interface Bubble { from: 'user' | 'bot'; text: string; error?: boolean }

const STORE = 'citadel-ai-chat-v1';
const MAX_ROUNDS = 4;
const QUESTION = /\?|^(how|what|when|where|who|which|why|is|are|do|does|did|can|will|wetin|how much)\b/i;

function load(): { bubbles: Bubble[]; contents: Content[] } {
  try {
    const raw = sessionStorage.getItem(STORE);
    if (raw) return JSON.parse(raw);
  } catch { /* private mode etc. -- start fresh */ }
  return { bubbles: [], contents: [] };
}

const lagosToday = () => new Date().toLocaleDateString('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos',
});
const isoToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });

const CitadelAI = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { currentUser } = auth;
  const role: AiRole = (currentUser?.role as AiRole | undefined) ?? 'guest';
  // Names are stored in capitals ("ADA OKEKE"); greet as "Ada".
  const rawFirst = currentUser?.name?.split(' ')[0];
  const niceFirstName = rawFirst ? rawFirst.charAt(0) + rawFirst.slice(1).toLowerCase() : undefined;

  const [open, setOpen] = useState(false);
  const [{ bubbles, contents }, setChat] = useState(load);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState<VoiceStatus | null>(null);
  const listening = voice !== null;
  const [voiceOn, setVoiceOn] = useState(false);
  const [guide, setGuide] = useState<{ g: Guide; step: number; waiting: boolean } | null>(null);
  const voiceSession = useRef<VoiceSession | null>(null);
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  useEffect(() => { loadFaqs().then(setFaqs).catch(() => {}); }, []);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Function results waiting to go out with the visitor's next message
  // (Gemini needs every call answered before the conversation continues).
  const pending = useRef<Part[]>([]);
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;

  useEffect(() => {
    try { sessionStorage.setItem(STORE, JSON.stringify({ bubbles: bubbles.slice(-40), contents: contents.slice(-30) })); }
    catch { /* storage full or blocked -- chat still works this visit */ }
  }, [bubbles, contents]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, busy, open]);

  // share: the words are the same for everyone, so the voice clip can be
  // kept and reused (see speak.ts). Never for answers with personal details.
  const say = useCallback((text: string, error = false, share = false) => {
    setChat((c) => ({ ...c, bubbles: [...c.bubbles, { from: 'bot', text, error }] }));
    if (voiceOnRef.current && !error) speak(text, { share });
  }, []);

  // ---- guides ------------------------------------------------------

  const startGuide = useCallback((g: Guide) => {
    setGuide({ g, step: 0, waiting: false });
    setOpen(false);
    const here = location.pathname + location.search;
    if (here !== g.path) navigate(g.path);
  }, [location.pathname, location.search, navigate]);

  const finishGuide = useCallback((text: string) => {
    setGuide(null);
    setOpen(true);
    say(text, false, true);
  }, [say]);

  const nextStep = useCallback(() => {
    if (!guide) return;
    if (guide.step < guide.g.steps.length - 1) {
      setGuide({ ...guide, step: guide.step + 1, waiting: false });
    } else if (guide.g.donePath || guide.g.doneSelector) {
      // Finished the steps. We can tell when it's truly done (a page or
      // an element appears), so wait for that -- the last step stays up
      // in case the form bounced back with an error.
      setGuide({ ...guide, waiting: true });
    } else {
      finishGuide(guide.g.doneText);
    }
  }, [guide, finishGuide]);

  // Speak each step as it comes up.
  useEffect(() => {
    if (guide && !guide.waiting && voiceOnRef.current) speak(guide.g.steps[guide.step].text, { share: true });
  }, [guide?.g, guide?.step, guide?.waiting]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for the guide's finish line -- e.g. after "Register Now" the
  // visitor lands in the portal. Checked from the moment the guide
  // starts, since people often press the final button early.
  useEffect(() => {
    if (!guide) return;
    const g = guide.g;
    const check = () => {
      if (g.donePath && g.donePath(location.pathname)) { finishGuide(g.doneText); return true; }
      if (g.doneSelector && document.querySelector(g.doneSelector)) { finishGuide(g.doneText); return true; }
      return false;
    };
    if (check()) return;
    const id = window.setInterval(check, 400);
    return () => window.clearInterval(id);
  }, [guide, location.pathname, finishGuide]);

  // ---- things Gemini can ask us to do -----------------------------

  const runTool = useCallback((name: string, args: Record<string, unknown>): { result: Record<string, unknown>; needsReply: boolean; note?: string } => {
    if (name === 'open_page') {
      const page = pagesFor(role).find((p) => p.key === args.page);
      if (!page) return { result: { ok: false, error: `That page is not available for this visitor (role ${role}).` }, needsReply: true };
      navigate(page.path);
      return { result: { ok: true, opened: page.label }, needsReply: false, note: openingLine(page) };
    }
    if (name === 'start_guide') {
      const g = guidesFor(role).find((x) => x.key === args.guide);
      if (!g) return { result: { ok: false, error: 'That guide is not available for this visitor.' }, needsReply: true };
      startGuide(g);
      return { result: { ok: true, started: g.label }, needsReply: false, note: "Let's do it together. Follow the purple box." };
    }
    if (!DATA_TOOLS_BY_ROLE[role].includes(name)) {
      return { result: { error: 'Not available. The visitor may need to log in first.' }, needsReply: true };
    }
    const today = isoToday();
    if (name === 'get_my_profile') {
      return { result: {
        name: currentUser?.name, loginId: currentUser?.displayId, role: currentUser?.role,
        class: currentUser?.grade ?? currentUser?.assignedClass ?? 'not assigned yet',
      }, needsReply: true };
    }
    if (name === 'get_my_assignments') {
      const list = auth.assignments.slice(0, 25).map((a) => {
        const sub = auth.mySubmissions[a.id];
        return {
          title: a.title, subject: a.subject, class: a.className,
          due: a.dueDate ?? 'no due date', postedOn: a.createdAt?.slice(0, 10),
          ...(role === 'student' ? { submitted: !!sub, grade: sub?.grade ?? null } : {}),
        };
      });
      return { result: { today, count: auth.assignments.length, assignments: list }, needsReply: true };
    }
    if (name === 'get_school_calendar') {
      const cal = auth.academicCalendar;
      if (!cal) return { result: { published: false }, needsReply: true };
      const rows = cal.documentTables.flatMap((t) => [
        ...(t.heading ? [`# ${t.heading}`] : []),
        ...t.rows.map((r) => r.join(' | ')),
      ]).slice(0, 80);
      return { result: { today, term: cal.term, termStartDate: cal.termStartDate, totalWeeks: cal.totalWeeks, calendar: rows }, needsReply: true };
    }
    if (name === 'get_my_tests') {
      const list = auth.tests.slice(0, 20).map((t) => ({
        title: t.title, subject: t.subject, status: t.status, minutes: t.durationMinutes, class: t.className,
      }));
      return { result: { today, tests: list }, needsReply: true };
    }
    if (name === 'get_my_timetable') {
      const cls = currentUser?.grade ?? '';
      return { result: { class: cls, timetable: (auth.timetables[cls] ?? []).slice(0, 60) }, needsReply: true };
    }
    return { result: { error: 'Unknown action' }, needsReply: true };
  }, [role, navigate, startGuide, currentUser, auth]);

  // ---- talking to the server --------------------------------------

  const context = useCallback(() => ({
    path: location.pathname + location.search,
    signedIn: !!currentUser,
    role,
    name: currentUser?.name,
    className: currentUser?.grade ?? currentUser?.assignedClass,
    pages: pagesFor(role).map(({ key, label }) => ({ key, label })),
    guides: guidesFor(role).map(({ key, label }) => ({ key, label })),
    dataTools: DATA_TOOLS_BY_ROLE[role],
    today: lagosToday(),
  }), [location.pathname, location.search, currentUser, role]);

  const ask = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    stopSpeaking();
    unlockAudio();
    setInput('');
    let history: Content[] = [...contents, { role: 'user', parts: [...pending.current, { text: q }] }];
    pending.current = [];

    // Common requests are answered right here, with no wait: first the
    // FAQ list (built-in + learned from real questions), then the
    // built-in handlers. They still go into the history so Gemini has
    // the context for follow-ups.
    const fromFaq = matchFaq(q, role, faqs);
    const instant = fromFaq ?? instantAnswer(q, {
      role, firstName: niceFirstName, today: isoToday(),
      assignments: auth.assignments, mySubmissions: auth.mySubmissions, academicCalendar: auth.academicCalendar,
    });
    if (instant) {
      logQuestion(q, role, fromFaq ? 'faq' : 'instant');
      history = [...history, { role: 'model', parts: [{ text: instant.text }] }];
      setChat((c) => ({ contents: history, bubbles: [...c.bubbles, { from: 'user', text: q }] }));
      say(instant.text, false, !instant.personal);
      if (instant.openPage) runTool('open_page', { page: instant.openPage });
      if (instant.startGuide) runTool('start_guide', { guide: instant.startGuide });
      return;
    }

    setChat((c) => ({ contents: history, bubbles: [...c.bubbles, { from: 'user', text: q }] }));
    setBusy(true);

    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const { data, error } = await supabase.functions.invoke('citadel-ai', {
          body: { contents: history, context: context() },
        });
        if (error) {
          const status = (error as { context?: Response }).context?.status;
          say(status === 429
            ? 'Many people are asking me questions right now. Please try again in a minute.'
            : "Sorry, I couldn't answer just now. Please try again, or chat with the school on WhatsApp: 0706 497 0003.", true);
          // Drop the unanswered question so the next attempt starts clean.
          history = history.slice(0, -1);
          break;
        }
        if (round === 0) logQuestion(q, role, data?.model === 'cache' ? 'cache' : 'gemini');
        const reply: Content = data?.content ?? { role: 'model', parts: [] };
        // Keep every part exactly as sent -- newer models attach hidden
        // "thought signatures" that must come back unchanged.
        const parts = (reply.parts ?? []).filter((p) => Object.keys(p).length > 0);
        if (!parts.some((p) => p.text?.trim() || p.functionCall)) {
          say("Sorry, I didn't catch that. Could you say it another way?");
          break;
        }
        history = [...history, { role: 'model', parts }];

        const replyText = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join(' ').trim();
        const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
        if (replyText) say(replyText);

        if (!calls.length) break;
        const responses: Part[] = [];
        const notes: string[] = [];
        let needsReply = false;
        for (const call of calls) {
          const out = runTool(call.name, call.args ?? {});
          responses.push({ functionResponse: { name: call.name, response: out.result } });
          needsReply ||= out.needsReply;
          if (out.note) notes.push(out.note);
        }
        // A real question ("how much are the fees?") deserves words, not
        // just a page opening -- the lighter backup models sometimes skip
        // them, so ask once more.
        if (!replyText && round === 0 && QUESTION.test(q)) needsReply = true;
        if (needsReply) {
          history = [...history, { role: 'user', parts: responses }];
          continue;
        }
        // Only page moves / guides: no need for another round trip.
        // Hold the results until the visitor's next message.
        pending.current = responses;
        if (!replyText && notes.length) say(notes.join(' '), false, true);
        break;
      }
    } finally {
      setChat((c) => ({ ...c, contents: history }));
      setBusy(false);
    }
  }, [busy, contents, context, runTool, say, role, niceFirstName, faqs, auth.assignments, auth.mySubmissions, auth.academicCalendar]);

  // ---- voice -------------------------------------------------------

  const transcribe = useCallback(async (audio: Blob) => {
    const data = await blobToBase64(audio);
    const res = await supabase.functions.invoke('citadel-ai', {
      body: { transcribe: { mimeType: audio.type || 'audio/webm', data } },
    });
    if (res.error) throw res.error;
    return String(res.data?.text ?? '');
  }, []);

  // Keep the latest ask() for the voice callback, which outlives renders.
  const askRef = useRef(ask);
  askRef.current = ask;

  const toggleMic = () => {
    // Pressed again while listening: stop now and use what was heard.
    if (voiceSession.current) {
      voiceSession.current.stop();
      return;
    }
    stopSpeaking();
    unlockAudio();
    setVoiceOn(true);
    // Browsers only allow the microphone on secure (https) pages -- an
    // http:// address (e.g. opening a test copy by its Wi-Fi address on
    // a phone) can never use it, so say that rather than "unsupported".
    if (!window.isSecureContext) {
      say('The microphone only works on the secure (https) website. Please type your question here for now.', true);
      return;
    }
    voiceSession.current = startVoice({
      onStatus: (s) => {
        setVoice(s);
        if (s.kind === 'listening' && s.text) setInput(s.text);
      },
      onDone: (finalText, err) => {
        voiceSession.current = null;
        setVoice(null);
        if (finalText) { askRef.current(finalText); return; }
        setInput('');
        if (err === 'not-allowed') say('Please allow the microphone for this site in your browser settings, then tap the mic again.', true);
        else if (err === 'unsupported') say("Voice doesn't work in this browser. Please type your question instead.", true);
        else if (err === 'no-speech') say("I didn't hear anything. Tap the mic and speak, then tap it again when you finish.", true);
        else if (err && err !== 'aborted') say("I couldn't hear that clearly. Please tap the mic and try again, or type.", true);
      },
      transcribe,
    });
  };

  // Close the mic if the panel closes or the page unmounts mid-recording.
  useEffect(() => () => voiceSession.current?.cancel(), []);

  const reset = () => {
    stopSpeaking();
    pending.current = [];
    setChat({ bubbles: [], contents: [] });
  };

  const openPanel = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
    // Bring the voice for the suggested questions (and the guides they
    // start) onto the device now, so tapping one speaks immediately.
    const lines: string[] = [];
    for (const s of SUGGESTIONS[role]) {
      const a = matchFaq(s, role, faqs) ?? instantAnswer(s, {
        role, today: isoToday(), assignments: auth.assignments, mySubmissions: auth.mySubmissions, academicCalendar: auth.academicCalendar,
      });
      if (!a || a.personal) continue;
      lines.push(a.text);
      const g = a.startGuide && guidesFor(role).find((x) => x.key === a.startGuide);
      if (g) lines.push(...g.steps.map((st) => st.text));
    }
    prefetchVoices(lines).catch(() => {});
  };

  const suggestions = SUGGESTIONS[role];
  const greeting = niceFirstName
    ? `Hello ${niceFirstName}! I'm Citadel AI. What would you like to do?`
    : "Hello! I'm Citadel AI. Ask me anything about the school, or tap the mic and talk to me.";

  // Never during a test: it would be a way to get help, and the camera
  // preview already owns that corner.
  if (/^\/portal\/tests\/[^/]+/.test(location.pathname)) return null;

  return (
    <>
      {guide && (
        <GuideOverlay guide={guide.g} step={guide.step} onNext={nextStep} onStop={() => { setGuide(null); stopSpeaking(); }} />
      )}

      {guide && !open && (
        <div className="cai-guiding">
          <Sparkles size={16} aria-hidden="true" />
          <span>Citadel AI is guiding you</span>
          <button type="button" onClick={() => { setGuide(null); stopSpeaking(); }}>Stop</button>
        </div>
      )}

      {!open && !guide && (
        <button type="button" className="cai-fab" onClick={openPanel} aria-label="Open Citadel AI helper">
          <Sparkles size={20} aria-hidden="true" />
          <span>Citadel AI</span>
        </button>
      )}

      {open && (
        <section className="cai-panel" role="dialog" aria-label="Citadel AI">
          <header className="cai-head">
            <div className="cai-avatar"><Sparkles size={18} aria-hidden="true" /></div>
            <div className="cai-title">
              <strong>Citadel AI</strong>
              <span>{listening ? 'Listening…' : busy ? 'Thinking…' : 'Type or tap the mic'}</span>
            </div>
            <button type="button" className="cai-icon" onClick={() => { setVoiceOn((v) => !v); stopSpeaking(); }}
              aria-label={voiceOn ? 'Stop reading answers aloud' : 'Read answers aloud'} title={voiceOn ? 'Voice on' : 'Voice off'}>
              {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            {bubbles.length > 0 && (
              <button type="button" className="cai-icon" onClick={reset} aria-label="Start a new chat" title="New chat">
                <RotateCcw size={17} />
              </button>
            )}
            <button type="button" className="cai-icon" onClick={() => { setOpen(false); stopSpeaking(); voiceSession.current?.cancel(); }} aria-label="Close">
              <X size={19} />
            </button>
          </header>

          <div className="cai-list" ref={listRef}>
            <div className="cai-bubble bot">{greeting}</div>
            {bubbles.map((b, i) => (
              <div key={i} className={`cai-bubble ${b.from}${b.error ? ' error' : ''}`}>{b.text}</div>
            ))}
            {busy && <div className="cai-bubble bot cai-typing"><Loader2 size={14} className="animate-spin" /> Thinking…</div>}
          </div>

          {bubbles.length === 0 && (
            <div className="cai-chips">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
          )}

          {voice ? (
            // While the mic is on, the whole bar says so -- and the big
            // button stops it, always, straight away.
            <div className="cai-input cai-voicebar" aria-live="polite">
              {voice.kind === 'transcribing' ? (
                <>
                  <span className="cai-mic busy"><Loader2 size={19} className="animate-spin" /></span>
                  <span className="cai-voice-text">Getting your words…</span>
                </>
              ) : (
                <>
                  <button type="button" className="cai-mic on" onClick={toggleMic} aria-label="Stop and send">
                    <Square size={16} fill="currentColor" />
                  </button>
                  <span className="cai-voice-text">
                    {voice.kind === 'listening' && voice.text ? voice.text : 'Listening… speak now'}
                    <small>Tap the red button when you finish{voice.kind === 'recording' ? ` · 0:${String(voice.seconds).padStart(2, '0')}` : ''}</small>
                  </span>
                  {voice.kind === 'recording' && (
                    <span className="cai-level" aria-hidden="true">
                      {[0.3, 0.6, 1, 0.6, 0.3].map((w, i) => (
                        <i key={i} style={{ height: `${6 + Math.round(voice.level * w * 22)}px` }} />
                      ))}
                    </span>
                  )}
                  <button type="button" className="cai-icon cai-cancel" onClick={() => voiceSession.current?.cancel()} aria-label="Cancel">
                    <X size={18} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <form className="cai-input" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
              {(canUseVoice() || !window.isSecureContext) && (
                <button type="button" className="cai-mic" onClick={toggleMic} aria-label="Speak to Citadel AI" disabled={busy}>
                  <Mic size={19} />
                </button>
              )}
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything…"
                maxLength={500}
                aria-label="Message Citadel AI"
              />
              <button type="submit" className="cai-send" disabled={busy || !input.trim()} aria-label="Send">
                <Send size={17} />
              </button>
            </form>
          )}
        </section>
      )}
    </>
  );
};

export default CitadelAI;
