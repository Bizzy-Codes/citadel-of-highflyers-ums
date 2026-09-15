import { useEffect, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type PaymentReceipt, type AdmissionApplication } from '../../context/AuthContext';
import { Download, CheckCircle2, XCircle, Receipt, Banknote, Landmark, GraduationCap } from 'lucide-react';

const STATUS_STYLE: Record<PaymentReceipt['status'], { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', label: 'Pending' },
  acknowledged: { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', label: 'Acknowledged' },
  rejected: { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', label: 'Rejected' },
};

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const ADMISSION_STATUS_STYLE: Record<AdmissionApplication['paymentStatus'], { bg: string; color: string; label: string }> = {
  unpaid: { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', label: 'Not Paid' },
  submitted: { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', label: 'Awaiting Confirmation' },
  confirmed: { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', label: 'Confirmed' },
};

const AdminPayments = () => {
  const {
    getAllPaymentReceipts, reviewPaymentReceipt, getPaymentReceiptUrl,
    getAdmissionApplications, confirmAdmissionPayment, getAdmissionPhotoUrl,
  } = useAuth();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  // Admission fees are a completely separate table from pupil fee
  // receipts -- an applicant has no profile yet, so their payment can't
  // live in payment_receipts. This page used to read only the latter,
  // which is why every admission payment the school had taken was
  // invisible here.
  const [admissions, setAdmissions] = useState<AdmissionApplication[]>([]);
  const [tab, setTab] = useState<'admissions' | 'fees'>('admissions');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    const [feeData, admissionData] = await Promise.all([
      getAllPaymentReceipts(),
      getAdmissionApplications(),
    ]);
    setReceipts(feeData);
    setAdmissions(admissionData.filter((a) => a.paymentStatus !== 'unpaid'));
    setLoading(false);
  };

  const visibleAdmissions = filter === 'pending'
    ? admissions.filter((a) => a.paymentStatus === 'submitted')
    : admissions;

  const handleConfirmAdmission = async (id: string) => {
    setBusyId(id);
    const { error } = await confirmAdmissionPayment(id);
    setBusyId(null);
    if (error) { alert('Failed to confirm payment: ' + error); return; }
    await load();
  };

  const handleViewAdmissionReceipt = async (path: string) => {
    const url = await getAdmissionPhotoUrl(path);
    if (url) window.open(url, '_blank');
    else alert('Could not open this receipt.');
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = filter === 'pending' ? receipts.filter((r) => r.status === 'pending') : receipts;

  const handleView = async (path: string) => {
    const url = await getPaymentReceiptUrl(path);
    if (url) window.open(url, '_blank');
    else alert('Could not open this receipt.');
  };

  const handleReview = async (id: string, status: 'acknowledged' | 'rejected') => {
    setBusyId(id);
    const { error } = await reviewPaymentReceipt(id, status, notes[id] ?? '');
    setBusyId(null);
    if (error) { alert('Failed to update receipt: ' + error); return; }
    await load();
  };

  return (
    <PortalLayout title="Payment Receipts">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ marginBottom: '4px' }}>Payments</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Admission fees from the public form, and school-fee receipts uploaded by pupils and parents.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={`btn sm ${filter === 'pending' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('pending')}>Pending</button>
            <button className={`btn sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>All</button>
          </div>
        </div>

        <div className="glass" style={{ display: 'flex', padding: '4px', borderRadius: '12px', alignSelf: 'flex-start', gap: '4px' }}>
          <button className={`btn sm ${tab === 'admissions' ? 'btn-primary' : ''}`} style={{ borderRadius: '8px' }} onClick={() => setTab('admissions')}>
            <GraduationCap size={16} /> Admission Fees{visibleAdmissions.length > 0 ? ` (${visibleAdmissions.length})` : ''}
          </button>
          <button className={`btn sm ${tab === 'fees' ? 'btn-primary' : ''}`} style={{ borderRadius: '8px' }} onClick={() => setTab('fees')}>
            <Receipt size={16} /> School Fees{visible.length > 0 ? ` (${visible.length})` : ''}
          </button>
        </div>

        {tab === 'admissions' && (
          <div className="card glass" style={{ padding: '0' }}>
            {!loading && visibleAdmissions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <GraduationCap size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <p>No {filter === 'pending' ? 'unconfirmed ' : ''}admission payments.</p>
              </div>
            )}
            {visibleAdmissions.map((a) => {
              const s = ADMISSION_STATUS_STYLE[a.paymentStatus];
              const isCash = a.paymentMethod === 'cash';
              return (
                <div key={a.id} style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <strong>{a.firstName} {a.surname}</strong>
                      <span style={{ padding: '3px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                        {isCash ? <Banknote size={14} /> : <Landmark size={14} />}
                        {isCash ? 'Cash' : 'Transfer'}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Admission fee · {a.paymentAmount != null ? naira(a.paymentAmount) : '—'} · applied {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                    {isCash && a.paymentStatus === 'submitted' && (
                      <p style={{ fontSize: '13px', marginTop: '6px', color: 'var(--warning)' }}>
                        Paid in cash at the school — check it against the office record before confirming.
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', minWidth: '220px' }}>
                    {a.paymentReceiptPath && (
                      <button className="btn btn-outline sm" onClick={() => handleViewAdmissionReceipt(a.paymentReceiptPath!)}>
                        <Download size={14} /> View Receipt
                      </button>
                    )}
                    {a.paymentStatus === 'submitted' && (
                      <button className="btn btn-primary sm" disabled={busyId === a.id} onClick={() => handleConfirmAdmission(a.id)}>
                        <CheckCircle2 size={14} /> Confirm Payment
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'fees' && (
        <div className="card glass" style={{ padding: '0' }}>
          {!loading && visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <Receipt size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>No {filter === 'pending' ? 'pending ' : ''}receipts.</p>
            </div>
          )}
          {visible.map((r) => {
            const s = STATUS_STYLE[r.status];
            return (
              <div key={r.id} style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <strong>{r.studentName ?? r.studentId}</strong>
                    <span style={{ padding: '3px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {r.studentDisplayId} · {naira(r.amount)} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                  {r.note && <p style={{ fontSize: '13px', marginTop: '6px' }}>{r.note}</p>}
                  {r.adminNote && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Admin note: {r.adminNote}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', minWidth: '260px' }}>
                  <button className="btn btn-outline sm" onClick={() => handleView(r.filePath)}><Download size={14} /> View Receipt</button>
                  {r.status === 'pending' && (
                    <>
                      <input type="text" placeholder="note (optional)" value={notes[r.id] ?? ''}
                        onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <button className="btn btn-primary sm" style={{ flex: 1 }} disabled={busyId === r.id} onClick={() => handleReview(r.id, 'acknowledged')}>
                          <CheckCircle2 size={14} /> Acknowledge
                        </button>
                        <button className="btn btn-outline sm" style={{ flex: 1 }} disabled={busyId === r.id} onClick={() => handleReview(r.id, 'rejected')}>
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </PortalLayout>
  );
};

export default AdminPayments;
