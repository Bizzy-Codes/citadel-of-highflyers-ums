import { useEffect, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type AdmissionApplication } from '../../context/AuthContext';
import { UserPlus, Download, CheckCircle2, XCircle, FileCheck, MessageCircle, Receipt } from 'lucide-react';

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

// Normalizes a Nigerian local number (e.g. "08036334689") into the
// international format wa.me needs (e.g. "2348036334689").
const toWhatsAppNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? '234' + digits.slice(1) : digits;
};

const AdminAdmissions = () => {
  const { getAdmissionApplications, reviewAdmissionApplication, getAdmissionPhotoUrl, confirmAdmissionPayment } = useAuth();
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [selected, setSelected] = useState<AdmissionApplication | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const data = await getAdmissionApplications();
    setApplications(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = filter === 'pending' ? applications.filter((a) => a.status === 'pending') : applications;

  const openDetail = (app: AdmissionApplication) => {
    setSelected(app);
    setNote(app.adminNote ?? '');
  };

  const handleViewPhoto = async (path: string) => {
    const url = await getAdmissionPhotoUrl(path);
    if (url) window.open(url, '_blank');
    else alert('Could not open this photo.');
  };

  const handleReview = async (status: 'admitted' | 'declined' | 'reviewed') => {
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
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ marginBottom: '4px' }}>Admission Applications</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Applications submitted through the public website's admissions form.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={`btn sm ${filter === 'pending' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('pending')}>Pending</button>
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
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => handleReview('admitted')}><CheckCircle2 size={16} /> Admit</button>
              <button className="btn btn-outline" style={{ flex: 1 }} disabled={busy} onClick={() => handleReview('reviewed')}><FileCheck size={16} /> Mark Reviewed</button>
              <button className="btn btn-outline" style={{ flex: 1 }} disabled={busy} onClick={() => handleReview('declined')}><XCircle size={16} /> Decline</button>
            </div>
            <button className="btn btn-outline" style={{ width: '100%', marginTop: '10px' }} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

export default AdminAdmissions;
