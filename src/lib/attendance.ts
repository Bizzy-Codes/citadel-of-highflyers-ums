import type { AttendanceStatus } from '../context/AuthContext';

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const dateKey = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
export const formatShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const STATUS_META: Record<AttendanceStatus, { label: string; short: string; color: string }> = {
  present: { label: 'Present', short: 'P', color: 'var(--success)' },
  absent: { label: 'Absent', short: 'A', color: 'var(--error)' },
  late: { label: 'Late', short: 'L', color: 'var(--warning)' },
};

export interface RegisterWeek {
  weekStart: string; // the Monday of this calendar week, even if this month's slice starts later
  days: { date: string; day: number; weekdayName: string }[];
}

// School runs Monday-Friday, so weekends are dropped entirely (not
// just dimmed) -- and split into real calendar weeks so a week never
// has to be scrolled sideways to see the rest of it.
export const computeWeeksInMonth = (year: number, month: number): RegisterWeek[] => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks: RegisterWeek[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const weekday = new Date(year, month - 1, d).getDay(); // 0 Sun .. 6 Sat
    if (weekday === 0 || weekday === 6) continue;
    const date = dateKey(year, month, d);
    const isNewWeek = weekday === 1 || weeks.length === 0;
    if (isNewWeek) {
      const monday = new Date(year, month - 1, d);
      monday.setDate(monday.getDate() - (weekday - 1));
      weeks.push({ weekStart: monday.toISOString().slice(0, 10), days: [] });
    }
    weeks[weeks.length - 1].days.push({ date, day: d, weekdayName: WEEKDAY_NAMES[weekday - 1] });
  }
  return weeks;
};

export interface MonthOption { key: string; year: number; month: number; label: string }

export const monthOptions = (): MonthOption[] => {
  const opts: MonthOption[] = [];
  const base = new Date();
  for (let i = -11; i <= 1; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    opts.push({
      key: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    });
  }
  return opts;
};
