import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type User } from '../../context/AuthContext';
import { upperName } from '../../lib/names';
import {
  Users,
  Settings,
  Database,
  PlusCircle,
  Search,
  Edit2,
  Key,
  CheckCircle,
  Clock,
  Calendar,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  GraduationCap
} from 'lucide-react';

const PAGE_SIZE = 10;

const AdminDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { students, staff, createUser, updateUser, requestPasswordReset, exportData } = useAuth();
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [page, setPage] = useState(1);
  const recordsRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();

  const pendingTeacherCount = staff.filter(s => s.role === 'teacher_pending').length;

  // Graduates keep their account but are no longer pupils the school is
  // teaching, so they don't belong in the roll or its counts.
  const currentPupils = students.filter(s => !s.graduatedAt);
  const graduateCount = students.length - currentPupils.length;

  // Each card carries where it goes, not a function -- a ref-reading
  // callback stored in a render-time array counts as touching the ref
  // during render. The ref is read in the click handler instead.
  const adminStats = [
    { label: "Total Pupils", value: currentPupils.length.toString(), icon: <Users size={20} />, trend: "Across all grades", target: 'records' as const },
    { label: "Active This Term", value: currentPupils.filter(s => s.status === 'Active').length.toString(), icon: <CheckCircle size={20} />, trend: "Registered & Paid", target: 'users' as const },
    { label: "Pending Staff Approval", value: pendingTeacherCount.toString(), icon: <Clock size={20} />, trend: "Self-registered teachers", target: 'users' as const },
    { label: "Staff Accounts", value: staff.length.toString(), icon: <Database size={20} />, trend: "Teachers & Admin", target: 'users' as const },
  ];

  const filteredStudents = currentPupils.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.displayId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  // A search that shortens the list can leave you on a page that no
  // longer exists, which reads as "my pupils have vanished".
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleStudents = filteredStudents.slice(pageStart, pageStart + PAGE_SIZE);

  const goToPage = (n: number) => {
    setPage(Math.max(1, Math.min(pageCount, n)));
    recordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAddStudent = async () => {
    const name = prompt("Enter Pupil Full Name:");
    if (!name) return;
    const email = prompt("Enter Pupil's Email (or a parent/guardian's):");
    if (!email) return;
    const grade = prompt("Enter Grade / Class:", "Grade 1");
    if (!grade) return;

    const { error, password } = await createUser(name, email, 'student', grade);
    if (error) {
      alert("Failed to add pupil: " + error);
    } else {
      alert(`${name}'s account is ready.\n\nTemporary password: ${password}\n\nShare this with them -- they can log in right away with their name, ID, or email. No email was sent.`);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent) {
      const { error } = await updateUser(editingStudent.id, editingStudent);
      if (error) { alert('Failed to update pupil: ' + error); return; }
      setEditingStudent(null);
      alert("Pupil updated!");
    }
  };

  const toggleStatus = async (student: User) => {
    const { error } = await updateUser(student.id, { status: student.status === 'Active' ? 'Inactive' : 'Active' });
    if (error) alert('Failed to change status: ' + error);
  };

  const resetPassword = async (student: User) => {
    if (!student.email) {
      alert("This pupil has no email on file, so a reset link can't be sent.");
      return;
    }
    if (!window.confirm(`Send a password reset link to ${student.name} (${student.email})?`)) return;
    const { error } = await requestPasswordReset(student.email);
    if (error) alert("Failed to send reset email: " + error);
    else alert("Password reset link sent to " + student.email);
  };

  return (
    <PortalLayout title="Admin Control Center">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Overview Stats */}
        <section className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
           {adminStats.map((stat, i) => (
             <div
               key={i}
               className="stat-card glass hover-scale"
               onClick={() => {
                 if (stat.target === 'records') recordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 else navigate('/portal/admin/users');
               }}
               style={{ padding: '24px', borderRadius: '24px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}
             >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                   <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--accent)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8 }}>
                      {stat.icon}
                   </div>
                   <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--success)' }}>{stat.trend}</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>{stat.value}</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500' }}>{stat.label}</p>
             </div>
           ))}
        </section>

        {/* Student Management Section */}
        <section ref={recordsRef} className="card glass" style={{ padding: '30px', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
             <div>
                <h3 style={{ fontSize: '20px', fontWeight: '700' }}>Pupil Records Database</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Manage all pupil profiles, login details, and passwords.</p>
             </div>
             <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div className="search-bar" style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
                   <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                   <input 
                     type="text" 
                     placeholder="Search by name or ID..." 
                     value={searchQuery}
                     onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                     style={{ width: '100%', padding: '10px 16px 10px 40px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)', fontSize: '14px' }}
                   />
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={handleAddStudent}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px' }}
                >
                   <PlusCircle size={18} /> Add Pupil
                </button>
             </div>
          </div>

          <div style={{ width: '100%', overflowX: 'auto' }}>
             <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                <thead>
                   <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <th style={{ padding: '12px 20px' }}>PUPIL NAME</th>
                      <th style={{ padding: '12px 20px' }}>ID / LOGIN</th>
                      <th style={{ padding: '12px 20px' }}>DATE CREATED</th>
                      <th style={{ padding: '12px 20px' }}>STATUS</th>
                      <th style={{ padding: '12px 20px', textAlign: 'right' }}>ACTIONS</th>
                   </tr>
                </thead>
                <tbody>
                   {visibleStudents.map((student, i) => (
                     <tr key={i} className="hover-scale" style={{ background: 'var(--bg-surface)', transition: 'all 0.2s ease' }}>
                        <td style={{ padding: '16px 20px', borderRadius: '12px 0 0 12px', fontWeight: '600' }}>{student.name}</td>
                        <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{student.displayId}</td>
                        <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Calendar size={14} />
                              {new Date(student.createdAt).toLocaleDateString()}
                           </div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                           <span
                            onClick={() => toggleStatus(student)}
                            style={{ cursor: 'pointer', padding: '4px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: '700', background: student.status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: student.status === 'Active' ? 'var(--success)' : 'var(--error)' }}
                           >
                              {student.status}
                           </span>
                        </td>
                        <td style={{ padding: '16px 20px', borderRadius: '0 12px 12px 0', textAlign: 'right' }}>
                           <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button onClick={() => setEditingStudent(student)} className="icon-btn" title="Edit Pupil" style={{ color: 'var(--primary)' }}><Edit2 size={16} /></button>
                              <button onClick={() => resetPassword(student)} className="icon-btn" title="Send Password Reset Email" style={{ color: 'var(--warning)' }}><Key size={16} /></button>
                           </div>
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>

          {filteredStudents.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>
              {searchQuery ? `No pupil matches "${searchQuery}".` : 'No pupils yet.'}
            </p>
          )}

          {filteredStudents.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                Showing <strong style={{ color: 'var(--text-main)' }}>{pageStart + 1}–{pageStart + visibleStudents.length}</strong> of {filteredStudents.length} pupils
              </p>
              {pageCount > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button className="btn btn-outline sm" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '90px', textAlign: 'center' }}>
                    Page {currentPage} of {pageCount}
                  </span>
                  <button className="btn btn-outline sm" disabled={currentPage === pageCount} onClick={() => goToPage(currentPage + 1)}>
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {graduateCount > 0 && (
            <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <GraduationCap size={14} style={{ verticalAlign: '-2px' }} />{' '}
              {graduateCount} graduated pupil{graduateCount === 1 ? '' : 's'} {graduateCount === 1 ? 'is' : 'are'} kept in the{' '}
              <button
                onClick={() => navigate('/portal/admin/graduates')}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}
              >
                Graduated list
              </button>.
            </p>
          )}
        </section>

        {/* Edit Modal */}
        {editingStudent && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
             <div className="glass" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '450px', position: 'relative' }}>
                <button onClick={() => setEditingStudent(null)} style={{ position: 'absolute', right: '20px', top: '20px' }}><X size={20} /></button>
                <h3 style={{ marginBottom: '24px' }}>Edit Pupil Details</h3>
                <form onSubmit={handleUpdateStudent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   <div className="input-group">
                      <label>Pupil Name</label>
                      <input 
                        type="text" 
                        value={editingStudent.name} 
                        onChange={(e) => setEditingStudent({...editingStudent, name: upperName(e.target.value)})}
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                      />
                   </div>
                   <div className="input-group">
                      <label>Grade / Class</label>
                      <input 
                        type="text" 
                        value={editingStudent.grade || ''} 
                        onChange={(e) => setEditingStudent({...editingStudent, grade: e.target.value})}
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                      />
                   </div>
                   <button type="submit" className="btn btn-primary lg" style={{ marginTop: '12px' }}>
                      <Save size={18} /> Update Record
                   </button>
                </form>
             </div>
          </div>
        )}

        {/* Other Admin Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
           <section className="card glass" style={{ padding: '24px', borderRadius: '24px' }}>
              <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                 <h3>System & Configuration</h3>
                 <Settings size={20} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                 <div onClick={() => navigate('/portal/admin/users')} className="blend-bg hover-scale" style={{ padding: '20px', borderRadius: '16px', cursor: 'pointer', border: '1px solid var(--glass-border)' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>Manage Staff</h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{staff.length} Total accounts</p>
                 </div>
                 <div onClick={() => navigate('/portal/timetable')} className="blend-bg hover-scale" style={{ padding: '20px', borderRadius: '16px', cursor: 'pointer', border: '1px solid var(--glass-border)' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>Class Timetables</h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Edit weekly class schedules</p>
                 </div>
              </div>
           </section>

            <section className="card glass" style={{ padding: '24px', borderRadius: '24px' }}>
              <div className="card-header" style={{ marginBottom: '20px' }}>
                 <h3>System Maintenance</h3>
              </div>
              <div className="blend-bg" style={{ padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px' }}>Database</span>
                    <span style={{ fontSize: '11px', color: 'var(--success)' }}>Supabase (Postgres)</span>
                 </div>
                 <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Data is stored centrally and shared across every device -- not just this browser.</p>
              </div>

              <button
               onClick={exportData}
               className="btn btn-primary sm"
               style={{ width: '100%', justifyContent: 'center' }}
              >
                 <Save size={16} /> Download Backup (JSON)
              </button>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                 Bulk restore-from-file was removed -- it let anyone overwrite the entire user database with unvalidated data. Individual records can still be edited above.
              </p>
            </section>
        </div>
      </div>
    </PortalLayout>
  );
};

export default AdminDashboard;
