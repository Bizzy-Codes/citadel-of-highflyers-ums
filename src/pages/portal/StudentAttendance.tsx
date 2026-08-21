import { useEffect, useState, type ReactNode } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type AttendanceRecord, type AttendanceStatus } from '../../context/AuthContext';
import { CheckCircle2, XCircle, Clock3, FileText, CalendarClock } from 'lucide-react';

const STATUS_META: Record<AttendanceStatus, { label: string; color: string; icon: ReactNode }> = {
  present: { label: 'Present', color: 'var(--success)', icon: <CheckCircle2 size={14} /> },
  absent: { label: 'Absent', color: 'var(--error)', icon: <XCircle size={14} /> },
  late: { label: 'Late', color: 'var(--warning)', icon: <Clock3 size={14} /> },
};

const addDays = (isoDate: string, days: number) => {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const formatShort = (isoDate: string) =>
  new Date(isoDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

interface Week {
  weekNumber: number;
  start: string;
  end: string;
  records: AttendanceRecord[];
  isCurrent: boolean;
}

const StudentAttendance = () => {
  const { academicCalendar, getMyAttendance, getAcademicCalendarDocumentUrl } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyAttendance().then((r) => { setRecords(r); setLoading(false); });
  }, [getMyAttendance]);

  const documentUrl = getAcademicCalendarDocumentUrl();
  const isPdf = academicCalendar?.documentName?.toLowerCase().endsWith('.pdf');

  const weeks: Week[] = [];
  if (academicCalendar?.termStartDate) {
    const start = academicCalendar.termStartDate;
    const todayIso = new Date().toISOString().slice(0, 10);
    for (let w = 1; w <= academicCalendar.totalWeeks; w++) {
      const weekStart = addDays(start, (w - 1) * 7);
      const weekEnd = addDays(start, w * 7 - 1);
      weeks.push({
        weekNumber: w,
        start: weekStart,
        end: weekEnd,
        records: records.filter((r) => r.attendanceDate >= weekStart && r.attendanceDate <= weekEnd),
        isCurrent: todayIso >= weekStart && todayIso <= weekEnd,
      });
    }
  }

  return (
    <PortalLayout title="My Attendance">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card glass-purple" style={{ padding: '24px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{academicCalendar?.term ?? 'This Term'}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {academicCalendar?.totalWeeks ?? '—'} academic weeks{academicCalendar?.termStartDate ? ` · starting ${formatShort(academicCalendar.termStartDate)}` : ''}
            </p>
          </div>
          {documentUrl && (
            <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline sm">
              <FileText size={16} /> View School Calendar {isPdf ? '(PDF)' : ''}
            </a>
          )}
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>Loading attendance...</p>
        ) : !academicCalendar?.termStartDate ? (
          <div className="card glass" style={{ padding: '40px', textAlign: 'center', borderRadius: '24px' }}>
            <CalendarClock size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
            <p style={{ color: 'var(--text-muted)' }}>Attendance tracking hasn't started yet -- the school hasn't set the term's start date. Check back once the academic calendar is published.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {weeks.map((week) => {
              const presentCount = week.records.filter((r) => r.status === 'present').length;
              const absentCount = week.records.filter((r) => r.status === 'absent').length;
              const lateCount = week.records.filter((r) => r.status === 'late').length;
              return (
                <div
                  key={week.weekNumber}
                  className="card glass"
                  style={{
                    padding: '20px 24px', borderRadius: '18px',
                    border: week.isCurrent ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: week.records.length ? '14px' : 0 }}>
                    <div>
                      <p style={{ fontWeight: '700' }}>
                        Week {week.weekNumber} {week.isCurrent && <span style={{ color: 'var(--primary)', fontSize: '12px', fontWeight: '700' }}>· CURRENT</span>}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatShort(week.start)} – {formatShort(week.end)}</p>
                    </div>
                    {week.records.length > 0 && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {presentCount} present · {lateCount} late · {absentCount} absent
                      </p>
                    )}
                  </div>
                  {week.records.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {week.records.map((r) => {
                        const meta = STATUS_META[r.status];
                        return (
                          <span
                            key={r.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '50px',
                              fontSize: '12px', fontWeight: '700', color: meta.color, background: 'var(--bg-surface)', border: `1px solid ${meta.color}`,
                            }}
                          >
                            {meta.icon} {formatShort(r.attendanceDate)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
};

export default StudentAttendance;
