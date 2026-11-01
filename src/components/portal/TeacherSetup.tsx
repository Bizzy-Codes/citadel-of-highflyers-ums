import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { useAuth, type TeachingClass, type User } from '../../context/AuthContext';
import { CLASSES } from '../../lib/accounts';

// Admin: is this teacher a class teacher (looks after one whole class) or
// a subject teacher (teaches some subjects in one or more classes)?
// A subject teacher can enter marks for their own subjects, set
// assignments and tests, and use the class chat -- but not take the
// class register or write report-card comments.
const TeacherSetup = ({ teacher }: { teacher: User }) => {
  const { subjectsByClass, getTeacherSetup, saveTeacherSetup } = useAuth();
  const [kind, setKind] = useState<'main' | 'sub'>(teacher.teacherKind === 'sub' ? 'sub' : 'main');
  const [rows, setRows] = useState<TeachingClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTeacherSetup(teacher.id).then((list) => {
      if (cancelled) return;
      setRows(list);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher.id]);

  const used = new Set(rows.map((r) => r.className));
  const nextFree = CLASSES.find((c) => !used.has(c));

  const addRow = () => {
    if (!nextFree) return;
    setRows((cur) => [...cur, { className: nextFree, subjects: [] }]);
    setMessage(null);
  };
  const removeRow = (i: number) => setRows((cur) => cur.filter((_, idx) => idx !== i));
  const setClass = (i: number, className: string) =>
    setRows((cur) => cur.map((r, idx) => (idx === i ? { className, subjects: [] } : r)));
  const toggleSubject = (i: number, subject: string) =>
    setRows((cur) => cur.map((r, idx) => {
      if (idx !== i) return r;
      return { ...r, subjects: r.subjects.includes(subject) ? r.subjects.filter((s) => s !== subject) : [...r.subjects, subject] };
    }));

  const save = async () => {
    setMessage(null);
    if (kind === 'sub') {
      if (rows.length === 0) { setMessage({ ok: false, text: 'Add at least one class for a subject teacher.' }); return; }
      const empty = rows.find((r) => r.subjects.length === 0);
      if (empty) { setMessage({ ok: false, text: `Tick at least one subject for ${empty.className}.` }); return; }
    }
    setSaving(true);
    const { error } = await saveTeacherSetup(teacher.id, kind, kind === 'sub' ? rows : []);
    setSaving(false);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: 'Saved.' });
  };

  return (
    <div className="teacher-setup">
      <h3 style={{ marginBottom: '6px' }}>Teacher type</h3>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
        A <b>class teacher</b> looks after one whole class. A <b>subject teacher</b> only teaches certain subjects, in one or more classes
        — they enter marks for those subjects, set assignments and tests, and join each class's chat.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
        <button type="button" className={`btn sm ${kind === 'main' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setKind('main'); setMessage(null); }}>Class teacher</button>
        <button type="button" className={`btn sm ${kind === 'sub' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setKind('sub'); setMessage(null); if (rows.length === 0 && nextFree) setRows([{ className: nextFree, subjects: [] }]); }}>Subject teacher</button>
      </div>

      {kind === 'main' && (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Their class is the "Assigned Class" above. {teacher.teacherKind === 'sub' ? 'Saving turns them back into a class teacher.' : ''}
        </p>
      )}

      {kind === 'sub' && (loading ? (
        <p style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rows.map((row, i) => {
            const options = subjectsByClass[row.className] ?? [];
            return (
              <div key={row.className} style={{ padding: '14px', borderRadius: '16px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                  <select
                    value={row.className}
                    onChange={(e) => setClass(i, e.target.value)}
                    style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)' }}
                  >
                    {CLASSES.filter((c) => c === row.className || !used.has(c)).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="button" className="icon-btn" onClick={() => removeRow(i)} aria-label={`Remove ${row.className}`}><Trash2 size={16} /></button>
                </div>
                {options.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--warning)', margin: 0 }}>No subjects are set up for {row.className} yet — add them under User Management &gt; Subjects first.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
                    {options.map((s) => (
                      <label key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                        <input type="checkbox" checked={row.subjects.includes(s)} onChange={() => toggleSubject(i, s)} /> {s}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {nextFree && (
            <button type="button" className="btn btn-outline sm" style={{ alignSelf: 'flex-start' }} onClick={addRow}><Plus size={15} /> Add another class</button>
          )}
        </div>
      ))}

      {message && (
        <p role="status" style={{ marginTop: '12px', fontSize: '13px', fontWeight: 600, color: message.ok ? 'var(--success)' : 'var(--error)' }}>{message.text}</p>
      )}
      <button type="button" className="btn btn-primary" style={{ marginTop: '14px' }} onClick={save} disabled={saving || (kind === 'sub' && loading)}>
        <Save size={16} /> {saving ? 'Saving…' : 'Save teacher type'}
      </button>
    </div>
  );
};

export default TeacherSetup;
