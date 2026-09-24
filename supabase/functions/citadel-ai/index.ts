// Citadel AI -- the website/portal helper. The browser sends the
// conversation so far plus where the visitor is and what they're allowed
// to open; this function adds the school facts and rules, asks Gemini,
// and hands back Gemini's reply, which may include "function calls"
// (open a page, start a guided walkthrough, look up the pupil's
// assignments...). The browser carries those out -- data lookups run
// there under the visitor's own login, so the AI can never see anything
// the visitor couldn't already see themselves.
//
// It also turns voice recordings into words (for browsers whose own
// speech recognition doesn't work), and keeps a shared store of answers
// to general questions so repeat questions come back instantly
// (ai_answer_cache, patch_32).
//
// The Gemini key lives in the GEMINI_API_KEY secret and never leaves
// this function. GEMINI_MODEL optionally overrides the model.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SCHOOL_FACTS } from './knowledge.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Changes whenever knowledge.ts (or the rules below) change, which
// retires every stored answer at once.
const PROMPT_VERSION = 'v3';
const FACTS_VERSION = (await sha256(PROMPT_VERSION + SCHOOL_FACTS)).slice(0, 16);
const CACHE_DAYS = 7;
// Tried in order. The free tier often answers "high demand" (503) for
// one model while another is fine, so a busy or missing model just
// means trying the next.
const MODELS = [Deno.env.get('GEMINI_MODEL'), 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest']
  .filter((m): m is string => !!m);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Lookups the browser knows how to run. Anything else a client asks
// for is dropped, so this endpoint can't be repurposed.
const DATA_TOOLS: Record<string, string> = {
  get_my_assignments: "The signed-in user's assignments (for a pupil: what's been set for their class, due dates, and whether they've submitted; for a teacher: what they've posted). Use for 'do I have assignment', 'homework', 'wetin I go do today'.",
  get_school_calendar: "This term's school calendar: term name, start date, number of weeks, and the calendar table (holidays, exams, events).",
  get_my_profile: "The signed-in user's own name, login ID, role and class.",
  get_my_tests: "Tests for the signed-in user's class (published ones a pupil can take, or a teacher's own tests).",
  get_my_timetable: "The signed-in pupil's class timetable.",
};

interface PageRef { key: string; label: string }
interface ClientContext {
  path?: string;
  signedIn?: boolean;
  role?: string;
  name?: string;
  className?: string;
  pages?: PageRef[];
  guides?: PageRef[];
  dataTools?: string[];
  today?: string;
}

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

function systemPrompt(ctx: ClientContext) {
  const who = ctx.signedIn
    ? `The visitor is signed in as ${clip(ctx.name, 80)} (role: ${clip(ctx.role, 20)}${ctx.className ? `, class: ${clip(ctx.className, 40)}` : ''}).`
    : 'The visitor is NOT signed in (a parent, pupil, teacher or member of the public on the website).';
  return `You are Citadel AI, the friendly helper built into the website and portal of Citadel of Highflyers Int'l Academy in Jos, Nigeria.

WHO YOU TALK TO: parents, young pupils and teachers. Many are not confident with technology or English. People may type or speak very briefly, with spelling mistakes, broken English or Nigerian Pidgin ("how i go register my pikin", "assignment", "calendar abeg"). Work out what they most likely mean and act on it. Only ask a question back when you truly cannot guess.

HOW YOU HELP -- prefer DOING over explaining:
- If they want to go somewhere ("take me to", "open", "where is", "show me"), call open_page straight away.
- If they want to do a task with several steps (sign up, register a child, log in, apply for admission, reset password), call start_guide. The guide opens the right page and points at each box for them.
- If they ask about their own things (assignments, tests, calendar, timetable, their class), call the matching get_ lookup first, then answer from the result. Often also open the page so they can see it.
- When they ASK something (how much, when, what, who, is there...), always answer it in words in the same reply, even if you also open a page. Never reply with only an action to a question.
- For questions about the school, answer from SCHOOL FACTS below. If the answer isn't there, say you're not sure and give the school's WhatsApp/phone number. Never make up fees, dates or rules.
- "Register" can mean two things: for a teacher who is signed in it usually means the daily attendance register; for everyone else it means creating an account (sign up).
- Things that need signing in (assignments, results, calendar...) when the visitor is not signed in: say they need to log in first and offer the log-in guide.

HOW YOU WRITE: very short and simple -- one to three short sentences, no long lists, no markdown symbols (your replies are also read aloud). Warm and respectful. Reply in the language the user used (English or Pidgin). Only use the pages and guides listed in your tools; never invent links.

TODAY: ${clip(ctx.today, 40)} (Nigeria time).
CURRENT PAGE: ${clip(ctx.path, 120)}
${who}

SCHOOL FACTS:
${SCHOOL_FACTS}`;
}

function toolDeclarations(ctx: ClientContext) {
  const pages = (ctx.pages ?? []).slice(0, 60);
  const guides = (ctx.guides ?? []).slice(0, 20);
  const decls: unknown[] = [];
  if (pages.length) {
    decls.push({
      name: 'open_page',
      description: 'Open a page of the website or portal for the visitor. Pages: ' +
        pages.map((p) => `${clip(p.key, 40)} = ${clip(p.label, 80)}`).join('; '),
      parameters: {
        type: 'OBJECT',
        properties: { page: { type: 'STRING', enum: pages.map((p) => clip(p.key, 40)) } },
        required: ['page'],
      },
    });
  }
  if (guides.length) {
    decls.push({
      name: 'start_guide',
      description: 'Start a step-by-step walkthrough that opens the right page and highlights each box/button to fill or press. Guides: ' +
        guides.map((g) => `${clip(g.key, 40)} = ${clip(g.label, 80)}`).join('; '),
      parameters: {
        type: 'OBJECT',
        properties: { guide: { type: 'STRING', enum: guides.map((g) => clip(g.key, 40)) } },
        required: ['guide'],
      },
    });
  }
  for (const name of (ctx.dataTools ?? [])) {
    if (DATA_TOOLS[name]) decls.push({ name, description: DATA_TOOLS[name] });
  }
  return decls.length ? [{ functionDeclarations: decls }] : undefined;
}

type GeminiResult =
  | { ok: true; content: { role: string; parts: Record<string, unknown>[] }; model: string }
  | { ok: false; status: number };

// Asks Gemini, moving down the model list whenever one is busy or gone.
// Thinking is kept "low": these are short, simple answers, and deep
// thinking was most of the wait. A model that doesn't understand the
// setting gets the request again without it.
async function callGemini(payload: Record<string, unknown>): Promise<GeminiResult> {
  let lastError = 'No model available';
  for (const model of MODELS) {
    for (const thinking of [true, false]) {
      const body = thinking
        ? { ...payload, generationConfig: { ...(payload.generationConfig as object), thinkingConfig: { thinkingLevel: 'low' } } }
        : payload;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const content = data?.candidates?.[0]?.content ?? { role: 'model', parts: [] };
        if (!content.role) content.role = 'model';
        if (!content.parts) content.parts = [];
        return { ok: true, content, model };
      }
      const detail = JSON.stringify(data).slice(0, 300);
      if (res.status === 400 && thinking && /think/i.test(detail)) continue; // retry without the setting
      if (res.status === 404 || res.status === 429 || res.status >= 500) {
        lastError = `${model}: ${res.status} ${detail}`;
        console.error('gemini unavailable, trying next model', lastError);
        break;
      }
      console.error('gemini error', model, res.status, detail);
      return { ok: false, status: 502 };
    }
  }
  console.error('all models failed', lastError);
  return { ok: false, status: 429 };
}

