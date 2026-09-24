import type { Assignment, AssignmentSubmission, AcademicCalendar } from '../../context/AuthContext';
import { FEE_SCHEDULES, feeTotals, naira } from '../../lib/feeSchedule';
import { openingLine, pagesFor, type AiRole } from './catalog';
import { guidesFor } from './guides';

// Answers Citadel AI can give on the spot, without asking Gemini:
// greetings, the suggested questions, and plain "take me to X" requests.
// These are the bulk of what people ask, and a Gemini round trip on the
// free tier takes several seconds, so handling them here makes the
// helper feel instant. Anything this doesn't recognise confidently goes
// to Gemini as normal -- when in doubt, return null.

export interface InstantAnswer {
  text: string;
  openPage?: string;   // a page key from catalog.ts
  startGuide?: string; // a guide key from guides.ts
  // Mentions the person's own details (their name, their assignments):
  // its voice clip must never be stored for others.
  personal?: boolean;
}

export interface InstantContext {
  role: AiRole;
  firstName?: string;
  assignments: Assignment[];
  mySubmissions: Record<string, AssignmentSubmission>;
  academicCalendar: AcademicCalendar | null;
  today: string; // YYYY-MM-DD, Lagos time
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (q: string, ...words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`).test(q));

const shortDate = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// ---- canned school answers -----------------------------------------

function feesAnswer(): InstantAnswer {
  const k = FEE_SCHEDULES.kinders;
  const g = FEE_SCHEDULES.graders;
  return {
    text: `School fees per term: Reception and Kindergarten pay ₦${naira(k.tuition)} tuition plus ₦${naira(k.registration)} registration (₦${naira(feeTotals(k).total)} with uniforms). `
      + `Pre-Grade and Graders pay ₦${naira(g.tuition)} tuition plus ₦${naira(g.registration)} registration (₦${naira(feeTotals(g).total)} with uniforms). I've opened the full fees sheet for you.`,
    openPage: 'fees',
  };
}

const CONTACT = 'You can call or WhatsApp the school on 0706 497 0003, or email citadelofhighflyersintlacademy@gmail.com.';
const ADDRESS = 'The school is at Rock Haven, opposite St. Murumba College, Jos, Plateau State.';

// Words people use for each page, for "take me to ..." requests.
const PAGE_WORDS: Record<string, string[]> = {
  home: ['home', 'homepage', 'main page', 'website'],
  admissions: ['admission', 'admissions', 'apply', 'application', 'enrol', 'enroll'],
  fees: ['fees', 'fee', 'school fees', 'price', 'prices', 'payment', 'financial'],
  founders: ['founder', 'founders', 'management', 'proprietor', 'owner', 'owners'],
  gallery: ['gallery', 'photos', 'pictures', 'pics'],
  login: ['login', 'log in', 'sign in', 'signin', 'portal'],
  sign_up: ['sign up', 'signup', 'create account', 'registration', 'register'],
  forgot_password: ['forgot password', 'reset password', 'password'],
  dashboard: ['dashboard', 'home', 'portal'],
  assignments: ['assignment', 'assignments', 'homework', 'home work'],
  tests: ['test', 'tests', 'exam', 'exams', 'quiz'],
  results: ['result', 'results', 'report card', 'report', 'scores', 'grades'],
  attendance: ['attendance'],
  portal_fees: ['fees', 'fee', 'payment', 'receipt', 'receipts'],
  teacher_dashboard: ['dashboard', 'home'],
  attendance_register: ['register', 'attendance', 'roll call', 'mark attendance'],
  my_pupils: ['pupils', 'students', 'class list', 'my class'],
  teacher_assignments: ['assignment', 'assignments', 'homework'],
  teacher_tests: ['test', 'tests', 'exam', 'exams', 'quiz'],
  report_cards: ['report card', 'report cards', 'results', 'result', 'scores'],
  admin_dashboard: ['dashboard', 'home'],
  user_management: ['users', 'user management', 'accounts'],
  admin_admissions: ['admission', 'admissions', 'applications', 'application'],
  admin_payments: ['payments', 'payment', 'receipts', 'receipt'],
  admin_calendar: ['academic calendar', 'term settings'],
  admin_attendance: ['attendance'],
  graduates: ['graduates', 'graduated'],
  school_calendar: ['calendar', 'school calendar', 'term calendar', 'holiday', 'holidays'],
  timetable: ['timetable', 'time table', 'schedule'],
  messages: ['messages', 'message', 'chat', 'inbox'],
  profile: ['profile', 'my details', 'my account', 'change password', 'my photo'],
  support: ['help', 'support'],
};

