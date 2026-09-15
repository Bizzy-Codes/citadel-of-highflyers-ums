import type { SchoolSection } from './accounts';

// ---------------------------------------------------------------
// EDIT ME EACH SESSION: the published Financial Involvement figures.
//
// Everything on the fee sheet comes from here -- the subtotals and the
// grand total are computed, never typed, so they can't drift out of
// step with the lines above them.
// ---------------------------------------------------------------
export interface FeeSchedule {
  section: SchoolSection;
  /** Heading on the sheet, e.g. "Reception & Kindergarten Classes". */
  title: string;
  tuition: number;
  registration: number;
  uniforms: { label: string; amount: number }[];
}

export const FEE_SCHEDULES: Record<SchoolSection, FeeSchedule> = {
  kinders: {
    section: 'kinders',
    title: 'Reception & Kindergarten Classes',
    tuition: 54_900,
    registration: 20_500,
    uniforms: [
      { label: 'A Pair of Complete Suit', amount: 21_500 },
      { label: 'A Pair of Customized Sportswear', amount: 11_700 },
      { label: '2 Pairs of Customized T-Shirts', amount: 12_600 },
      { label: 'A Pair of Customized Cardigan', amount: 10_800 },
    ],
  },
  graders: {
    section: 'graders',
    title: 'Pre-Grade / Graders Classes',
    tuition: 56_700,
    registration: 20_500,
    uniforms: [
      { label: 'A Pair of Complete Suit', amount: 21_800 },
      { label: 'A Pair of Customized Sportswear', amount: 11_700 },
      { label: '2 Pairs of Customized T-Shirts', amount: 12_600 },
      { label: 'A Pair of Customized Cardigan', amount: 11_500 },
    ],
  },
};

export const feeTotals = (s: FeeSchedule) => {
  const feesSubtotal = s.tuition + s.registration;
  const uniformsSubtotal = s.uniforms.reduce((sum, u) => sum + u.amount, 0);
  return { feesSubtotal, uniformsSubtotal, total: feesSubtotal + uniformsSubtotal };
};

export const naira = (n: number) => n.toLocaleString('en-NG');

export const SCHOOL_BANK = {
  bank: 'First Bank',
  accountName: "Citadel of Highflyers Int'l Academy",
  accountNumber: '2032386769',
  receiptWhatsApp: '07064970003',
};
