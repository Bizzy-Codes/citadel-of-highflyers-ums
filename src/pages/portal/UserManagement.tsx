import { useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type User } from '../../context/AuthContext';
import { 
  Users, 
  Search,
  Edit2,
  Trash2,
  BookOpen,
  UserCheck,
  Save,
  X
} from 'lucide-react';

const UserManagement = () => {
  const { students, staff, updateUser, deleteUser, subjectsByClass, updateSubjects } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'teachers' | 'students' | 'subjects'>('teachers');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingSubjects, setEditingSubjects] = useState<{className: string, subjects: string} | null>(null);

  const classes = ["Kindergarten 1", "Kindergarten 2", "Pre-Grade", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"];

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateUser(editingUser.id, editingUser);
      setEditingUser(null);
      alert("User updated successfully!");
    }
  };

  const handleDeleteUser = (id: string) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      deleteUser(id);
      alert("User deleted.");
    }
  };

  const handleUpdateSubjects = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSubjects) {
      const subjectList = editingSubjects.subjects.split(',').map(s => s.trim()).filter(s => s !== "");
      updateSubjects(editingSubjects.className, subjectList);
      setEditingSubjects(null);
      alert("Subjects updated!");
    }
  };

  return (
    <PortalLayout title="User Management & Control">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Tabs and Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
           <div className="glass" style={{ display: 'flex', padding: '4px', borderRadius: '12px' }}>
              <button 
                onClick={() => setActiveTab('teachers')}
                className={`btn sm ${activeTab === 'teachers' ? 'btn-primary' : ''}`}
                style={{ borderRadius: '8px' }}
              >
                <Users size={16} /> Teachers
              </button>
              <button 
                onClick={() => setActiveTab('students')}
                className={`btn sm ${activeTab === 'students' ? 'btn-primary' : ''}`}
                style={{ borderRadius: '8px' }}
              >
                <UserCheck size={16} /> Students
              </button>
              <button 
                onClick={() => setActiveTab('subjects')}
                className={`btn sm ${activeTab === 'subjects' ? 'btn-primary' : ''}`}
                style={{ borderRadius: '8px' }}
              >
                <BookOpen size={16} /> Subjects
              </button>
           </div>

           <div className="search-bar" style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder={`Search ${activeTab}...`} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '10px 16px 10px 40px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' }}
              />
           </div>
        </div>

        {/* Content Area */}
        <div className="card glass" style={{ padding: '24px', borderRadius: '24px' }}>
           
           {/* Teachers / Students Table */}
           {(activeTab === 'teachers' || activeTab === 'students') && (
             <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                   <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '13px' }}>
                         <th style={{ padding: '12px 20px' }}>NAME</th>
                         <th style={{ padding: '12px 20px' }}>ID / LOGIN</th>
                         <th style={{ padding: '12px 20px' }}>ROLE / CLASS</th>
                         <th style={{ padding: '12px 20px' }}>PASSWORD</th>
                         <th style={{ padding: '12px 20px' }}>STATUS</th>
                         <th style={{ padding: '12px 20px', textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                   </thead>
                   <tbody>
                      {(activeTab === 'teachers' ? filteredStaff : filteredStudents).map((user, i) => (
                        <tr key={i} className="hover-scale" style={{ background: 'var(--bg-surface)' }}>
                           <td style={{ padding: '16px 20px', borderRadius: '12px 0 0 12px', fontWeight: '600' }}>{user.name}</td>
                           <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{user.id}</td>
                           <td style={{ padding: '16px 20px' }}>
                              <span style={{ fontSize: '12px', background: 'var(--accent)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '6px' }}>
                                 {user.role === 'student' ? user.grade : (user.assignedClass || user.role)}
                              </span>
                           </td>
                           <td style={{ padding: '16px 20px', fontFamily: 'monospace' }}>{user.password}</td>
                           <td style={{ padding: '16px 20px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: user.status === 'Active' ? 'var(--success)' : 'var(--error)' }}>
                                 {user.status}
                              </span>
                           </td>
                           <td style={{ padding: '16px 20px', borderRadius: '0 12px 12px 0', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                 <button onClick={() => setEditingUser(user)} className="icon-btn" title="Edit"><Edit2 size={16} /></button>
                                 <button onClick={() => handleDeleteUser(user.id)} className="icon-btn" title="Delete" style={{ color: 'var(--error)' }}><Trash2 size={16} /></button>
                              </div>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           )}

           {/* Subjects Section */}
           {activeTab === 'subjects' && (
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {classes.map((cls, i) => (
                  <div key={i} className="blend-bg" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ fontWeight: '700' }}>{cls}</h4>
                        <button 
                          onClick={() => setEditingSubjects({ className: cls, subjects: (subjectsByClass[cls] || []).join(', ') })}
                          className="icon-btn"
                        >
                          <Edit2 size={16} />
                        </button>
                     </div>
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {(subjectsByClass[cls] || []).map((sub, j) => (
                          <span key={j} style={{ fontSize: '11px', background: 'var(--primary)', color: 'white', padding: '4px 10px', borderRadius: '50px' }}>
                            {sub}
                          </span>
                        ))}
                        {(!subjectsByClass[cls] || subjectsByClass[cls].length === 0) && (
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No subjects assigned.</p>
                        )}
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>

        {/* Edit User Modal */}
        {editingUser && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
             <div className="glass" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '500px', position: 'relative' }}>
                <button onClick={() => setEditingUser(null)} style={{ position: 'absolute', right: '20px', top: '20px' }}><X size={20} /></button>
                <h3 style={{ marginBottom: '24px' }}>Edit User Details</h3>
                <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   <div className="input-group">
                      <label>Full Name</label>
                      <input 
                        type="text" 
                        value={editingUser.name} 
                        onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                      />
                   </div>
                   <div className="input-group">
                      <label>Password</label>
                      <input 
                        type="text" 
                        value={editingUser.password} 
                        onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                      />
                   </div>
                   {editingUser.role === 'student' ? (
                     <div className="input-group">
                        <label>Grade / Class</label>
                        <select 
                          value={editingUser.grade} 
                          onChange={(e) => setEditingUser({...editingUser, grade: e.target.value})}
                          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                        >
                           {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>
                   ) : (
                     <div className="input-group">
                        <label>Assigned Class (For Teacher)</label>
                        <select 
                          value={editingUser.assignedClass || ''} 
                          onChange={(e) => setEditingUser({...editingUser, assignedClass: e.target.value})}
                          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                        >
                           <option value="">None / Admin</option>
                           {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>
                   )}
                   <button type="submit" className="btn btn-primary lg" style={{ marginTop: '12px' }}>
                      <Save size={18} /> Save Changes
                   </button>
                </form>
             </div>
          </div>
        )}

        {/* Edit Subjects Modal */}
        {editingSubjects && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
             <div className="glass" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '500px', position: 'relative' }}>
                <button onClick={() => setEditingSubjects(null)} style={{ position: 'absolute', right: '20px', top: '20px' }}><X size={20} /></button>
                <h3 style={{ marginBottom: '24px' }}>Edit Subjects: {editingSubjects.className}</h3>
                <form onSubmit={handleUpdateSubjects} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   <div className="input-group">
                      <label>Subjects (Comma separated)</label>
                      <textarea 
                        rows={4}
                        value={editingSubjects.subjects} 
                        onChange={(e) => setEditingSubjects({...editingSubjects, subjects: e.target.value})}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', resize: 'none' }}
                        placeholder="Mathematics, English, Science..."
                      />
                   </div>
                   <button type="submit" className="btn btn-primary lg">
                      <Save size={18} /> Save Subjects
                   </button>
                </form>
             </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
};

export default UserManagement;
