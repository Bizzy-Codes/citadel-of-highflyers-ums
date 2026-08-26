import { Fragment, useEffect, useMemo, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type AttendanceStatus } from '../../context/AuthContext';
import { Save, Loader2, Info, MessageSquarePlus } from 'lucide-react';
import { STATUS_META, computeWeeksInMonth, monthOptions, todayIso, formatShort } from '../../lib/attendance';

// Click cycles a cell through the same states a paper register uses,
// landing back on blank so a mistake is one more click away, not a
// separate "clear" control.
const CYCLE: (AttendanceStatus | undefined)[] = ['present', 'absent', 'late', undefined];
const nextStatus = (current: AttendanceStatus | undefined) => CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];

const TeacherRegister = () => {
  const { currentUser, students, getClassAttendanceForRange, markClassAttendanceBulk, getClassAttendanceNotes, upsertAttendanceNote } = useAuth();
  const className = currentUser?.assignedClass;

  const MONTH_OPTIONS = useMemo(monthOptions, []);
  const today = todayIso();
  const currentMonthKey = `${today.slice(0, 4)}-${today.slice(5, 7)}`;
  const [monthKey, setMonthKey] = useState(MONTH_OPTIONS.some((o) => o.key === currentMonthKey) ? currentMonthKey : MONTH_OPTIONS[MONTH_OPTIONS.length - 1].key);
  const selectedMonth = MONTH_OPTIONS.find((o) => o.key === monthKey) ?? MONTH_OPTIONS[MONTH_OPTIONS.length - 1];

  const weeks = useMemo(() => computeWeeksInMonth(selectedMonth.year, selectedMonth.month), [selectedMonth.year, selectedMonth.month]);
  const [weekIndex, setWeekIndex] = useState(0);

  // Jumping to a new month should default to whichever week contains
  // today (if today falls in that month) instead of always Week 1.
  useEffect(() => {
    const idx = weeks.findIndex((w) => w.days.some((d) => d.date === today));
    setWeekIndex(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  const week = weeks[Math.min(weekIndex, weeks.length - 1)];

  const classStudents = useMemo(
    () => [...students].filter((s) => s.grade === className).sort((a, b) => a.name.localeCompare(b.name)),
    [students, className]
  );

  const [grid, setGrid] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [baseline, setBaseline] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteBaseline, setNoteBaseline] = useState<Record<string, string>>({});
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!className || !week) return;
    let cancelled = false;
    setLoading(true);
    setSaved(false);
    const weekEnd = week.days[week.days.length - 1].date;
    Promise.all([
      getClassAttendanceForRange(className, week.weekStart, weekEnd),
      getClassAttendanceNotes(className, week.weekStart),
    ]).then(([records, noteRows]) => {
      if (cancelled) return;
      const map: Record<string, Record<string, AttendanceStatus>> = {};
      records.forEach((r) => {
        if (!map[r.studentId]) map[r.studentId] = {};
        map[r.studentId][r.attendanceDate] = r.status;
      });
      const noteMap: Record<string, string> = {};
      noteRows.forEach((n) => { noteMap[n.studentId] = n.note; });
      setGrid(map);
      setBaseline(map);
      setNotes(noteMap);
      setNoteBaseline(noteMap);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // week is intentionally read (not listed) -- it's derived fresh from
    // weeks/weekIndex every render, so depending on week?.weekStart (a
    // stable primitive) avoids refetching on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, week?.weekStart, getClassAttendanceForRange, getClassAttendanceNotes]);

  const cycleCell = (studentId: string, date: string) => {
    setGrid((prev) => {
      const studentRow = { ...(prev[studentId] ?? {}) };
      const next = nextStatus(studentRow[date]);
      if (next) studentRow[date] = next; else delete studentRow[date];
      return { ...prev, [studentId]: studentRow };
    });
    setSaved(false);
  };

  // Clicking a day's header is the fast path for the common case --
  // the whole class was in and present that day.
  const markDayAllPresent = (date: string) => {
    setGrid((prev) => {
      const next = { ...prev };
      classStudents.forEach((s) => { next[s.id] = { ...(next[s.id] ?? {}), [date]: 'present' }; });
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!className || !week) return;
    setSaving(true);
    const changes: { studentId: string; date: string; status: AttendanceStatus }[] = [];
    for (const student of classStudents) {
      const row = grid[student.id] ?? {};
      const baseRow = baseline[student.id] ?? {};
      for (const { date } of week.days) {
        const value = row[date];
        if (value && value !== baseRow[date]) changes.push({ studentId: student.id, date, status: value });
      }
    }
    const noteChanges = classStudents.filter((s) => (notes[s.id] ?? '') !== (noteBaseline[s.id] ?? ''));

    const [attendanceResult] = await Promise.all([
      markClassAttendanceBulk(className, changes),
      ...noteChanges.map((s) => upsertAttendanceNote(className, s.id, week.weekStart, notes[s.id] ?? '')),
    ]);
    setSaving(false);
    if (attendanceResult.error) { alert('Failed to save register: ' + attendanceResult.error); return; }
    setBaseline(grid);
    setNoteBaseline(notes);
    setSaved(true);
  };

  const markedThisWeek = week ? classStudents.reduce((sum, s) => sum + week.days.filter((d) => grid[s.id]?.[d.date]).length, 0) : 0;
  const possibleThisWeek = week ? classStudents.length * week.days.filter((d) => d.date <= today).length : 0;

  if (!className) {
    return (
      <PortalLayout title="Attendance Register">
        <div className="card glass" style={{ padding: '40px', textAlign: 'center', borderRadius: '24px' }}>
          <p>You aren't assigned to a class yet. Ask an admin to assign you one before you can take a register.</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title={`Attendance Register: ${className}`}>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card glass" style={{ padding: '24px', borderRadius: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div className="input-group">
                <label>Month</label>
                <select
                  value={monthKey}
                  onChange={(e) => setMonthKey(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' }}
                >
                  {MONTH_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Week</label>
                <select
                  value={weekIndex}
                  onChange={(e) => setWeekIndex(Number(e.target.value))}
                  style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' }}
                >
                  {weeks.map((w, i) => (
                    <option key={w.weekStart} value={i}>
                      Week {i + 1} ({formatShort(w.days[0].date)} - {formatShort(w.days[w.days.length - 1].date)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                {(Object.keys(STATUS_META) as AttendanceStatus[]).map((s) => (
                  <span key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: STATUS_META[s].color, display: 'inline-block' }} />
                    {STATUS_META[s].label}
                  </span>
                ))}
              </div>
              <button onClick={handleSave} className="btn btn-primary sm" type="button" disabled={saving || loading}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : 'Save Register'}
              </button>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '14px' }}>
            {markedThisWeek} of {possibleThisWeek} slots marked for {className} this week.
          </p>
          <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
            <Info size={13} /> Tap a cell to cycle Present &rarr; Absent &rarr; Late &rarr; blank. Tap a day's name to mark the whole class present for that day. Use the note icon to leave a reason or report the admin can see.
          </p>
          {saved && <p style={{ color: 'var(--success)', fontSize: '13px', marginTop: '8px', fontWeight: '600' }}>Register saved.</p>}
        </div>

        <div className="card glass" style={{ padding: '0', borderRadius: '24px', overflow: 'hidden' }}>
          {loading || !week ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>Loading register...</p>
          ) : classStudents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>No pupils in {className} yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--glass-border)', minWidth: '160px' }}>
                      Pupil
                    </th>
                    {week.days.map(({ date, day, weekdayName }) => {
                      const isFuture = date > today;
                      return (
                        <th key={date} style={{ padding: 0, borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-surface)' }}>
                          <button
                            type="button"
                            disabled={isFuture}
                            onClick={() => markDayAllPresent(date)}
                            title={`Mark everyone present on ${weekdayName} ${day}`}
                            style={{
                              width: '100%', minWidth: '64px', padding: '10px 6px', border: 'none', background: 'transparent',
                              cursor: isFuture ? 'default' : 'pointer', opacity: isFuture ? 0.35 : 1,
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                            }}
                          >
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{weekdayName.slice(0, 3)}</span>
                            <span style={{ fontSize: '13px', fontWeight: 700 }}>{day}</span>
                          </button>
                        </th>
                      );
                    })}
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-surface)' }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((student, rowIdx) => (
                    <Fragment key={student.id}>
                      <tr style={{ background: rowIdx % 2 === 0 ? 'transparent' : 'var(--bg-light)' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', borderBottom: openNoteFor === student.id ? 'none' : '1px solid var(--glass-border)' }}>
                          {student.name}
                        </td>
                        {week.days.map(({ date }) => {
                          const status = grid[student.id]?.[date];
                          const meta = status ? STATUS_META[status] : null;
                          const isFuture = date > today;
                          return (
                            <td key={date} style={{ padding: '4px', textAlign: 'center', borderBottom: openNoteFor === student.id ? 'none' : '1px solid var(--glass-border)' }}>
                              <button
                                type="button"
                                disabled={isFuture}
                                onClick={() => cycleCell(student.id, date)}
                                title={meta?.label ?? 'Not marked'}
                                style={{
                                  width: '32px', height: '32px', borderRadius: '8px', fontSize: '12px', fontWeight: 800,
                                  border: `1.5px solid ${meta ? meta.color : 'var(--glass-border)'}`,
                                  background: meta ? meta.color : 'transparent',
                                  color: meta ? 'white' : 'var(--text-muted)',
                                  cursor: isFuture ? 'default' : 'pointer',
                                  opacity: isFuture ? 0.35 : 1,
                                }}
                              >
                                {meta?.short ?? ''}
                              </button>
                            </td>
                          );
                        })}
                        <td style={{ padding: '4px 12px', textAlign: 'center', borderBottom: openNoteFor === student.id ? 'none' : '1px solid var(--glass-border)' }}>
                          <button
                            type="button"
                            className="icon-btn"
                            title={notes[student.id] ? 'Edit note' : 'Add a note for this pupil this week'}
                            onClick={() => setOpenNoteFor(openNoteFor === student.id ? null : student.id)}
                            style={{ color: notes[student.id] ? 'var(--primary)' : 'var(--text-muted)' }}
                          >
                            <MessageSquarePlus size={16} />
                          </button>
                        </td>
                      </tr>
                      {openNoteFor === student.id && (
                        <tr style={{ background: rowIdx % 2 === 0 ? 'transparent' : 'var(--bg-light)' }}>
                          <td colSpan={week.days.length + 2} style={{ padding: '0 16px 14px', borderBottom: '1px solid var(--glass-border)' }}>
                            <textarea
                              rows={2}
                              placeholder="Reason for absence, an incident, or anything the admin should know about this pupil this week..."
                              value={notes[student.id] ?? ''}
                              onChange={(e) => { setNotes({ ...notes, [student.id]: e.target.value }); setSaved(false); }}
                              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)', resize: 'vertical', fontSize: '13px' }}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
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

export default TeacherRegister;
