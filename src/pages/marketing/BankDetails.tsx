import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Landmark, MessageCircle, Printer } from 'lucide-react';
import { SCHOOL_BANK } from '../../lib/feeSchedule';
import { SCHOOL_WHATSAPP } from '../../lib/outreach';

// The school's bank details on a page of their own, for anyone who
// asks "where do I pay?" -- visitors included. Deliberately has NO fee
// amounts on it: those are only shown inside the portal.

const Row = ({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked -- the number is on screen to copy by hand */ }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px 0', borderBottom: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontSize: label === 'Account Number' ? '30px' : '18px', fontWeight: 800, letterSpacing: label === 'Account Number' ? '2px' : undefined, marginTop: '2px' }}>{value}</div>
      </div>
      {copyable && (
        <button type="button" className="btn btn-outline sm" onClick={copy}>
          {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
        </button>
      )}
    </div>
  );
};

const BankDetails = () => {
  const navigate = useNavigate();
  const receiptLink = `https://wa.me/${SCHOOL_WHATSAPP}?text=${encodeURIComponent('Hello, I have made a payment. Here is my receipt.')}`;

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 80px', background: 'var(--bg-light)' }}>
      <div style={{ maxWidth: '620px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline sm" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
            <ArrowLeft size={16} /> Back
          </button>
          <Link to="/" className="btn btn-outline sm">Home</Link>
          <button type="button" className="btn btn-primary sm" onClick={() => window.print()} style={{ marginLeft: 'auto' }}>
            <Printer size={16} /> Print
          </button>
        </div>

        <article className="card glass" style={{ borderRadius: '28px', overflow: 'hidden', padding: 0 }}>
          <header style={{ padding: '28px 24px', textAlign: 'center', color: '#fff', background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
            <img src="/logo.jpg" alt="" style={{ width: '64px', height: '64px', borderRadius: '50%', border: '3px solid #fff', marginBottom: '10px' }} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, opacity: 0.9 }}>
              <Landmark size={16} /> SCHOOL BANK DETAILS
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 900, marginTop: '6px' }}>Citadel of Highflyers Int'l Academy</h1>
          </header>

          <div style={{ padding: '8px 24px 24px' }}>
            <Row label="Bank" value={SCHOOL_BANK.bank} />
            <Row label="Account Name" value={SCHOOL_BANK.accountName} copyable />
            <Row label="Account Number" value={SCHOOL_BANK.accountNumber} copyable />

            <div style={{ marginTop: '20px', padding: '16px', borderRadius: '16px', background: 'var(--accent)' }}>
              <div style={{ fontWeight: 800, marginBottom: '4px' }}>Send your payment receipt to</div>
              <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '1px' }}>{SCHOOL_BANK.receiptWhatsApp}</div>
              <a href={receiptLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ marginTop: '12px', background: '#25D366', borderColor: '#25D366' }}>
                <MessageCircle size={18} /> Send receipt on WhatsApp
              </a>
            </div>

            <p style={{ textAlign: 'center', marginTop: '22px', fontWeight: 700, color: 'var(--primary)' }}>
              Thank you for partnering with us in raising future generals!
            </p>
          </div>
        </article>
      </div>
    </div>
  );
};

export default BankDetails;
