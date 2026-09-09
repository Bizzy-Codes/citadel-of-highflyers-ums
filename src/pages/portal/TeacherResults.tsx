import { useEffect, useMemo, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import ReportCard from '../../components/portal/ReportCard';
import { useAuth, type Result, type ReportCardData, type SubjectStats, type User } from '../../context/AuthContext';
import { RATING_OPTIONS, gradeFromScore } from '../../lib/grading';
import { Download, Pencil, Users, X, Save, ClipboardList, Calculator } from 'lucide-react';

const PSYCHOMOTOR_FIELDS = [
  ['commOralRating', 'Communication (Oral)'],
  ['creativityRating', 'Creativity'],
  ['drawingPaintingRating', 'Drawing & Painting'],
  ['musicRating', 'Music'],
  ['sportsRating', 'Sports'],
] as const;

const AFFECTIVE_FIELDS = [
  ['honestyRating', 'Honesty'],
  ['punctualityRating', 'Punctuality & Cleanliness'],
  ['attentivenessRating', 'Attentiveness & Promptness'],
  ['politenessRating', 'Politeness & Considerate'],
  ['obedienceRating', 'Obedience & Homework'],
  ['independenceRating', 'Works Independently'],
  ['socialRating', 'Social Skills'],
] as const;

// Scores are kept as raw strings (not numbers) so a field can sit
// empty while a teacher types -- binding a number input straight to a
// number state snaps a cleared field back to a literal "0"
// (Number('') === 0) and makes "type 5 over the 0" land as "50".
type ScoreRow = { ca1: string; ca2: string; exam: string };
const BLANK_ROW: ScoreRow = { ca1: '', ca2: '', exam: '' };
const n = (v: string) => Number(v) || 0;
const rowTotal = (r: ScoreRow) => n(r.ca1) + n(r.ca2) + n(r.exam);
const rowHasMarks = (r: ScoreRow) => n(r.ca1) > 0 || n(r.ca2) > 0 || n(r.exam) > 0;

// Teachers pick a pupil in their class, type CA1/CA2/Exam straight
// into a sheet that's already listing every subject the class offers
// (set by the admin in User Management > Subjects), watch the totals
// and grades add themselves up, and save. Term and session come from
// the Academic Calendar -- never typed here, never per pupil.
const TeacherResults = () => {
  const {
    currentUser, students, academicCalendar, subjectsByClass,
    getReportCard, upsertReportCard, getSubjectStats, saveSubjectResults,
  } = useAuth();

  const className = currentUser?.assignedClass ?? '';
  const term: Result['term'] = academicCalendar?.currentTerm ?? '1st Term';
  const session = academicCalendar?.currentSession ?? '';

  const classStudents = useMemo(
    () => [...students]
      .filter((s) => s.role === 'student' && s.grade === className)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [students, className]
  );

  // Every subject the class offers, plus any subject a pupil somehow
  // already has a result for that isn't on the list (so nothing is
  // ever hidden). This is the sheet's row order.
  const classSubjects = useMemo(() => subjectsByClass[className] ?? [], [subjectsByClass, className]);

  const [selectedId, setSelectedId] = useState('');
  const selectedStudent: User | undefined = useMemo(
    () => classStudents.find((s) => s.id === selectedId),
    [classStudents, selectedId]
  );

  const [reportCard, setReportCard] = useState<ReportCardData | null>(null);
  const [subjectStats, setSubjectStats] = useState<Record<string, SubjectStats>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<ReportCardData>({});
  const [saving, setSaving] = useState(false);

  const [scores, setScores] = useState<Record<string, ScoreRow>>({});
  const [savingScores, setSavingScores] = useState(false);
  const [scoresSaved, setScoresSaved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const existingResults = useMemo(
    () => (selectedStudent?.results ?? []).filter((r) => r.term === term && r.session === session),
    [selectedStudent, term, session]
  );

  // Rows shown in the sheet: class subject list first, then any extra
  // subject the pupil already has a result for.
  const sheetSubjects = useMemo(() => {
    const extra = existingResults.map((r) => r.subject).filter((s) => !classSubjects.includes(s));
    return [...classSubjects, ...extra];
  }, [classSubjects, existingResults]);

  // Load the sheet from whatever's already saved whenever the pupil
  // (or the term/session from the calendar) changes.
  useEffect(() => {
    if (!selectedStudent) { setScores({}); setReportCard(null); setSubjectStats({}); return; }
    const next: Record<string, ScoreRow> = {};
    sheetSubjects.forEach((subject) => {
      const r = existingResults.find((x) => x.subject === subject);
      next[subject] = r
        ? { ca1: r.ca1 != null ? String(r.ca1) : '', ca2: r.ca2 != null ? String(r.ca2) : '', exam: r.exam != null ? String(r.exam) : '' }
        : { ...BLANK_ROW };
    });
    setScores(next);
    setScoresSaved(false);

    getReportCard(selectedStudent.id, term, session).then(setReportCard);
    Promise.all(
      existingResults.map((r) => getSubjectStats(selectedStudent.id, r.subject, term, session).then((stats) => [r.subject, stats] as const))
    ).then((entries) => {
      const map: Record<string, SubjectStats> = {};
      for (const [subject, stats] of entries) if (stats) map[subject] = stats;
      setSubjectStats(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, term, session, sheetSubjects.length, reloadKey]);

  const setCell = (subject: string, key: keyof ScoreRow, value: string) => {
    setScores((prev) => ({ ...prev, [subject]: { ...(prev[subject] ?? BLANK_ROW), [key]: value } }));
    setScoresSaved(false);
  };

  const handleSaveScores = async () => {
    if (!selectedStudent) return;
    if (!session) { alert('Set the Current Session on the Academic Calendar page first.'); return; }

    const bad = sheetSubjects
      .map((subject) => ({ subject, r: scores[subject] ?? BLANK_ROW }))
      .filter(({ r }) => n(r.ca1) > 20 || n(r.ca2) > 20 || n(r.exam) > 60 || rowTotal(r) > 100 || n(r.ca1) < 0 || n(r.ca2) < 0 || n(r.exam) < 0);
    if (bad.length > 0) {
      alert(`Check the marks for: ${bad.map((b) => b.subject).join(', ')}.\nEach CA is out of 20, the exam out of 60, and the total can't be over 100.`);
      return;
    }

    setSavingScores(true);
    const rows = sheetSubjects.map((subject) => {
      const r = scores[subject] ?? BLANK_ROW;
      return { subject, ca1: n(r.ca1), ca2: n(r.ca2), exam: n(r.exam) };
    });
    const { error } = await saveSubjectResults(selectedStudent.id, term, session, rows);
    setSavingScores(false);
    if (error) { alert('Failed to save scores: ' + error); return; }
    setScoresSaved(true);
    setReloadKey((k) => k + 1); // pull fresh stats + report card
  };

  const openEdit = () => { setEditDraft(reportCard ?? {}); setIsEditing(true); };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setSaving(true);
    await upsertReportCard(selectedStudent.id, term, session, editDraft);
    setReportCard(editDraft);
    setSaving(false);
    setIsEditing(false);
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' };
  const cellInput: React.CSSProperties = { width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', textAlign: 'center' };

  return (
    <PortalLayout title="Report Cards">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <div className="card glass" style={{ padding: '24px', borderRadius: '24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ flex: '1 1 260px' }}>
              <label>Pupil</label>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={inputStyle}>
                <option value="">-- Select a pupil --</option>
                {classStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.displayId})</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', paddingBottom: '12px' }}>
              Term & Session:{' '}
              <strong style={{ color: 'var(--text-main)' }}>{term}</strong>{' '}
              &middot; <strong style={{ color: 'var(--text-main)' }}>{session || 'not set'}</strong>
              <span style={{ display: 'block', fontSize: '11px' }}>Set on the Academic Calendar page.</span>
            </div>
            {selectedStudent && (
              <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                <button className="btn btn-outline" onClick={openEdit}><Pencil size={16} /> Edit Ratings & Comments</button>
                <button className="btn btn-primary" onClick={() => window.print()}><Download size={16} /> Download</button>
              </div>
            )}
          </div>
        </div>

        {!selectedStudent && (
          <div className="card glass" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
            {classStudents.length === 0 ? (
              <p>{className ? `No pupils in ${className} yet.` : "You don't have a class assigned yet -- ask an admin to assign one."}</p>
            ) : (
              <p>Pick a pupil above to enter their scores and preview the report card.</p>
            )}
          </div>
        )}

        {selectedStudent && (
          <div className="card glass" style={{ padding: '24px', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calculator size={18} /> Subject Scores &mdash; {selectedStudent.name}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {scoresSaved && <span style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 600 }}>Scores saved.</span>}
                <button className="btn btn-primary sm" onClick={handleSaveScores} disabled={savingScores}>
                  <Save size={16} /> {savingScores ? 'Saving...' : 'Save Scores'}
                </button>
              </div>
            </div>

            {sheetSubjects.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '12px', borderRadius: '10px', background: 'var(--bg-light)', border: '1px dashed var(--glass-border)' }}>
                No subjects defined for {className}. An admin adds them in User Management &gt; Subjects, then they show up here automatically.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid var(--glass-border)' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', border: '1px solid var(--glass-border)', minWidth: '160px' }}>Subject</th>
                      <th style={{ padding: '10px 8px', border: '1px solid var(--glass-border)', width: '90px' }}>1st CA (20)</th>
                      <th style={{ padding: '10px 8px', border: '1px solid var(--glass-border)', width: '90px' }}>2nd CA (20)</th>
                      <th style={{ padding: '10px 8px', border: '1px solid var(--glass-border)', width: '90px' }}>Exam (60)</th>
                      <th style={{ padding: '10px 8px', border: '1px solid var(--glass-border)', width: '80px' }}>Total</th>
                      <th style={{ padding: '10px 8px', border: '1px solid var(--glass-border)', width: '70px' }}>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheetSubjects.map((subject) => {
                      const row = scores[subject] ?? BLANK_ROW;
                      const total = rowTotal(row);
                      const marked = rowHasMarks(row);
                      return (
                        <tr key={subject}>
                          <td style={{ padding: '8px 12px', border: '1px solid var(--glass-border)', fontWeight: 600, fontSize: '13px' }}>{subject}</td>
                          <td style={{ padding: '4px', border: '1px solid var(--glass-border)' }}>
                            <input type="number" min="0" max="20" value={row.ca1} onChange={(e) => setCell(subject, 'ca1', e.target.value)} style={cellInput} />
                          </td>
                          <td style={{ padding: '4px', border: '1px solid var(--glass-border)' }}>
                            <input type="number" min="0" max="20" value={row.ca2} onChange={(e) => setCell(subject, 'ca2', e.target.value)} style={cellInput} />
                          </td>
                          <td style={{ padding: '4px', border: '1px solid var(--glass-border)' }}>
                            <input type="number" min="0" max="60" value={row.exam} onChange={(e) => setCell(subject, 'exam', e.target.value)} style={cellInput} />
                          </td>
                          <td style={{ padding: '8px', border: '1px solid var(--glass-border)', textAlign: 'center', fontWeight: 700 }}>
                            {marked ? total : '-'}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid var(--glass-border)', textAlign: 'center', fontWeight: 700 }}>
                            {marked ? gradeFromScore(total).grade : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
              Totals and grades add up automatically. Blank rows are skipped &mdash; only subjects with a mark are saved.
            </p>
          </div>
        )}

        {selectedStudent && (
          <div className="card glass report-card-wrapper" style={{ padding: '20px', overflowX: 'auto' }}>
            <ReportCard
              student={selectedStudent}
              term={term}
              session={session}
              results={existingResults}
              reportCard={reportCard}
              subjectStats={subjectStats}
              totalInClass={Object.values(subjectStats)[0]?.totalInClass ?? classStudents.length}
              classSubjects={sheetSubjects}
            />
          </div>
        )}
      </div>

      {isEditing && selectedStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ClipboardList size={20} /> Report Card: {selectedStudent.name}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>{term} &middot; {session || 'session not set'}</p>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label>This Term Ends</label>
                  <input type="date" value={editDraft.termEnds ?? ''} onChange={(e) => setEditDraft({ ...editDraft, termEnds: e.target.value })} style={inputStyle} />
                </div>
                <div className="input-group">
                  <label>Next Term Begins</label>
                  <input type="date" value={editDraft.nextTermBegins ?? ''} onChange={(e) => setEditDraft({ ...editDraft, nextTermBegins: e.target.value })} style={inputStyle} />
                </div>
              </div>

              <div className="input-group">
                <label>Overall Remark</label>
                <input type="text" placeholder="e.g. A hardworking and diligent pupil." value={editDraft.remark ?? ''} onChange={(e) => setEditDraft({ ...editDraft, remark: e.target.value })} style={inputStyle} />
              </div>

              <h4 style={{ marginTop: '8px' }}>Psychomotor Domain</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {PSYCHOMOTOR_FIELDS.map(([key, label]) => (
                  <div className="input-group" key={key}>
                    <label>{label}</label>
                    <select value={editDraft[key] ?? ''} onChange={(e) => setEditDraft({ ...editDraft, [key]: e.target.value })} style={inputStyle}>
                      <option value="">-- Not rated --</option>
                      {RATING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <h4 style={{ marginTop: '8px' }}>Affective Domain (Conduct)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {AFFECTIVE_FIELDS.map(([key, label]) => (
                  <div className="input-group" key={key}>
                    <label>{label}</label>
                    <select value={editDraft[key] ?? ''} onChange={(e) => setEditDraft({ ...editDraft, [key]: e.target.value })} style={inputStyle}>
                      <option value="">-- Not rated --</option>
                      {RATING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <h4 style={{ marginTop: '8px' }}>Comments & Signatures</h4>
              <div className="input-group">
                <label>Head Master's Comment</label>
                <input type="text" value={editDraft.headmasterComment ?? ''} onChange={(e) => setEditDraft({ ...editDraft, headmasterComment: e.target.value })} style={inputStyle} />
              </div>
              <div className="input-group">
                <label>Class Teacher's Comment</label>
                <input type="text" value={editDraft.classTeacherComment ?? ''} onChange={(e) => setEditDraft({ ...editDraft, classTeacherComment: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label>Head Master's Signature</label>
                  <input type="text" placeholder="Typed name" value={editDraft.headmasterSignature ?? ''} onChange={(e) => setEditDraft({ ...editDraft, headmasterSignature: e.target.value })} style={inputStyle} />
                </div>
                <div className="input-group">
                  <label>Class Teacher's Signature</label>
                  <input type="text" placeholder="Typed name" value={editDraft.classTeacherSignature ?? ''} onChange={(e) => setEditDraft({ ...editDraft, classTeacherSignature: e.target.value })} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsEditing(false)} className="btn btn-outline" style={{ flex: 1 }}><X size={16} /> Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save Report Card'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

export default TeacherResults;
