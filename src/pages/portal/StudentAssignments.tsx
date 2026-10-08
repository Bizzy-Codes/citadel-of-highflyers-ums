import { useRef, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type Assignment } from '../../context/AuthContext';
import { compressImageToTarget } from '../../lib/imageCompression';
import { FileText, Download, Upload, CheckCircle2, Paperclip, Clock, AlertTriangle } from 'lucide-react';
import './Tests.css';

const MAX_BYTES = 25 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 2 * 1024 * 1024; // phone photos are compressed to about this

const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
const dayLabel = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const StudentAssignments = () => {
  const { assignments, mySubmissions, submitAssignment, getAssignmentFileUrl } = useAuth();
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [okId, setOkId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileChosen = async (assignmentId: string, chosen: File | null) => {
    if (!chosen) return;
    if (chosen.size > MAX_BYTES) { alert('That file is too big (over 25MB). Please choose a smaller one.'); return; }
    setSubmittingId(assignmentId);
    setOkId(null);
    let file = chosen;
    // A phone camera photo can be 5-10MB; shrink it so it uploads on a weak connection.
    if (chosen.type.startsWith('image/') && chosen.size > TARGET_IMAGE_BYTES) {
      try { file = await compressImageToTarget(chosen, TARGET_IMAGE_BYTES); } catch { /* send the original */ }
    }
    const { error } = await submitAssignment(assignmentId, file);
    setSubmittingId(null);
    if (error) alert('Your work was NOT sent: ' + error + '\n\nPlease check your connection and try again.');
    else setOkId(assignmentId);
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

  const today = todayIso();
  const sorted = [...assignments].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const todo = sorted.filter((a) => !mySubmissions[a.id]);
  const done = sorted.filter((a) => mySubmissions[a.id]).reverse();

  const renderRow = (a: Assignment) => {
    const submission = mySubmissions[a.id];
    const locked = !!submission?.grade;
    const overdue = !submission && !!a.dueDate && a.dueDate < today;
    const dueToday = !submission && a.dueDate === today;
    const input = (
      <input ref={(el) => { fileInputRefs.current[a.id] = el; }} type="file" style={{ display: 'none' }}
        onChange={(e) => { handleFileChosen(a.id, e.target.files?.[0] ?? null); e.target.value = ''; }} />
    );
    return (
      <div key={a.id} className="test-row" style={{ alignItems: 'flex-start' }}>
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
          {a.description && <p style={{ fontSize: '13px', marginTop: '6px', whiteSpace: 'pre-wrap' }}>{a.description}</p>}
          {a.attachmentPath && (
            <button className="btn btn-outline sm" style={{ marginTop: '8px' }} onClick={() => handleDownload(a.attachmentPath!)}>
              <Download size={14} /> {a.attachmentName ?? 'Download Brief'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '160px' }}>
          {submission ? (
            <>
              <span className="test-result-pill">
                <CheckCircle2 size={14} /> {okId === a.id ? 'Sent!' : 'Submitted'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Paperclip size={12} /> {submission.fileName}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {new Date(submission.submittedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              {submission.grade && <span style={{ fontSize: '13px', fontWeight: 700 }}>Grade: {submission.grade}</span>}
              {submission.feedback && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>{submission.feedback}</span>
              )}
              {!locked && (
                <>
                  {input}
                  <button className="btn btn-outline sm" disabled={submittingId === a.id} onClick={() => fileInputRefs.current[a.id]?.click()}>
                    {submittingId === a.id ? 'Uploading...' : 'Resubmit'}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {input}
              <button data-ai="assignment-submit" className="btn btn-primary sm" disabled={submittingId === a.id} onClick={() => fileInputRefs.current[a.id]?.click()}>
                <Upload size={14} /> {submittingId === a.id ? 'Uploading...' : 'Submit Work'}
              </button>
              {overdue && <span style={{ fontSize: '11px', color: 'var(--error)' }}>Late — you can still send it</span>}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <PortalLayout title="My Assignments">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h2>My Assignments</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Assignments posted for your class. Upload a photo or document to submit your work.</p>
        </div>

        {assignments.length === 0 && (
          <div className="card glass" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <FileText size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p>No assignments posted yet.</p>
          </div>
        )}

        {todo.length > 0 && (
          <div>
            <h3 style={{ fontSize: '15px', marginBottom: '10px' }}>To do ({todo.length})</h3>
            <div className="card glass" style={{ padding: '0' }}>{todo.map(renderRow)}</div>
          </div>
        )}

        {done.length > 0 && (
          <div>
            <h3 style={{ fontSize: '15px', marginBottom: '10px' }}>Done ({done.length})</h3>
            <div className="card glass" style={{ padding: '0' }}>{done.map(renderRow)}</div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
};

export default StudentAssignments;
