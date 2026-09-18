// The password every new account is created with.
//
// Families were being read a 10-character random string over the phone
// and couldn't type it in or remember it, so every account now starts
// on one short, easy-to-say default that the parent (or the admin) can
// change from the portal afterwards.
//
// NOTE: the Edge Function that actually creates accounts
// (supabase/functions/admin-create-user/index.ts) runs on Deno and
// cannot import from src/, so it carries its own copy of this value.
// If you change it here, change it there too -- they must match, and
// the function must be REDEPLOYED for a change to take effect.
export const DEFAULT_ACCOUNT_PASSWORD = 'citadel1234';

// Classes, in school order. Kept here so the admissions form, the admit
// dialog, the sign-up form and the admin screens can't drift apart.
export const CLASSES = [
  'Daycare', 'Reception', 'Kindergarten 1', 'Kindergarten 2', 'Pre-Grade',
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
] as const;

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
