import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type NewTestInput } from '../../context/AuthContext';
import { ClipboardList, Plus, Pencil, Radio, Trash2, Send, Lock } from 'lucide-react';
import './Tests.css';

const emptyInput: NewTestInput = { subject: '', title: '', instructions: '', durationMinutes: 30 };

const TeacherTests = () => {
  const navigate = useNavigate();
  const { currentUser, tests, createTest, publishTest, closeTest, deleteTest } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [input, setInput] = useState<NewTestInput>(emptyInput);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error, testId } = await createTest(input);
    if (error) { alert('Failed to create test: ' + error); return; }
    setIsCreating(false);
    setInput(emptyInput);
    if (testId) navigate(`/portal/teacher/tests/${testId}`);
  };

  const handlePublish = async (id: string) => {
    setBusyId(id);
    const { error } = await publishTest(id);
    setBusyId(null);
    if (error) alert('Failed to publish: ' + error);
  };

  const handleClose = async (id: string) => {
    setBusyId(id);
    const { error } = await closeTest(id);
    setBusyId(null);
    if (error) alert('Failed to close: ' + error);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This removes all questions and student attempts. This cannot be undone.`)) return;
    setBusyId(id);
    await deleteTest(id);
    setBusyId(null);
  };

  return (
    <PortalLayout title="Manage Tests">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ marginBottom: '4px' }}>Tests {currentUser?.assignedClass ? `— ${currentUser.assignedClass}` : ''}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Create timed tests, publish them, and monitor attempts live.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setIsCreating(true)}><Plus size={18} /> Create Test</button>
        </div>

        <div className="card glass" style={{ padding: '0' }}>
          {tests.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <ClipboardList size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>No tests yet. Create one to get started.</p>
            </div>
          )}
          {tests.map((t) => (
            <div key={t.id} className="test-row">
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <strong>{t.title}</strong>
                  <span className={`test-status-badge test-status-${t.status}`}>{t.status}</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {t.subject} &middot; {t.durationMinutes} min &middot; {t.totalPoints} pts
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-outline sm" onClick={() => navigate(`/portal/teacher/tests/${t.id}`)}><Pencil size={16} /> Edit</button>
                <button className="btn btn-outline sm" onClick={() => navigate(`/portal/teacher/tests/${t.id}/monitor`)}><Radio size={16} /> Monitor</button>
                {t.status !== 'published' && t.status !== 'closed' && (
                  <button className="btn btn-primary sm" disabled={busyId === t.id} onClick={() => handlePublish(t.id)}><Send size={16} /> Publish</button>
                )}
                {t.status === 'published' && (
                  <button className="btn btn-outline sm" disabled={busyId === t.id} onClick={() => handleClose(t.id)}><Lock size={16} /> Close</button>
                )}
                <button className="icon-btn" title="Delete" disabled={busyId === t.id} onClick={() => handleDelete(t.id, t.title)}><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isCreating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '440px' }}>
            <h3 style={{ marginBottom: '24px' }}>Create Test</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label>Title</label>
                <input type="text" required value={input.title} onChange={(e) => setInput({ ...input, title: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
              </div>
              <div className="input-group">
                <label>Subject</label>
                <input type="text" required placeholder="e.g. Mathematics" value={input.subject} onChange={(e) => setInput({ ...input, subject: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
              </div>
              <div className="input-group">
                <label>Instructions (optional)</label>
                <textarea rows={3} value={input.instructions} onChange={(e) => setInput({ ...input, instructions: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', resize: 'none' }} />
              </div>
              <div className="input-group">
                <label>Duration (minutes)</label>
                <input type="number" min={1} required value={input.durationMinutes} onChange={(e) => setInput({ ...input, durationMinutes: Number(e.target.value) })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsCreating(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create &amp; Add Questions</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

export default TeacherTests;
