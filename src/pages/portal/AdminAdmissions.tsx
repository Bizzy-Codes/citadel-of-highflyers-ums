import { useEffect, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type AdmissionApplication } from '../../context/AuthContext';
import { UserPlus, Download, CheckCircle2, XCircle, FileCheck, MessageCircle, Receipt, GraduationCap, Bell, FileText } from 'lucide-react';
import { CLASSES, DEFAULT_ACCOUNT_PASSWORD } from '../../lib/accounts';
import { buildReceiptReminderMessage, buildLoginDetailsMessage, toWhatsAppNumber } from '../../lib/outreach';
import ContactParentDialog, { type ParentContact } from '../../components/portal/ContactParentDialog';

const STATUS_STYLE: Record<AdmissionApplication['status'], { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', label: 'Pending' },
  reviewed: { bg: 'rgba(107, 33, 168, 0.1)', color: 'var(--primary)', label: 'Reviewed' },
  admitted: { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', label: 'Admitted' },
  declined: { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', label: 'Declined' },
};

const PAYMENT_STATUS_STYLE: Record<AdmissionApplication['paymentStatus'], { bg: string; color: string; label: string }> = {
  unpaid: { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', label: 'Unpaid' },
  submitted: { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', label: 'Payment Pending Confirmation' },
  confirmed: { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', label: 'Payment Confirmed' },
};

const AdminAdmissions = () => {
  const { getAdmissionApplications, reviewAdmissionApplication, getAdmissionPhotoUrl, confirmAdmissionPayment, createUser, updateUser, linkProfileToApplication, students } = useAuth();
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'awaiting-receipt' | 'all'>('pending');
  const [selected, setSelected] = useState<AdmissionApplication | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Admitting opens a dialog that asks which class the child is going
  // into -- families no longer pick one on the form, so this is where
  // placement is actually decided.
  const [admitting, setAdmitting] = useState<AdmissionApplication | null>(null);
  const [admitClass, setAdmitClass] = useState<string>(CLASSES[0]);
  const [admitEmail, setAdmitEmail] = useState('');

  // Outbound WhatsApp, each asking which parent to send to.
  const [chasing, setChasing] = useState<AdmissionApplication | null>(null);
  const [admittedInfo, setAdmittedInfo] = useState<
    { name: string; contacts: ParentContact[]; message: string } | null
  >(null);

  const load = async () => {
    const data = await getAdmissionApplications();
    setApplications(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Families who applied but never came back to upload their receipt --
  // the single biggest source of stalled applications, so they get
  // their own tab and a one-tap WhatsApp chase rather than being
  // buried in the full list.
  const awaitingReceipt = applications.filter((a) => a.paymentStatus === 'unpaid' && a.status !== 'declined');

  const visible =
    filter === 'pending' ? applications.filter((a) => a.status === 'pending')
    : filter === 'awaiting-receipt' ? awaitingReceipt
    : applications;

  // Everyone we hold a number for on an application. Outbound messages
  // ask which of them to use rather than silently picking the first --
  // one of the two parents' numbers is often out of service.
  const contactsFor = (a: AdmissionApplication): ParentContact[] => [
    { role: 'Father', name: a.fatherName, phone: a.fatherPhone },
    { role: 'Mother', name: a.motherName, phone: a.motherPhone },
    { role: 'Pickup contact', name: a.pickupPerson, phone: a.pickupPhone },
  ];
  const hasAnyNumber = (a: AdmissionApplication) =>
    contactsFor(a).some((c) => toWhatsAppNumber(c.phone ?? '').length >= 10);

  const openDetail = (app: AdmissionApplication) => {
    setSelected(app);
    setNote(app.adminNote ?? '');
  };

  const handleViewPhoto = async (path: string) => {
    const url = await getAdmissionPhotoUrl(path);
    if (url) window.open(url, '_blank');
    else alert('Could not open this photo.');
  };

  const openAdmitDialog = (app: AdmissionApplication) => {
    setAdmitClass(app.classApplyingFor && CLASSES.includes(app.classApplyingFor as typeof CLASSES[number])
      ? app.classApplyingFor
      : CLASSES[0]);
    setAdmitEmail(app.email ?? '');
    setAdmitting(app);
  };

  // Admitting creates the pupil's account in the same step -- with the
  // class the admin just chose -- and copies everything the family
  // filled in on the application across onto the new profile, so the
  // office never has to re-key it or go digging back through the form.
  const handleAdmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admitting) return;
    const app = admitting;
    const email = admitEmail.trim();
    if (!email) return;

    setBusy(true);
    const fullName = `${app.firstName} ${app.otherNames ? app.otherNames + ' ' : ''}${app.surname}`.trim();
    const { error: createError, password, userId } = await createUser(fullName, email, 'student', admitClass);
    if (createError) {
      setBusy(false);
      alert('Application was not admitted -- failed to create the pupil account: ' + createError);
      return;
    }

    if (userId) {
      const { error: detailsError } = await updateUser(userId, {
        sex: app.sex,
        dateOfBirth: app.dateOfBirth,
        homeAddress: app.homeAddress,
        nationality: app.nationality,
        stateOfOrigin: app.stateOfOrigin,
        lga: app.lga,
        religion: app.religion ?? '',
        bloodGroup: app.bloodGroup ?? '',
        genotype: app.genotype ?? '',
        healthNotes: [app.healthChallenge, app.healthChallengeDetails].filter(Boolean).join(' — '),
        fatherName: app.fatherName ?? '',
        fatherOccupation: app.fatherOccupation ?? '',
        fatherPhone: app.fatherPhone ?? '',
        motherName: app.motherName ?? '',
        motherOccupation: app.motherOccupation ?? '',
        motherPhone: app.motherPhone ?? '',
        pickupPerson: app.pickupPerson,
        pickupPhone: app.pickupPhone,
        phone: app.fatherPhone || app.motherPhone || app.pickupPhone || '',
      });
      // The account exists either way -- a failure here is a gap in the
      // record, not a failed admission. Say so loudly rather than
      // rolling back or failing silently: a silent failure here is
      // exactly how pupils ended up admitted with empty profiles.
      if (detailsError) {
        console.error('admit: copying application details onto the profile failed', detailsError);
        alert(
          `${fullName}'s account was created, but their details could not be copied across ` +
          `(${detailsError}).\n\nOpen their profile and use "Import from Application" to pull them over.`
        );
      }
      // Link the profile back to the application it came from, so the
      // details can always be re-imported later.
      await linkProfileToApplication(userId, app.id);
    }

    const { error } = await reviewAdmissionApplication(app.id, 'admitted', note);
    setBusy(false);
    if (error) { alert('Account was created, but failed to mark the application admitted: ' + error); return; }

    setAdmitting(null);
    setSelected(null);
    await load();

    // Straight into "who do I send this to?" rather than an alert the
    // admin has to copy out of. The login shown is the pupil's NAME --
    // the email on the account is a parent's, and quoting that made it
    // read as the parent's own login rather than the child's.
    const loginPassword = password ?? DEFAULT_ACCOUNT_PASSWORD;
    const created = students.find((s) => s.email?.toLowerCase() === email.toLowerCase());
    setAdmittedInfo({
      name: fullName,
      contacts: contactsFor(app),
      message: buildLoginDetailsMessage({
        studentName: fullName,
        displayId: created?.displayId ?? 'see the portal',
        password: loginPassword,
        className: admitClass,
      }),
    });
  };

  const handleReview = async (status: 'declined' | 'reviewed') => {
    if (!selected) return;
    setBusy(true);
    const { error } = await reviewAdmissionApplication(selected.id, status, note);
    setBusy(false);
    if (error) { alert('Failed to update application: ' + error); return; }
    setSelected(null);
    await load();
  };

  const handleConfirmPayment = async () => {
    if (!selected) return;
    setBusy(true);
    const { error } = await confirmAdmissionPayment(selected.id);
    setBusy(false);
    if (error) { alert('Failed to confirm payment: ' + error); return; }
    setSelected({ ...selected, paymentStatus: 'confirmed' });
    await load();
  };

  return (
    <PortalLayout title="Admission Applications">
      <ContactParentDialog
        open={!!chasing}
        title="Chase payment receipt"
        description={chasing ? `Who should the reminder about ${chasing.firstName} ${chasing.surname}'s receipt go to?` : undefined}
        contacts={chasing ? contactsFor(chasing) : []}
        message={chasing ? buildReceiptReminderMessage(`${chasing.firstName} ${chasing.surname}`) : ''}
        onClose={() => setChasing(null)}
      />

      <ContactParentDialog
        open={!!admittedInfo}
        title="Send login details"
        description={admittedInfo ? `Who should ${admittedInfo.name}'s portal login go to?` : undefined}
        contacts={admittedInfo?.contacts ?? []}
        message={admittedInfo?.message ?? ''}
        onClose={() => setAdmittedInfo(null)}
      />

      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ marginBottom: '4px' }}>Admission Applications</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Applications submitted through the public website's admissions form.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className={`btn sm ${filter === 'pending' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('pending')}>Pending</button>
            <button className={`btn sm ${filter === 'awaiting-receipt' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('awaiting-receipt')}>
              Awaiting Receipt{awaitingReceipt.length > 0 ? ` (${awaitingReceipt.length})` : ''}
            </button>
            <button className={`btn sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>All</button>
          </div>
        </div>

        <div className="card glass" style={{ padding: '0' }}>
          {!loading && visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <UserPlus size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>No {filter === 'pending' ? 'pending ' : ''}applications.</p>
            </div>
          )}
          {visible.map((a) => {
            const s = STATUS_STYLE[a.status];
            const p = PAYMENT_STATUS_STYLE[a.paymentStatus];
            return (
              <div key={a.id} onClick={() => openDetail(a)} className="hover-scale" style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', cursor: 'pointer', flexWrap: 'wrap' }}>
                <div>
                  <strong>{a.firstName} {a.surname}</strong>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {a.sex} · DOB {new Date(a.dateOfBirth).toLocaleDateString()} · Submitted {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {a.paymentStatus === 'unpaid' && hasAnyNumber(a) && (
                    <button
                      className="btn btn-outline sm"
                      onClick={(e) => { e.stopPropagation(); setChasing(a); }}
                      title="Send a reminder to upload their receipt"
                    >
                      <Bell size={14} /> Chase Receipt
                    </button>
                  )}
                  <span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '11px', fontWeight: 700, background: p.bg, color: p.color }}>{p.label}</span>
                  <span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h3>{selected.firstName} {selected.otherNames} {selected.surname}</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <a className="btn btn-outline sm" href={`https://wa.me/${toWhatsAppNumber(selected.pickupPhone)}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={14} /> WhatsApp Applicant
                </a>
                {selected.photoPath && (
                  <button className="btn btn-outline sm" onClick={() => handleViewPhoto(selected.photoPath!)}><Download size={14} /> View Photo</button>
                )}
                {(selected.documents ?? []).map((doc) => (
                  <button key={doc.path} className="btn btn-outline sm" onClick={() => handleViewPhoto(doc.path)} title={doc.name}>
                    <FileText size={14} /> {doc.name.length > 22 ? doc.name.slice(0, 20) + '...' : doc.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grading-answer-card" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <strong>Payment: </strong>
                  <span style={{ color: PAYMENT_STATUS_STYLE[selected.paymentStatus].color, fontWeight: 700 }}>{PAYMENT_STATUS_STYLE[selected.paymentStatus].label}</span>
                  {selected.paymentAmount != null && <span style={{ color: 'var(--text-muted)' }}> · ₦{selected.paymentAmount.toLocaleString()} {selected.wantsPhysicalCopy ? '(incl. physical copy)' : ''}</span>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selected.paymentReceiptPath && (
                    <button className="btn btn-outline sm" onClick={() => handleViewPhoto(selected.paymentReceiptPath!)}><Receipt size={14} /> View Receipt</button>
                  )}
                  {selected.paymentStatus === 'submitted' && (
                    <button className="btn btn-primary sm" disabled={busy} onClick={handleConfirmPayment}><CheckCircle2 size={14} /> Confirm Payment</button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '14px', marginBottom: '20px' }}>
              <p><strong>Email:</strong> {selected.email || '—'}</p>
              <p><strong>Class Applying For:</strong> {selected.classApplyingFor || '—'}</p>
              <p><strong>Sex:</strong> {selected.sex}</p>
              <p><strong>Date of Birth:</strong> {new Date(selected.dateOfBirth).toLocaleDateString()}</p>
              <p><strong>Nationality:</strong> {selected.nationality}</p>
              <p><strong>State of Origin:</strong> {selected.stateOfOrigin}</p>
              <p><strong>LGA:</strong> {selected.lga}</p>
              <p><strong>Religion:</strong> {selected.religion || '—'}</p>
              <p><strong>Blood Group:</strong> {selected.bloodGroup || '—'}</p>
              <p><strong>Genotype:</strong> {selected.genotype || '—'}</p>
              <p style={{ gridColumn: '1 / -1' }}><strong>Home Address:</strong> {selected.homeAddress}</p>
              <p style={{ gridColumn: '1 / -1' }}><strong>Father:</strong> {selected.fatherName || '—'} ({selected.fatherOccupation || '—'}) · {selected.fatherPhone || '—'}</p>
              <p style={{ gridColumn: '1 / -1' }}><strong>Mother:</strong> {selected.motherName || '—'} ({selected.motherOccupation || '—'}) · {selected.motherPhone || '—'}</p>
              <p style={{ gridColumn: '1 / -1' }}><strong>Health Challenge:</strong> {selected.healthChallenge || '—'} {selected.healthChallengeDetails ? `(${selected.healthChallengeDetails})` : ''}</p>
              <p style={{ gridColumn: '1 / -1' }}><strong>School Last Attended:</strong> {selected.schoolLastAttended || '—'}</p>
              <p style={{ gridColumn: '1 / -1' }}><strong>Pickup:</strong> {selected.pickupPerson} · {selected.pickupPhone}</p>
              <p style={{ gridColumn: '1 / -1' }}><strong>Siblings at Citadel:</strong> {selected.siblingNames || '—'}</p>
            </div>

            <div className="input-group">
              <label>Admin Note</label>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', resize: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => openAdmitDialog(selected)}><CheckCircle2 size={16} /> Admit</button>
              <button className="btn btn-outline" style={{ flex: 1 }} disabled={busy} onClick={() => handleReview('reviewed')}><FileCheck size={16} /> Mark Reviewed</button>
              <button className="btn btn-outline" style={{ flex: 1 }} disabled={busy} onClick={() => handleReview('declined')}><XCircle size={16} /> Decline</button>
            </div>
            <button className="btn btn-outline" style={{ width: '100%', marginTop: '10px' }} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Admit dialog -- where the child's class is actually decided. */}
      {admitting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <form onSubmit={handleAdmit} className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '460px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <GraduationCap size={20} /> Admit {admitting.firstName} {admitting.surname}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Choose the class this child is being admitted into. Their pupil account is created
              straight away, with everything from their application already on the record.
            </p>

            <div className="input-group" style={{ marginBottom: '14px' }}>
              <label>Class Admitted Into</label>
              <select
                required
                value={admitClass}
                onChange={(e) => setAdmitClass(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
              >
                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label>Login Email</label>
              <input
                type="email"
                required
                value={admitEmail}
                onChange={(e) => setAdmitEmail(e.target.value)}
                placeholder="parent@example.com"
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                {admitting.email ? 'Taken from the application — change it if the family gave a different one.' : 'No email was captured on this application, so one is needed here.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setAdmitting(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy}>
                <CheckCircle2 size={16} /> {busy ? 'Admitting...' : 'Admit & Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}
    </PortalLayout>
  );
};

export default AdminAdmissions;
