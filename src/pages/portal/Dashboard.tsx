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
  const { currentUser } = useAuth();
  const results = currentUser?.results ?? [];

  const averageGrade = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : null;

  const stats = [
    { label: "Attendance", value: "N/A", icon: <CheckCircle2 className="success" />, trend: "Attendance tracking not yet implemented" },
    { label: "Average Score", value: averageGrade !== null ? `${averageGrade}%` : "No results yet", icon: <TrendingUp className="primary" />, trend: `${results.length} subject(s) this term` },
    { label: "Upcoming Exams", value: "N/A", icon: <Calendar className="warning" />, trend: "Exam calendar not yet implemented" },
    { label: "Pending Fees", value: "N/A", icon: <AlertCircle className="success" />, trend: "Fee tracking not yet implemented" },
  ];

  const assignments = [
    { title: "Science Project - Ecosystems", due: "Tomorrow", subject: "Biology", file: "assignment_bio.pdf" },
    { title: "English Essay - My Holidays", due: "Friday", subject: "English", file: "essay_holidays.pdf" },
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
            <p>You have {assignments.length} assignments due this week.</p>
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
                <div key={i} className="video-card hover-scale" style={{ minWidth: '240px', background: 'var(--bg-light)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ height: '120px', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <Play fill="white" color="white" />
                    </div>
                    <p style={{ padding: '12px', fontSize: '13px', fontWeight: '600' }}>{v.title}</p>
                </div>
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
                {assignments.map((as, i) => (
                  <div key={i} className="activity-item" style={{ padding: '12px', background: 'var(--bg-light)', borderRadius: '12px' }}>
                    <div className="activity-info" style={{ flex: 1 }}>
                      <p className="activity-title">{as.title}</p>
                      <span className="activity-time">Subject: {as.subject} | Due: {as.due}</span>
                    </div>
                    <button className="icon-btn" title="Download Assignment"><Download size={16} /></button>
                  </div>
                ))}
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
