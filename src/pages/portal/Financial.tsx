import PortalLayout from '../../components/layout/PortalLayout';
import { 
  CreditCard, 
  TrendingUp, 
  Download, 
  Printer, 
  PlusCircle, 
  AlertCircle 
} from 'lucide-react';

const Financial = () => {
  const transactions = [
    { title: "Third Term Tuition Fee", date: "Sep 10, 2024", amount: "₦350,000.00", status: "Completed", type: "Tuition" },
    { title: "School Bus Service Fee", date: "Sep 12, 2024", amount: "₦85,000.00", status: "Completed", type: "Transport" },
    { title: "Graduation Gown Fee", date: "Oct 01, 2024", amount: "₦50,000.00", status: "Pending", type: "Other" },
  ];

  return (
    <PortalLayout title="Financial Management">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <section className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
           <div className="stat-card glass hover-scale" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard />
                 </div>
                 <span style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(168, 85, 247, 0.1)', color: 'var(--primary)', borderRadius: '50px', fontWeight: '700' }}>Balance</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>₦0.00</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Current Term Balance</p>
           </div>

           <div className="stat-card glass hover-scale" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp />
                 </div>
                 <span style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '50px', fontWeight: '700' }}>Paid</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>₦435,000.00</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Current Term Payments</p>
           </div>

           <div className="stat-card glass hover-scale" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertCircle />
                 </div>
                 <span style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', borderRadius: '50px', fontWeight: '700' }}>Pending</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>₦50,000.00</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Upcoming Obligations</p>
           </div>
        </section>

        <section className="card glass">
           <div className="card-header">
              <h3>Transaction History</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                 <button className="btn btn-outline sm"><Download size={16} /> Export CSV</button>
                 <button className="btn btn-primary sm"><PlusCircle size={16} /> New Payment</button>
              </div>
           </div>
           
           <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                 <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--secondary)' }}>
                       <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>PAYMENT DESCRIPTION</th>
                       <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>DATE</th>
                       <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>AMOUNT</th>
                       <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>CATEGORY</th>
                       <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>STATUS</th>
                       <th style={{ padding: '20px' }}></th>
                    </tr>
                 </thead>
                 <tbody>
                    {transactions.map((tra, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                         <td style={{ padding: '20px', fontWeight: '700', fontSize: '14px' }}>{tra.title}</td>
                         <td style={{ padding: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>{tra.date}</td>
                         <td style={{ padding: '20px', fontWeight: '800' }}>{tra.amount}</td>
                         <td style={{ padding: '20px' }}>
                            <span style={{ padding: '4px 10px', background: 'var(--bg-light)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>{tra.type}</span>
                         </td>
                         <td style={{ padding: '20px' }}>
                            <span style={{ 
                               padding: '4px 12px', 
                               borderRadius: '50px', 
                               fontSize: '11px', 
                               fontWeight: '700',
                               background: tra.status === 'Completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                               color: tra.status === 'Completed' ? 'var(--success)' : 'var(--warning)'
                            }}>
                               {tra.status}
                            </span>
                         </td>
                         <td style={{ padding: '20px' }}>
                            <button className="icon-btn" title="View Receipt"><Printer size={18} /></button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </section>

        <section className="card glass-purple" style={{ padding: '40px', textAlign: 'center' }}>
           <h3 style={{ fontSize: '24px', marginBottom: '12px' }}>Download Tuition Fee Policy</h3>
           <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Keep updated with the current installment policy and scholarship criteria for the {new Date().getFullYear()} session.</p>
           <button className="btn btn-primary lg"><Download size={18} /> Financial Guide Document.pdf</button>
        </section>
      </div>
    </PortalLayout>
  );
};

export default Financial;
