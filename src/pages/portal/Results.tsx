import PortalLayout from '../../components/layout/PortalLayout';
import { Download, ChevronRight, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Results = () => {
  const { currentUser } = useAuth();
  
  const currentResults = currentUser?.results || [];
  const history = currentUser?.history || [];

  const calculateGPA = (results: any[]) => {
    if (results.length === 0) return "0.0";
    const total = results.reduce((acc, curr) => acc + curr.score, 0);
    return ((total / (results.length * 100)) * 5).toFixed(1);
  };

  const getOverallGrade = (gpa: string) => {
    const num = parseFloat(gpa);
    if (num >= 4.5) return "Grade A";
    if (num >= 3.5) return "Grade B";
    if (num >= 2.5) return "Grade C";
    return "Grade D/F";
  };

  const currentGPA = calculateGPA(currentResults);
  const overallGrade = getOverallGrade(currentGPA);

  return (
    <PortalLayout title="Academic Results">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* Latest Performance Card */}
        <div className="card glass-purple" style={{ padding: '40px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', color: 'var(--text-muted)', marginBottom: '16px' }}>Current Performance ({currentUser?.grade})</h2>
          <div style={{ fontSize: '80px', fontWeight: '800', color: 'var(--primary)', lineHeight: '1', margin: '20px 0' }}>{currentGPA}</div>
          <p style={{ fontSize: '18px', fontWeight: '600' }}>GPA Scale 5.0 | {overallGrade}</p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '30px' }}>
            <button className="btn btn-primary sm" onClick={() => window.print()}><Download size={18} /> Download Report Card</button>
          </div>
        </div>

        {/* Current Term Subjects */}
        <div className="card glass">
          <div className="card-header">
            <h3>Current Term Subjects ({currentResults.length})</h3>
          </div>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--secondary)' }}>
                  <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>SUBJECT</th>
                  <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>SCORE</th>
                  <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>GRADE</th>
                  <th style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>TERM</th>
                </tr>
              </thead>
              <tbody>
                {currentResults.length > 0 ? currentResults.map((res, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <td style={{ padding: '20px', fontWeight: '600' }}>{res.subject}</td>
                    <td style={{ padding: '20px' }}>{res.score}/100</td>
                    <td style={{ padding: '20px' }}>
                      <span style={{ padding: '4px 12px', borderRadius: '4px', background: res.score >= 50 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: res.score >= 50 ? 'var(--success)' : 'var(--error)', fontWeight: '700' }}>
                        {res.grade}
                      </span>
                    </td>
                    <td style={{ padding: '20px' }}>{res.term}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No results uploaded for this term yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Past Academic History (Promotion Records) */}
        {history.length > 0 && (
          <div className="card glass">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={20} />
              <h3>Academic History & Past Classes</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px' }}>
              {history.map((record, idx) => (
                <div key={idx} className="blend-bg hover-scale" style={{ padding: '20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--glass-border)' }}>
                   <div>
                      <h4 style={{ fontSize: '16px', marginBottom: '4px' }}>{record.grade} Archives</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Session: {record.session} | {record.results.length} Subjects Recorded</p>
                   </div>
                   <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ textAlign: 'right', marginRight: '20px' }}>
                         <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Final GPA</span>
                         <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>{calculateGPA(record.results)}</strong>
                      </div>
                      <button className="icon-btn" title="View Full Report"><ChevronRight size={20} /></button>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
};

export default Results;
