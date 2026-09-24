// What Citadel AI is allowed to do, per role. The server builds Gemini's
// tool list from whatever this sends, and the browser re-checks every
// request against it before acting -- so the AI can only open pages and
// start guides that the visitor could reach by clicking anyway.

export type AiRole = 'guest' | 'student' | 'teacher' | 'teacher_pending' | 'admin';

export interface AiPage {
  key: string;
  label: string;
  path: string;
  roles: AiRole[];
}

const EVERYONE: AiRole[] = ['guest', 'student', 'teacher', 'teacher_pending', 'admin'];
const GUEST: AiRole[] = ['guest'];
const PUPIL: AiRole[] = ['student'];
const TEACHER: AiRole[] = ['teacher'];
const ADMIN: AiRole[] = ['admin'];
const PUPIL_TEACHER: AiRole[] = ['student', 'teacher'];
const SIGNED_IN: AiRole[] = ['student', 'teacher', 'admin'];

export const PAGES: AiPage[] = [
  // Public website
  { key: 'home', label: 'Website home page', path: '/', roles: EVERYONE },
  { key: 'admissions', label: 'Apply for admission (new pupils)', path: '/admissions', roles: EVERYONE },
  { key: 'fees', label: 'School fees sheet (Financial Involvement)', path: '/fees', roles: EVERYONE },
  { key: 'founders', label: 'Founders and management team', path: '/founders', roles: EVERYONE },
  { key: 'gallery', label: 'Photo gallery', path: '/gallery', roles: EVERYONE },
  { key: 'login', label: 'Portal log in page', path: '/login', roles: GUEST },
  { key: 'sign_up', label: 'Create a portal account (sign up / register a pupil)', path: '/login?register=student', roles: GUEST },
  { key: 'staff_sign_up', label: 'Create a staff (teacher) account', path: '/login?register=staff', roles: GUEST },
  { key: 'forgot_password', label: 'Forgot password / reset password', path: '/forgot-password', roles: GUEST },

  // Portal -- pupils
  { key: 'dashboard', label: 'My portal dashboard', path: '/portal', roles: PUPIL },
  { key: 'assignments', label: 'My assignments (homework)', path: '/portal/assignments', roles: PUPIL },
  { key: 'tests', label: 'My tests', path: '/portal/tests', roles: PUPIL },
  { key: 'results', label: 'My results and report cards', path: '/portal/results', roles: PUPIL },
  { key: 'attendance', label: 'My attendance', path: '/portal/attendance', roles: PUPIL },
  { key: 'portal_fees', label: 'My fees and payment receipts', path: '/portal/fees', roles: PUPIL },

  // Portal -- teachers
  { key: 'teacher_dashboard', label: 'Teacher dashboard', path: '/portal/teacher', roles: TEACHER },
  { key: 'attendance_register', label: 'Daily attendance register (mark pupils present/absent)', path: '/portal/teacher/register', roles: TEACHER },
  { key: 'my_pupils', label: 'My pupils (class list)', path: '/portal/teacher/students', roles: TEACHER },
  { key: 'teacher_assignments', label: 'Post and mark assignments', path: '/portal/teacher/assignments', roles: TEACHER },
  { key: 'teacher_tests', label: 'Create and manage tests', path: '/portal/teacher/tests', roles: TEACHER },
  { key: 'report_cards', label: 'Enter results / report cards', path: '/portal/teacher/results', roles: TEACHER },

  // Portal -- admins
  { key: 'admin_dashboard', label: 'Admin dashboard', path: '/portal/admin', roles: ADMIN },
  { key: 'user_management', label: 'User management (pupils and staff accounts)', path: '/portal/admin/users', roles: ADMIN },
  { key: 'admin_admissions', label: 'Admission applications', path: '/portal/admin/admissions', roles: ADMIN },
  { key: 'admin_payments', label: 'Payment receipts', path: '/portal/admin/payments', roles: ADMIN },
  { key: 'admin_calendar', label: 'Set the academic calendar / term', path: '/portal/admin/calendar', roles: ADMIN },
  { key: 'admin_attendance', label: 'Attendance overview', path: '/portal/admin/attendance', roles: ADMIN },
  { key: 'graduates', label: 'Graduated pupils', path: '/portal/admin/graduates', roles: ADMIN },

  // Portal -- shared
  { key: 'school_calendar', label: 'School calendar for this term', path: '/portal/calendar', roles: PUPIL_TEACHER },
  { key: 'timetable', label: 'Class timetable', path: '/portal/timetable', roles: SIGNED_IN },
  { key: 'messages', label: 'Messages', path: '/portal/messages', roles: SIGNED_IN },
  { key: 'profile', label: 'My profile (change photo, details, password)', path: '/portal/profile', roles: SIGNED_IN },
  { key: 'support', label: 'Help and support', path: '/portal/support', roles: SIGNED_IN },
  { key: 'pending', label: 'Waiting for approval page', path: '/portal/pending', roles: ['teacher_pending'] },
];

export const DATA_TOOLS_BY_ROLE: Record<AiRole, string[]> = {
  guest: [],
  teacher_pending: ['get_my_profile'],
  student: ['get_my_assignments', 'get_school_calendar', 'get_my_profile', 'get_my_tests', 'get_my_timetable'],
  teacher: ['get_my_assignments', 'get_school_calendar', 'get_my_profile', 'get_my_tests'],
  admin: ['get_my_profile'],
};

export const pagesFor = (role: AiRole) => PAGES.filter((p) => p.roles.includes(role));

// Starter questions shown when the chat opens, per role.
export const SUGGESTIONS: Record<AiRole, string[]> = {
  guest: ['How do I register my child?', 'How much are the school fees?', 'Help me log in'],
  student: ['Do I have any assignment?', 'Show me the school calendar', 'Open my results'],
  teacher: ['Open the register', 'Post an assignment', 'Show me the school calendar'],
  teacher_pending: ['Why can’t I use the portal yet?', 'How do I contact the school?'],
  admin: ['Open admission applications', 'Open user management', 'Show payment receipts'],
};
