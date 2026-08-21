import { useEffect, useState, type ReactNode } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type AttendanceStatus } from '../../context/AuthContext';
import { CheckCircle2, XCircle, Clock3, Save, Loader2, CheckCheck } from 'lucide-react';

const todayIso = () => new Date().toISOString().slice(0, 10);

const STATUS_META: Record<AttendanceStatus, { label: string; color: string; icon: ReactNode }> = {
  present: { label: 'Present', color: 'var(--success)', icon: <CheckCircle2 size={16} /> },
  absent: { label: 'Absent', color: 'var(--error)', icon: <XCircle size={16} /> },
  late: { label: 'Late', color: 'var(--warning)', icon: <Clock3 size={16} /> },
};

const TeacherRegister = () => {
  const { currentUser, students, getClassAttendance, markClassAttendance } = useAuth();
  const className = currentUser?.assignedClass;
  const [date, setDate] = useState(todayIso());
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const classStudents = students.filter((s) => s.grade === className);

  useEffect(() => {
    if (!className) return;
    let cancelled = false;
    // Synchronous setState-before-fetch is React's own documented data
    // -fetching pattern (react.dev/learn/synchronizing-with-effects) --
    // the lint rule doesn't special-case it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSaved(false);
    getClassAttendance(className, date).then((records) => {
      if (cancelled) return;
      const map: Record<string, AttendanceStatus> = {};
      records.forEach((r) => { map[r.studentId] = r.status; });
      setStatuses(map);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [className, date, getClassAttendance]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
    setSaved(false);
  };

  const markAllPresent = () => {
    const map: Record<string, AttendanceStatus> = {};
    classStudents.forEach((s) => { map[s.id] = 'present'; });
    setStatuses(map);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!className) return;
    setSaving(true);
    const records = classStudents
      .filter((s) => statuses[s.id])
      .map((s) => ({ studentId: s.id, status: statuses[s.id] }));
    const { error } = await markClassAttendance(className, date, records);
    setSaving(false);
    if (error) { alert('Failed to save register: ' + error); return; }
    setSaved(true);
  };

  const markedCount = classStudents.filter((s) => statuses[s.id]).length;

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{className} Pupil Register</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{markedCount} of {classStudents.length} pupils marked for this date.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' }}
              />
              <button onClick={markAllPresent} className="btn btn-outline sm" type="button">
                <CheckCheck size={16} /> Mark All Present
              </button>
              <button onClick={handleSave} className="btn btn-primary sm" type="button" disabled={saving || loading}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : 'Save Register'}
              </button>
            </div>
          </div>
          {saved && <p style={{ color: 'var(--success)', fontSize: '13px', marginTop: '12px', fontWeight: '600' }}>Register saved for {date}.</p>}
        </div>

        <div className="card glass" style={{ padding: '24px', borderRadius: '24px' }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>Loading register...</p>
          ) : classStudents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>No pupils in {className} yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {classStudents.map((student) => {
                const current = statuses[student.id];
                return (
                  <div
                    key={student.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
                      padding: '14px 18px', borderRadius: '14px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: '600' }}>{student.name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{student.displayId}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(Object.keys(STATUS_META) as AttendanceStatus[]).map((status) => {
                        const meta = STATUS_META[status];
                        const active = current === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setStatus(student.id, status)}
                            className="btn sm"
                            style={{
                              borderRadius: '10px',
                              border: `1.5px solid ${active ? meta.color : 'var(--glass-border)'}`,
                              background: active ? meta.color : 'transparent',
                              color: active ? 'white' : meta.color,
                            }}
                          >
                            {meta.icon} {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
};

export default TeacherRegister;
