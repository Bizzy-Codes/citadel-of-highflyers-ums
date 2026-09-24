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

  let body: { contents?: unknown[]; context?: ClientContext; transcribe?: { mimeType?: string; data?: string } };
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  if (body.transcribe) return transcribe(body.transcribe);

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