const failure = (status: number) => status === 429
  ? json({ error: 'busy' }, 429)
  : json({ error: 'The AI service had a problem. Please try again.' }, 502);

// ---- voice recordings -> words -----------------------------------------

const AUDIO_TYPES = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|aac|m4a|x-m4a)(;.*)?$/;

async function transcribe(audio: { mimeType?: string; data?: string }) {
  const mimeType = String(audio.mimeType ?? '').toLowerCase();
  const data = String(audio.data ?? '');
  if (!AUDIO_TYPES.test(mimeType) || !data) return json({ error: 'Bad audio' }, 400);
  // ~20 seconds of compressed speech is well under 1 MB.
  if (data.length > 2_000_000) return json({ error: 'Recording too long' }, 413);

  const result = await callGemini({
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mimeType.split(';')[0], data } },
        { text: 'Write down exactly what the speaker says, in the words they use (English or Nigerian Pidgin). Output only those words, nothing else. If nobody speaks, output nothing.' },
      ],
    }],
    generationConfig: { temperature: 0, maxOutputTokens: 400 },
  });
  if (!result.ok) return failure(result.status);
  const text = result.content.parts.map((p) => (typeof p.text === 'string' && !p.thought ? p.text : '')).join(' ').trim();
  return json({ text });
}

