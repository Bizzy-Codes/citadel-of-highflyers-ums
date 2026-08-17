import { useEffect, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type PaymentReceipt } from '../../context/AuthContext';
import {
  CreditCard,
  TrendingUp,
  Download,
  PlusCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';

const STATUS_STYLE: Record<PaymentReceipt['status'], { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', label: 'Pending Review' },
  acknowledged: { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', label: 'Acknowledged' },
  rejected: { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', label: 'Rejected' },
};

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const Financial = () => {
  const { submitPaymentReceipt, getMyPaymentReceipts, getPaymentReceiptUrl } = useAuth();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    const data = await getMyPaymentReceipts();
    setReceipts(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acknowledgedTotal = receipts.filter((r) => r.status === 'acknowledged').reduce((sum, r) => sum + r.amount, 0);
  const pendingCount = receipts.filter((r) => r.status === 'pending').length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { alert('Please attach your payment receipt (image or PDF).'); return; }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) { alert('Enter a valid amount.'); return; }
    setSaving(true);
    const { error } = await submitPaymentReceipt(amountNum, note, file);
    setSaving(false);
    if (error) { alert('Failed to submit receipt: ' + error); return; }
    setIsSubmitting(false);
    setAmount(''); setNote(''); setFile(null);
    await load();
  };

  const handleView = async (path: string) => {
    const url = await getPaymentReceiptUrl(path);
    if (url) window.open(url, '_blank');
    else alert('Could not open this receipt.');
  };

  return (
    <PortalLayout title="Financial Management">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <section className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
           <div className="stat-card glass hover-scale" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard />
                 </div>
                 <span style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(168, 85, 247, 0.1)', color: 'var(--primary)', borderRadius: '50px', fontWeight: '700' }}>Receipts</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>{receipts.length}</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Total Submitted</p>
           </div>

           <div className="stat-card glass hover-scale" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp />
                 </div>
                 <span style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '50px', fontWeight: '700' }}>Acknowledged</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>{naira(acknowledgedTotal)}</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Confirmed by Admin</p>
           </div>

           <div className="stat-card glass hover-scale" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertCircle />
                 </div>
                 <span style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', borderRadius: '50px', fontWeight: '700' }}>Pending</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>{pendingCount}</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Awaiting Admin Review</p>
           </div>
        </section>

        <section className="card glass">
           <div className="card-header">
              <h3>Payment Receipts</h3>
              <button className="btn btn-primary sm" onClick={() => setIsSubmitting(true)}><PlusCircle size={16} /> Submit Receipt</button>
           </div>

           <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                 <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--secondary)' }}>
                       <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>NOTE</th>
                       <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>DATE</th>
                       <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>AMOUNT</th>
                       <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>STATUS</th>
                       <th style={{ padding: '20px' }}></th>
                    </tr>
                 </thead>
                 <tbody>
                    {receipts.map((r) => {
                      const s = STATUS_STYLE[r.status];
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                           <td style={{ padding: '20px', fontWeight: '700', fontSize: '14px' }}>{r.note || 'Payment receipt'}</td>
                           <td style={{ padding: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                           <td style={{ padding: '20px', fontWeight: '800' }}>{naira(r.amount)}</td>
                           <td style={{ padding: '20px' }}>
                              <span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '11px', fontWeight: '700', background: s.bg, color: s.color }}>{s.label}</span>
                              {r.status === 'rejected' && r.adminNote && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{r.adminNote}</div>
                              )}
                           </td>
                           <td style={{ padding: '20px' }}>
                              <button className="icon-btn" title="View Receipt" onClick={() => handleView(r.filePath)}><Download size={18} /></button>
                           </td>
                        </tr>
                      );
                    })}
                    {!loading && receipts.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Clock size={32} style={{ opacity: 0.2, marginBottom: '10px' }} /><br />
                        No payment receipts submitted yet.
                      </td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </section>
      </div>

      {isSubmitting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '440px' }}>
            <h3 style={{ marginBottom: '24px' }}>Submit Payment Receipt</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Upload a photo or PDF of your bank transfer/deposit receipt. An admin will review it and acknowledge the payment against your account.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label>Amount Paid (₦)</label>
                <input type="number" min={1} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
              </div>
              <div className="input-group">
                <label>Note (optional)</label>
                <input type="text" placeholder="e.g. Third Term Tuition" value={note} onChange={(e) => setNote(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
              </div>
              <div className="input-group">
                <label>Receipt (image or PDF)</label>
                <input type="file" accept="image/*,application/pdf" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsSubmitting(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Submitting...' : 'Submit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

export default Financial;
