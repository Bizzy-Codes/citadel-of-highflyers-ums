import logo from '../../assets/logo.jpg';
import './WelcomeLetter.css';

// ---------------------------------------------------------------
// EDIT ME: the uniform timetable.
//
// Only days with a `wear` value are printed, so the list is always
// accurate -- fill a day in and it appears in the letter, leave it
// blank and the letter simply doesn't mention it.
//
// (The Ankara wear has been retired and is deliberately not listed.)
// ---------------------------------------------------------------
const UNIFORM_SCHEDULE: { day: string; wear: string }[] = [
  { day: 'Monday', wear: 'School Suit' },
  { day: 'Tuesday', wear: 'School Suit' },
  { day: 'Wednesday', wear: '' },
  { day: 'Thursday', wear: '' },
  { day: 'Friday', wear: 'School Suit' },
];

interface WelcomeLetterProps {
  /** Pupil's name, so the letter reads as addressed to them. */
  studentName?: string;
  /** Class they've been admitted into, if known. */
  className?: string;
}

const WelcomeLetter = ({ studentName, className }: WelcomeLetterProps) => {
  const scheduled = UNIFORM_SCHEDULE.filter((u) => u.wear.trim());
  const allDaysSet = scheduled.length === UNIFORM_SCHEDULE.length;

  return (
    <div className="welcome-letter">
      <div className="welcome-letter-header">
        <img src={logo} alt="" className="welcome-letter-logo" />
        <div className="welcome-letter-titles">
          <h1>CITADEL OF HIGH FLYERS INT'L ACADEMY</h1>
          <p className="welcome-letter-motto">Raising Future Generals&hellip; in all their Fields</p>
          <p>B3, Rock Heaven, Opposite Deeperlife Bible Church, off Goodluck Jonathan Road (Former Zaria Road), Jos</p>
          <p>Tel: 08036334689 &nbsp;|&nbsp; citadelofhighflyersintlacademy@gmail.com</p>
        </div>
      </div>

      <h2 className="welcome-letter-banner">Welcome to the Citadel Family</h2>

      <div className="welcome-letter-body">
        <p className="welcome-letter-salutation">
          Dear {studentName ? <strong>{studentName}</strong> : 'Parent / Guardian'}
          {className ? <> &amp; Family <span className="welcome-letter-class">({className})</span></> : ' & Family'},
        </p>

        <p>
          It is our great delight to welcome you to Citadel of High Flyers International Academy.
          Your decision to join us is one we do not take lightly, and we count it a privilege that
          you have entrusted your child&rsquo;s education and character to our care.
        </p>

        <p>
          From today, your child is part of a community built on faith, discipline and genuine
          excellence &mdash; a place where every pupil is known by name, encouraged in their
          strengths, and patiently supported where they are still growing. We do not simply teach
          subjects here; we raise Future Generals, equipped in mind, in character and in confidence
          for every field they will one day lead.
        </p>

        <p>
          Our teachers are looking forward to meeting your child, and our doors are always open to
          you. Please speak to us early and often &mdash; about progress, about concerns, about
          anything at all. A child flourishes fastest when home and school move together, and we
          are committed to walking this journey with you.
        </p>

        {scheduled.length > 0 && (
          <>
            <h3 className="welcome-letter-subhead">School Uniform</h3>
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
            {!allDaysSet && (
              <p className="welcome-letter-note">
                Your class teacher will confirm the kit for the remaining days of the week.
              </p>
            )}
          </>
        )}

        <h3 className="welcome-letter-subhead">Getting Started</h3>
        <p>
          Your parent portal account is ready. Signing in gives you your child&rsquo;s attendance,
          results and report cards, school announcements and term dates, all in one place. If you
          ever need help getting in, our office will sort it out for you straight away.
        </p>

        <p>
          Once again, welcome. We are genuinely glad you are here, and we look forward to
          celebrating everything your child will achieve with us.
        </p>

        <div className="welcome-letter-signoff">
          <p>Warmly,</p>
          <p className="welcome-letter-signature">The Management</p>
          <p className="welcome-letter-signature-role">Citadel of High Flyers International Academy</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeLetter;
