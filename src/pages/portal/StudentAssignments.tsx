import { useEffect, useRef, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import AnswerSheet from '../../components/portal/AnswerSheet';
import { useAuth, type Assignment, type AssignmentQuestion } from '../../context/AuthContext';
import { FileText, Download, Clock, AlertTriangle, ChevronDown, ChevronUp, NotebookPen, CheckCircle2 } from 'lucide-react';
import './Tests.css';

const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
const dayLabel = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

type SaveState = 'saving' | 'saved' | 'error';

// One assignment. Pupils read it (and copy the questions into their
// notebook); if the teacher opened an answer sheet for a question, they
// type the answer there and it saves by itself. Nothing is uploaded.
const AssignmentCard = ({ a, today, open, onToggle }: { a: Assignment; today: string; open: boolean; onToggle: () => void }) => {
  const { getAssignmentQuestions, getMyAnswers, saveMyAnswer, getAssignmentFileUrl, recordAssignmentView } = useAuth();
  const [questions, setQuestions] = useState<AssignmentQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!open || questions) return;
    let cancelled = false;
    (async () => {
      const [qs, mine] = await Promise.all([getAssignmentQuestions(a.id), getMyAnswers(a.id)]);
      if (cancelled) return;
      setQuestions(qs);
      setAnswers(mine);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Read receipt: the teacher can see the pupil has opened this.
  useEffect(() => {
    if (open) recordAssignmentView(a.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  const handleChange = (questionId: string, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
    setSaveState((prev) => ({ ...prev, [questionId]: 'saving' }));
    clearTimeout(timers.current[questionId]);
    timers.current[questionId] = setTimeout(async () => {
      const { error } = await saveMyAnswer(a.id, questionId, text);
      setSaveState((prev) => ({ ...prev, [questionId]: error ? 'error' : 'saved' }));
    }, 700);
  };

  const handleDownload = async (path: string) => {
    // Open the tab straight away (inside the tap) -- phones block a tab
    // that is opened only after waiting for the link.
    const tab = window.open('', '_blank');
    const url = await getAssignmentFileUrl(path);
    if (url) {
      if (tab) tab.location.replace(url); else window.location.assign(url);
    } else {
      tab?.close();
      alert('Could not open the file. Please try again.');
    }
  };

  const overdue = !!a.dueDate && a.dueDate < today;
  const dueToday = a.dueDate === today;

  return (
    <div className="test-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <strong>{a.title}</strong>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{a.subject}</span>
            {a.dueDate && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: overdue ? 'var(--error)' : dueToday ? 'var(--warning)' : undefined, fontWeight: overdue || dueToday ? 700 : undefined }}>
                {overdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                {overdue ? 'Was due ' : dueToday ? 'Due today · ' : 'Due '}{dayLabel(a.dueDate)}
              </span>
            )}
          </p>
        </div>
        <button className="btn btn-primary sm" onClick={onToggle}>
          {open ? <><ChevronUp size={16} /> Close</> : <><ChevronDown size={16} /> Open</>}
        </button>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {a.description && <p style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{a.description}</p>}
          {a.attachmentPath && (
            <button className="btn btn-outline sm" style={{ alignSelf: 'flex-start' }} onClick={() => handleDownload(a.attachmentPath!)}>
              <Download size={14} /> {a.attachmentName ?? 'Download Brief'}
            </button>
          )}

          {questions === null && <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading questions...</p>}
          {questions?.length === 0 && !a.description && !a.attachmentPath && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Your teacher will tell you what to do for this one.</p>
          )}

          {questions?.map((q, i) => (
            <div key={q.id} className="grading-answer-card">
              <strong style={{ color: 'var(--primary)' }}>Question {i + 1}</strong>
              <p style={{ margin: '6px 0 10px', whiteSpace: 'pre-wrap', fontSize: '15px' }}>{q.prompt}</p>
              {q.answerMode === 'none' ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <NotebookPen size={14} /> Copy this question into your notebook and write your answer there.
                </p>
              ) : (
                <>
                  <AnswerSheet
                    mode={q.answerMode}
                    lineCount={q.lineCount}
                    value={answers[q.id] ?? ''}
                    onChange={(text) => handleChange(q.id, text)}
                  />
                  <p style={{ fontSize: '12px', marginTop: '6px', minHeight: '16px', color: saveState[q.id] === 'error' ? 'var(--error)' : 'var(--text-muted)' }}>
                    {saveState[q.id] === 'saving' && 'Saving...'}
                    {saveState[q.id] === 'saved' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}><CheckCircle2 size={12} /> Saved</span>}
                    {saveState[q.id] === 'error' && 'Not saved -- check your connection and keep typing to try again.'}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StudentAssignments = () => {
  const { assignments } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const today = todayIso();
  const sorted = [...assignments].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));

  return (
    <PortalLayout title="My Assignments">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h2>My Assignments</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Open an assignment to read the questions. Write your answers in your notebook, unless your teacher gave you an answer box to type in.</p>
        </div>

        {assignments.length === 0 && (
          <div className="card glass" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <FileText size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p>No assignments posted yet.</p>
          </div>
        )}

        {sorted.length > 0 && (
          <div className="card glass" style={{ padding: '0' }}>
            {sorted.map((a) => (
              <AssignmentCard key={a.id} a={a} today={today} open={openId === a.id} onToggle={() => setOpenId(openId === a.id ? null : a.id)} />
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
};

export default StudentAssignments;
