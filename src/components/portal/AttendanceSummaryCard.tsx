import { STATUS_META, formatShort, type AttendanceSummary } from '../../lib/attendance';
import { CalendarClock } from 'lucide-react';

interface AttendanceSummaryCardProps {
  summary: AttendanceSummary;
  hasCalendar: boolean;
  compact?: boolean;
}

const SEGMENTS: { key: 'present' | 'absent' | 'holiday' }[] = [
  { key: 'present' }, { key: 'absent' }, { key: 'holiday' },
];

// A small hand-rolled SVG donut -- no charting library in this project,
// and three static segments don't need one. Each arc's length is its
// share of totalSchoolDays (not just of the marked days), so the ring
// visibly fills in as the term goes on rather than always looking 100%
// full from day one.
const AttendanceDonut = ({ summary }: { summary: AttendanceSummary }) => {
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const total = summary.totalSchoolDays || 1;
  const arcs = SEGMENTS.reduce<{ key: string; length: number; offset: number; color: string; value: number }[]>((acc, { key }) => {
    const value = summary[key];
    const length = (value / total) * circumference;
    const previous = acc[acc.length - 1];
    const offset = previous ? previous.offset + previous.length : 0;
    return [...acc, { key, length, offset, color: STATUS_META[key].color, value }];
  }, []);

  return (
    <svg viewBox="0 0 100 100" width="120" height="120" role="img" aria-label={`${summary.percentage}% present`}>
      {/* The base ring shows through wherever no colored segment covers
          it, doubling as the "not yet marked" portion of the term. */}
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--glass-border)" strokeWidth="14" />
      {arcs.filter((a) => a.value > 0).map((a) => (
        <circle
          key={a.key}
          cx="50" cy="50" r={r} fill="none"
          stroke={a.color} strokeWidth="14"
          strokeDasharray={`${a.length} ${circumference - a.length}`}
          strokeDashoffset={-a.offset}
          transform="rotate(-90 50 50)"
          strokeLinecap="butt"
        />
      ))}
      <text x="50" y="46" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text-main)">{summary.percentage}%</text>
      <text x="50" y="62" textAnchor="middle" fontSize="9" fill="var(--text-muted)">present</text>
    </svg>
  );
};

const DateChips = ({ label, dates, color }: { label: string; dates: string[]; color: string }) => {
  if (dates.length === 0) return null;
  return (
    <div style={{ marginBottom: '10px' }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color, marginBottom: '6px' }}>{label} ({dates.length})</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {dates.map((d) => (
          <span key={d} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '50px', background: 'var(--bg-light)', border: `1px solid ${color}`, color }}>
            {formatShort(d)}
          </span>
        ))}
      </div>
    </div>
  );
};

const AttendanceSummaryCard = ({ summary, hasCalendar, compact }: AttendanceSummaryCardProps) => {
  if (!hasCalendar) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
        <CalendarClock size={28} style={{ opacity: 0.3, marginBottom: '8px' }} />
        <p style={{ fontSize: '13px' }}>Attendance tracking starts once the admin sets the term's start date on the academic calendar.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <AttendanceDonut summary={summary} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '160px' }}>
          <div>
            <strong style={{ fontSize: '20px' }}>{summary.present}</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}> / {summary.totalSchoolDays} school days present</span>
          </div>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px' }}>
            <span style={{ color: STATUS_META.absent.color, fontWeight: 700 }}>{summary.absent} absent</span>
            <span style={{ color: STATUS_META.holiday.color, fontWeight: 700 }}>{summary.holiday} holiday</span>
          </div>
        </div>
      </div>
      {!compact && (
        <div>
          <DateChips label="Absent" dates={summary.absentDates} color={STATUS_META.absent.color} />
          <DateChips label="Holiday" dates={summary.holidayDates} color={STATUS_META.holiday.color} />
          {summary.absentDates.length === 0 && summary.holidayDates.length === 0 && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No absences recorded yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceSummaryCard;
