import { useEffect, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import ReportCard from '../../components/portal/ReportCard';
import { useAuth, type Result, type ReportCardData, type SubjectStats, type User } from '../../context/AuthContext';
import { RATING_OPTIONS } from '../../lib/grading';
import { Download, Pencil, Users, X, Save, ClipboardList } from 'lucide-react';

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

// Teachers used to land on the exact same "Academic Results" page a
// pupil sees -- which shows a pupil's own results, so for a teacher
// (who has none) it was a near-empty duplicate of the student view.
// This replaces it with what a teacher actually needs there: pick any
// pupil in their class from a dropdown, see their report card exactly
// as it will print, and edit the ratings/remarks/comments right from
// that preview. Subject scores (CA1/CA2/Exam) are still entered from
// Class Management -- this page is for reviewing and finishing the
// report card once scores are in, not for re-doing that entry form.
const TeacherResults = () => {
  const { currentUser, students, getReportCard, upsertReportCard, getSubjectStats } = useAuth();

  const classStudents = [...students]
    .filter((s) => s.role === 'student' && s.grade === currentUser?.assignedClass)
    .sort((a, b) => a.name.localeCompare(b.name));

  const [selectedId, setSelectedId] = useState('');
  const selectedStudent: User | undefined = classStudents.find((s) => s.id === selectedId);

  const [term, setTerm] = useState<Result['term']>('1st Term');
  const [session, setSession] = useState('2023/2024');
  const [reportCard, setReportCard] = useState<ReportCardData | null>(null);
  const [subjectStats, setSubjectStats] = useState<Record<string, SubjectStats>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<ReportCardData>({});
  const [saving, setSaving] = useState(false);

  const reportResults = (selectedStudent?.results ?? []).filter((r) => r.term === term && r.session === session);

  // Jumping to a newly-picked pupil should default to whichever
  // term/session their most recent result belongs to, same as the
  // pupil's own view does -- not silently keep showing the previous
  // pupil's term selection against an empty result set.
  useEffect(() => {
    if (!selectedStudent) return;
    const latest = [...(selectedStudent.results ?? [])].sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    )[0];
    setTerm(latest?.term ?? '1st Term');
    setSession(latest?.session ?? '2023/2024');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!selectedStudent) { setReportCard(null); setSubjectStats({}); return; }
    getReportCard(selectedStudent.id, term, session).then(setReportCard);
    Promise.all(
      reportResults.map((r) => getSubjectStats(selectedStudent.id, r.subject, term, session).then((stats) => [r.subject, stats] as const))
    ).then((entries) => {
      const map: Record<string, SubjectStats> = {};
      for (const [subject, stats] of entries) if (stats) map[subject] = stats;
      setSubjectStats(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, term, session]);

  const openEdit = () => {
    setEditDraft(reportCard ?? {});
    setIsEditing(true);
  };

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
            <div className="input-group" style={{ flex: '0 1 160px' }}>
              <label>Term</label>
              <select value={term} onChange={(e) => setTerm(e.target.value as Result['term'])} style={inputStyle} disabled={!selectedStudent}>
                <option>1st Term</option>
                <option>2nd Term</option>
                <option>3rd Term</option>
              </select>
            </div>
            <div className="input-group" style={{ flex: '0 1 160px' }}>
              <label>Session</label>
              <input type="text" value={session} onChange={(e) => setSession(e.target.value)} style={inputStyle} disabled={!selectedStudent} />
            </div>
            {selectedStudent && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-outline" onClick={openEdit}><Pencil size={16} /> Edit</button>
                <button className="btn btn-primary" onClick={() => window.print()}><Download size={16} /> Download</button>
              </div>
            )}
          </div>
        </div>

        {!selectedStudent && (
          <div className="card glass" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
            {classStudents.length === 0 ? (
              <p>{currentUser?.assignedClass ? `No pupils in ${currentUser.assignedClass} yet.` : "You don't have a class assigned yet -- ask an admin to assign one."}</p>
            ) : (
              <p>Pick a pupil above to preview and edit their report card.</p>
            )}
          </div>
        )}

        {selectedStudent && (
          <div className="card glass report-card-wrapper" style={{ padding: '20px', overflowX: 'auto' }}>
            <ReportCard
              student={selectedStudent}
              term={term}
              session={session}
              results={reportResults}
              reportCard={reportCard}
              subjectStats={subjectStats}
              totalInClass={Object.values(subjectStats)[0]?.totalInClass ?? classStudents.length}
            />
          </div>
        )}
      </div>

      {isEditing && selectedStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ClipboardList size={20} /> Report Card: {selectedStudent.name}
            </h3>
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
