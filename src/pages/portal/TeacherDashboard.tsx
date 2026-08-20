import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth } from '../../context/AuthContext';
import {
  GraduationCap,
  BookMarked,
  Calendar,
  ChevronRight,
  Plus
} from 'lucide-react';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { currentUser, students } = useAuth();

  const classes = ["Daycare", "Reception", "Kindergarten 1", "Kindergarten 2", "Pre-Grade", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"];

  // RLS already scopes `students` to whichever class this teacher is
  // assigned to, so counting by class here reflects real enrollment.
  const classCounts = classes.map(name => ({
    name,
    students: students.filter(s => s.grade === name).length,
  })).filter(c => c.students > 0 || c.name === currentUser?.assignedClass);

  const recentResults = students
    .flatMap(s => (s.results ?? []).map(r => ({ ...r, studentName: s.name, grade: s.grade })))
    .filter(r => r.createdAt)
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 5);

  return (
    <PortalLayout title="Teacher Portal">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <section className="welcome-banner glass-purple" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', padding: '24px' }}>
           <div className="welcome-text">
              <h1>Hello, <span>{currentUser?.name || 'Teacher'}!</span> 👋</h1>
              <p>Manage your class{currentUser?.assignedClass ? ` (${currentUser.assignedClass})` : ''} below.</p>
           </div>
           <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary sm"><Plus size={18} /> New Announcement</button>
           </div>
        </section>

        <section className="classes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
           {classCounts.map((cls, i) => (
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
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{cls.students} Enrolled Pupil{cls.students === 1 ? '' : 's'}</p>
             </div>
           ))}
           {classCounts.length === 0 && (
             <div className="card glass" style={{ padding: '24px', color: 'var(--text-muted)' }}>
               No class assigned to your account yet. Contact an admin to assign one.
             </div>
           )}
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
                       <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>PUPIL NAME</th>
                       <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>CLASS</th>
                       <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>SUBJECT</th>
                       <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>SCORE</th>
                    </tr>
                 </thead>
                 <tbody>
                    {recentResults.map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: '16px' }}>{r.studentName}</td>
                        <td style={{ padding: '16px' }}>{r.grade}</td>
                        <td style={{ padding: '16px' }}>{r.subject}</td>
                        <td style={{ padding: '16px', fontWeight: '700' }}>{r.score}/100</td>
                      </tr>
                    ))}
                    {recentResults.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No results uploaded yet.</td></tr>
                    )}
                 </tbody>
              </table>
           </section>

           <section className="card glass">
              <div className="card-header">
                 <h3>Upcoming Events</h3>
                 <Calendar size={20} />
              </div>
              <p style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>Event calendar not yet implemented.</p>
           </section>
        </div>
      </div>
    </PortalLayout>
  );
};

export default TeacherDashboard;
