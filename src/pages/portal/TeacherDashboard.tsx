import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { 
  GraduationCap, 
  BookMarked, 
  Calendar, 
  ChevronRight,
  Plus,
  ShieldAlert
} from 'lucide-react';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const classes = [
    { name: "Kindergarten 1", students: 18, pendingResults: 0 },
    { name: "Kindergarten 2", students: 22, pendingResults: 5 },
    { name: "Pre-Grade", students: 15, pendingResults: 2 },
    { name: "Grade 1", students: 25, pendingResults: 0 },
    { name: "Grade 2", students: 20, pendingResults: 0 },
    { name: "Grade 3", students: 24, pendingResults: 8 },
    { name: "Grade 4", students: 21, pendingResults: 0 },
    { name: "Grade 5", students: 19, pendingResults: 0 },
  ];

  const handleAdminAccess = () => {
    const password = prompt("Enter Special Admin Password:");
    if (password === 'CH-ADMIN-SECURE-2024') {
      navigate('/portal/admin');
    } else {
      alert("Unauthorized access. Incorrect password.");
    }
  };

  return (
    <PortalLayout title="Teacher Portal">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <section className="welcome-banner glass-purple" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', padding: '24px' }}>
           <div className="welcome-text">
              <h1>Hello, <span>Staff!</span> 👋</h1>
              <p>You have 15 results pending approval for Grade 3 and Kindergarten 2. Manage your classes below.</p>
           </div>
           <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleAdminAccess} className="btn btn-outline sm" style={{ borderColor: 'var(--error)', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} /> Admin Section
              </button>
              <button className="btn btn-primary sm"><Plus size={18} /> New Announcement</button>
           </div>
        </section>

        <section className="classes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
           {classes.map((cls, i) => (
             <div 
              key={i} 
              className="card glass hover-scale" 
              style={{ padding: '24px', cursor: 'pointer' }}
              onClick={() => navigate(`/portal/teacher/class/${cls.name}`)}
             >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                   <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GraduationCap size={24} />
                   </div>
                   <button className="icon-btn"><ChevronRight size={20} /></button>
                </div>
                <h3 style={{ fontSize: '20px', marginBottom: '4px' }}>{cls.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>{cls.students} Enrolled Students</p>
                
                <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '16px' }}>
                   <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Attendance</span>
                      <strong style={{ fontSize: '14px' }}>92%</strong>
                   </div>
                   <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Pending</span>
                      <strong style={{ fontSize: '14px', color: cls.pendingResults > 0 ? 'var(--error)' : 'var(--success)' }}>{cls.pendingResults} Results</strong>
                   </div>
                </div>
             </div>
           ))}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
           <section className="card glass">
              <div className="card-header">
                 <h3>Recent Result Uploads</h3>
                 <BookMarked size={20} />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                 <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--secondary)' }}>
                       <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>STUDENT NAME</th>
                       <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>CLASS</th>
                       <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>SUBJECT</th>
                       <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>SCORE</th>
                    </tr>
                 </thead>
                 <tbody>
                    <tr><td style={{ padding: '16px' }}>Ikechukwu A.</td><td style={{ padding: '16px' }}>Grade 4</td><td style={{ padding: '16px' }}>Mathematics</td><td style={{ padding: '16px', fontWeight: '700' }}>92/100</td></tr>
                    <tr><td style={{ padding: '16px' }}>Sarah J.</td><td style={{ padding: '16px' }}>Grade 2</td><td style={{ padding: '16px' }}>English</td><td style={{ padding: '16px', fontWeight: '700' }}>85/100</td></tr>
                 </tbody>
              </table>
           </section>

           <section className="card glass">
              <div className="card-header">
                 <h3>Upcoming Events</h3>
                 <Calendar size={20} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 <div className="event-item"><div className="event-date"><span className="day">10</span><span className="month">APR</span></div><div className="event-info"><p>PTA Meeting</p><span>2:00 PM</span></div></div>
                 <div className="event-item"><div className="event-date"><span className="day">15</span><span className="month">APR</span></div><div className="event-info"><p>Mid-Term Break</p><span>Starts</span></div></div>
              </div>
           </section>
        </div>
      </div>
    </PortalLayout>
  );
};

export default TeacherDashboard;