// ---- natural voice (answers read aloud) ---------------------------------
// The browser's built-in voices sound flat and robotic, so answers are
// spoken by Gemini's text-to-speech instead: a warm, clear American
// voice at a child-friendly pace. The browser falls back to its own
// voice if this fails. Model names change often, so the TTS model is
// looked up from Google's model list rather than hard-coded.

const TTS_VOICES = [Deno.env.get('GEMINI_TTS_VOICE'), 'Sulafat', 'Kore'].filter((v): v is string => !!v);
let ttsModels: string[] | null = null;

async function findTtsModels(): Promise<string[]> {
  if (ttsModels) return ttsModels;
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': GEMINI_API_KEY },
  });
  const data = await res.json().catch(() => ({}));
  const names: string[] = (data?.models ?? [])
    .map((m: { name?: string }) => String(m.name ?? '').replace(/^models\//, ''))
    .filter((n: string) => /tts/i.test(n));
  // Flash before Pro (faster), newest first.
  names.sort((a, b) => Number(/pro/i.test(a)) - Number(/pro/i.test(b)) || b.localeCompare(a));
  ttsModels = names;
  return names;
}

// Saved clips (patch_34): answers that are the same for everyone are
// voiced once and kept, because generating takes 7-16 s on the free tier.
const clipPath = async (say: string) => `${(await sha256(`${TTS_VOICES[0]}|${say}`)).slice(0, 40)}.wav`;

async function savedClip(say: string): Promise<string | null> {
  const { data } = await db.storage.from('ai-voice').download(await clipPath(say));
  if (!data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function saveClip(say: string, base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const { error } = await db.storage.from('ai-voice').upload(await clipPath(say), bytes, { contentType: 'audio/wav', upsert: true });
  if (error) console.error('voice clip not saved', error.message);
}

// Answers are voiced a sentence or two at a time. KEEP IN SYNC with
// splitForSpeech in src/components/ai/speak.ts -- saved clips are found
// by their exact text.
function splitForSpeech(text: string): string[] {
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

async function tts(text: unknown, share: unknown) {
  const say = String(text ?? '').replace(/[*_#`]/g, '').trim().slice(0, 700);
  if (!say) return json({ error: 'Nothing to say' }, 400);
  if (share === true) {
    const saved = await savedClip(say).catch(() => null);
    if (saved) return json({ audio: saved, mimeType: 'audio/wav', saved: true });
  }
  const made = await generateClip(say);
  if (!made) return json({ error: 'busy' }, 429);
  // Only clips the browser marked as the same for everyone are kept.
  // The format must be WAV for the saved copy to play back correctly.
  if (share === true && /wav/i.test(made.mimeType)) await saveClip(say, made.audio);
  return json(made);
}

// Voices every FAQ answer ahead of time, so even the first person to
// ask hears the natural voice straight away. Stops quietly when the
// free-tier limit is reached; the next run carries on.
async function prerenderVoices(budgetMs = 100_000) {
  // The app's fixed lines, queued by the admin page (patch_35), most-used
  // first -- then every FAQ answer, in case one was added or edited since.
  const { data: queued } = await db.from('ai_voice_queue').select('text').order('priority').order('created_at').limit(2000);
  const { data: faqs } = await db.from('ai_faq').select('answer').eq('enabled', true);
  const pieces = [...new Set([
    ...(queued ?? []).map((q) => String(q.text)),
    ...(faqs ?? []).flatMap((f) => splitForSpeech(String(f.answer).replace(/[*_#`]/g, '').trim())),
  ])];
  const { data: files } = await db.storage.from('ai-voice').list('', { limit: 5000 });
  const saved = new Set((files ?? []).map((f) => f.name));
  let made = 0, had = 0;
  // A function run is cut off after ~150 s; stop well before and let the
  // next run (nightly, or the admin button) carry on.
  const stopAt = Date.now() + budgetMs;
  let outOfAllowance = false;
  for (const p of pieces) {
    if (saved.has(await clipPath(p))) { had++; continue; }
    // Keep counting what's already saved, but stop recording once time
    // or the day's free allowance runs out.
    if (outOfAllowance || Date.now() > stopAt) continue;
    const clip = await generateClip(p);
    if (!clip) { outOfAllowance = true; continue; }
    if (/wav/i.test(clip.mimeType)) { await saveClip(p, clip.audio); made++; }
  }
  return {
    pieces: pieces.length, already_saved: had, newly_saved: made,
    remaining: pieces.length - had - made, out_of_allowance: outOfAllowance,
  };
}

async function generateClip(say: string): Promise<{ audio: string; mimeType: string; model: string; voice: string } | null> {
  const models = await findTtsModels().catch(() => []);
  for (const model of models) {
    for (const voice of TTS_VOICES) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          // Only the words to say. The newer TTS models read any "Say
          // warmly: ..." style direction aloud as part of the text, so
          // the warmth comes from the voice chosen instead.
          contents: [{ role: 'user', parts: [{ text: say }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      const audio = data?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData)?.inlineData;
      if (res.ok && audio?.data) return { audio: audio.data, mimeType: audio.mimeType ?? 'audio/L16;rate=24000', model, voice };
      const detail = JSON.stringify(data).slice(0, 200);
      if (res.status === 400 && /voice/i.test(detail)) continue; // try the next voice
      console.error('tts unavailable', model, res.status, detail);
      break; // try the next model
    }
  }
  return null;
}

// ---- learning FAQs from real questions ----------------------------------
// Runs on the 1st and 15th (pg_cron, patch_33) or when an admin presses
// "Learn from questions now". Takes the last two weeks of questions that
// had to go to Gemini, groups the common ones, and writes ready answers
// into ai_faq so they're instant next time.

// KEEP IN SYNC with src/components/ai/catalog.ts and guides.ts.
const PAGE_KEYS = ['home', 'admissions', 'fees', 'founders', 'gallery', 'login', 'sign_up', 'staff_sign_up', 'forgot_password',
  'dashboard', 'assignments', 'tests', 'results', 'attendance', 'portal_fees', 'teacher_dashboard', 'attendance_register',
  'my_pupils', 'teacher_assignments', 'teacher_tests', 'report_cards', 'admin_dashboard', 'user_management',
  'admin_admissions', 'admin_payments', 'admin_calendar', 'admin_attendance', 'graduates', 'school_calendar', 'timetable',
  'messages', 'profile', 'support', 'pending', 'ai_admin'];
const GUIDE_KEYS = ['pupil_sign_up', 'staff_sign_up', 'log_in', 'forgot_password', 'apply_admission', 'submit_assignment', 'post_assignment'];
const ROLES = ['guest', 'student', 'teacher', 'teacher_pending', 'admin'];

async function isAllowedToRefresh(req: Request, token: unknown): Promise<boolean> {
  if (typeof token === 'string' && token.length > 20) {
    const { data } = await db.from('ai_settings').select('value').eq('key', 'refresh_token').maybeSingle();
    if (data?.value && data.value === token) return true;
  }
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return false;
  const { data: { user } } = await db.auth.getUser(jwt);
  if (!user) return false;
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return profile?.role === 'admin';
}

async function refreshFaq() {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data: rows, error } = await db.from('ai_questions')
    .select('question, role').eq('handled', 'gemini').gte('created_at', since).limit(3000);
  if (error) return json({ error: error.message }, 500);

  const groups = new Map<string, { question: string; roles: Set<string>; count: number }>();
  for (const r of rows ?? []) {
    const k = normalise(r.question);
    if (!k) continue;
    const g = groups.get(k) ?? { question: r.question, roles: new Set<string>(), count: 0 };
    g.count++; g.roles.add(r.role);
    groups.set(k, g);
  }
  const top = [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 80);
  if (!top.length) return json({ ok: true, added: 0, updated: 0, note: 'No questions to learn from yet.' });

  const { data: existing } = await db.from('ai_faq').select('id, phrases, source');
  const known = (existing ?? []).map((f) => f.phrases[0]).slice(0, 200);

  const result = await callGemini({
    systemInstruction: { parts: [{ text: `You maintain the FAQ for Citadel AI, the helper on a Nigerian primary school's website and portal. Answers are shown and read aloud to parents, young pupils and teachers.

SCHOOL FACTS (the only facts you may use):
${SCHOOL_FACTS}` }] },
    contents: [{ role: 'user', parts: [{ text: `Here are questions people asked in the last two weeks, with how many times and by which roles:
${top.map((g) => `- (${g.count}x, ${[...g.roles].join('/')}) ${g.question}`).join('\n')}

Group questions that mean the same thing. For each group asked 3 or more times in total, write one FAQ entry. Skip a group if:
- it's already covered by one of these existing FAQs: ${known.join(' | ')}
- the answer depends on the person's own data (their assignments, results, marks, attendance numbers) -- unless the whole answer is just opening the right page;
- the facts above don't contain the answer (never guess).

Each entry: phrases = 4 to 8 short lower-case ways people ask it (include the real wording, and Pidgin if they used it); roles = which of ${ROLES.join(', ')} it's for; answer = one to three short, simple, warm sentences with no markdown; open_page and/or start_guide only if helpful, chosen from pages [${PAGE_KEYS.join(', ')}] and guides [${GUIDE_KEYS.join(', ')}]; count = total times asked.` }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 6000,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            phrases: { type: 'ARRAY', items: { type: 'STRING' } },
            roles: { type: 'ARRAY', items: { type: 'STRING' } },
            answer: { type: 'STRING' },
            open_page: { type: 'STRING' },
            start_guide: { type: 'STRING' },
            count: { type: 'INTEGER' },
          },
          required: ['phrases', 'roles', 'answer', 'count'],
        },
      },
    },
  });
  if (!result.ok) return failure(result.status);

  let entries: { phrases: string[]; roles: string[]; answer: string; open_page?: string; start_guide?: string; count: number }[] = [];
  try {
    const raw = result.content.parts.map((p) => (typeof p.text === 'string' && !p.thought ? p.text : '')).join('');
    entries = JSON.parse(raw);
  } catch {
    return json({ error: 'The AI returned something unreadable. Try again later.' }, 502);
  }

  let added = 0, updated = 0;
  for (const e of Array.isArray(entries) ? entries : []) {
    const phrases = [...new Set((e.phrases ?? []).map(normalise).filter((p) => p && p.length <= 120))].slice(0, 12);
    const roles = (e.roles ?? []).filter((r) => ROLES.includes(r));
    const answer = String(e.answer ?? '').trim().slice(0, 500);
    if (phrases.length < 2 || !roles.length || !answer || (e.count ?? 0) < 3) continue;
    const row = {
      phrases, roles, answer,
      open_page: e.open_page && PAGE_KEYS.includes(e.open_page) ? e.open_page : null,
      start_guide: e.start_guide && GUIDE_KEYS.includes(e.start_guide) ? e.start_guide : null,
      source: 'learned', asked: e.count, updated_at: new Date().toISOString(),
    };
    // Update a learned entry that already covers one of these phrasings
    // rather than adding a near-duplicate. Built-in ones are left alone.
    const match = (existing ?? []).find((f) => f.source === 'learned' && f.phrases.some((p: string) => phrases.includes(p)));
    if (match) {
      await db.from('ai_faq').update({ ...row, phrases: [...new Set([...match.phrases, ...phrases])].slice(0, 16) }).eq('id', match.id);
      updated++;
    } else {
      await db.from('ai_faq').insert(row);
      added++;
    }
  }
  return json({ ok: true, looked_at: rows?.length ?? 0, added, updated });
}

// ---- shared answer store ------------------------------------------------

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Only a guest's opening question, in plain text, is shareable: it
// can't contain anything personal, and the answer doesn't depend on who
// asked. The key includes the pages/guides offered, since those shape
// the answer.
async function cacheKeyFor(contents: unknown[], ctx: ClientContext): Promise<{ key: string; question: string } | null> {
  if (ctx.signedIn || ctx.role !== 'guest' || contents.length !== 1) return null;
  const first = contents[0] as { role?: string; parts?: { text?: unknown }[] };
  if (first?.role !== 'user' || first.parts?.length !== 1 || typeof first.parts[0].text !== 'string') return null;
  const question = normalise(first.parts[0].text);
  if (!question || question.length > 200) return null;
  const offered = [...(ctx.pages ?? []).map((p) => p.key), '|', ...(ctx.guides ?? []).map((g) => g.key)].join(',');
  return { key: await sha256(`${FACTS_VERSION}|${offered}|${question}`), question };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!GEMINI_API_KEY) return json({ error: 'Citadel AI is not set up yet (missing GEMINI_API_KEY).' }, 500);

  let body: {
    contents?: unknown[]; context?: ClientContext; transcribe?: { mimeType?: string; data?: string };
    tts?: string; share?: boolean; refresh_faq?: boolean; prerender_voice?: boolean; token?: string;
  };
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  if (body.transcribe) return transcribe(body.transcribe);
  if (body.tts !== undefined) return tts(body.tts, body.share);
  if (body.refresh_faq || body.prerender_voice) {
    if (!(await isAllowedToRefresh(req, body.token))) return json({ error: 'Not allowed' }, 403);
    if (body.prerender_voice) return json({ ok: true, ...(await prerenderVoices()) });
    // Learn new answers, then voice them (and any not voiced yet).
    const learned = await refreshFaq();
    const voices = await prerenderVoices(50_000).catch(() => null); // learning already used some of the time
    const summary = await learned.json();
    return json({ ...summary, voices }, learned.status);
  }

  // Keep requests small: the last 30 turns, and no more than ~24k
  // characters overall. Stops the endpoint being used as a free
  // general-purpose chatbot or burning the free quota.
  const contents = Array.isArray(body.contents) ? body.contents.slice(-30) : [];
  if (!contents.length) return json({ error: 'Nothing to answer' }, 400);
  if (JSON.stringify(contents).length > 24_000) return json({ error: 'That conversation is too long. Start a new chat.' }, 413);
  const ctx = body.context ?? {};
  const started = Date.now();

  const cache = await cacheKeyFor(contents, ctx).catch(() => null);
  if (cache) {
    const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
    const { data: hit } = await db.from('ai_answer_cache')
      .select('content, hits').eq('key', cache.key).gte('created_at', since).maybeSingle();
    if (hit) {
      db.from('ai_answer_cache').update({ hits: (hit.hits ?? 0) + 1 }).eq('key', cache.key).then(() => {});
      return json({ content: hit.content, model: 'cache', ms: Date.now() - started });
    }
  }

  const result = await callGemini({
    systemInstruction: { parts: [{ text: systemPrompt(ctx) }] },
    contents,
    tools: toolDeclarations(ctx),
    // Room for the model's hidden "thinking" too -- the prompt, not this
    // limit, is what keeps the visible replies short.
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  });
  if (!result.ok) return failure(result.status);

  // Store it for the next person -- but only a complete answer that
  // says something (a reply with no words just opens a page, and the
  // browser asks again for words when it was a question).
  const parts = result.content.parts;
  const hasText = parts.some((p) => typeof p.text === 'string' && p.text.trim() && !p.thought);
  if (cache && hasText) {
    await db.from('ai_answer_cache').upsert({
      key: cache.key, question: cache.question, content: result.content, hits: 0, created_at: new Date().toISOString(),
    }).then(({ error }) => { if (error) console.error('cache write failed', error.message); });
  }

  return json({ content: result.content, model: result.model, ms: Date.now() - started });
});
