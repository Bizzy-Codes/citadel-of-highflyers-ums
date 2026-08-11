import { useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import {
  MessageCircle,
  Phone,
  Mail,
  HelpCircle,
  Search,
  ChevronRight
} from 'lucide-react';

const Support = () => {
  const faq = [
    { q: "How can I request a second copy of my report card?", a: "Go to Results > Request Re-issue or contact the school office directly." },
    { q: "What is the procedure for updating my child's medical info?", a: "Navigate to Profile > Medical and click 'Request Edit'." },
    { q: "How do I pay tuition fees online?", a: "Access the Financial tab and use the 'New Payment' button to pay via Card or Bank Transfer." },
  ];

  const [faqSearch, setFaqSearch] = useState('');
  const filteredFaq = faq.filter(item =>
    item.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
    item.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  return (
    <PortalLayout title="Help & Support">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <section className="welcome-banner glass-purple">
           <div className="welcome-text">
              <h1>Need <span>Help?</span> We're here for you!</h1>
              <p>Search our knowledge base or chat with our administrative support team in real-time.</p>
              <div className="search-bar" style={{ display: 'block', maxWidth: '400px', marginTop: '30px' }}>
                 <Search className="search-icon" size={20} />
                 <input
                   type="text"
                   placeholder="Search for answers..."
                   value={faqSearch}
                   onChange={(e) => setFaqSearch(e.target.value)}
                 />
              </div>
           </div>
           <div style={{ width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '60px' }}>
              <HelpCircle size={80} color="var(--primary)" />
           </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
           <div className="card glass hover-scale" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'var(--accent)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                 <MessageCircle />
              </div>
              <h4 style={{ fontSize: '18px', marginBottom: '8px' }}>Staff Messaging</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>Direct contact with teachers and management.</p>
              <button className="btn btn-outline sm" style={{ width: '100%' }}>Send a Message</button>
           </div>

           <div className="card glass hover-scale" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                 <Phone />
              </div>
              <h4 style={{ fontSize: '18px', marginBottom: '8px' }}>Call Support</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>Available Mon-Fri, 8 AM - 4 PM.</p>
              <button className="btn btn-outline sm" style={{ width: '100%' }}>+234 706 497 0003</button>
           </div>

           <div className="card glass hover-scale" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                 <Mail />
              </div>
              <h4 style={{ fontSize: '18px', marginBottom: '8px' }}>Email Support</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>24-hour response time guaranteed.</p>
              <button className="btn btn-outline sm" style={{ width: '100%' }}>Send an Email</button>
           </div>
        </section>

        <section className="card glass">
           <div className="card-header">
              <h3>Frequently Asked Questions</h3>
              <HelpCircle size={20} />
           </div>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredFaq.map((item, i) => (
                <div key={i} style={{ padding: '24px', background: 'var(--bg-light)', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.02)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: '700' }}>{item.q}</h4>
                      <button className="icon-btn" style={{ padding: '4px', background: 'white', borderRadius: '50%' }}><ChevronRight size={16} /></button>
                   </div>
                   <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>{item.a}</p>
                </div>
              ))}
              {filteredFaq.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', padding: '12px' }}>No answers matched your search.</p>
              )}
           </div>
        </section>
      </div>
    </PortalLayout>
  );
};

export default Support;
