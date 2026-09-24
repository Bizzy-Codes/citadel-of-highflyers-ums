import { openingLine, pagesFor, type AiRole } from './catalog';
import { guidesFor } from './guides';
import { instantAnswer } from './instant';
import type { FaqRow } from './faq';
import { speechText, splitForSpeech } from './speak';

// Every fixed line Citadel AI can say -- page openings, guide steps, the
// built-in answers and the FAQ answers -- split exactly the way speak()
// splits them. The admin page queues these for recording
// (ai_voice_queue, patch_35), so each one plays in the natural voice
// straight away instead of being generated while the visitor waits.
// Lines with anyone's own details are never included.

const ROLES: AiRole[] = ['guest', 'student', 'teacher', 'teacher_pending', 'admin'];

// Lower = recorded first (the free tier only allows a few a day).
const PRIORITY: Record<AiRole, number> = { guest: 1, student: 3, teacher: 4, teacher_pending: 5, admin: 6 };

// Questions whose built-in answers are fixed text.
const SAMPLE_QUESTIONS = [
  'hi', 'thank you', 'how much are the school fees', 'where is the school located', 'what is the phone number',
  'register my child', 'register as teacher', 'apply for admission', 'log in', 'forgot my password',
  'post an assignment', 'submit my homework', 'open the register', 'do i have any assignment',
  'why cant i use the portal yet',
];

export interface VoiceLine { text: string; priority: number }

export function allVoiceLines(faqs: FaqRow[]): VoiceLine[] {
  const best = new Map<string, number>();
  const add = (text: string, priority: number) => {
    for (const piece of splitForSpeech(speechText(text))) {
      if (piece && (best.get(piece) ?? 99) > priority) best.set(piece, priority);
    }
  };

  for (const role of ROLES) {
    const p = PRIORITY[role];
    for (const q of SAMPLE_QUESTIONS) {
      const a = instantAnswer(q, { role, assignments: [], mySubmissions: {}, academicCalendar: null, today: '2000-01-01' });
      if (a && !a.personal) add(a.text, p);
    }
    for (const page of pagesFor(role)) add(openingLine(page), p);
    for (const g of guidesFor(role)) {
      for (const s of g.steps) add(s.text, p);
      add(g.doneText, p);
    }
  }
  add("Let's do it together. Follow the purple box.", 1);
  for (const f of faqs) add(f.answer, Math.min(...f.roles.map((r) => PRIORITY[r as AiRole] ?? 6)) + 1);

  return [...best.entries()].map(([text, priority]) => ({ text, priority })).sort((a, b) => a.priority - b.priority);
}
