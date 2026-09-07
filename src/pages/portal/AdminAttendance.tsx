import { useEffect, useMemo, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type AttendanceStatus } from '../../context/AuthContext';
import { ClipboardList } from 'lucide-react';
import { STATUS_META, computeTermWeeks, computeWeeksInMonth, monthOptions, todayIso, formatShort } from '../../lib/attendance';

const CLASSES = ["Daycare", "Reception", "Kindergarten 1", "Kindergarten 2", "Pre-Grade", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"];

// A single, comprehensive place for the admin to check any class's
// register for any week -- present/absent/holiday at a glance, plus
// whatever notes the class teacher left -- instead of having to know
// to go ask each teacher separately.
const AdminAttendance = () => {
  const { students, academicCalendar, getClassAttendanceForRange, getClassAttendanceNotes } = useAuth();

  const MONTH_OPTIONS = useMemo(monthOptions, []);
  const today = todayIso();
  const currentMonthKey = `${today.slice(0, 4)}-${today.slice(5, 7)}`;

  const [className, setClassName] = useState(CLASSES[5]); // Grade 1, a sane default
  const [monthKey, setMonthKey] = useState(MONTH_OPTIONS.some((o) => o.key === currentMonthKey) ? currentMonthKey : MONTH_OPTIONS[MONTH_OPTIONS.length - 1].key);
  const selectedMonth = MONTH_OPTIONS.find((o) => o.key === monthKey) ?? MONTH_OPTIONS[MONTH_OPTIONS.length - 1];

  // Same continuous term-week numbering the teacher's register uses, so
  // "Week 7" means the same week on both screens.
  const termStart = academicCalendar?.termStartDate ?? null;
  const weeks = useMemo(
    () => (termStart
      ? computeTermWeeks(termStart, academicCalendar?.totalWeeks ?? 13)
      : computeWeeksInMonth(selectedMonth.year, selectedMonth.month)),
    [termStart, academicCalendar?.totalWeeks, selectedMonth.year, selectedMonth.month]
  );
  const [weekIndex, setWeekIndex] = useState(0);

  useEffect(() => {
    const byToday = weeks.findIndex((w) => w.days.some((d) => d.date === today));
    if (byToday >= 0) { setWeekIndex(byToday); return; }
    const byMonth = weeks.findIndex((w) => w.days.some((d) => d.date.slice(0, 7) === monthKey));
    setWeekIndex(byMonth >= 0 ? byMonth : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, className, termStart, weeks.length]);

  const week = weeks[Math.min(weekIndex, weeks.length - 1)];

  const classStudents = useMemo(
    () => [...students].filter((s) => s.role === 'student' && s.grade === className).sort((a, b) => a.name.localeCompare(b.name)),
    [students, className]
  );

  const [grid, setGrid] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [notes, setNotes] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!week) return;
    let cancelled = false;
    setLoading(true);
    const weekStart = week.days[0].date;
    const weekEnd = week.days[week.days.length - 1].date;
    Promise.all([
      getClassAttendanceForRange(className, weekStart, weekEnd),
      getClassAttendanceNotes(className, weekStart, weekEnd),
    ]).then(([records, noteRows]) => {
      if (cancelled) return;
      const map: Record<string, Record<string, AttendanceStatus>> = {};
      records.forEach((r) => {
        if (!map[r.studentId]) map[r.studentId] = {};
        map[r.studentId][r.attendanceDate] = r.status;
      });
      const noteMap: Record<string, Record<string, string>> = {};
      noteRows.forEach((n) => {
        if (!noteMap[n.studentId]) noteMap[n.studentId] = {};
        noteMap[n.studentId][n.noteDate] = n.note;
      });
      setGrid(map);
      setNotes(noteMap);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, week?.weekStart, getClassAttendanceForRange, getClassAttendanceNotes]);

  const dayTotals = week?.days.map((d) => {
    const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, holiday: 0 };
    classStudents.forEach((s) => {
      const status = grid[s.id]?.[d.date];
      if (status) counts[status] += 1;
    });
    return { date: d.date, counts };
  }) ?? [];

  const inputStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' };

  return (
    <PortalLayout title="Attendance Overview">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card glass" style={{ padding: '24px', borderRadius: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="input-group">
              <label>Class</label>
              <select value={className} onChange={(e) => setClassName(e.target.value)} style={inputStyle}>
                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Month</label>
              <select value={monthKey} onChange={(e) => setMonthKey(e.target.value)} style={inputStyle}>
                {MONTH_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Week</label>
              <select value={weekIndex} onChange={(e) => setWeekIndex(Number(e.target.value))} style={inputStyle}>
                {weeks.map((w, i) => (
                  <option key={w.weekStart} value={i}>
                    Week {w.weekNumber} ({formatShort(w.days[0].date)} - {formatShort(w.days[w.days.length - 1].date)})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {week && !loading && (
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '18px' }}>
              {dayTotals.map(({ date, counts }) => (
                <div key={date} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-main)' }}>{formatShort(date)}</strong>
                  {' -- '}
                  <span style={{ color: 'var(--success)' }}>{counts.present}P</span>{' '}
                  <span style={{ color: 'var(--error)' }}>{counts.absent}A</span>{' '}
                  <span style={{ color: 'var(--primary)' }}>{counts.holiday}H</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card glass" style={{ padding: '0', borderRadius: '24px', overflow: 'hidden' }}>
          {loading || !week ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>Loading register...</p>
          ) : classStudents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <ClipboardList size={36} style={{ opacity: 0.2, marginBottom: '12px' }} />
              <p>No pupils in {className}.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--glass-border)', minWidth: '160px' }}>
                      Pupil
                    </th>
                    {week.days.map(({ date, day, weekdayName }) => (
                      <th key={date} style={{ padding: '10px 6px', borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-surface)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{weekdayName.slice(0, 3)}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{day}</div>
                      </th>
                    ))}
                    <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-surface)' }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((student, rowIdx) => (
                    <tr key={student.id} style={{ background: rowIdx % 2 === 0 ? 'transparent' : 'var(--bg-light)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--glass-border)' }}>
                        {student.name}
                      </td>
                      {week.days.map(({ date }) => {
                        const status = grid[student.id]?.[date];
                        const meta = status ? STATUS_META[status] : null;
                        return (
                          <td key={date} style={{ padding: '4px', textAlign: 'center', borderBottom: '1px solid var(--glass-border)' }}>
                            <span
                              style={{
                                display: 'inline-flex', width: '30px', height: '30px', borderRadius: '8px', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', fontWeight: 800, border: `1.5px solid ${meta ? meta.color : 'var(--glass-border)'}`,
                                background: meta ? meta.color : 'transparent', color: meta ? 'white' : 'var(--text-muted)',
                              }}
                            >
                              {meta?.short ?? ''}
                            </span>
                          </td>
                        );
                      })}
                      <td style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)', maxWidth: '300px' }}>
                        {(() => {
                          const dayNotes = week.days
                            .map((d) => ({ d, text: notes[student.id]?.[d.date]?.trim() }))
                            .filter((n) => n.text);
                          if (dayNotes.length === 0) return '--';
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {dayNotes.map(({ d, text }) => (
                                <div key={d.date}>
                                  <strong style={{ color: 'var(--text-main)' }}>{d.weekdayName.slice(0, 3)}:</strong> {text}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
};

export default AdminAttendance;
