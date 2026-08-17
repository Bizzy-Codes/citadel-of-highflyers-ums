import { useRef, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth } from '../../context/AuthContext';
import { FileText, Download, Upload, CheckCircle2, Paperclip } from 'lucide-react';
import './Tests.css';

const StudentAssignments = () => {
  const { assignments, mySubmissions, submitAssignment, getAssignmentFileUrl } = useAuth();
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileChosen = async (assignmentId: string, file: File | null) => {
    if (!file) return;
    setSubmittingId(assignmentId);
    const { error } = await submitAssignment(assignmentId, file);
    setSubmittingId(null);
    if (error) alert('Failed to submit: ' + error);
  };

  const handleDownload = async (path: string) => {
    const url = await getAssignmentFileUrl(path);
    if (url) window.open(url, '_blank');
    else alert('Could not generate a download link.');
  };

  return (
    <PortalLayout title="My Assignments">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h2>My Assignments</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Assignments posted for your class. Upload a photo or document to submit your work.</p>
        </div>

        <div className="card glass" style={{ padding: '0' }}>
          {assignments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <FileText size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>No assignments posted yet.</p>
            </div>
          )}
          {assignments.map((a) => {
            const submission = mySubmissions[a.id];
            const locked = !!submission?.grade;
            return (
              <div key={a.id} className="test-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <strong>{a.title}</strong>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {a.subject} {a.dueDate ? `· Due ${new Date(a.dueDate).toLocaleDateString()}` : ''}
                  </p>
                  {a.description && <p style={{ fontSize: '13px', marginTop: '6px' }}>{a.description}</p>}
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
                        <CheckCircle2 size={14} /> Submitted
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Paperclip size={12} /> {submission.fileName}
                      </span>
                      {submission.grade && (
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>Grade: {submission.grade}</span>
                      )}
                      {submission.feedback && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>{submission.feedback}</span>
                      )}
                      {!locked && (
                        <>
                          <input ref={(el) => { fileInputRefs.current[a.id] = el; }} type="file" style={{ display: 'none' }}
                            onChange={(e) => { handleFileChosen(a.id, e.target.files?.[0] ?? null); e.target.value = ''; }} />
                          <button className="btn btn-outline sm" disabled={submittingId === a.id} onClick={() => fileInputRefs.current[a.id]?.click()}>
                            {submittingId === a.id ? 'Uploading...' : 'Resubmit'}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <input ref={(el) => { fileInputRefs.current[a.id] = el; }} type="file" style={{ display: 'none' }}
                        onChange={(e) => { handleFileChosen(a.id, e.target.files?.[0] ?? null); e.target.value = ''; }} />
                      <button className="btn btn-primary sm" disabled={submittingId === a.id} onClick={() => fileInputRefs.current[a.id]?.click()}>
                        <Upload size={14} /> {submittingId === a.id ? 'Uploading...' : 'Submit Work'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PortalLayout>
  );
};

export default StudentAssignments;
