import { Fragment, useEffect, useMemo, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type AttendanceStatus } from '../../context/AuthContext';
import { Save, Loader2, Info, MessageSquarePlus, Check, X, Sun, CalendarDays } from 'lucide-react';
import { STATUS_META, computeTermWeeks, computeWeeksInMonth, monthOptions, todayIso, formatShort } from '../../lib/attendance';

// Click cycles a cell through the same states a paper register uses,
// landing back on blank so a mistake is one more click away, not a
// separate "clear" control.
const CYCLE: (AttendanceStatus | undefined)[] = ['present', 'absent', 'holiday', undefined];
const nextStatus = (current: AttendanceStatus | undefined) => CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];

const CELL_ICON: Record<AttendanceStatus, React.ReactNode> = {
  present: <Check size={17} strokeWidth={3.5} />,
  absent: <X size={17} strokeWidth={3.5} />,
  holiday: <Sun size={16} strokeWidth={3} />,
};

const TeacherRegister = () => {
  const {
    currentUser, students, academicCalendar,
    getClassAttendanceForRange, markClassAttendanceBulk, getClassAttendanceNotes, upsertAttendanceNote,
  } = useAuth();
  const className = currentUser?.assignedClass;

  const MONTH_OPTIONS = useMemo(monthOptions, []);
  const today = todayIso();
  const currentMonthKey = `${today.slice(0, 4)}-${today.slice(5, 7)}`;
  const [monthKey, setMonthKey] = useState(MONTH_OPTIONS.some((o) => o.key === currentMonthKey) ? currentMonthKey : MONTH_OPTIONS[MONTH_OPTIONS.length - 1].key);
  const selectedMonth = MONTH_OPTIONS.find((o) => o.key === monthKey) ?? MONTH_OPTIONS[MONTH_OPTIONS.length - 1];

  // Week numbers run 1..totalWeeks straight through the term, so the
  // week after the month ends is Week 5, not Week 1 again. That needs
  // the admin's term start date; without it we fall back to this
  // month's own weeks and say so rather than showing a meaningless number.
  const termStart = academicCalendar?.termStartDate ?? null;
  const weeks = useMemo(
    () => (termStart
      ? computeTermWeeks(termStart, academicCalendar?.totalWeeks ?? 13)
      : computeWeeksInMonth(selectedMonth.year, selectedMonth.month)),
    [termStart, academicCalendar?.totalWeeks, selectedMonth.year, selectedMonth.month]
  );
  const [weekIndex, setWeekIndex] = useState(0);

  // Land on the week containing today where possible; otherwise the
  // first week of whichever month was picked.
  useEffect(() => {
    const byToday = weeks.findIndex((w) => w.days.some((d) => d.date === today));
    if (byToday >= 0) { setWeekIndex(byToday); return; }
    const byMonth = weeks.findIndex((w) => w.days.some((d) => d.date.slice(0, 7) === monthKey));
    setWeekIndex(byMonth >= 0 ? byMonth : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, termStart, weeks.length]);

  const week = weeks[Math.min(weekIndex, weeks.length - 1)];

  const classStudents = useMemo(
    () => [...students].filter((s) => s.grade === className).sort((a, b) => a.name.localeCompare(b.name)),
    [students, className]
  );

  const [grid, setGrid] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [baseline, setBaseline] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  // notes[studentId][date] -- one note per pupil per school day, so a
  // Monday incident and a Tuesday one are two separate notes.
  const [notes, setNotes] = useState<Record<string, Record<string, string>>>({});
  const [noteBaseline, setNoteBaseline] = useState<Record<string, Record<string, string>>>({});
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [holidayDays, setHolidayDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!className || !week) return;
    let cancelled = false;
    setLoading(true);
    setSaved(false);
    setHolidayOpen(false);
    setHolidayDays([]);
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
      setBaseline(map);
      setNotes(noteMap);
      setNoteBaseline(noteMap);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // week is derived fresh from weeks/weekIndex every render, so
    // depending on its start date (a stable primitive) avoids
    // refetching on every unrelated re-render.
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
  const markWholeClass = (dates: string[], status: AttendanceStatus) => {
    setGrid((prev) => {
      const next = { ...prev };
      classStudents.forEach((s) => {
        const row = { ...(next[s.id] ?? {}) };
        dates.forEach((d) => { row[d] = status; });
        next[s.id] = row;
      });
      return next;
    });
    setSaved(false);
  };

  const setNote = (studentId: string, date: string, value: string) => {
    setNotes((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] ?? {}), [date]: value } }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!className || !week) return;
    setSaving(true);
    const changes: { studentId: string; date: string; status: AttendanceStatus }[] = [];
    const noteWrites: { studentId: string; date: string; note: string }[] = [];
    for (const student of classStudents) {
      const row = grid[student.id] ?? {};
      const baseRow = baseline[student.id] ?? {};
      const noteRow = notes[student.id] ?? {};
      const noteBaseRow = noteBaseline[student.id] ?? {};
      for (const { date } of week.days) {
        const value = row[date];
        if (value && value !== baseRow[date]) changes.push({ studentId: student.id, date, status: value });
        const note = noteRow[date] ?? '';
        if (note !== (noteBaseRow[date] ?? '')) noteWrites.push({ studentId: student.id, date, note });
      }
    }

    const [attendanceResult, ...noteResults] = await Promise.all([
      markClassAttendanceBulk(className, changes),
      ...noteWrites.map((n) => upsertAttendanceNote(className, n.studentId, n.date, n.note)),
    ]);
    setSaving(false);
    if (attendanceResult.error) { alert('Failed to save register: ' + attendanceResult.error); return; }
    const noteError = noteResults.find((r) => r.error)?.error;
    if (noteError) { alert('Register saved, but a note failed: ' + noteError); return; }
    setBaseline(grid);
    setNoteBaseline(notes);
    setSaved(true);
  };

  const markedThisWeek = week ? classStudents.reduce((sum, s) => sum + week.days.filter((d) => grid[s.id]?.[d.date]).length, 0) : 0;
  const possibleThisWeek = week ? classStudents.length * week.days.filter((d) => d.date <= today).length : 0;
  const noteCount = (studentId: string) => (week ? week.days.filter((d) => (notes[studentId]?.[d.date] ?? '').trim()).length : 0);

  if (!className) {
    return (
      <PortalLayout title="Attendance Register">
        <div className="card glass" style={{ padding: '40px', textAlign: 'center', borderRadius: '24px' }}>
          <p>You aren't assigned to a class yet. Ask an admin to assign you one before you can take a register.</p>
        </div>
      </PortalLayout>
    );
  }

  const selectStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' };

  return (
    <PortalLayout title={`Attendance Register: ${className}`}>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card glass" style={{ padding: '24px', borderRadius: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div className="input-group">
                <label>Jump to month</label>
                <select value={monthKey} onChange={(e) => setMonthKey(e.target.value)} style={selectStyle}>
                  {MONTH_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Week</label>
                <select value={weekIndex} onChange={(e) => setWeekIndex(Number(e.target.value))} style={selectStyle}>
                  {weeks.map((w, i) => (
                    <option key={w.weekStart} value={i}>
                      Week {w.weekNumber} ({formatShort(w.days[0].date)} - {formatShort(w.days[w.days.length - 1].date)})
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
              <button onClick={() => setHolidayOpen((v) => !v)} className="btn btn-outline sm" type="button" disabled={loading}>
                <CalendarDays size={16} /> Mark holiday
              </button>
              <button onClick={handleSave} className="btn btn-primary sm" type="button" disabled={saving || loading}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : 'Save Register'}
              </button>
            </div>
          </div>

          {holidayOpen && week && (
            <div style={{ marginTop: '16px', padding: '16px', borderRadius: '14px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>
                Which days of Week {week.weekNumber} were a holiday for the whole class?
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {week.days.map(({ date, weekdayName, day }) => {
                  const on = holidayDays.includes(date);
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setHolidayDays((prev) => (on ? prev.filter((d) => d !== date) : [...prev, date]))}
                      style={{
                        padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${on ? STATUS_META.holiday.color : 'var(--glass-border)'}`,
                        background: on ? STATUS_META.holiday.color : 'transparent',
                        color: on ? 'white' : 'var(--text-main)',
                      }}
                    >
                      {weekdayName.slice(0, 3)} {day}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setHolidayDays(holidayDays.length === week.days.length ? [] : week.days.map((d) => d.date))}
                  className="btn btn-outline sm"
                >
                  {holidayDays.length === week.days.length ? 'Clear all' : 'Whole week (Mon-Fri)'}
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary sm"
                disabled={holidayDays.length === 0}
                onClick={() => {
                  markWholeClass(holidayDays, 'holiday');
                  setHolidayOpen(false);
                  setHolidayDays([]);
                }}
              >
                Mark {holidayDays.length || 'no'} day{holidayDays.length === 1 ? '' : 's'} as holiday for all {classStudents.length} pupils
              </button>
            </div>
          )}

          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '14px' }}>
            {markedThisWeek} of {possibleThisWeek} slots marked for {className} this week.
          </p>
          <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
            <Info size={13} /> Tap a cell to cycle Present &rarr; Absent &rarr; Holiday &rarr; blank. Tap a day's name to mark the whole class present for that day. The note icon opens a box for each day, so you can record something for Monday and something different for Tuesday.
          </p>
          {!termStart && (
            <p style={{ fontSize: '12px', color: 'var(--warning)', marginTop: '6px' }}>
              No term start date is set, so weeks are numbered within this month only. Ask an admin to set the term start date on the Academic Calendar page for continuous Week 1-{academicCalendar?.totalWeeks ?? 13} numbering.
            </p>
          )}
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
                            onClick={() => markWholeClass([date], 'present')}
                            title={isFuture ? 'This day hasn\'t happened yet' : `Mark all ${classStudents.length} pupils present on ${weekdayName} ${day}`}
                            style={{
                              width: '100%', minWidth: '72px', padding: '10px 6px', border: 'none', background: 'transparent',
                              cursor: isFuture ? 'default' : 'pointer', opacity: isFuture ? 0.35 : 1,
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                              color: 'var(--text-main)',
                            }}
                          >
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{weekdayName.slice(0, 3)}</span>
                            <span style={{ fontSize: '13px', fontWeight: 700 }}>{day}</span>
                            {!isFuture && (
                              <span style={{ fontSize: '9px', color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.02em' }}>ALL PRESENT</span>
                            )}
                          </button>
                        </th>
                      );
                    })}
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-surface)' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((student, rowIdx) => {
                    const open = openNoteFor === student.id;
                    const count = noteCount(student.id);
                    return (
                      <Fragment key={student.id}>
                        <tr style={{ background: rowIdx % 2 === 0 ? 'transparent' : 'var(--bg-light)' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', borderBottom: open ? 'none' : '1px solid var(--glass-border)' }}>
                            {student.name}
                          </td>
                          {week.days.map(({ date }) => {
                            const status = grid[student.id]?.[date];
                            const meta = status ? STATUS_META[status] : null;
                            const isFuture = date > today;
                            return (
                              <td key={date} style={{ padding: '5px', textAlign: 'center', borderBottom: open ? 'none' : '1px solid var(--glass-border)' }}>
                                <button
                                  type="button"
                                  disabled={isFuture}
                                  onClick={() => cycleCell(student.id, date)}
                                  title={meta?.label ?? 'Not marked'}
                                  aria-label={`${student.name}, ${formatShort(date)}: ${meta?.label ?? 'not marked'}`}
                                  style={{
                                    width: '34px', height: '34px', borderRadius: '9px',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    border: meta ? `2px solid ${meta.color}` : '2px dashed var(--glass-border)',
                                    background: meta ? meta.color : 'transparent',
                                    color: meta ? 'white' : 'var(--text-muted)',
                                    cursor: isFuture ? 'default' : 'pointer',
                                    opacity: isFuture ? 0.3 : 1,
                                    transition: 'background 120ms ease, border-color 120ms ease',
                                  }}
                                >
                                  {status ? CELL_ICON[status] : null}
                                </button>
                              </td>
                            );
                          })}
                          <td style={{ padding: '4px 12px', textAlign: 'center', borderBottom: open ? 'none' : '1px solid var(--glass-border)' }}>
                            <button
                              type="button"
                              className="icon-btn"
                              title={count ? `${count} daily note${count === 1 ? '' : 's'} this week` : 'Add a note for any day this week'}
                              onClick={() => setOpenNoteFor(open ? null : student.id)}
                              style={{ color: count ? 'var(--primary)' : 'var(--text-muted)', position: 'relative' }}
                            >
                              <MessageSquarePlus size={16} />
                              {count > 0 && (
                                <span style={{
                                  position: 'absolute', top: '-2px', right: '-2px', minWidth: '15px', height: '15px',
                                  borderRadius: '999px', background: 'var(--primary)', color: 'white',
                                  fontSize: '9px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>{count}</span>
                              )}
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr style={{ background: rowIdx % 2 === 0 ? 'transparent' : 'var(--bg-light)' }}>
                            <td colSpan={week.days.length + 2} style={{ padding: '4px 16px 16px', borderBottom: '1px solid var(--glass-border)' }}>
                              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                                Daily notes for {student.name} - one box per school day.
                              </p>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
                                {week.days.map(({ date, weekdayName, day }) => (
                                  <div key={date}>
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                      {weekdayName} {day}
                                    </label>
                                    <textarea
                                      rows={2}
                                      placeholder={`What happened on ${weekdayName}?`}
                                      value={notes[student.id]?.[date] ?? ''}
                                      onChange={(e) => setNote(student.id, date, e.target.value)}
                                      style={{ width: '100%', padding: '9px 11px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)', resize: 'vertical', fontSize: '13px' }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
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
