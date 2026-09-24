import type { AiRole } from './catalog';

// Step-by-step walkthroughs Citadel AI can start. Each step points at an
// element tagged data-ai="..." on the page. 'next' steps wait for the
// visitor to press Next (after typing, say); 'click' steps move on by
// themselves once the highlighted button is pressed.
//
// Adding a guide: tag the elements with data-ai, add an entry here.
// Nothing server-side needs to change -- the browser sends the list.

export interface GuideStep {
  target: string;
  text: string;
  advance: 'next' | 'click';
}

export interface Guide {
  key: string;
  label: string;
  roles: AiRole[];
  path: string;
  steps: GuideStep[];
  // How we know the visitor got to the end: they land on a page, or a
  // tagged element appears (e.g. the payment step of admissions).
  donePath?: (path: string) => boolean;
  doneSelector?: string;
  doneText: string;
}

export const GUIDES: Guide[] = [
  {
    key: 'pupil_sign_up',
    label: 'Create a portal account for a pupil (sign up / register a child)',
    roles: ['guest'],
    path: '/login?register=student',
    steps: [
      { target: 'reg-role', text: 'Pupil is already chosen. Staff is only for teachers.', advance: 'next' },
      { target: 'reg-name', text: "Type the child's full name here. They will use this name to log in.", advance: 'next' },
      { target: 'reg-email', text: "Type the parent's email. Brothers and sisters can all use the same email.", advance: 'next' },
      { target: 'reg-details', text: 'These details are optional. Fill in what you can. For date of birth, tap the box and swipe the wheels.', advance: 'next' },
      { target: 'reg-password', text: 'Make a password of at least 8 letters or numbers, and write it down somewhere safe.', advance: 'next' },
      { target: 'reg-submit', text: 'Now press Register Now.', advance: 'click' },
    ],
    donePath: (p) => p === '/portal' || p.startsWith('/portal/'),
    doneText: 'All done! The account is ready and you are signed in. The school will put your child in their class. Ask me anything else.',
  },
  {
    key: 'staff_sign_up',
    label: 'Create a staff account for a teacher',
    roles: ['guest'],
    path: '/login?register=staff',
    steps: [
      { target: 'reg-role', text: 'Staff is chosen. An admin must approve your account before you can use the portal.', advance: 'next' },
      { target: 'reg-name', text: 'Type your full name.', advance: 'next' },
      { target: 'reg-email', text: 'Type your email address.', advance: 'next' },
      { target: 'reg-password', text: 'Make a password of at least 8 letters or numbers.', advance: 'next' },
      { target: 'reg-submit', text: 'Now press Register Now.', advance: 'click' },
    ],
    donePath: (p) => p.startsWith('/portal'),
    doneText: 'Done! Your staff account is waiting for the admin to approve it. You will be able to use the portal once they do.',
  },
  {
    key: 'log_in',
    label: 'Log in to the portal',
    roles: ['guest'],
    path: '/login',
    steps: [
      { target: 'login-id', text: 'Type your name, or your login ID like CH 001.', advance: 'next' },
      { target: 'login-password', text: 'Type your password. New accounts from the school start with citadel1234.', advance: 'next' },
      { target: 'login-submit', text: 'Now press Sign In to Portal.', advance: 'click' },
    ],
    donePath: (p) => p.startsWith('/portal'),
    doneText: 'You are in! Tell me what you want to see, like assignments or results.',
  },
  {
    key: 'forgot_password',
    label: 'Reset a forgotten password',
    roles: ['guest'],
    path: '/forgot-password',
    steps: [
      { target: 'forgot-email', text: 'Type the email you used for the account.', advance: 'next' },
      { target: 'forgot-submit', text: 'Press Send Verification Code.', advance: 'click' },
    ],
    doneSelector: '[data-ai="forgot-otp"]',
    doneText: 'Check your email for a 6-digit code (look in spam too) and type it in the box. If it does not come, the school office can reset your password.',
  },
  {
    key: 'apply_admission',
    label: 'Apply for admission for a new child',
    roles: ['guest', 'student', 'teacher', 'teacher_pending', 'admin'],
    path: '/admissions',
    steps: [
      { target: 'adm-surname', text: "Type the child's surname (family name).", advance: 'next' },
      { target: 'adm-firstname', text: "Type the child's first name.", advance: 'next' },
      { target: 'adm-email', text: "Type the parent's email address.", advance: 'next' },
      { target: 'adm-dob', text: 'Tap here and swipe to choose the date of birth.', advance: 'next' },
      { target: 'adm-pickup', text: 'Fill the other boxes as you go down, like who picks the child from school.', advance: 'next' },
      { target: 'adm-submit', text: 'When you have filled everything, press this button to send the application.', advance: 'click' },
    ],
    doneSelector: '[data-ai="adm-pay"]',
    doneText: 'Your application has been sent! The last step is the 2,000 naira processing fee. Choose cash or bank transfer on this page.',
  },
  {
    key: 'submit_assignment',
    label: 'Submit (upload) work for an assignment',
    roles: ['student'],
    path: '/portal/assignments',
    steps: [
      { target: 'assignment-submit', text: 'Press Submit Work, then choose a photo or file of your work.', advance: 'click' },
    ],
    doneText: 'Once the upload finishes, it will say Submitted. Well done!',
  },
  {
    key: 'post_assignment',
    label: 'Post a new assignment for my class (teacher)',
    roles: ['teacher'],
    path: '/portal/teacher/assignments',
    steps: [
      { target: 'assign-new', text: 'Press New Assignment.', advance: 'click' },
      { target: 'assign-title', text: 'Type a title, like Maths homework page 12.', advance: 'next' },
      { target: 'assign-subject', text: 'Type the subject.', advance: 'next' },
      { target: 'assign-due', text: 'Choose a due date if there is one.', advance: 'next' },
      { target: 'assign-post', text: 'Press Post Assignment. Your pupils will see it straight away.', advance: 'click' },
    ],
    doneText: 'Posted! Your pupils can now see it and upload their work.',
  },
];

export const guidesFor = (role: AiRole) => GUIDES.filter((g) => g.roles.includes(role));
