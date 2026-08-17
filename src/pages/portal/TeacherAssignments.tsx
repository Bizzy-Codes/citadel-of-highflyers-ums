import { useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type NewAssignmentInput, type AssignmentSubmission } from '../../context/AuthContext';
import { FileText, Plus, Trash2, Users, Download, Paperclip } from 'lucide-react';
import './Tests.css';

const emptyInput: NewAssignmentInput = { subject: '', title: '', description: '', dueDate: '' };

const TeacherAssignments = () => {
  const { currentUser, assignments, createAssignment, deleteAssignment, getSubmissionsForAssignment, gradeSubmission, getAssignmentFileUrl } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [input, setInput] = useState<NewAssignmentInput>(emptyInput);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { grade: string; feedback: string }>>({});

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await createAssignment(input, file);
    setSaving(false);
    if (error) { alert('Failed to create assignment: ' + error); return; }
    setIsCreating(false);
    setInput(emptyInput);
    setFile(null);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This removes all student submissions too.`)) return;
    await deleteAssignment(id);
  };

  const openSubmissions = async (assignmentId: string) => {
    setViewingId(assignmentId);
    const subs = await getSubmissionsForAssignment(assignmentId);
    setSubmissions(subs);
    const d: Record<string, { grade: string; feedback: string }> = {};
    subs.forEach((s) => { d[s.id] = { grade: s.grade ?? '', feedback: s.feedback ?? '' }; });
    setDrafts(d);
  };

  const handleGrade = async (submissionId: string) => {
    const draft = drafts[submissionId];
    if (!draft) return;
    const { error } = await gradeSubmission(submissionId, draft.grade, draft.feedback);
    if (error) { alert('Failed to save grade: ' + error); return; }
    if (viewingId) setSubmissions(await getSubmissionsForAssignment(viewingId));
  };

  const handleDownload = async (path: string) => {
    const url = await getAssignmentFileUrl(path);
    if (url) window.open(url, '_blank');
    else alert('Could not generate a download link.');
  };

  const viewingAssignment = assignments.find((a) => a.id === viewingId);

  return (
    <PortalLayout title="Assignments">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ marginBottom: '4px' }}>Assignments {currentUser?.assignedClass ? `— ${currentUser.assignedClass}` : ''}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Post assignments with an optional brief, then review and grade student submissions.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setIsCreating(true)}><Plus size={18} /> New Assignment</button>
        </div>

        <div className="card glass" style={{ padding: '0' }}>
          {assignments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <FileText size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>No assignments posted yet.</p>
            </div>
          )}
          {assignments.map((a) => (
            <div key={a.id} className="test-row">
              <div style={{ flex: 1, minWidth: '200px' }}>
                <strong>{a.title}</strong>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {a.subject} {a.dueDate ? `· Due ${new Date(a.dueDate).toLocaleDateString()}` : ''} {a.attachmentName ? `· 📎 ${a.attachmentName}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-outline sm" onClick={() => openSubmissions(a.id)}><Users size={16} /> Submissions</button>
                <button className="icon-btn" title="Delete" onClick={() => handleDelete(a.id, a.title)}><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isCreating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '440px' }}>
            <h3 style={{ marginBottom: '24px' }}>New Assignment</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label>Title</label>
                <input type="text" required value={input.title} onChange={(e) => setInput({ ...input, title: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
              </div>
              <div className="input-group">
                <label>Subject</label>
                <input type="text" required value={input.subject} onChange={(e) => setInput({ ...input, subject: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
              </div>
              <div className="input-group">
                <label>Description (optional)</label>
                <textarea rows={3} value={input.description} onChange={(e) => setInput({ ...input, description: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', resize: 'none' }} />
              </div>
              <div className="input-group">
                <label>Due Date (optional)</label>
                <input type="date" value={input.dueDate} onChange={(e) => setInput({ ...input, dueDate: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
              </div>
              <div className="input-group">
                <label>Attach a brief (optional)</label>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setIsCreating(false); setFile(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Posting...' : 'Post Assignment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '20px' }}>Submissions: {viewingAssignment?.title}</h3>
            {submissions.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No submissions yet.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {submissions.map((s) => (
                <div key={s.id} className="grading-answer-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                    <div>
                      <strong>{s.studentName ?? s.studentId}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.studentDisplayId} · Submitted {new Date(s.submittedAt).toLocaleString()}</div>
                    </div>
                    <button className="icon-btn" title="Download submission" onClick={() => handleDownload(s.filePath)}><Download size={16} /></button>
                  </div>
                  <p style={{ fontSize: '13px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><Paperclip size={14} /> {s.fileName}</p>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <input type="text" placeholder="grade (e.g. A, 85%)" value={drafts[s.id]?.grade ?? ''}
                      onChange={(e) => setDrafts({ ...drafts, [s.id]: { ...(drafts[s.id] ?? { feedback: '' }), grade: e.target.value } })}
                      style={{ width: '140px', padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
                    <input type="text" placeholder="feedback (optional)" value={drafts[s.id]?.feedback ?? ''}
                      onChange={(e) => setDrafts({ ...drafts, [s.id]: { ...(drafts[s.id] ?? { grade: '' }), feedback: e.target.value } })}
                      style={{ flex: 1, minWidth: '160px', padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
                    <button className="btn btn-primary sm" onClick={() => handleGrade(s.id)}>Save</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-outline" style={{ width: '100%', marginTop: '20px' }} onClick={() => setViewingId(null)}>Close</button>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

export default TeacherAssignments;
