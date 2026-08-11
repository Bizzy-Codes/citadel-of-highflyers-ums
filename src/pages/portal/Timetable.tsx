import { useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type TimetableEntry } from '../../context/AuthContext';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Save, 
  Clock,
  User
} from 'lucide-react';

const Timetable = () => {
  const { currentUser, timetables, updateTimetable, staff } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const classes = ["Kindergarten 1", "Kindergarten 2", "Pre-Grade", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"];
  
  const [selectedClass, setSelectedClass] = useState(isAdmin ? classes[0] : (currentUser?.grade || classes[0]));
  const [entries, setEntries] = useState<TimetableEntry[]>(timetables[selectedClass] || []);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const times = ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM"];

  const handleClassChange = (cls: string) => {
    setSelectedClass(cls);
    setEntries(timetables[cls] || []);
  };

  const handleAddEntry = () => {
    setEntries([...entries, { day: "Monday", time: "08:00 AM", subject: "", teacher: "" }]);
  };

  const handleUpdateEntry = (index: number, field: keyof TimetableEntry, value: string) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const handleRemoveEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    await updateTimetable(selectedClass, entries);
    alert(`Timetable for ${selectedClass} saved!`);
  };

  return (
    <PortalLayout title="Class Timetable">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <Calendar size={20} />
              </div>
              <div>
                 <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Schedule for {selectedClass}</h3>
                 <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isAdmin ? "Manage and edit class schedules" : "View your weekly class schedule"}</p>
              </div>
           </div>

           {isAdmin && (
             <div style={{ display: 'flex', gap: '12px' }}>
                <select 
                  value={selectedClass} 
                  onChange={(e) => handleClassChange(e.target.value)}
                  style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)' }}
                >
                   {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={handleSave} className="btn btn-primary">
                   <Save size={18} /> Save Changes
                </button>
             </div>
           )}
        </div>

        <div className="card glass" style={{ padding: '24px', borderRadius: '24px' }}>
           {isAdmin ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {entries.map((entry, i) => (
                  <div key={i} className="blend-bg hover-scale" style={{ padding: '16px', borderRadius: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'center', border: '1px solid var(--glass-border)' }}>
                     <select value={entry.day} onChange={(e) => handleUpdateEntry(i, 'day', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                        {days.map(d => <option key={d} value={d}>{d}</option>)}
                     </select>
                     <select value={entry.time} onChange={(e) => handleUpdateEntry(i, 'time', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                        {times.map(t => <option key={t} value={t}>{t}</option>)}
                     </select>
                     <input 
                        type="text" 
                        placeholder="Subject" 
                        value={entry.subject} 
                        onChange={(e) => handleUpdateEntry(i, 'subject', e.target.value)}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}
                     />
                     <select value={entry.teacher} onChange={(e) => handleUpdateEntry(i, 'teacher', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                        <option value="">Select Teacher</option>
                        {staff.filter(s => s.role === 'teacher').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                     </select>
                     <button onClick={() => handleRemoveEntry(i)} className="icon-btn" style={{ color: 'var(--error)' }}><Trash2 size={18} /></button>
                  </div>
                ))}
                <button onClick={handleAddEntry} className="btn btn-outline" style={{ marginTop: '12px', borderStyle: 'dashed' }}>
                   <Plus size={18} /> Add New Entry
                </button>
             </div>
           ) : (
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                {days.map(day => (
                  <div key={day} className="day-column">
                     <h4 style={{ marginBottom: '16px', color: 'var(--primary)', fontWeight: '700', textAlign: 'center', borderBottom: '2px solid var(--accent)', paddingBottom: '8px' }}>{day}</h4>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {entries.filter(e => e.day === day).sort((a,b) => times.indexOf(a.time) - times.indexOf(b.time)).map((entry, i) => (
                          <div key={i} className="blend-bg transition-all hover-scale" style={{ padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px' }}>
                                <Clock size={12} /> {entry.time}
                             </div>
                             <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>{entry.subject}</div>
                             <div style={{ fontSize: '12px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <User size={12} /> {entry.teacher}
                             </div>
                          </div>
                        ))}
                        {entries.filter(e => e.day === day).length === 0 && (
                          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px dashed var(--glass-border)' }}>No classes</div>
                        )}
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>
    </PortalLayout>
  );
};

export default Timetable;
