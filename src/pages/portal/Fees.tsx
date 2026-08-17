import PortalLayout from '../../components/layout/PortalLayout';
import { CreditCard, Download, Receipt } from 'lucide-react';

const Fees = () => {
  const transactions = [
    { type: 'School Fees', amount: '₦250,000.00', date: 'Jan 15, 2024', status: 'Approved', receipt: 'R-7821' },
    { type: 'Uniform & Gears', amount: '₦35,000.00', date: 'Jan 10, 2024', status: 'Approved', receipt: 'R-7815' },
    { type: 'Books & Materials', amount: '₦20,000.00', date: 'Jan 05, 2024', status: 'Approved', receipt: 'R-7802' },
  ];

  return (
    <PortalLayout title="Fees & Finance">
      <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
         <div className="card glass-purple" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <h4 style={{ fontSize: '14px', color: 'var(--primary)', marginBottom: '8px' }}>Total Balance</h4>
            <div style={{ fontSize: '32px', fontWeight: '700' }}>₦0.00</div>
            <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '8px' }}>Fully Paid for Term 1</p>
         </div>
         <div className="card glass" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Upcoming Payment</h4>
            <div style={{ fontSize: '32px', fontWeight: '700' }}>₦0.00</div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Next session: Sept 2024</p>
         </div>
         <div className="card glass" style={{ padding: '24px' }}>
            <button className="btn btn-primary lg" style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-lg)' }}><CreditCard size={20} /> Pay Fees Now</button>
         </div>
      </div>

      <div className="card glass animate-fade-in">
        <div className="card-header">
           <h3>Payment History & Receipts</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
           {transactions.map((t, i) => (
             <div key={i} className="receipt-item hover-scale" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'var(--bg-light)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                   <div style={{ width: '40px', height: '40px', background: 'var(--accent)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}><Receipt size={20} /></div>
                   <div>
                      <div style={{ fontWeight: '700', fontSize: '15px' }}>{t.type}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.date}</div>
                   </div>
                </div>
                <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--primary)' }}>{t.amount}</div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                   <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>{t.status}</span>
                   <button className="icon-btn"><Download size={20} /></button>
                </div>
             </div>
           ))}
        </div>
      </div>
    </PortalLayout>
  );
};

export default Fees;
