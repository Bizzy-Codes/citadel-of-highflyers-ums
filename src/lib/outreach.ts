import { type SchoolSection, SECTION_LABEL, sectionForClass } from './accounts';

// The school's WhatsApp line, in the international format wa.me needs.
export const SCHOOL_WHATSAPP = '2347064970003';

// The two prospectuses. Kindergarten and Graders get different sheets,
// so whichever one a family is pointed at has to be decided before the
// link is built.
//
// Drop the real files in at these paths (see public/prospectus/README.md).
// Nothing breaks while they're missing -- hasFile() below is used to
// hide a button whose file isn't there yet.
export const PROSPECTUS: Record<SchoolSection, { label: string; file: string }> = {
  kinders: { label: 'Kindergarten Prospectus', file: '/prospectus/kindergarten-prospectus.jpg' },
  graders: { label: 'Graders Prospectus', file: '/prospectus/graders-prospectus.jpg' },
};

// Age 6+ on 1 September of the current school year is the Graders arm;
// anything younger is Kindergarten. Families no longer pick a class on
// the form (the admin decides placement at the point of admitting), so
// this is what decides which prospectus they're offered. It's only a
// default -- the confirmation screen shows both, with this one first.
export function sectionFromDateOfBirth(dateOfBirth: string): SchoolSection {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 'kinders';
  const now = new Date();
  // School year starts in September.
  const yearStart = new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 1);
  let age = yearStart.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    yearStart.getMonth() < dob.getMonth() ||
    (yearStart.getMonth() === dob.getMonth() && yearStart.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 6 ? 'graders' : 'kinders';
}

export { sectionForClass, SECTION_LABEL };
export type { SchoolSection };

// The message a new applicant sends to the school line.
//
// The SECTION line is deliberately a bare upper-case keyword on its own
// line: it's what a human on the school line reads at a glance today,
// and it's the exact token an automated responder would branch on later
// to decide which prospectus to reply with.
export function buildNewApplicantMessage(opts: {
  childName: string;
  section: SchoolSection;
  reference?: string;
}): string {
  const lines = [
    `Hello Citadel of Highflyers Int'l Academy,`,
    ``,
    `I have just completed the online admission application.`,
    ``,
    `NEW STUDENT`,
    `SECTION: ${SECTION_LABEL[opts.section].toUpperCase()}`,
    `Child: ${opts.childName}`,
  ];
  if (opts.reference) lines.push(`Reference: ${opts.reference}`);
  lines.push(``, `Please send me the welcome information. Thank you.`);
  return lines.join('\n');
}

// A permanent link to the right arm's Financial Involvement sheet.
// WhatsApp can't be made to attach a file on its own, but it carries a
// link perfectly -- so the school pastes this and the family opens,
// reads and prints the real sheet on their phone.
export function feeSheetUrl(section: SchoolSection, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/fees/${section}`;
}

// A reminder the school sends to a family that applied but never came
// back to upload their payment receipt.
export function buildReceiptReminderMessage(childName: string): string {
  return [
    `Hello, this is Citadel of Highflyers Int'l Academy.`,
    ``,
    `We have your admission application for ${childName}, but we haven't received the payment receipt yet.`,
    ``,
    `Your application is on hold until the receipt is uploaded. You can finish it here:`,
    `${typeof window !== 'undefined' ? window.location.origin : ''}/admissions`,
    ``,
    `Thank you.`,
  ].join('\n');
}

// The message that hands a family their portal login.
//
// The pupil's NAME is the login, not the parent's email: the email on
// the account is usually a parent's, which made "log in with
// mum@example.com" read as the parent's own account rather than the
// child's. Name, pupil ID and email all work -- name is the one a
// family will actually remember.
export function buildLoginDetailsMessage(opts: {
  studentName: string;
  displayId: string;
  password: string;
  className?: string;
  portalUrl?: string;
}): string {
  const url = opts.portalUrl ?? (typeof window !== 'undefined' ? `${window.location.origin}/login` : '');
  return [
    `Hello, this is Citadel of Highflyers Int'l Academy.`,
    ``,
    `Here are the portal login details for ${opts.studentName}${opts.className ? ` (${opts.className})` : ''}:`,
    ``,
    `Login name: ${opts.studentName}`,
    `Pupil ID: ${opts.displayId}`,
    `Password: ${opts.password}`,
    ``,
    url ? `Sign in here: ${url}` : '',
    ``,
    `You can change the password once you are signed in, under Profile.`,
    ``,
    `Thank you for partnering with us in raising future generals.`,
  ].filter((line) => line !== undefined).join('\n');
}

export function whatsappLink(phoneOrLine: string, message: string): string {
  return `https://wa.me/${phoneOrLine}?text=${encodeURIComponent(message)}`;
}

// Normalizes a Nigerian local number ("08036334689") into the
// international format wa.me needs ("2348036334689").
export function toWhatsAppNumber(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.startsWith('0') ? '234' + digits.slice(1) : digits;
}

// True if a file is actually deployed at this path. Used so a download
// button for a prospectus/letter that hasn't been added yet simply
// doesn't render, instead of handing a family a broken link.
export async function hasFile(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: 'HEAD' });
    return res.ok && !(res.headers.get('content-type') ?? '').includes('text/html');
  } catch {
    return false;
  }
}
