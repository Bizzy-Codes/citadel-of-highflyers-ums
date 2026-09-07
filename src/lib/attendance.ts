import type { AttendanceStatus, AttendanceRecord } from '../context/AuthContext';

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const dateKey = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
export const formatShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const STATUS_META: Record<AttendanceStatus, { label: string; short: string; color: string }> = {
  present: { label: 'Present', short: 'P', color: 'var(--success)' },
  absent: { label: 'Absent', short: 'A', color: 'var(--error)' },
  holiday: { label: 'Holiday', short: 'H', color: 'var(--primary)' },
};

export interface RegisterWeek {
  weekNumber: number; // absolute week of the term -- keeps counting past a month boundary
  weekStart: string;  // the Monday of this week
  days: { date: string; day: number; weekdayName: string }[];
}

// Local-date formatter. Deliberately not toISOString(), which converts
// to UTC first and so reports the *previous* day for any timezone ahead
// of UTC (Nigeria is UTC+1) -- that silently shifted every week's
// Monday back to Sunday.
const isoOf = (d: Date) => dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());

const mondayOf = (d: Date) => {
  const weekday = d.getDay(); // 0 Sun .. 6 Sat
  const monday = new Date(d);
  monday.setDate(monday.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return monday;
};

const weekFrom = (monday: Date, weekNumber: number): RegisterWeek => {
  const days: RegisterWeek['days'] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push({ date: isoOf(d), day: d.getDate(), weekdayName: WEEKDAY_NAMES[i] });
  }
  return { weekNumber, weekStart: isoOf(monday), days };
};

// The term's weeks, numbered 1..totalWeeks straight through -- so the
// week after 30 Sept is Week 5, not Week 1 all over again. Week 1 is
// the Mon-Fri week containing the calendar's term start date. School
// runs Monday-Friday, so weekends are dropped entirely.
export const computeTermWeeks = (termStartDate: string, totalWeeks: number): RegisterWeek[] => {
  const firstMonday = mondayOf(new Date(termStartDate + 'T00:00:00'));
  const weeks: RegisterWeek[] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const monday = new Date(firstMonday);
    monday.setDate(monday.getDate() + w * 7);
    weeks.push(weekFrom(monday, w + 1));
  }
  return weeks;
};

// Fallback for when the admin hasn't set a term start date yet: the
// register still has to work, so fall back to this month's own weeks.
// Numbering restarts here by necessity -- the UI says so explicitly
// rather than quietly showing a week number that means nothing.
export const computeWeeksInMonth = (year: number, month: number): RegisterWeek[] => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks: RegisterWeek[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const cur = new Date(year, month - 1, d);
    const weekday = cur.getDay();
    if (weekday === 0 || weekday === 6) continue;
    if (weekday === 1 || weeks.length === 0) weeks.push(weekFrom(mondayOf(cur), weeks.length + 1));
  }
  return weeks;
};

export interface AttendanceSummary {
  totalSchoolDays: number; // the whole term's expected weekdays, from the academic calendar's week count
  present: number;
  absent: number;
  holiday: number;
  percentage: number; // present / totalSchoolDays, 0 if the calendar isn't set up yet
  absentDates: string[];
  holidayDates: string[];
}

// The academic calendar only stores a week count, not a day count --
// this is the one place "13 weeks" becomes "65 school days" (weekdays
// only, matching the register). Present/absent/late/holiday counts
// come from whatever's actually been marked so far, which is why the
// numerator grows over the term while the denominator (the calendar's
// total) stays fixed.
export const summarizeAttendance = (records: AttendanceRecord[], totalWeeks: number | undefined): AttendanceSummary => {
  const totalSchoolDays = (totalWeeks ?? 0) * 5;
  let present = 0, absent = 0, holiday = 0;
  const absentDates: string[] = [];
  const holidayDates: string[] = [];
  for (const r of records) {
    if (r.status === 'present') present += 1;
    else if (r.status === 'absent') { absent += 1; absentDates.push(r.attendanceDate); }
    else if (r.status === 'holiday') { holiday += 1; holidayDates.push(r.attendanceDate); }
  }
  const percentage = totalSchoolDays > 0 ? Math.round((present / totalSchoolDays) * 100) : 0;
  return { totalSchoolDays, present, absent, holiday, percentage, absentDates, holidayDates };
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
