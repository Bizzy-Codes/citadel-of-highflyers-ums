// The password new accounts start with lives ONLY in the Edge Function
// (supabase/functions/admin-create-user/index.ts). Never put it back in
// src/: this code is downloaded by every visitor. Admin screens get it
// from the function -- see src/lib/defaultPassword.ts.

// Classes, in school order. Kept here so the admissions form, the admit
// dialog, the sign-up form and the admin screens can't drift apart.
export const CLASSES = [
  'Daycare', 'Reception', 'Kindergarten 1', 'Kindergarten 2', 'Pre-Grade',
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
] as const;

// Where a pupil goes when they finish the final class. Not a member of
// CLASSES on purpose -- every screen that lists real classes should
// leave graduates out without needing to know about them.
export const GRADUATED = 'Graduated';

// The class after this one, in school order. Returns GRADUATED after
// the last class, and null when the class isn't recognised (an
// unassigned pupil, or a name that has since been renamed), so the
// caller can say so instead of guessing.
export function nextClassAfter(className: string | null | undefined): string | null {
  const current = (className ?? '').trim().toLowerCase();
  const i = CLASSES.findIndex((c) => c.toLowerCase() === current);
  if (i === -1) return null;
  return i === CLASSES.length - 1 ? GRADUATED : CLASSES[i + 1];
}

export type SchoolSection = 'kinders' | 'graders';

// Which arm of the school a class belongs to. The two arms get
// different prospectuses, so this is what decides which one a family is
// pointed at after they apply.
export function sectionForClass(className: string | null | undefined): SchoolSection {
  return /^grade\s/i.test((className ?? '').trim()) ? 'graders' : 'kinders';
}

export const SECTION_LABEL: Record<SchoolSection, string> = {
  kinders: 'Kindergarten',
  graders: 'Graders',
};

// Siblings share one parent email (patch_31), but the login system
// still needs a unique address per account. A pupil whose family email
// is already taken signs up under a plus-address of it --
// mum@gmail.com -> mum+ch4k2x9a@gmail.com -- which most providers
// (Gmail included) still deliver to mum. The profile keeps the real
// address. Keep in sync with the Edge Function's copy.
export function siblingLoginEmail(email: string): string {
  const at = email.lastIndexOf('@');
  const tag = 'ch' + crypto.randomUUID().replace(/-/g, '').slice(0, 6);
  return `${email.slice(0, at)}+${tag}${email.slice(at)}`;
}

export function isEmailTakenError(message: string): boolean {
  return /already been registered|already registered|already exists|duplicate/i.test(message);
}
