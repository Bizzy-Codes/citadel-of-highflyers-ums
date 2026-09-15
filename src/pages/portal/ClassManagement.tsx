import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type Result, type ReportCardData, type User } from '../../context/AuthContext';
import { RATING_OPTIONS } from '../../lib/grading';
import { getSuggestedComments, addCommentToHistory } from '../../lib/commentHistory';
import {
  CheckCircle,
  Sparkles,
  Search,
  ArrowUpCircle,
  ClipboardList,
  Save
} from 'lucide-react';
import OCRResultExtractor from '../../components/portal/OCRResultExtractor';

const ClassManagement = () => {
  const { className } = useParams();
  const { students, saveSubjectResults, promoteStudent, addNotification, getReportCard, upsertReportCard, academicCalendar } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isEditingReportCard, setIsEditingReportCard] = useState(false);

  // Term and session come from the Academic Calendar -- never typed in
  // per pupil. Subject scores are entered on the Report Cards page
  // now; this screen manages the pupil list, the report-card remarks/
  // ratings, promotions, and the AI result scan.
  const reportCardTerm: Result['term'] = academicCalendar?.currentTerm ?? '1st Term';
  const reportCardSession = academicCalendar?.currentSession ?? '';
  const [reportCard, setReportCard] = useState<ReportCardData>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [classTeacherSuggestions, setClassTeacherSuggestions] = useState<string[]>([]);
  const [headmasterSuggestions, setHeadmasterSuggestions] = useState<string[]>([]);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const classStudents = students.filter(s => s.grade === className && (
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.displayId.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  const openReportCard = async (student: User) => {
    setSelectedStudent(student);
    const existing = await getReportCard(student.id, reportCardTerm, reportCardSession);
    setReportCard(existing ?? {});
    setAutoSaveStatus('idle');
    setClassTeacherSuggestions(getSuggestedComments('classTeacher'));
    setHeadmasterSuggestions(getSuggestedComments('headmaster'));
    setIsEditingReportCard(true);
  };

  // Auto-save report card on changes
  useEffect(() => {
    if (!isEditingReportCard || !selectedStudent) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    setAutoSaveStatus('saving');

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await upsertReportCard(selectedStudent.id, reportCardTerm, reportCardSession, reportCard);
        // Save comments to history
        if (reportCard.classTeacherComment) {
          addCommentToHistory('classTeacher', reportCard.classTeacherComment);
        }
        if (reportCard.headmasterComment) {
          addCommentToHistory('headmaster', reportCard.headmasterComment);
        }
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch (error) {
        setAutoSaveStatus('idle');
      }
    }, 1500); // Auto-save after 1.5 seconds of inactivity

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [reportCard, isEditingReportCard, selectedStudent, reportCardTerm, reportCardSession, upsertReportCard]);

  const handleSaveReportCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    // Save comments to history
    if (reportCard.classTeacherComment) {
      addCommentToHistory('classTeacher', reportCard.classTeacherComment);
    }
    if (reportCard.headmasterComment) {
      addCommentToHistory('headmaster', reportCard.headmasterComment);
    }

    await upsertReportCard(selectedStudent.id, reportCardTerm, reportCardSession, reportCard);
    // Deliberately NOT a notification. "The thing I just saved has
    // saved" is page feedback -- broadcasting it put a line in every
    // pupil's notification box.
    setIsEditingReportCard(false);
  };

  const handlePromote = async (student: User) => {
    const nextGrade = prompt(`Promote ${student.name} to which class?`, 'Grade 2');
    if (nextGrade) {
      await promoteStudent(student.id, nextGrade, "2023/2024");
      // A promotion IS news for the pupil it happened to -- and only them.
      await addNotification({
        recipientId: student.id,
        title: "You've been promoted",
        message: `Congratulations! You have been moved up to ${nextGrade}.`,
        type: 'success'
      });
      alert(`${student.name} promoted to ${nextGrade}`);
    }
  };

  const handleExtractedResults = async (extracted: { subject: string; score: number }[]) => {
    if (!selectedStudent) return;
    if (!reportCardSession) { alert('Set the Current Session on the Academic Calendar page first.'); return; }
    // OCR only gives a single total, not a CA/exam breakdown, so it all
    // goes into "exam" -- the printed report shows blank CA columns for
    // these subjects until a teacher fills them in on the Report Cards
    // page. Term/session come from the Academic Calendar.
    const rows = extracted.map((item) => ({ subject: item.subject, ca1: 0, ca2: 0, exam: item.score }));
    const { error } = await saveSubjectResults(selectedStudent.id, reportCardTerm, reportCardSession, rows);
    if (error) { alert('Failed to save scanned results: ' + error); return; }

    setIsAIProcessing(false);
    alert(`Successfully extracted and added ${extracted.length} results!`);
  };

  return (
    <PortalLayout title={`Manage Class: ${className}`}>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Class Overview */}
        <section className="card glass" style={{ padding: '30px', borderRadius: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '24px', fontWeight: '800' }}>{className} Pupil List</h3>
              <p style={{ color: 'var(--text-muted)' }}>You have {classStudents.length} pupils in this class section.</p>
            </div>
            <div className="search-bar" style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search pupil..."
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
                  <th style={{ padding: '12px 20px' }}>PUPIL NAME</th>
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
                          onClick={() => openReportCard(student)}
                          className="btn btn-outline sm"
                        >
                          <ClipboardList size={16} /> Report Card
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

        {/* Report Card Modal -- term dates, remarks/signatures, and
            psychomotor/affective domain ratings for the printed sheet. */}
        {isEditingReportCard && selectedStudent && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
             <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto' }}>
                <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                   <ClipboardList size={20} /> Report Card: {selectedStudent.name}
                </h3>
                <form onSubmit={handleSaveReportCard} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                     {reportCardTerm} &middot; {reportCardSession || 'session not set'}
                     <span style={{ display: 'block', fontSize: '11px' }}>Term &amp; session come from the Academic Calendar. Subject scores are entered on the Report Cards page.</span>
                   </p>

                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="input-group">
                        <label>This Term Ends</label>
                        <input
                          type="date"
                          value={reportCard.termEnds ?? ''}
                          onChange={e => setReportCard({...reportCard, termEnds: e.target.value})}
                          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                        />
                      </div>
                      <div className="input-group">
                        <label>Next Term Begins</label>
                        <input
                          type="date"
                          value={reportCard.nextTermBegins ?? ''}
                          onChange={e => setReportCard({...reportCard, nextTermBegins: e.target.value})}
                          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                        />
                      </div>
                   </div>

                   <div className="input-group">
                      <label>Overall Remark</label>
                      <input
                        type="text" placeholder="e.g. A hardworking and diligent pupil."
                        value={reportCard.remark ?? ''}
                        onChange={e => setReportCard({...reportCard, remark: e.target.value})}
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                      />
                   </div>

                   <h4 style={{ marginTop: '8px' }}>Psychomotor Domain</h4>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {([
                        ['commOralRating', 'Communication (Oral)'],
                        ['creativityRating', 'Creativity'],
                        ['drawingPaintingRating', 'Drawing & Painting'],
                        ['musicRating', 'Music'],
                        ['sportsRating', 'Sports'],
                      ] as const).map(([key, label]) => (
                        <div className="input-group" key={key}>
                          <label>{label}</label>
                          <select
                            value={reportCard[key] ?? ''}
                            onChange={e => setReportCard({...reportCard, [key]: e.target.value})}
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                          >
                            <option value="">-- Not rated --</option>
                            {RATING_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                   </div>

                   <h4 style={{ marginTop: '8px' }}>Affective Domain (Conduct)</h4>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {([
                        ['honestyRating', 'Honesty'],
                        ['punctualityRating', 'Punctuality & Cleanliness'],
                        ['attentivenessRating', 'Attentiveness & Promptness'],
                        ['politenessRating', 'Politeness & Considerate'],
                        ['obedienceRating', 'Obedience & Homework'],
                        ['independenceRating', 'Works Independently'],
                        ['socialRating', 'Social Skills'],
                      ] as const).map(([key, label]) => (
                        <div className="input-group" key={key}>
                          <label>{label}</label>
                          <select
                            value={reportCard[key] ?? ''}
                            onChange={e => setReportCard({...reportCard, [key]: e.target.value})}
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                          >
                            <option value="">-- Not rated --</option>
                            {RATING_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                   </div>

                   <h4 style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     Comments & Signatures
                     {autoSaveStatus === 'saving' && (
                       <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>saving...</span>
                     )}
                     {autoSaveStatus === 'saved' && (
                       <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '4px' }}>
                         <Save size={12} /> saved
                       </span>
                     )}
                   </h4>
                   <div className="input-group">
                      <label>Head Master's Comment</label>
                      <input
                        type="text"
                        placeholder="Enter comment..."
                        value={reportCard.headmasterComment ?? ''}
                        onChange={e => setReportCard({...reportCard, headmasterComment: e.target.value})}
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                      />
                      {headmasterSuggestions.length > 0 && (
                        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <p style={{ margin: '0 0 4px' }}>Recently used:</p>
                          {headmasterSuggestions.slice(0, 3).map((suggestion, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setReportCard({...reportCard, headmasterComment: suggestion})}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '6px 8px',
                                margin: '2px 0',
                                background: 'var(--bg-light)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                color: 'var(--text-main)',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-light)')}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                   </div>
                   <div className="input-group">
                      <label>Class Teacher's Comment</label>
                      <input
                        type="text"
                        placeholder="Enter comment..."
                        value={reportCard.classTeacherComment ?? ''}
                        onChange={e => setReportCard({...reportCard, classTeacherComment: e.target.value})}
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                      />
                      {classTeacherSuggestions.length > 0 && (
                        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <p style={{ margin: '0 0 4px' }}>Recently used:</p>
                          {classTeacherSuggestions.slice(0, 3).map((suggestion, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setReportCard({...reportCard, classTeacherComment: suggestion})}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '6px 8px',
                                margin: '2px 0',
                                background: 'var(--bg-light)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                color: 'var(--text-main)',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-light)')}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="input-group">
                        <label>Head Master's Signature</label>
                        <input
                          type="text" placeholder="Typed name"
                          value={reportCard.headmasterSignature ?? ''}
                          onChange={e => setReportCard({...reportCard, headmasterSignature: e.target.value})}
                          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                        />
                      </div>
                      <div className="input-group">
                        <label>Class Teacher's Signature</label>
                        <input
                          type="text" placeholder="Typed name"
                          value={reportCard.classTeacherSignature ?? ''}
                          onChange={e => setReportCard({...reportCard, classTeacherSignature: e.target.value})}
                          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}
                        />
                      </div>
                   </div>

                   <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <button type="button" onClick={() => setIsEditingReportCard(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Report Card</button>
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
