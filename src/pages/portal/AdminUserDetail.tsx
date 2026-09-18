import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type PaymentReceipt, type AttendanceRecord } from '../../context/AuthContext';
import AttendanceSummaryCard from '../../components/portal/AttendanceSummaryCard';
import { summarizeAttendance } from '../../lib/attendance';
import { ArrowLeft, Save, KeyRound, Trash2, UserCheck, Receipt, Loader2, Wand2, Eye, EyeOff, Printer, AlertTriangle, DownloadCloud, MessageCircle } from 'lucide-react';
import StudentRecordSheet from '../../components/portal/StudentRecordSheet';
import ContactParentDialog from '../../components/portal/ContactParentDialog';
import { buildLoginDetailsMessage } from '../../lib/outreach';
import { DEFAULT_ACCOUNT_PASSWORD, CLASSES } from '../../lib/accounts';

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
    getAllPaymentReceipts, getPaymentReceiptUrl, getStudentAttendance, academicCalendar,
    importAdmissionDetails,
  } = useAuth();

  const user = [...students, ...staff].find((u) => u.id === userId);

  const BLANK_FORM = {
    name: '', phone: '', location: '', grade: '', assignedClass: '', status: 'Active' as 'Active' | 'Inactive',
    // Pupil bio + guardian block (patch_22) -- filled from the admission
    // form when the child was admitted, or by the family at sign-up.
    sex: '' as '' | 'Male' | 'Female', dateOfBirth: '', homeAddress: '',
    nationality: '', stateOfOrigin: '', lga: '', religion: '', bloodGroup: '', genotype: '', healthNotes: '',
    fatherName: '', fatherOccupation: '', fatherPhone: '',
    motherName: '', motherOccupation: '', motherPhone: '',
    pickupPerson: '', pickupPhone: '',
  };
  const [form, setForm] = useState(BLANK_FORM);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [sendingLogin, setSendingLogin] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name,
      phone: user.phone ?? '',
      location: user.location ?? '',
      grade: user.grade ?? CLASSES[0],
      assignedClass: user.assignedClass ?? '',
      status: user.status,
      sex: user.sex ?? '',
      dateOfBirth: user.dateOfBirth ?? '',
      homeAddress: user.homeAddress ?? '',
      nationality: user.nationality ?? '',
      stateOfOrigin: user.stateOfOrigin ?? '',
      lga: user.lga ?? '',
      religion: user.religion ?? '',
      bloodGroup: user.bloodGroup ?? '',
      genotype: user.genotype ?? '',
      healthNotes: user.healthNotes ?? '',
      fatherName: user.fatherName ?? '',
      fatherOccupation: user.fatherOccupation ?? '',
      fatherPhone: user.fatherPhone ?? '',
      motherName: user.motherName ?? '',
      motherOccupation: user.motherOccupation ?? '',
      motherPhone: user.motherPhone ?? '',
      pickupPerson: user.pickupPerson ?? '',
      pickupPhone: user.pickupPhone ?? '',
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

  useEffect(() => {
    if (!user || user.role !== 'student') { setLoadingAttendance(false); return; }
    setLoadingAttendance(true);
    getStudentAttendance(user.id).then((records) => {
      setAttendanceRecords(records);
      setLoadingAttendance(false);
    });
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
  // "Nothing on file" -- the signal that an admission application's
  // details never made it onto this profile.
  const detailsLookEmpty = isStudent
    && !user.bloodGroup && !user.fatherName && !user.motherName && !user.nationality && !user.dateOfBirth;
  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const attendanceSummary = summarizeAttendance(attendanceRecords, academicCalendar?.totalWeeks);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    const { error } = await updateUser(user.id, {
      name: form.name,
      phone: form.phone,
      location: form.location,
      status: form.status,
      ...(isStudent ? {
        grade: form.grade,
        sex: form.sex || undefined,
        dateOfBirth: form.dateOfBirth,
        homeAddress: form.homeAddress,
        nationality: form.nationality,
        stateOfOrigin: form.stateOfOrigin,
        lga: form.lga,
        religion: form.religion,
        bloodGroup: form.bloodGroup,
        genotype: form.genotype,
        healthNotes: form.healthNotes,
        fatherName: form.fatherName,
        fatherOccupation: form.fatherOccupation,
        fatherPhone: form.fatherPhone,
        motherName: form.motherName,
        motherOccupation: form.motherOccupation,
        motherPhone: form.motherPhone,
        pickupPerson: form.pickupPerson,
        pickupPhone: form.pickupPhone,
      } : { assignedClass: form.assignedClass || undefined }),
    });
    setSavingProfile(false);
    if (error) { alert('Failed to save profile: ' + error); return; }
    setSaveMessage('Saved. You can come back and fill in the rest at any time.');
    setTimeout(() => setSaveMessage(null), 4000);
  };

  // Recovers whatever the family filled in on their admission form but
  // which never reached this profile.
  const handleImportDetails = async () => {
    setImporting(true);
    const { error, filled } = await importAdmissionDetails(user.id);
    setImporting(false);
    if (error) { alert(error); return; }
    if (!filled) { alert('Nothing to import — this pupil\'s record already has everything from their application.'); return; }
    alert(`Imported ${filled} detail${filled === 1 ? '' : 's'} from ${user.name}'s admission application.`);
  };

  // Printing scopes itself with a body class so the print rules in
  // StudentRecordSheet.css only take over while this is running -- the
  // report card's own print rules live in the same document.
  const handlePrintRecord = () => {
    document.body.classList.add('printing-record');
    const cleanup = () => {
      document.body.classList.remove('printing-record');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    // Safari/older browsers don't always fire afterprint.
    setTimeout(cleanup, 3000);
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

  // Fills both fields with the school's standard default (revealed, not
  // masked) so the admin can read it straight off the screen. Parents
  // could not reliably type or remember the random strings this used to
  // generate, which is the whole reason for a single known default.
  const useDefaultPassword = () => {
    setNewPassword(DEFAULT_ACCOUNT_PASSWORD);
    setConfirmPassword(DEFAULT_ACCOUNT_PASSWORD);
    setShowPassword(true);
    setPasswordMessage(null);
    setPasswordError(null);
  };

  const handleApprove = async () => {
    await approveTeacher(user.id);
    alert('Teacher approved. They now have portal access.');
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${user.name}? This removes their portal access and frees up their email permanently -- this can't be undone.`)) return;
    const { error } = await deleteUser(user.id);
    if (error) { alert(`Failed to delete user: ${error}`); return; }
    navigate('/portal/admin/users');
  };

  const handleViewReceipt = async (path: string) => {
    const url = await getPaymentReceiptUrl(path);
    if (url) window.open(url, '_blank');
    else alert('Could not open this receipt.');
  };

  return (
    <PortalLayout title="Pupil / Staff Profile">
      <ContactParentDialog
        open={sendingLogin}
        title="Send login details"
        description={`Choose who to send ${user.name}'s portal login to. The message uses their name as the login, not the email on the account.`}
        contacts={[
          { role: 'Father', name: user.fatherName, phone: user.fatherPhone },
          { role: 'Mother', name: user.motherName, phone: user.motherPhone },
          { role: 'Pickup contact', name: user.pickupPerson, phone: user.pickupPhone },
          { role: 'Number on the account', phone: user.phone },
        ]}
        message={buildLoginDetailsMessage({
          studentName: user.name,
          displayId: user.displayId,
          password: DEFAULT_ACCOUNT_PASSWORD,
          className: user.grade,
        })}
        onClose={() => setSendingLogin(false)}
      />

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
                <span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '11px', fontWeight: 700, background: user.role === 'teacher_pending' ? 'rgba(245, 158, 11, 0.1)' : user.status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: user.role === 'teacher_pending' ? 'var(--warning)' : user.status === 'Active' ? 'var(--success)' : 'var(--error)' }}>
                  {user.role === 'teacher_pending' ? 'Pending' : user.status}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isStudent && (
                <button onClick={() => setSendingLogin(true)} className="btn btn-primary sm">
                  <MessageCircle size={16} /> Send Login Details
                </button>
              )}
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

            {/* Everyone admitted before the admit step started copying
                the application across has a profile full of blanks,
                while the data sits intact on the application itself. */}
            {isStudent && detailsLookEmpty && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                padding: '14px 16px', borderRadius: '12px', marginBottom: '18px',
                background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)',
              }}>
                <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: '200px', fontSize: '13px' }}>
                  <strong>This pupil's details are missing.</strong> If their family filled in an
                  admission form, everything they entered is still on it and can be pulled over.
                </div>
                <button type="button" className="btn btn-primary sm" disabled={importing} onClick={handleImportDetails}>
                  <DownloadCloud size={15} /> {importing ? 'Importing...' : 'Import from Application'}
                </button>
              </div>
            )}

            {saveMessage && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', marginBottom: '16px' }}>
                {saveMessage}
              </div>
            )}

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Nothing here is `required`. The office fills a profile
                  in over days as information trickles in, so the form
                  must always save whatever has been typed so far and
                  leave the rest blank. */}
              <Field label="Full Name">
                <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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

              {/* Everything the family filled in on the admissions form
                  (or at sign-up) -- editable here so the office can keep
                  it current without going back to the application. */}
              {isStudent && (
                <>
                  <h4 style={{ marginTop: '14px' }}>Pupil Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Field label="Sex">
                      <select style={inputStyle} value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as '' | 'Male' | 'Female' })}>
                        <option value="">Not recorded</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </Field>
                    <Field label="Date of Birth">
                      <input type="date" style={inputStyle} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
                    </Field>
                    <Field label="Nationality">
                      <input style={inputStyle} value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
                    </Field>
                    <Field label="State of Origin">
                      <input style={inputStyle} value={form.stateOfOrigin} onChange={(e) => setForm({ ...form, stateOfOrigin: e.target.value })} />
                    </Field>
                    <Field label="L.G.A">
                      <input style={inputStyle} value={form.lga} onChange={(e) => setForm({ ...form, lga: e.target.value })} />
                    </Field>
                    <Field label="Religion">
                      <input style={inputStyle} value={form.religion} onChange={(e) => setForm({ ...form, religion: e.target.value })} />
                    </Field>
                    <Field label="Blood Group">
                      <input style={inputStyle} value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} />
                    </Field>
                    <Field label="Genotype">
                      <input style={inputStyle} value={form.genotype} onChange={(e) => setForm({ ...form, genotype: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Home Address">
                    <input style={inputStyle} value={form.homeAddress} onChange={(e) => setForm({ ...form, homeAddress: e.target.value })} />
                  </Field>
                  <Field label="Health Notes">
                    <input style={inputStyle} placeholder="Allergies, conditions, medication..." value={form.healthNotes} onChange={(e) => setForm({ ...form, healthNotes: e.target.value })} />
                  </Field>

                  <h4 style={{ marginTop: '14px' }}>Father / Guardian</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Field label="Name"><input style={inputStyle} value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} /></Field>
                    <Field label="Occupation"><input style={inputStyle} value={form.fatherOccupation} onChange={(e) => setForm({ ...form, fatherOccupation: e.target.value })} /></Field>
                  </div>
                  <Field label="Father's Phone"><input type="tel" style={inputStyle} value={form.fatherPhone} onChange={(e) => setForm({ ...form, fatherPhone: e.target.value })} /></Field>

                  <h4 style={{ marginTop: '14px' }}>Mother / Guardian</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Field label="Name"><input style={inputStyle} value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} /></Field>
                    <Field label="Occupation"><input style={inputStyle} value={form.motherOccupation} onChange={(e) => setForm({ ...form, motherOccupation: e.target.value })} /></Field>
                  </div>
                  <Field label="Mother's Phone"><input type="tel" style={inputStyle} value={form.motherPhone} onChange={(e) => setForm({ ...form, motherPhone: e.target.value })} /></Field>

                  <h4 style={{ marginTop: '14px' }}>Collection</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Field label="Authorised for Pickup"><input style={inputStyle} value={form.pickupPerson} onChange={(e) => setForm({ ...form, pickupPerson: e.target.value })} /></Field>
                    <Field label="Pickup Phone"><input type="tel" style={inputStyle} value={form.pickupPhone} onChange={(e) => setForm({ ...form, pickupPhone: e.target.value })} /></Field>
                  </div>
                </>
              )}

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
              <button type="button" onClick={useDefaultPassword} className="btn btn-outline sm" style={{ alignSelf: 'flex-start' }}>
                <Wand2 size={14} /> Use Default Password ({DEFAULT_ACCOUNT_PASSWORD})
              </button>
              <Field label="New Password">
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    style={{ ...inputStyle, paddingRight: '40px' }}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              <Field label="Confirm Password">
                <input type={showPassword ? 'text' : 'password'} style={inputStyle} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required />
              </Field>
              <button type="submit" className="btn btn-outline" disabled={settingPassword} style={{ marginTop: '8px' }}>
                <KeyRound size={16} /> {settingPassword ? 'Updating...' : 'Set Password'}
              </button>
            </form>
          </div>

          {isStudent && (
            <div className="card glass" style={{ padding: '28px', borderRadius: '24px', gridColumn: '1 / -1' }}>
              <h3 style={{ marginBottom: '16px' }}>Attendance Record</h3>
              {loadingAttendance ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Loader2 className="animate-spin" /></div>
              ) : (
                <AttendanceSummaryCard summary={attendanceSummary} hasCalendar={!!academicCalendar?.termStartDate} />
              )}
            </div>
          )}

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

          {/* Printable A4 record -- the whole pupil file on one sheet. */}
          {isStudent && (
            <div className="card glass student-record-wrapper" style={{ padding: '28px', borderRadius: '24px', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <h3>Pupil Record</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Everything on file for {user.name}, on one A4 sheet.</p>
                </div>
                <button className="btn btn-primary sm" onClick={handlePrintRecord}>
                  <Printer size={16} /> Print / Save as PDF
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <StudentRecordSheet student={user} />
              </div>
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
};

export default AdminUserDetail;
