import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type PaymentReceipt } from '../../context/AuthContext';
import { ArrowLeft, Save, KeyRound, Trash2, UserCheck, Receipt, Loader2 } from 'lucide-react';

const CLASSES = ["Daycare", "Reception", "Kindergarten 1", "Kindergarten 2", "Pre-Grade", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"];

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const RECEIPT_STATUS_STYLE: Record<PaymentReceipt['status'], { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', label: 'Pending' },
  acknowledged: { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', label: 'Acknowledged' },
  rejected: { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', label: 'Rejected' },
};

const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' };

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="input-group">
    <label>{label}</label>
    {children}
  </div>
);

const AdminUserDetail = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const {
    students, staff, updateUser, adminSetPassword, deleteUser, approveTeacher,
    getAllPaymentReceipts, getPaymentReceiptUrl,
  } = useAuth();

  const user = [...students, ...staff].find((u) => u.id === userId);

  const [form, setForm] = useState({ name: '', phone: '', location: '', grade: '', assignedClass: '', status: 'Active' as 'Active' | 'Inactive' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name,
      phone: user.phone ?? '',
      location: user.location ?? '',
      grade: user.grade ?? CLASSES[0],
      assignedClass: user.assignedClass ?? '',
      status: user.status,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user || user.role !== 'student') { setLoadingReceipts(false); return; }
    (async () => {
      const all = await getAllPaymentReceipts();
      setReceipts(all.filter((r) => r.studentId === user.id));
      setLoadingReceipts(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) {
    return (
      <PortalLayout title="User Not Found">
        <div className="card glass" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ marginBottom: '16px' }}>This user couldn't be found.</p>
          <Link to="/portal/admin/users" className="btn btn-outline"><ArrowLeft size={16} /> Back to User Management</Link>
        </div>
      </PortalLayout>
    );
  }

  const isStudent = user.role === 'student';
  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    await updateUser(user.id, {
      name: form.name,
      phone: form.phone,
      location: form.location,
      status: form.status,
      ...(isStudent ? { grade: form.grade } : { assignedClass: form.assignedClass || undefined }),
    });
    setSavingProfile(false);
    alert('Profile updated.');
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return; }
    setSettingPassword(true);
    const { error } = await adminSetPassword(user.id, newPassword);
    setSettingPassword(false);
    if (error) { setPasswordError(error); return; }
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage(`Password updated. ${user.name} can log in with it right away -- no email was sent.`);
  };

  const handleApprove = async () => {
    await approveTeacher(user.id);
    alert('Teacher approved. They now have portal access.');
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${user.name}? This removes their portal access permanently.`)) return;
    await deleteUser(user.id);
    navigate('/portal/admin/users');
  };

  const handleViewReceipt = async (path: string) => {
    const url = await getPaymentReceiptUrl(path);
    if (url) window.open(url, '_blank');
    else alert('Could not open this receipt.');
  };

  return (
    <PortalLayout title="Pupil / Staff Profile">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Link to="/portal/admin/users" className="back-btn" style={{ alignSelf: 'flex-start' }}><ArrowLeft size={18} /> Back to User Management</Link>

        <div className="card glass" style={{ padding: '32px', borderRadius: '32px' }}>
          <div style={{ display: 'flex', gap: '28px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              width: '110px', height: '110px', borderRadius: '50%', flexShrink: 0,
              background: user.avatarUrl ? undefined : 'linear-gradient(135deg, var(--primary), var(--secondary))',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '36px', fontWeight: 800, border: '4px solid white', boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
            }}>
              {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(user.name)}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '4px' }}>{user.name}</h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '10px' }}>{user.displayId} · {user.email || 'No email on file'}</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '11px', fontWeight: 700, background: 'var(--accent)', color: 'var(--primary)' }}>
                  {isStudent ? user.grade : (user.role === 'teacher_pending' ? 'Pending Teacher' : user.role)}
                </span>
                <span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '11px', fontWeight: 700, background: user.status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: user.status === 'Active' ? 'var(--success)' : 'var(--error)' }}>
                  {user.status}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {user.role === 'teacher_pending' && (
                <button onClick={handleApprove} className="btn btn-primary sm"><UserCheck size={16} /> Approve Teacher</button>
              )}
              <button onClick={handleDelete} className="btn btn-outline sm" style={{ color: 'var(--error)' }}><Trash2 size={16} /> Delete User</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          <div className="card glass" style={{ padding: '28px', borderRadius: '24px' }}>
            <h3 style={{ marginBottom: '20px' }}>Profile Details</h3>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field label="Full Name">
                <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field label="Phone">
                <input type="tel" style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Location / Address">
                <input style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
              {isStudent ? (
                <Field label="Grade / Class">
                  <select style={inputStyle} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="Assigned Class">
                  <select style={inputStyle} value={form.assignedClass} onChange={(e) => setForm({ ...form, assignedClass: e.target.value })}>
                    <option value="">None / Admin</option>
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Account Status">
                <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </Field>
              <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ marginTop: '8px' }}>
                <Save size={16} /> {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          <div className="card glass" style={{ padding: '28px', borderRadius: '24px' }}>
            <h3 style={{ marginBottom: '6px' }}>Set New Password</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Sets their login password directly -- no email is sent. Use this when someone has lost access to the email on their account.
            </p>
            <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {passwordError && <div className="admission-form-error">{passwordError}</div>}
              {passwordMessage && <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '12px 16px', borderRadius: '10px', fontSize: '14px' }}>{passwordMessage}</div>}
              <Field label="New Password">
                <input type="password" style={inputStyle} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required />
              </Field>
              <Field label="Confirm Password">
                <input type="password" style={inputStyle} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required />
              </Field>
              <button type="submit" className="btn btn-outline" disabled={settingPassword} style={{ marginTop: '8px' }}>
                <KeyRound size={16} /> {settingPassword ? 'Updating...' : 'Set Password'}
              </button>
            </form>
          </div>

          {isStudent && (
            <div className="card glass" style={{ padding: '28px', borderRadius: '24px', gridColumn: '1 / -1' }}>
              <h3 style={{ marginBottom: '16px' }}>Fee / Payment History</h3>
              {loadingReceipts ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Loader2 className="animate-spin" /></div>
              ) : receipts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  <Receipt size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p>No payment receipts submitted yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {receipts.map((r) => {
                    const s = RECEIPT_STATUS_STYLE[r.status];
                    return (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '14px 18px', borderRadius: '12px', background: 'var(--bg-light)' }}>
                        <div>
                          <strong>{naira(r.amount)}</strong>
                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{r.note || 'No note'} · {new Date(r.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>
                          <button className="btn btn-outline sm" onClick={() => handleViewReceipt(r.filePath)}><Receipt size={14} /> View</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
};

export default AdminUserDetail;
