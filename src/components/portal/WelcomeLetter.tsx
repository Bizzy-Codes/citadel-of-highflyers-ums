import logo from '../../assets/logo.jpg';
import './WelcomeLetter.css';

// ---------------------------------------------------------------
// EDIT ME: the uniform timetable.
//
// Only days with a `wear` value are printed, so the letter is always
// accurate -- fill a day in and it appears, leave it blank and the
// letter doesn't mention it (and says the class teacher will confirm
// the rest, rather than inventing a kit).
//
// The Ankara/native wear has been retired and is deliberately absent.
// ---------------------------------------------------------------
const UNIFORM_SCHEDULE: { day: string; wear: string }[] = [
  { day: 'Monday', wear: 'School Suit, black socks and black shoes (not canvas)' },
  { day: 'Tuesday', wear: 'School Suit, black socks and black shoes (not canvas)' },
  { day: 'Wednesday', wear: '' },
  { day: 'Thursday', wear: 'Sports Wear and white canvas' },
  { day: 'Friday', wear: 'School Suit, black socks and black shoes (not canvas)' },
];

const BANK = {
  name: 'First Bank',
  accountName: "Citadel of Highflyers Int'l Academy",
  accountNumber: '2032386769',
};

const SCHOOL_LINE = '0706 497 0003';

interface WelcomeLetterProps {
  /** Pupil's name, so the letter reads as addressed to their family. */
  studentName?: string;
  /** Class they've been admitted into, if known. */
  className?: string;
}

const Note = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="welcome-letter-note-item">
    <h4>{title}</h4>
    <p>{children}</p>
  </div>
);

const WelcomeLetter = ({ studentName, className }: WelcomeLetterProps) => {
  const scheduled = UNIFORM_SCHEDULE.filter((u) => u.wear.trim());
  const everyDaySet = scheduled.length === UNIFORM_SCHEDULE.length;

  return (
    <div className="welcome-letter">
      <div className="welcome-letter-header">
        <img src={logo} alt="" className="welcome-letter-logo" />
        <div className="welcome-letter-titles">
          <h1>CITADEL OF HIGHFLYERS INTERNATIONAL ACADEMY</h1>
          <p className="welcome-letter-motto">Foundation for Future Generals</p>
          <p>B3, Rock Heaven, Opposite Deeperlife Bible Church, off Goodluck Jonathan Road (Former Zaria Road), Jos</p>
          <p>Tel: {SCHOOL_LINE} &nbsp;|&nbsp; citadelofhighflyersintlacademy@gmail.com</p>
        </div>
      </div>

      <h2 className="welcome-letter-banner">A Warm Welcome to Our New Intake</h2>

      <div className="welcome-letter-body">
        <p className="welcome-letter-salutation">
          Dear {studentName ? <><strong>{studentName}</strong>&rsquo;s Parents &amp; Guardians</> : 'Parents and Guardians'}
          {className ? <> <span className="welcome-letter-class">({className})</span></> : null},
        </p>

        <p>
          Thank you for choosing Citadel of Highflyers International Academy. Entrusting us with your
          child&rsquo;s education is a decision we hold as a genuine privilege, and we assure you that,
          by the grace of God, you will not regret it.
        </p>

        <p>
          From today your child belongs to a community built on faith, discipline and real academic
          excellence &mdash; a place where every pupil is known by name, encouraged in their strengths
          and patiently supported wherever they are still growing. We do not simply teach subjects
          here; we raise Future Generals, prepared in mind, in character and in confidence for every
          field they will one day lead.
        </p>

        <p>
          So that we can serve you well from the very first day, please take note of the following.
        </p>

        <h3 className="welcome-letter-subhead">School Hours</h3>
        <div className="welcome-letter-notes">
          <Note title="Resumption">
            7:30am, Mondays to Fridays. For your child&rsquo;s safety and settling-in, no pupil is
            admitted into the school after 8:00am.
          </Note>
          <Note title="Closing">
            Reception Class (Cr&egrave;che) closes at 1:00pm, Mondays to Fridays. All other classes
            close at 2:30pm on Mondays, Wednesdays and Thursdays, and at 1:00pm on Tuesdays and Fridays.
          </Note>
        </div>

        <h3 className="welcome-letter-subhead">School Uniform</h3>
        <p className="welcome-letter-lead">
          Pupils should arrive in the correct uniform, neat and well ironed.
        </p>
        <table className="welcome-letter-uniform">
          <tbody>
            {scheduled.map((u) => (
              <tr key={u.day}>
                <td>{u.day}</td>
                <td>{u.wear}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!everyDaySet && (
          <p className="welcome-letter-footnote">
            Your class teacher will confirm the kit for the remaining day of the week.
          </p>
        )}

        <h3 className="welcome-letter-subhead">Day to Day</h3>
        <div className="welcome-letter-notes">
          <Note title="Weekend Assessment">
            A short assessment goes home every Friday so we can see how well each topic has landed.
            Please leave blank any question your child genuinely cannot answer &mdash; that blank is
            what tells the class teacher exactly what to go back over, so it helps us far more than a
            filled-in guess.
          </Note>
          <Note title="Prayer and Fasting">
            On the first Friday of every month all pupils come fasting (Joel 2:16, Psalm 28:2). Please
            pack your child&rsquo;s breakfast alongside their lunch; hot water is provided at school
            for those taking tea.
          </Note>
          <Note title="Juice Day">
            Juice may be brought on Mondays and Thursdays only, and will be treated as contraband on
            any other day.
          </Note>
          <Note title="Tissue">
            Please send a jumbo-sized tissue to your child&rsquo;s class teacher at the beginning of
            each term.
          </Note>
          <Note title="Staying in Touch">
            We communicate through newsletters, the school WhatsApp platform, SMS, the notice board
            and Open Day. Please speak to us early and often &mdash; about progress, about concerns,
            about anything at all. A child flourishes fastest when home and school move together.
          </Note>
        </div>

        <h3 className="welcome-letter-subhead">Payments &amp; Enquiries</h3>
        <div className="welcome-letter-notes">
          <Note title="School Account">
            All payments should be made to <strong>{BANK.accountName}</strong>,
            account number <strong>{BANK.accountNumber}</strong>, {BANK.name}.
          </Note>
          <Note title="Enquiries">
            Call or send an SMS to the school line on <strong>{SCHOOL_LINE}</strong>. Our office is
            always glad to hear from you.
          </Note>
        </div>

        <p className="welcome-letter-closing">
          Thank you for your cooperation, and please be assured of our highest regards. We are
          genuinely glad you are here, and we look forward to celebrating everything your child will
          achieve with us.
        </p>

        <div className="welcome-letter-signoff">
          <p>Warmly,</p>
          <p className="welcome-letter-signature">Management</p>
          <p className="welcome-letter-signature-role">Citadel of Highflyers International Academy</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeLetter;
