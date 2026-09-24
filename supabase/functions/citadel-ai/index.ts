// Citadel AI -- the website/portal helper. The browser sends the
// conversation so far plus where the visitor is and what they're allowed
// to open; this function adds the school facts and rules, asks Gemini,
// and hands back Gemini's reply, which may include "function calls"
// (open a page, start a guided walkthrough, look up the pupil's
// assignments...). The browser carries those out -- data lookups run
// there under the visitor's own login, so the AI can never see anything
// the visitor couldn't already see themselves.
//
// The Gemini key lives in the GEMINI_API_KEY secret and never leaves
// this function. GEMINI_MODEL optionally overrides the model.
import { SCHOOL_FACTS } from './knowledge.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!GEMINI_API_KEY) return json({ error: 'Citadel AI is not set up yet (missing GEMINI_API_KEY).' }, 500);

  let body: { contents?: unknown[]; context?: ClientContext };
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  // Keep requests small: the last 30 turns, and no more than ~24k
  // characters overall. Stops the endpoint being used as a free
  // general-purpose chatbot or burning the free quota.
  const contents = Array.isArray(body.contents) ? body.contents.slice(-30) : [];
  if (!contents.length) return json({ error: 'Nothing to answer' }, 400);
  if (JSON.stringify(contents).length > 24_000) return json({ error: 'That conversation is too long. Start a new chat.' }, 413);
  const ctx = body.context ?? {};

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt(ctx) }] },
    contents,
    tools: toolDeclarations(ctx),
    // Room for the model's hidden "thinking" too -- the prompt, not this
    // limit, is what keeps the visible replies short.
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  };

  const started = Date.now();
  let lastError = 'No model available';
  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (res.status === 404 || res.status === 429 || res.status >= 500) {
      lastError = `${model}: ${res.status} ${JSON.stringify(data).slice(0, 300)}`;
      console.error('gemini unavailable, trying next model', lastError);
      continue;
    }
    if (!res.ok) {
      console.error('gemini error', res.status, JSON.stringify(data).slice(0, 500));
      return json({ error: 'The AI service had a problem. Please try again.' }, 502);
    }
    const content = data?.candidates?.[0]?.content ?? { role: 'model', parts: [] };
    if (!content.role) content.role = 'model';
    return json({ content, model, ms: Date.now() - started });
  }
  console.error('all models failed', lastError);
  return json({ error: 'busy' }, 429);
});
