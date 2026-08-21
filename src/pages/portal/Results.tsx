import { useEffect, useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import ReportCard from '../../components/portal/ReportCard';
import { Download, ChevronRight, Calendar } from 'lucide-react';
import { useAuth, type Result, type ReportCardData, type SubjectStats } from '../../context/AuthContext';

const Results = () => {
  const { currentUser, getReportCard, getSubjectStats } = useAuth();

  const currentResults = currentUser?.results || [];
  const history = currentUser?.history || [];

  const [reportCard, setReportCard] = useState<ReportCardData | null>(null);
  const [subjectStats, setSubjectStats] = useState<Record<string, SubjectStats>>({});

  // The report card shows one term/session at a time -- default to
  // whichever the student's most recently entered result belongs to.
  const latestResult = [...currentResults].sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  )[0];
  const reportTerm: Result['term'] = latestResult?.term ?? '1st Term';
  const reportSession = latestResult?.session ?? '2023/2024';
  const reportResults = currentResults.filter(r => r.term === reportTerm && r.session === reportSession);

  useEffect(() => {
    if (!currentUser || reportResults.length === 0) { setReportCard(null); setSubjectStats({}); return; }

    getReportCard(currentUser.id, reportTerm, reportSession).then(setReportCard);

    Promise.all(
      reportResults.map(r => getSubjectStats(currentUser.id, r.subject, reportTerm, reportSession).then(stats => [r.subject, stats] as const))
    ).then(entries => {
      const map: Record<string, SubjectStats> = {};
      for (const [subject, stats] of entries) if (stats) map[subject] = stats;
      setSubjectStats(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, reportTerm, reportSession, reportResults.length]);

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

        {/* Official Report Card */}
        {currentUser && (
          <div className="card glass report-card-wrapper" style={{ padding: '20px', overflowX: 'auto' }}>
            <ReportCard
              student={currentUser}
              term={reportTerm}
              session={reportSession}
              results={reportResults}
              reportCard={reportCard}
              subjectStats={subjectStats}
              totalInClass={Object.values(subjectStats)[0]?.totalInClass ?? 0}
            />
          </div>
        )}

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
