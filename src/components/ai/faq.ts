import { supabase } from '../../lib/supabaseClient';
import type { AiRole } from './catalog';
import type { InstantAnswer } from './instant';

// Ready-made answers from the ai_faq table (patch_33): built-in ones,
// plus ones the citadel-ai function learns every two weeks from what
// people actually ask. Loaded once, kept in the browser for a few hours,
// and matched here -- a hit is answered instantly with no Gemini call.

export interface FaqRow {
  id: number;
  phrases: string[];
  roles: string[];
  answer: string;
  open_page: string | null;
  start_guide: string | null;
}

const STORE = 'citadel-ai-faq-v1';
const MAX_AGE = 6 * 60 * 60 * 1000;
let memory: FaqRow[] | null = null;
let loading: Promise<FaqRow[]> | null = null;

export function loadFaqs(): Promise<FaqRow[]> {
  if (memory) return Promise.resolve(memory);
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null');
    if (saved && Date.now() - saved.at < MAX_AGE && Array.isArray(saved.rows)) {
      memory = saved.rows;
      return Promise.resolve(saved.rows);
    }
  } catch { /* storage blocked -- fetch instead */ }
  loading ??= (async () => {
    const { data } = await supabase.from('ai_faq')
      .select('id, phrases, roles, answer, open_page, start_guide').eq('enabled', true);
    const rows = (data ?? []) as FaqRow[];
    memory = rows;
    try { localStorage.setItem(STORE, JSON.stringify({ at: Date.now(), rows })); } catch { /* ignore */ }
    return rows;
  })().finally(() => { loading = null; });
  return loading;
}

// Words that don't change what's being asked.
const FILLER = new Set(['a', 'an', 'the', 'i', 'me', 'my', 'mine', 'we', 'our', 'you', 'your', 'una', 'do', 'does', 'did', 'can',
  'could', 'please', 'pls', 'abeg', 'how', 'what', 'is', 'are', 'am', 'be', 'to', 'of', 'for', 'on', 'in', 'at', 'it', 'this',
  'that', 'want', 'wan', 'go', 'fit', 'will', 'would', 'let', 'just', 'now', 'so', 'and', 'or', 'with', 'where', 'there', 'get',
  'dey', 'na', 'o', 'oh', 'sir', 'ma', 'madam', 'kindly', 'help', 'need', 'like', 'which', 'when', 'from', 'about', 'his', 'her',
  'their', 'him', 'she', 'he', 'have', 'has', 'any', 'some']);

// Different words for the same thing.
const SAME: Record<string, string> = {
  check: 'see', view: 'see', show: 'see', open: 'see', look: 'see', find: 'see',
  children: 'child', kid: 'child', kids: 'child', pikin: 'child', son: 'child', daughter: 'child', ward: 'child', student: 'child', pupil: 'child',
  results: 'result', report: 'result', grades: 'result', scores: 'result', score: 'result',
  fees: 'fee', payment: 'pay', paid: 'pay', paying: 'pay',
  login: 'log', signin: 'log', sign: 'log',
  teachers: 'teacher', uniforms: 'uniform', documents: 'document', classes: 'class', passwords: 'password',
};

function meaningful(text: string): Set<string> {
  const words = text.toLowerCase().replace(/'s\b/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  const out = new Set<string>();
  for (const w of words) {
    if (!w || FILLER.has(w)) continue;
    out.add(SAME[w] ?? w);
  }
  return out;
}

function similarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return common / (a.size + b.size - common);
}

// Needs a close match: most of the meaningful words the same. Loose
// matches go to Gemini instead, which is slower but won't misfire.
export function matchFaq(question: string, role: AiRole, faqs: FaqRow[]): InstantAnswer | null {
  const q = meaningful(question);
  if (!q.size || q.size > 10) return null;
  let best: { row: FaqRow; score: number } | null = null;
  for (const row of faqs) {
    if (!row.roles.includes(role)) continue;
    for (const p of row.phrases) {
      const score = similarity(q, meaningful(p));
      if (!best || score > best.score) best = { row, score };
    }
  }
  if (!best || best.score < 0.75) return null;
  return {
    text: best.row.answer,
    openPage: best.row.open_page ?? undefined,
    startGuide: best.row.start_guide ?? undefined,
  };
}