const NAV = /^(please |pls |abeg )?(open|show( me)?|take me( to)?|go( to)?|carry me( go)?|bring( me)?|i want( to)?( see| go( to)?| open)?|where( is|s| i fit see)?|find|navigate( to)?|view|see)\b/;

function matchPage(q: string, role: AiRole): string | null {
  const pages = pagesFor(role);
  const hits = pages.filter((p) => (PAGE_WORDS[p.key] ?? []).some((w) => has(q, w.replace(/ /g, '\\s')))) ;
  if (hits.length === 1) return hits[0].key;
  // Several pages share a word (e.g. "fees" is both the public sheet and
  // the portal fees page) -- prefer the one with the longest match.
  if (hits.length > 1) {
    const score = (key: string) => Math.max(...(PAGE_WORDS[key] ?? []).filter((w) => has(q, w.replace(/ /g, '\\s'))).map((w) => w.length));
    const sorted = hits.map((p) => ({ key: p.key, s: score(p.key) })).sort((a, b) => b.s - a.s);
    if (sorted[0].s > sorted[1].s) return sorted[0].key;
    // Tie: portal pages beat website pages for signed-in users.
    if (role !== 'guest') return sorted.find((h) => !['fees', 'home', 'login'].includes(h.key))?.key ?? null;
  }
  return null;
}

// ---- the matcher ------------------------------------------------------

