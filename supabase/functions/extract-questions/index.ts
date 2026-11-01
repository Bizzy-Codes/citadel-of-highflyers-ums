// Turns a photo, PDF or Word text of a teacher's questions into structured
// questions the portal can show to pupils (typed / multiple choice).
// Teachers and admins only (the caller's login is checked).
//
// Uses the same GEMINI_API_KEY secret as citadel-ai. The teacher always
// reviews and edits the result before anything reaches a pupil.
//
// Deploy WITH jwt verification (the default).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const MODELS = [Deno.env.get('GEMINI_MODEL'), 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest']
  .filter((m): m is string => !!m);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const MAX_BASE64 = 14_000_000; // about 10 MB of file
const MAX_TEXT = 60_000;
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

const INSTRUCTIONS = `You read a school teacher's questions (a photo of a handwritten or printed page, a scanned or typed PDF, or the text of a Word document) and list every QUESTION so a school website can show it to young pupils.

Rules:
- Keep each question's original wording. Only fix obvious spelling mistakes caused by reading handwriting or scanning. Never invent, add or reword questions.
- Keep the original order. Do not include the question number in the text (no "1." at the start).
- A question with printed choices such as A, B, C, D (or a), b), c)) is type "objective": put each choice in "options" with keys "A", "B", "C", ... and the choice text without its letter.
- Set "correctOption" ONLY when the document itself clearly marks the right answer (a tick, a circle, an answer key, "Answer: B"). Otherwise leave it empty. Never guess an answer.
- Everything else (short answers, fill-in-the-blank, essays, calculations, questions with parts a, b, c) is type "written". Keep sub-parts together inside one question's text, each on its own line.
- Fill-in-the-blank blanks: keep them as underscores.
- Ignore page headings, school names, names/date lines, marks totals and general instructions unless they are part of a question.
- Mathematics: write fractions as 1/2, powers as 2^3, multiplication as x or ×, in plain text.
- If you cannot find any question, return an empty list and explain in "note".`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          prompt: { type: 'STRING' },
          type: { type: 'STRING', enum: ['written', 'objective'] },
          options: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { key: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['key', 'text'] },
          },
          correctOption: { type: 'STRING' },
        },
        required: ['prompt', 'type'],
      },
    },
    note: { type: 'STRING' },
  },
  required: ['questions'],
};

async function askGemini(parts: Record<string, unknown>[]): Promise<{ ok: true; text: string } | { ok: false; status: number }> {
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.1 },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
      return { ok: true, text };
    }
    const detail = JSON.stringify(data).slice(0, 300);
    if (res.status === 404 || res.status === 429 || res.status >= 500) {
      console.error('gemini unavailable, trying next model', model, res.status, detail);
      continue;
    }
    console.error('gemini error', model, res.status, detail);
    return { ok: false, status: 502 };
  }
  return { ok: false, status: 429 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401);
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return json({ error: 'Invalid session' }, 401);
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: caller } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (caller?.role !== 'teacher' && caller?.role !== 'admin') return json({ error: 'Teachers only' }, 403);

  if (!GEMINI_API_KEY) return json({ error: 'The reading service is not set up yet.' }, 503);

  let body: { mimeType?: string; data?: string; text?: string };
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  let parts: Record<string, unknown>[];
  if (body.text !== undefined) {
    const text = String(body.text).trim();
    if (!text) return json({ error: 'The document has no text.' }, 400);
    if (text.length > MAX_TEXT) return json({ error: 'That document is too long. Please split it into smaller parts.' }, 400);
    parts = [{ text: `Here is the text of the document:\n\n${text}` }];
  } else if (body.data && body.mimeType) {
    if (!ALLOWED_MIME.test(body.mimeType)) return json({ error: 'Please use a photo (JPG/PNG), a PDF or a Word document.' }, 400);
    if (body.data.length > MAX_BASE64) return json({ error: 'That file is too big. Please use a smaller photo or PDF (under 10 MB).' }, 413);
    parts = [{ inlineData: { mimeType: body.mimeType, data: body.data } }, { text: 'List the questions in this document.' }];
  } else {
    return json({ error: 'Nothing to read.' }, 400);
  }

  const result = await askGemini(parts);
  if (!result.ok) {
    return json({ error: result.status === 429 ? 'The reading service is busy. Please try again in a minute.' : 'The reading service could not read that file. Try a clearer photo.' }, 503);
  }

  try {
    const parsed = JSON.parse(result.text) as { questions?: { prompt?: string; type?: string; options?: { key?: string; text?: string }[]; correctOption?: string }[]; note?: string };
    const questions = (parsed.questions ?? [])
      .map((q) => {
        const objective = q.type === 'objective' && (q.options?.length ?? 0) >= 2;
        const options = objective
          ? (q.options ?? []).map((o, i) => ({ key: (o.key || String.fromCharCode(65 + i)).toString().trim().toUpperCase().slice(0, 2), text: (o.text ?? '').toString().trim() }))
          : [];
        const correct = (q.correctOption ?? '').toString().trim().toUpperCase();
        return {
          prompt: (q.prompt ?? '').toString().trim(),
          type: objective ? 'objective' : 'written',
          options,
          correctOption: objective && options.some((o) => o.key === correct) ? correct : '',
        };
      })
      .filter((q) => q.prompt)
      .slice(0, 100);
    return json({ questions, note: parsed.note ?? '' });
  } catch {
    return json({ error: 'The reading service gave an unreadable answer. Please try again.' }, 502);
  }
});
