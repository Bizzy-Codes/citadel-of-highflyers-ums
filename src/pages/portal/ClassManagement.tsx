import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type Result, type User } from '../../context/AuthContext';
import {
  Plus,
  FileText,
  CheckCircle,
  Sparkles,
  Search,
  ArrowUpCircle
} from 'lucide-react';
import OCRResultExtractor from '../../components/portal/OCRResultExtractor';

const ClassManagement = () => {
  const { className } = useParams();
  const { students, addResult, promoteStudent, addNotification } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [isAddingResult, setIsAddingResult] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  
  // Modal states for manual result entry
  const [newResult, setNewResult] = useState<Partial<Result>>({
    subject: '',
    score: 0,
    term: '1st Term',
    session: '2023/2024'
  });

  const classStudents = students.filter(s => s.grade === className && (
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.displayId.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  const handleAddResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudent && newResult.subject && newResult.score !== undefined) {
      const score = Number(newResult.score);
      const grade = score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F';

      await addResult(selectedStudent.id, {
        subject: newResult.subject,
        score: score,
        grade,
        term: newResult.term as Result['term'],
        session: newResult.session as string
      });

      await addNotification({
        title: "Result Added",
        message: `New result for ${selectedStudent.name} in ${newResult.subject} has been uploaded.`,
        type: 'success'
      });

      setIsAddingResult(false);
      setNewResult({ subject: '', score: 0, term: '1st Term', session: '2023/2024' });
    }
  };

  const handlePromote = async (student: User) => {
    const nextGrade = prompt(`Promote ${student.name} to which class?`, 'Grade 2');
    if (nextGrade) {
      await promoteStudent(student.id, nextGrade, "2023/2024");
      await addNotification({
        title: "Student Promoted",
        message: `${student.name} has been promoted to ${nextGrade}. All previous records archived.`,
        type: 'success'
      });
      alert(`${student.name} promoted to ${nextGrade}`);
    }
  };

  const handleExtractedResults = async (extracted: { subject: string; score: number }[]) => {
    if (selectedStudent) {
      for (const item of extracted) {
        const grade = item.score >= 80 ? 'A' : item.score >= 70 ? 'B' : item.score >= 60 ? 'C' : item.score >= 50 ? 'D' : 'F';
        await addResult(selectedStudent.id, {
          subject: item.subject,
          score: item.score,
          grade,
          term: '1st Term', // Default or could be selected
          session: '2023/2024'
        });
      }

      await addNotification({
        title: "AI Extraction Success",
        message: `Automatically extracted ${extracted.length} results for ${selectedStudent.name}.`,
        type: 'success'
      });

      setIsAIProcessing(false);
      alert(`Successfully extracted and added ${extracted.length} results!`);
    }
  };

  return (
    <PortalLayout title={`Manage Class: ${className}`}>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Class Overview */}
        <section className="card glass" style={{ padding: '30px', borderRadius: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '24px', fontWeight: '800' }}>{className} Student List</h3>
              <p style={{ color: 'var(--text-muted)' }}>You have {classStudents.length} students in this class section.</p>
            </div>
            <div className="search-bar" style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search student..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '10px 16px 10px 40px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <th style={{ padding: '12px 20px' }}>STUDENT NAME</th>
                  <th style={{ padding: '12px 20px' }}>ID / NUMBER</th>
                  <th style={{ padding: '12px 20px' }}>CURRENT RESULTS</th>
                  <th style={{ padding: '12px 20px' }}>STATUS</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((student, i) => (
                  <tr key={i} className="hover-scale" style={{ background: 'var(--bg-surface)', borderRadius: '16px', transition: 'all 0.2s ease' }}>
                    <td style={{ padding: '20px', borderRadius: '16px 0 0 16px', fontWeight: '700' }}>{student.name}</td>
                    <td style={{ padding: '20px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{student.displayId}</td>
                    <td style={{ padding: '20px' }}>
                      <span style={{ padding: '4px 10px', background: 'var(--accent)', color: 'var(--primary)', borderRadius: '50px', fontSize: '12px', fontWeight: '700' }}>
                        {student.results?.length || 0} Subjects
                      </span>
                    </td>
                    <td style={{ padding: '20px' }}>
                      <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600' }}>
                        <CheckCircle size={14} /> Active
                      </span>
                    </td>
                    <td style={{ padding: '20px', borderRadius: '0 16px 16px 0', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => { setSelectedStudent(student); setIsAddingResult(true); }}
                          className="btn btn-outline sm"
                        >
                          <Plus size={16} /> Add Result
                        </button>
                        <button 
                          onClick={() => { setSelectedStudent(student); setIsAIProcessing(true); }}
                          className="btn btn-primary sm"
                          style={{ background: 'linear-gradient(135deg, var(--primary), #D946EF)' }}
                        >
                          <Sparkles size={16} /> AI Scan
                        </button>
                        <button 
                          onClick={() => handlePromote(student)}
                          className="icon-btn" 
                          title="Promote to Next Class" 
                          style={{ color: 'var(--primary)' }}
                        >
                          <ArrowUpCircle size={22} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* AI OCR Modal */}
        {isAIProcessing && selectedStudent && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '500px' }}>
               <OCRResultExtractor 
                onResultsExtracted={handleExtractedResults}
                onCancel={() => setIsAIProcessing(false)}
               />
               <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '0 0 24px 24px', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
                  <p style={{ fontSize: '13px' }}>Scanning result for: <strong>{selectedStudent.name}</strong></p>
               </div>
            </div>
          </div>
        )}

        {/* Manual Result Modal */}
        {isAddingResult && selectedStudent && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
             <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '400px' }}>
                <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                   <FileText size={20} /> Add Result: {selectedStudent.name}
                </h3>
                <form onSubmit={handleAddResult} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   <div className="input-group">
                      <label>Subject Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Mathematics" 
                        value={newResult.subject}
                        onChange={e => setNewResult({...newResult, subject: e.target.value})}
                        required
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                      />
                   </div>
                   <div className="input-group">
                      <label>Score (Out of 100)</label>
                      <input 
                        type="number" 
                        max="100"
                        min="0"
                        value={newResult.score}
                        onChange={e => setNewResult({...newResult, score: parseInt(e.target.value)})}
                        required
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                      />
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="input-group">
                        <label>Term</label>
                        <select 
                          value={newResult.term}
                          onChange={e => setNewResult({...newResult, term: e.target.value as any})}
                          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                        >
                          <option>1st Term</option>
                          <option>2nd Term</option>
                          <option>3rd Term</option>
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Session</label>
                        <input 
                          type="text" 
                          value={newResult.session}
                          onChange={e => setNewResult({...newResult, session: e.target.value})}
                          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                        />
                      </div>
                   </div>
                   <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <button type="button" onClick={() => setIsAddingResult(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Result</button>
                   </div>
                </form>
             </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
};

export default ClassManagement;
