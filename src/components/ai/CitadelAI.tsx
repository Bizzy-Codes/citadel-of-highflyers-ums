import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, X, Mic, Send, Volume2, VolumeX, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { DATA_TOOLS_BY_ROLE, SUGGESTIONS, pagesFor, type AiRole } from './catalog';
import { guidesFor, type Guide } from './guides';
import GuideOverlay from './GuideOverlay';
import { canListen, listen, speak, stopSpeaking } from './voice';
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

  const [open, setOpen] = useState(false);
  const [{ bubbles, contents }, setChat] = useState(load);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [guide, setGuide] = useState<{ g: Guide; step: number; waiting: boolean } | null>(null);
  const stopListening = useRef<() => void>(() => {});
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

  const say = useCallback((text: string, error = false) => {
    setChat((c) => ({ ...c, bubbles: [...c.bubbles, { from: 'bot', text, error }] }));
    if (voiceOnRef.current && !error) speak(text);
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
    say(text);
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
    if (guide && !guide.waiting && voiceOnRef.current) speak(guide.g.steps[guide.step].text);
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
      return { result: { ok: true, opened: page.label }, needsReply: false, note: `Opening ${page.label.toLowerCase()}.` };
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
    setInput('');
    let history: Content[] = [...contents, { role: 'user', parts: [...pending.current, { text: q }] }];
    pending.current = [];
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
        if (!replyText && notes.length) say(notes.join(' '));
        break;
      }
    } finally {
      setChat((c) => ({ ...c, contents: history }));
      setBusy(false);
    }
  }, [busy, contents, context, runTool, say]);

  // ---- voice -------------------------------------------------------

  const toggleMic = () => {
    if (listening) { stopListening.current(); return; }
    stopSpeaking();
    setVoiceOn(true);
    setListening(true);
    stopListening.current = listen(
      (t) => setInput(t),
      (finalText, err) => {
        setListening(false);
        if (finalText) ask(finalText);
        else if (err === 'not-allowed' || err === 'service-not-allowed') say('Please allow the microphone in your browser, then tap the mic again.', true);
        else if (err && err !== 'aborted' && err !== 'no-speech') say("I couldn't hear that. Please tap the mic and try again, or type.", true);
      },
    );
  };

  const reset = () => {
    stopSpeaking();
    pending.current = [];
    setChat({ bubbles: [], contents: [] });
  };

  const openPanel = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const suggestions = SUGGESTIONS[role];
  const firstName = currentUser?.name?.split(' ')[0];
  const greeting = firstName
    ? `Hello ${firstName.charAt(0) + firstName.slice(1).toLowerCase()}! I'm Citadel AI. What would you like to do?`
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
            <button type="button" className="cai-icon" onClick={() => { setOpen(false); stopSpeaking(); }} aria-label="Close">
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

          <form className="cai-input" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            {canListen() && (
              <button type="button" className={`cai-mic${listening ? ' on' : ''}`} onClick={toggleMic}
                aria-label={listening ? 'Stop listening' : 'Speak to Citadel AI'}>
                <Mic size={19} />
              </button>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? 'Listening…' : 'Ask me anything…'}
              maxLength={500}
              aria-label="Message Citadel AI"
            />
            <button type="submit" className="cai-send" disabled={busy || !input.trim()} aria-label="Send">
              <Send size={17} />
            </button>
          </form>
        </section>
      )}
    </>
  );
};

export default CitadelAI;
