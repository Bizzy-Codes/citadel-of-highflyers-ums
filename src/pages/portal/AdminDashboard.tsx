import { useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type User } from '../../context/AuthContext';
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
  MoreVertical,
  Calendar,
  Lock,
  X,
  Save
} from 'lucide-react';

const AdminDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { students, staff, addStudent, updateUser } = useAuth();
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  
  const adminStats = [
    { label: "Total Students", value: students.length.toString(), icon: <Users size={20} />, trend: "Across all grades" },
    { label: "Active This Term", value: students.filter(s => s.status === 'Active').length.toString(), icon: <CheckCircle size={20} />, trend: "Registered & Paid" },
    { label: "Pending Registration", value: "0", icon: <Clock size={20} />, trend: "Incomplete profiles" },
    { label: "Staff Accounts", value: staff.length.toString(), icon: <Database size={20} />, trend: "Teachers & Admin" },
  ];

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddStudent = () => {
    const name = prompt("Enter Student Full Name:");
    const password = prompt("Enter Student Password:");
    if (name && password) {
      addStudent({ name, password });
      alert("Student added successfully!");
    }
  };

  const handleUpdateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent) {
      updateUser(editingStudent.id, editingStudent);
      setEditingStudent(null);
      alert("Student updated!");
    }
  };

  const toggleStatus = (student: User) => {
    updateUser(student.id, { status: student.status === 'Active' ? 'Inactive' : 'Active' });
  };

  const resetPassword = (student: User) => {
    const newPass = prompt("Enter new password for " + student.name, student.password);
    if (newPass) {
      updateUser(student.id, { password: newPass });
      alert("Password reset successful!");
    }
  };

  return (
    <PortalLayout title="Admin Control Center">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Overview Stats */}
        <section className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
           {adminStats.map((stat, i) => (
             <div key={i} className="stat-card glass hover-scale" style={{ padding: '24px', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
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
        <section className="card glass" style={{ padding: '30px', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
             <div>
                <h3 style={{ fontSize: '20px', fontWeight: '700' }}>Student Records Database</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Manage all student profiles, login details, and passwords.</p>
             </div>
             <div style={{ display: 'flex', gap: '12px' }}>
                <div className="search-bar" style={{ position: 'relative', width: '280px' }}>
                   <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                   <input 
                     type="text" 
                     placeholder="Search by name or ID..." 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     style={{ width: '100%', padding: '10px 16px 10px 40px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)', fontSize: '14px' }}
                   />
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={handleAddStudent}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px' }}
                >
                   <PlusCircle size={18} /> Add Student
                </button>
             </div>
          </div>

          <div style={{ width: '100%', overflowX: 'auto' }}>
             <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                <thead>
                   <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <th style={{ padding: '12px 20px' }}>STUDENT NAME</th>
                      <th style={{ padding: '12px 20px' }}>ID / LOGIN</th>
                      <th style={{ padding: '12px 20px' }}>PASSWORD</th>
                      <th style={{ padding: '12px 20px' }}>DATE CREATED</th>
                      <th style={{ padding: '12px 20px' }}>STATUS</th>
                      <th style={{ padding: '12px 20px', textAlign: 'right' }}>ACTIONS</th>
                   </tr>
                </thead>
                <tbody>
                   {filteredStudents.map((student, i) => (
                     <tr key={i} className="hover-scale" style={{ background: 'var(--bg-surface)', transition: 'all 0.2s ease' }}>
                        <td style={{ padding: '16px 20px', borderRadius: '12px 0 0 12px', fontWeight: '600' }}>{student.name}</td>
                        <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{student.id}</td>
                        <td style={{ padding: '16px 20px' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: '600' }}>
                              <Lock size={14} />
                              {student.password}
                           </div>
                        </td>
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
                              <button onClick={() => setEditingStudent(student)} className="icon-btn" title="Edit Student" style={{ color: 'var(--primary)' }}><Edit2 size={16} /></button>
                              <button onClick={() => resetPassword(student)} className="icon-btn" title="Reset Password" style={{ color: 'var(--warning)' }}><Key size={16} /></button>
                              <button className="icon-btn"><MoreVertical size={16} /></button>
                           </div>
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </section>

        {/* Edit Modal */}
        {editingStudent && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
             <div className="glass" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '450px', position: 'relative' }}>
                <button onClick={() => setEditingStudent(null)} style={{ position: 'absolute', right: '20px', top: '20px' }}><X size={20} /></button>
                <h3 style={{ marginBottom: '24px' }}>Edit Student Details</h3>
                <form onSubmit={handleUpdateStudent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   <div className="input-group">
                      <label>Student Name</label>
                      <input 
                        type="text" 
                        value={editingStudent.name} 
                        onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})}
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
                 <div className="blend-bg hover-scale" style={{ padding: '20px', borderRadius: '16px', cursor: 'pointer', border: '1px solid var(--glass-border)' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>Manage Staff</h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{staff.length} Total accounts</p>
                 </div>
                 <div className="blend-bg hover-scale" style={{ padding: '20px', borderRadius: '16px', cursor: 'pointer', border: '1px solid var(--glass-border)' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>Academic Calendar</h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Configure terms & breaks</p>
                 </div>
              </div>
           </section>

            <section className="card glass" style={{ padding: '24px', borderRadius: '24px' }}>
              <div className="card-header" style={{ marginBottom: '20px' }}>
                 <h3>System Maintenance</h3>
              </div>
              <div className="blend-bg" style={{ padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px' }}>Database Backup</span>
                    <span style={{ fontSize: '11px', color: 'var(--success)' }}>Local Storage Active</span>
                 </div>
                 <div style={{ height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: 'var(--primary)' }}></div>
                 </div>
                 <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>All data is stored in your browser's secure local storage.</p>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                 <button 
                  onClick={useAuth().exportData}
                  className="btn btn-primary sm" 
                  style={{ flex: 1, justifyContent: 'center' }}
                 >
                    <Save size={16} /> Download Backup (JSON)
                 </button>
                 <label className="btn btn-outline sm" style={{ flex: 1, justifyContent: 'center', cursor: 'pointer' }}>
                    <Database size={16} /> Import Data
                    <input 
                      type="file" 
                      accept=".json" 
                      style={{ display: 'none' }} 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const content = event.target?.result as string;
                            useAuth().importData(content);
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                 </label>
              </div>
            </section>
        </div>
      </div>
    </PortalLayout>
  );
};

export default AdminDashboard;
