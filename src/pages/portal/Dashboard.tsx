import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar,
  TrendingUp,
  AlertCircle,
  Play,
  Download,
  Video,
  ClipboardCheck,
  CheckCircle2
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, assignments, mySubmissions } = useAuth();
  const results = currentUser?.results ?? [];

  const averageGrade = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : null;

  const pendingAssignments = assignments.filter((a) => !mySubmissions[a.id]);

  const stats = [
    { label: "Attendance", value: "N/A", icon: <CheckCircle2 className="success" />, trend: "Attendance tracking not yet implemented" },
    { label: "Average Score", value: averageGrade !== null ? `${averageGrade}%` : "No results yet", icon: <TrendingUp className="primary" />, trend: `${results.length} subject(s) this term` },
    { label: "Upcoming Exams", value: "N/A", icon: <Calendar className="warning" />, trend: "Exam calendar not yet implemented" },
    { label: "Pending Fees", value: "N/A", icon: <AlertCircle className="success" />, trend: "Fee tracking not yet implemented" },
  ];

  return (
    <PortalLayout title="Student Overview">
      <div className="dashboard-grid animate-fade-in">
        {/* Welcome Banner */}
        <section className="welcome-banner glass-purple">
          <div className="welcome-text">
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
               <div style={{ padding: '10px 20px', background: 'var(--primary)', color: 'white', borderRadius: '12px', fontWeight: '700' }}>{currentUser?.grade || 'Unassigned'}</div>
            </div>
            <h1>Welcome back, <span>{currentUser?.name || 'Student'}!</span> 👋</h1>
            <p>You have {pendingAssignments.length} assignment{pendingAssignments.length === 1 ? '' : 's'} awaiting submission.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
               <button className="btn btn-primary sm"><Download size={18} /> Download Result Sheet</button>
               <button className="btn btn-outline sm">View Schedule</button>
            </div>
          </div>
          <div className="welcome-illustration">🚀</div>
        </section>

        {/* School YouTube Section */}
        <section className="card glass">
           <div className="card-header">
              <h3>Citadel Highflyers TV</h3>
              <a href="https://www.youtube.com/@citadelofhighflyersintlaca7994" target="_blank" rel="noreferrer" className="btn btn-outline sm"><Video size={16} /> YouTube Channel</a>
           </div>
           <div className="video-strip" style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
              {[
                { title: "Founder's Day Celebration", id: "dQw4w9WgXcQ" },
                { title: "Inter-House Sports 2024", id: "dQw4w9WgXcQ" },
                { title: "Cultural Day Highlights", id: "dQw4w9WgXcQ" }
              ].map((v, i) => (
                <a
                  key={i}
                  href={`https://www.youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="video-card hover-scale"
                  style={{ minWidth: '240px', background: 'var(--bg-light)', borderRadius: '12px', overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit' }}
                >
                    <div style={{
                      height: '120px', position: 'relative',
                      backgroundImage: `url(https://img.youtube.com/vi/${v.id}/hqdefault.jpg)`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                    }}>
                       <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <Play fill="white" color="white" size={18} />
                          </div>
                       </div>
                    </div>
                    <p style={{ padding: '12px', fontSize: '13px', fontWeight: '600' }}>{v.title}</p>
                </a>
              ))}
           </div>
        </section>

        {/* Stats Grid */}
        <section className="stats-row">
          {stats.map((stat, i) => (
            <div key={i} className="stat-card glass animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="stat-card-header">
                <span className="stat-icon">{stat.icon}</span>
                <span className="stat-trend">{stat.trend}</span>
              </div>
              <div className="stat-card-body">
                <h3 className="stat-value">{stat.value}</h3>
                <p className="stat-label">{stat.label}</p>
              </div>
            </div>
          ))}
        </section>

        <div className="dashboard-main-content">
          {/* Main Chart / Course Progress */}
          <section className="course-progress card glass">
            <div className="card-header">
              <h3>Term Progress Results</h3>
              <select className="period-select">
                <option>First Term</option>
                <option>Second Term</option>
                <option>Third Term</option>
              </select>
            </div>
            <div className="performance-chart-mini">
               <div className="chart-placeholder">
                  <div className="bar" style={{ height: '60%' }}><span>Math</span></div>
                  <div className="bar" style={{ height: '85%' }}><span>Eng</span></div>
                  <div className="bar" style={{ height: '70%' }}><span>Sci</span></div>
                  <div className="bar" style={{ height: '90%' }}><span>Art</span></div>
                  <div className="bar" style={{ height: '75%' }}><span>ICT</span></div>
               </div>
            </div>
          </section>

          {/* Sidebar Widgets */}
          <div className="dashboard-widgets">
            {/* Assignments */}
            <section className="recent-activity card glass">
              <div className="card-header">
                <h3>Assignments</h3>
                <ClipboardCheck size={18} />
              </div>
              <div className="activity-list">
                {assignments.slice(0, 4).map((as) => (
                  <div key={as.id} className="activity-item hover-scale" style={{ padding: '12px', background: 'var(--bg-light)', borderRadius: '12px', cursor: 'pointer' }}
                    onClick={() => navigate('/portal/assignments')}>
                    <div className="activity-info" style={{ flex: 1 }}>
                      <p className="activity-title">{as.title}</p>
                      <span className="activity-time">
                        {as.subject} {as.dueDate ? `| Due: ${new Date(as.dueDate).toLocaleDateString()}` : ''}
                        {mySubmissions[as.id] ? ' | Submitted' : ''}
                      </span>
                    </div>
                  </div>
                ))}
                {assignments.length === 0 && (
                  <p style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>No assignments posted yet.</p>
                )}
                <button className="btn btn-outline sm" style={{ width: '100%', marginTop: '8px' }} onClick={() => navigate('/portal/assignments')}>
                  <Download size={14} /> View All Assignments
                </button>
              </div>
            </section>


            {/* Upcoming Events */}
            <section className="upcoming-events card glass">
              <div className="card-header">
                <h3>School Calendar</h3>
                <Calendar size={18} />
              </div>
              <div className="event-item">
                <div className="event-date">
                  <span className="day">12</span>
                  <span className="month">APR</span>
                </div>
                <div className="event-info">
                  <p>Inter-House Sports</p>
                  <span>9:00 AM - 4:00 PM</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
};

export default Dashboard;