export function instantAnswer(raw: string, ctx: InstantContext): InstantAnswer | null {
  const q = norm(raw);
  if (!q) return null;
  const words = q.split(' ').length;
  const { role } = ctx;
  const guides = new Set(guidesFor(role).map((g) => g.key));
  const pages = new Set(pagesFor(role).map((p) => p.key));

  // Greetings and thanks (short messages only).
  if (words <= 4 && /^(hi|hello|hey|hy|helo|good (morning|afternoon|evening|day)|how far|howfa|how you dey|wetin dey|morning|evening)\b/.test(q)) {
    return {
      text: `Hello${ctx.firstName ? ` ${ctx.firstName}` : ''}! How can I help you today? You can ask me a question, or say something like "take me to ${role === 'guest' ? 'admissions' : 'my assignments'}".`,
      personal: !!ctx.firstName,
    };
  }
  if (words <= 5 && /^(thanks|thank you|thank u|tanks|thx|ok thanks|okay thanks|e se|nagode|daalu)\b/.test(q)) {
    return { text: "You're welcome! I'm here if you need anything else." };
  }

  if (role === 'teacher_pending' && has(q, 'portal', 'use', 'access', 'approve', 'approved', 'approval', 'waiting', 'pending')) {
    return { text: 'Your staff account is waiting for the school admin to approve it. Once they do, you can use the portal. ' + CONTACT };
  }

  // School facts.
  if (has(q, 'fee', 'fees', 'school fees', 'how much', 'price', 'cost') && !has(q, 'receipt', 'upload', 'paid')) {
    if (role === 'guest' || pages.has('fees')) return feesAnswer();
  }
  if (has(q, 'where', 'address', 'location', 'located') && has(q, 'school', 'una', 'you', 'citadel', 'located', 'address', 'location') && !matchPage(q, role)) {
    return { text: `${ADDRESS} ${CONTACT}` };
  }
  if (words <= 8 && has(q, 'phone', 'number', 'whatsapp', 'contact', 'call', 'email') && !has(q, 'my')) {
    return { text: CONTACT };
  }

  // Tasks with a guided walkthrough.
  const wantsSignUp = has(q, 'register', 'registration', 'sign up', 'signup', 'create account', 'create an account', 'open account', 'enroll', 'enrol');
  if (wantsSignUp && role === 'guest') {
    if (has(q, 'teacher', 'staff') && guides.has('staff_sign_up')) {
      return { text: "Let's create your staff account together. Follow the purple box.", startGuide: 'staff_sign_up' };
    }
    if (has(q, 'admission', 'apply', 'new school', 'new pupil', 'new student') && guides.has('apply_admission')) {
      return { text: "Let's fill the admission form together. Follow the purple box.", startGuide: 'apply_admission' };
    }
    if (guides.has('pupil_sign_up')) {
      return { text: "Let's create the portal account together. Follow the purple box.", startGuide: 'pupil_sign_up' };
    }
  }
  if (role === 'teacher' && words <= 6 && has(q, 'register', 'attendance') && !has(q, 'sign up', 'create')) {
    return { text: 'Opening the attendance register.', openPage: 'attendance_register' };
  }
  if (role === 'guest' && has(q, 'log in', 'login', 'sign in', 'signin') && !has(q, 'forgot', 'reset')) {
    return { text: "Let's log you in. Follow the purple box.", startGuide: 'log_in' };
  }
  if (role === 'guest' && has(q, 'forgot', 'reset', 'lost') && has(q, 'password', 'pin', 'login')) {
    return { text: "Let's reset your password. Follow the purple box.", startGuide: 'forgot_password' };
  }
  if (role === 'guest' && has(q, 'apply', 'admission', 'admissions') && !has(q, 'how much', 'fee', 'fees', 'when')) {
    return { text: "Let's fill the admission form together. Follow the purple box.", startGuide: 'apply_admission' };
  }
  if (role === 'teacher' && has(q, 'post', 'give', 'set', 'create', 'add', 'new') && has(q, 'assignment', 'assignments', 'homework')) {
    return { text: "Let's post it together. Follow the purple box.", startGuide: 'post_assignment' };
  }
  if (role === 'student' && has(q, 'submit', 'upload', 'send', 'turn in') && has(q, 'assignment', 'homework', 'work')) {
    return { text: "Let's submit your work. Follow the purple box.", startGuide: 'submit_assignment' };
  }

  // A pupil's own assignments, answered from what the portal already loaded.
  if (role === 'student' && has(q, 'assignment', 'assignments', 'homework', 'home work')) {
    const todo = ctx.assignments.filter((a) => !ctx.mySubmissions[a.id] && (!a.dueDate || a.dueDate >= ctx.today));
    const list = todo.slice(0, 3).map((a) => `${a.subject}: ${a.title}${a.dueDate ? ` (due ${shortDate(a.dueDate)})` : ''}`).join('; ');
    const text = todo.length === 0
      ? "Good news, you don't have any assignment to do right now. I've opened your assignments page."
      : `Yes, you have ${todo.length} assignment${todo.length > 1 ? 's' : ''} to do. ${list}${todo.length > 3 ? ', and more' : ''}. I've opened your assignments page.`;
    return { text, openPage: 'assignments', personal: todo.length > 0 };
  }

  // The term calendar, for anyone who can see it.
  if (pages.has('school_calendar') && has(q, 'calendar', 'term', 'holiday', 'holidays', 'resume', 'resumption') && words <= 8) {
    const cal = ctx.academicCalendar;
    const start = cal?.termStartDate ? `, which started on ${shortDate(cal.termStartDate)}` : '';
    return {
      text: cal ? `Here is the school calendar for ${cal.term}${start}.` : "Here is the school calendar page. The school hasn't published this term's calendar yet.",
      openPage: 'school_calendar',
    };
  }

  // Plain navigation: "open my results", "take me to gallery", "profile".
  const page = (NAV.test(q) || words <= 2) ? matchPage(q, role) : null;
  if (page && pages.has(page)) {
    return { text: openingLine(pagesFor(role).find((p) => p.key === page)!), openPage: page };
  }

  return null;
}
