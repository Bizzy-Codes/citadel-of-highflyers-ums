import { useEffect, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type NewAssignmentInput, type EditAssignmentQuestionInput, type AssignmentSubmission, type AssignmentQuestion, type AssignmentAnswerRow, type AssignmentView } from '../../context/AuthContext';
import { FileText, Plus, Trash2, Users, Download, Paperclip, Lock, RotateCcw, X, Pencil, Eye, CheckCheck } from 'lucide-react';
import './Tests.css';
import DateWheelInput from '../../components/common/DateWheelInput';

const emptyInput: NewAssignmentInput = { subject: '', title: '', description: '', dueDate: '' };

const TeacherAssignments = () => {
  const { currentUser, students, assignments, createAssignment, updateAssignment, getAssignmentViews, getAssignmentViewCounts, deleteAssignment, setAssignmentOpen, getAssignmentQuestions, getAnswersForAssignment, getSubmissionsForAssignment, gradeSubmission, getAssignmentFileUrl } = useAuth();
  const [newQuestions, setNewQuestions] = useState<EditAssignmentQuestionInput[]>([]);
  // Editing an already-posted assignment (null = creating a new one).
  const [editingId, setEditingId] = useState<string | null>(null);
  // "View" window: the assignment as pupils see it, plus who has opened it.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<AssignmentQuestion[]>([]);
  const [detailViews, setDetailViews] = useState<AssignmentView[]>([]);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  useEffect(() => { getAssignmentViewCounts().then(setViewCounts); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [assignments.length]);
  const [viewQuestions, setViewQuestions] = useState<AssignmentQuestion[]>([]);
  const [viewAnswers, setViewAnswers] = useState<AssignmentAnswerRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
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
    const { error } = editingId
      ? await updateAssignment(editingId, { subject: input.subject, title: input.title, description: input.description, dueDate: input.dueDate }, newQuestions, file)
      : await createAssignment({ ...input, questions: newQuestions }, file);
    setSaving(false);
    if (error) { alert((editingId ? 'Failed to save changes: ' : 'Failed to create assignment: ') + error); return; }
    setIsCreating(false);
    setEditingId(null);
    setInput(emptyInput);
    setNewQuestions([]);
    setFile(null);
  };

  const startEdit = async (id: string) => {
    const a = assignments.find((x) => x.id === id);
    if (!a) return;
    setInput({ subject: a.subject, title: a.title, description: a.description ?? '', dueDate: a.dueDate ?? '' });
    setFile(null);
    setEditingId(id);
    const qs = await getAssignmentQuestions(id);
    setNewQuestions(qs.map((q) => ({ id: q.id, prompt: q.prompt, answerMode: q.answerMode, lineCount: q.lineCount })));
    setDetailId(null);
    setIsCreating(true);
  };

  const closeForm = () => { setIsCreating(false); setEditingId(null); setInput(emptyInput); setFile(null); setNewQuestions([]); };

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailQuestions([]);
    setDetailViews([]);
    const [qs, views] = await Promise.all([getAssignmentQuestions(id), getAssignmentViews(id)]);
    setDetailQuestions(qs);
    setDetailViews(views);
    setViewCounts((prev) => ({ ...prev, [id]: views.length }));
  };

  const toggleOpen = async (id: string, open: boolean) => {
    setBusyId(id);
    const { error } = await setAssignmentOpen(id, open);
    setBusyId(null);
    if (error) alert('Could not update the assignment: ' + error);
  };

  const updateNewQuestion = (i: number, patch: Partial<EditAssignmentQuestionInput>) =>
    setNewQuestions(newQuestions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This removes all pupil submissions too.`)) return;
    await deleteAssignment(id);
  };

  const openSubmissions = async (assignmentId: string) => {
    setViewingId(assignmentId);
    setViewQuestions([]);
    setViewAnswers([]);
    const [subs, qs, ans] = await Promise.all([
      getSubmissionsForAssignment(assignmentId), getAssignmentQuestions(assignmentId), getAnswersForAssignment(assignmentId),
    ]);
    setViewQuestions(qs);
    setViewAnswers(ans);
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
    // Open the tab inside the tap so a phone doesn't block it.
    const tab = window.open('', '_blank');
    const url = await getAssignmentFileUrl(path);
    if (url) {
      if (tab) tab.location.replace(url); else window.location.assign(url);
    } else {
      tab?.close();
      alert('Could not generate a download link.');
    }
  };

  const viewingAssignment = assignments.find((a) => a.id === viewingId);
  // Who in the class has not handed it in yet.
  const classPupils = viewingAssignment ? students.filter((s) => s.grade === viewingAssignment.className) : [];
  const handedIn = new Set(submissions.map((s) => s.studentId));
  const missing = classPupils.filter((p) => !handedIn.has(p.id));

  return (
    <PortalLayout title="Assignments">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ marginBottom: '4px' }}>Assignments {currentUser?.assignedClass ? `— ${currentUser.assignedClass}` : ''}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Post assignments with questions. Pupils read them and write in their notebooks, or type in an answer box you open for them.</p>
          </div>
          <button data-ai="assign-new" className="btn btn-primary" onClick={() => setIsCreating(true)}><Plus size={18} /> New Assignment</button>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <strong>{a.title}</strong>
                  {!a.isOpen && <span className="test-status-badge test-status-closed">closed</span>}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {a.subject} {a.dueDate ? `· Due ${new Date(a.dueDate).toLocaleDateString()}` : ''} {a.attachmentName ? `· 📎 ${a.attachmentName}` : ''}
                  {' '}· 👁 Opened by {viewCounts[a.id] ?? 0} of {students.filter((s) => s.grade === a.className).length || '—'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-outline sm" onClick={() => openDetail(a.id)}><Eye size={16} /> View</button>
                <button className="btn btn-outline sm" onClick={() => startEdit(a.id)}><Pencil size={16} /> Edit</button>
                <button className="btn btn-outline sm" onClick={() => openSubmissions(a.id)}><Users size={16} /> Answers</button>
                {a.isOpen
                  ? <button className="btn btn-outline sm" disabled={busyId === a.id} onClick={() => toggleOpen(a.id, false)} title="Hide it from pupils. Nothing is deleted."><Lock size={16} /> Close</button>
                  : <button className="btn btn-primary sm" disabled={busyId === a.id} onClick={() => toggleOpen(a.id, true)} title="Show it to pupils again and notify them."><RotateCcw size={16} /> Republish</button>}
                <button className="icon-btn" title="Delete" onClick={() => handleDelete(a.id, a.title)}><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isCreating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '24px' }}>{editingId ? 'Edit Assignment' : 'New Assignment'}</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label>Title</label>
                <input data-ai="assign-title" type="text" required value={input.title} onChange={(e) => setInput({ ...input, title: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
              </div>
              <div className="input-group">
                <label>Subject</label>
                <input data-ai="assign-subject" type="text" required value={input.subject} onChange={(e) => setInput({ ...input, subject: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
              </div>
              <div className="input-group">
                <label>Description (optional)</label>
                <textarea rows={3} value={input.description} onChange={(e) => setInput({ ...input, description: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', resize: 'none' }} />
              </div>
              <div className="input-group">
                <label>Due Date (optional)</label>
                <div data-ai="assign-due"><DateWheelInput value={input.dueDate} onChange={(v) => setInput({ ...input, dueDate: v })} title="Due date" /></div>
              </div>
              <div className="input-group">
                <label>Questions (optional)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {newQuestions.map((q, i) => (
                    <div key={i} className="grading-answer-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong>Question {i + 1}</strong>
                        <button type="button" className="icon-btn sm" title="Remove question" onClick={() => setNewQuestions(newQuestions.filter((_, idx) => idx !== i))}><X size={14} /></button>
                      </div>
                      <textarea rows={2} required value={q.prompt} placeholder="Type the question..." onChange={(e) => updateNewQuestion(i, { prompt: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', resize: 'none' }} />
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
                        <button type="button" className={`btn sm ${q.answerMode === 'none' ? 'btn-primary' : 'btn-outline'}`} onClick={() => updateNewQuestion(i, { answerMode: 'none' })}>Notebook only</button>
                        <button type="button" className={`btn sm ${q.answerMode === 'box' ? 'btn-primary' : 'btn-outline'}`} onClick={() => updateNewQuestion(i, { answerMode: 'box' })}>Answer box</button>
                        <button type="button" className={`btn sm ${q.answerMode === 'lines' ? 'btn-primary' : 'btn-outline'}`} onClick={() => updateNewQuestion(i, { answerMode: 'lines' })}>Lines i, ii, iii</button>
                        {q.answerMode === 'lines' && (
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                            Lines
                            <input type="number" min={1} max={30} value={q.lineCount} onChange={(e) => updateNewQuestion(i, { lineCount: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })}
                              style={{ width: '64px', padding: '6px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-outline sm" style={{ marginTop: '8px' }}
                  onClick={() => setNewQuestions([...newQuestions, { prompt: '', answerMode: 'none', lineCount: 5 }])}>
                  <Plus size={14} /> Add a question
                </button>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  "Notebook only": pupils copy it into their notebook. "Answer box" or "Lines": they type the answer on the portal and you read it.
                </p>
              </div>
              <div className="input-group">
                <label>Attach a brief (optional)</label>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={closeForm}>Cancel</button>
                <button data-ai="assign-post" type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? (editingId ? 'Saving...' : 'Posting...') : (editingId ? 'Save changes' : 'Post Assignment')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailId && (() => {
        const a = assignments.find((x) => x.id === detailId);
        if (!a) return null;
        const pupils = students.filter((s) => s.grade === a.className);
        const openedIds = new Set(detailViews.map((v) => v.studentId));
        const notOpened = pupils.filter((p) => !openedIds.has(p.id));
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3>{a.title}</h3>
                {!a.isOpen && <span className="test-status-badge test-status-closed">closed</span>}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 14px' }}>
                {a.subject} {a.dueDate ? `· Due ${new Date(a.dueDate).toLocaleDateString()}` : '· No due date'}
              </p>
              {a.description && <p style={{ fontSize: '14px', whiteSpace: 'pre-wrap', marginBottom: '12px' }}>{a.description}</p>}
              {a.attachmentPath && (
                <button className="btn btn-outline sm" style={{ marginBottom: '12px' }} onClick={() => handleDownload(a.attachmentPath!)}>
                  <Download size={14} /> {a.attachmentName ?? 'Download brief'}
                </button>
              )}
              {detailQuestions.map((q, i) => (
                <div key={q.id} className="grading-answer-card" style={{ marginBottom: '10px' }}>
                  <strong style={{ color: 'var(--primary)' }}>Question {i + 1}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    {q.answerMode === 'none' ? 'notebook only' : q.answerMode === 'box' ? 'answer box' : `${q.lineCount} lines (i, ii, iii)`}
                  </span>
                  <p style={{ marginTop: '4px', whiteSpace: 'pre-wrap', fontSize: '14px' }}>{q.prompt}</p>
                </div>
              ))}

              <h4 style={{ fontSize: '14px', margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCheck size={16} color="var(--success)" /> Opened by {detailViews.length} of {pupils.length} pupils
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {detailViews.map((v) => (
                  <div key={v.studentId} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '13px' }}>
                    <span>✓✓ {v.studentName ?? v.studentId}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{new Date(v.firstViewedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
              {notOpened.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <h4 style={{ fontSize: '13px', marginBottom: '6px' }}>Not opened yet ({notOpened.length})</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {notOpened.map((p) => (
                      <span key={p.id} style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)', fontWeight: 600 }}>{p.name}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => startEdit(a.id)}><Pencil size={16} /> Edit</button>
                <button className="btn btn-outline" onClick={() => { setDetailId(null); openSubmissions(a.id); }}><Users size={16} /> See answers</button>
                <button className="btn btn-outline" style={{ marginLeft: 'auto' }} onClick={() => setDetailId(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {viewingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '6px' }}>Submissions: {viewingAssignment?.title}</h3>
            {classPupils.length > 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
                {submissions.length} of {classPupils.length} pupils have handed in.
              </p>
            )}
            {viewQuestions.some((q) => q.answerMode !== 'none') && (() => {
              const typedQs = viewQuestions.filter((q) => q.answerMode !== 'none');
              const byStudent = new Map<string, AssignmentAnswerRow[]>();
              viewAnswers.forEach((r) => byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]));
              return (
                <div style={{ marginBottom: '18px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Typed answers ({byStudent.size} of {classPupils.length || byStudent.size} pupils have started)</h4>
                  {byStudent.size === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nobody has typed an answer yet.</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[...byStudent.entries()].map(([sid, rows]) => (
                      <div key={sid} className="grading-answer-card">
                        <strong>{rows[0].studentName ?? sid}</strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>{rows[0].studentDisplayId}</span>
                        {typedQs.map((q) => {
                          const qi = viewQuestions.findIndex((x) => x.id === q.id) + 1;
                          const row = rows.find((r) => r.questionId === q.id);
                          return (
                            <div key={q.id} style={{ marginTop: '8px' }}>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Q{qi}. {q.prompt}</div>
                              <p style={{ fontSize: '13px', whiteSpace: 'pre-wrap', background: 'var(--bg-light)', padding: '8px', borderRadius: '8px', marginTop: '2px' }}>
                                {row?.answerText?.trim() ? row.answerText : '(no answer)'}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {submissions.length === 0 && viewQuestions.every((q) => q.answerMode === 'none') && <p style={{ color: 'var(--text-muted)' }}>Nothing handed in on the portal for this one.</p>}
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
            {missing.length > 0 && (
              <div style={{ marginTop: '18px' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Not handed in yet ({missing.length})</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {missing.map((p) => (
                    <span key={p.id} style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)', fontWeight: 600 }}>{p.name}</span>
                  ))}
                </div>
              </div>
            )}
            <button className="btn btn-outline" style={{ width: '100%', marginTop: '20px' }} onClick={() => setViewingId(null)}>Close</button>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

export default TeacherAssignments;
