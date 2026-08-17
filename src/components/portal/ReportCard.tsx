import type { User, Result, ReportCardData, SubjectStats } from '../../context/AuthContext';
import { gradeFromScore, commentFromGrade, pointsForRating, GRADING_SYSTEM } from '../../lib/grading';
import logo from '../../assets/logo.jpg';
import './ReportCard.css';

interface ReportCardProps {
  student: User;
  term: string;
  session: string;
  results: Result[];
  reportCard: ReportCardData | null;
  subjectStats: Record<string, SubjectStats>;
  totalInClass: number;
}

const PSYCHOMOTOR_ITEMS: [keyof ReportCardData, string][] = [
  ['commOralRating', 'Communication (Oral)'],
  ['creativityRating', 'Creativity'],
  ['drawingPaintingRating', 'Drawing & Painting'],
  ['musicRating', 'Music'],
  ['sportsRating', 'Sports'],
];

const AFFECTIVE_ITEMS: [keyof ReportCardData, string][] = [
  ['honestyRating', 'Honesty'],
  ['punctualityRating', 'Punctuality and Cleanliness'],
  ['attentivenessRating', 'Attentiveness and Promptness at Work'],
  ['politenessRating', 'Politeness and Considerate'],
  ['obedienceRating', 'Obedience and Does Homework Regularly'],
  ['independenceRating', 'Works Independently'],
  ['socialRating', 'Enjoys Company of Peers and Participates in Social Activities'],
];

const DomainTable = ({ title, items, reportCard }: { title: string; items: [keyof ReportCardData, string][]; reportCard: ReportCardData | null }) => {
  let total = 0;
  const rows = items.map(([key, label]) => {
    const rating = reportCard?.[key] as string | undefined;
    const points = pointsForRating(rating);
    if (points) total += points;
    return (
      <tr key={key}>
        <td>{label}</td>
        <td>{rating || '-'}</td>
        <td>{points ?? '-'}</td>
      </tr>
    );
  });
  return (
    <table className="report-card-domain-table">
      <thead>
        <tr><th colSpan={3}>{title}</th></tr>
        <tr><th>Item</th><th>Rating</th><th>Points</th></tr>
      </thead>
      <tbody>
        {rows}
        <tr className="total-row"><td>Total</td><td></td><td>{total}</td></tr>
      </tbody>
    </table>
  );
};

const ReportCard = ({ student, term, session, results, reportCard, subjectStats, totalInClass }: ReportCardProps) => {
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const totalPossible = results.length * 100;
  const percentage = totalPossible > 0 ? ((totalScore / totalPossible) * 100).toFixed(1) : '0.0';
  const overall = gradeFromScore(totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0);

  return (
    <div className="report-card">
      <div className="report-card-header">
        <img src={logo} alt="" className="report-card-logo" />
        <div className="report-card-title">
          <h1>CITADEL OF HIGH FLYERS INT'L ACADEMY, JOS</h1>
          <p>B3, Rock Heaven Opposite Deeperlife Bible Church off Goodluck Jonathan Road, (Former Zaria Road), Jos</p>
          <p>Tel: 08036334689 &nbsp;|&nbsp; Email: citadelofhighflyersintlacademy@gmail.com</p>
        </div>
        <img src={logo} alt="" className="report-card-logo" />
      </div>

      <div className="report-card-student-info">
        <div><span>Name</span><strong>{student.name}</strong></div>
        <div><span>Session</span><strong>{session}</strong></div>
        <div><span>Term</span><strong>{term}</strong></div>
        <div><span>Class</span><strong>{student.grade}</strong></div>
        <div><span>Total in Class</span><strong>{totalInClass || '-'}</strong></div>
        <div><span>This Term Ends</span><strong>{reportCard?.termEnds || '-'}</strong></div>
        <div><span>Next Term Begins</span><strong>{reportCard?.nextTermBegins || '-'}</strong></div>
      </div>

      <table className="report-card-subjects">
        <thead>
          <tr>
            <th>Subjects</th>
            <th>1st CA (20)</th>
            <th>2nd CA (20)</th>
            <th>Exam (60)</th>
            <th>Total (100)</th>
            <th>Position</th>
            <th>Lowest</th>
            <th>Average</th>
            <th>Highest</th>
            <th>Grade</th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody>
          {results.length > 0 ? results.map((r, i) => {
            const stats = subjectStats[r.subject];
            return (
              <tr key={i}>
                <td>{r.subject}</td>
                <td>{r.ca1 ?? '-'}</td>
                <td>{r.ca2 ?? '-'}</td>
                <td>{r.exam ?? '-'}</td>
                <td>{r.score}</td>
                <td>{stats?.classPosition ?? '-'}</td>
                <td>{stats?.lowest ?? '-'}</td>
                <td>{stats?.average ?? '-'}</td>
                <td>{stats?.highest ?? '-'}</td>
                <td>{r.grade}</td>
                <td>{commentFromGrade(r.grade)}</td>
              </tr>
            );
          }) : (
            <tr><td colSpan={11} style={{ textAlign: 'center', padding: '16px' }}>No results recorded for this term yet.</td></tr>
          )}
        </tbody>
      </table>

      <div className="report-card-domains">
        <DomainTable title="Psychomotor Domain (Skills & Sports)" items={PSYCHOMOTOR_ITEMS} reportCard={reportCard} />
        <DomainTable title="Affective Domain (Observations of Conduct)" items={AFFECTIVE_ITEMS} reportCard={reportCard} />
      </div>

      <div className="report-card-summary">
        <div className="report-card-remark">
          <div className="remark-stats">
            <div><span>Total Score</span><strong>{totalScore}</strong></div>
            <div><span>Out of</span><strong>{totalPossible}</strong></div>
            <div><span>Percentage</span><strong>{percentage}%</strong></div>
          </div>
          <div className="remark-box">
            <span>Remark</span>
            <p>{reportCard?.remark || overall.comment}</p>
          </div>
        </div>
        <table className="report-card-grading-system">
          <thead><tr><th colSpan={3}>Grading System</th></tr></thead>
          <tbody>
            {GRADING_SYSTEM.map(g => (
              <tr key={g.grade}><td>{g.range}</td><td>{g.grade}</td><td>{g.comment}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="report-card-footer">
        <div>
          <span>Head Master's Comment</span>
          <p>{reportCard?.headmasterComment || '-'}</p>
          <p className="signature">{reportCard?.headmasterSignature || ''}</p>
        </div>
        <div>
          <span>Class Teacher's Comment</span>
          <p>{reportCard?.classTeacherComment || '-'}</p>
          <p className="signature">{reportCard?.classTeacherSignature || ''}</p>
        </div>
      </div>
    </div>
  );
};

export default ReportCard;
