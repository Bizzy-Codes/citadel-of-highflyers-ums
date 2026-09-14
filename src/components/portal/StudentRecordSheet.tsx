import type { User } from '../../context/AuthContext';
import logo from '../../assets/logo.jpg';
import { User as UserIcon } from 'lucide-react';
import './StudentRecordSheet.css';

// The pupil's full record on one A4 sheet -- everything the family
// filled in on the admission form plus the school's own fields. Shown
// on screen inside the admin's Pupil Profile and printed from there.
//
// Print behaviour matches the report card: the portal shell is hidden
// and this sheet is laid out against the page itself.
const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="record-row">
    <span>{label}</span>
    <strong>{value?.trim() ? value : '—'}</strong>
  </div>
);

const formatDate = (value?: string) => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const StudentRecordSheet = ({ student }: { student: User }) => (
  <div className="student-record-sheet">
    <div className="record-header">
      <img src={logo} alt="" className="record-logo" />
      <div className="record-title">
        <h1>CITADEL OF HIGH FLYERS INT'L ACADEMY, JOS</h1>
        <p>B3, Rock Heaven Opposite Deeperlife Bible Church off Goodluck Jonathan Road, (Former Zaria Road), Jos</p>
        <p>Tel: 08036334689 &nbsp;|&nbsp; Email: citadelofhighflyersintlacademy@gmail.com</p>
        <h2>Pupil Record</h2>
      </div>
      <div className="record-photo">
        {student.avatarUrl
          ? <img src={student.avatarUrl} alt={student.name} />
          : <div className="record-photo-placeholder"><UserIcon size={28} /></div>}
      </div>
    </div>

    <h3 className="record-section">Pupil</h3>
    <div className="record-grid">
      <Row label="Full Name" value={student.name} />
      <Row label="Pupil ID" value={student.displayId} />
      <Row label="Class" value={student.grade} />
      <Row label="Sex" value={student.sex} />
      <Row label="Date of Birth" value={formatDate(student.dateOfBirth)} />
      <Row label="Nationality" value={student.nationality} />
      <Row label="State of Origin" value={student.stateOfOrigin} />
      <Row label="L.G.A" value={student.lga} />
      <Row label="Religion" value={student.religion} />
      <Row label="Blood Group" value={student.bloodGroup} />
      <Row label="Genotype" value={student.genotype} />
      <Row label="Account Status" value={student.status} />
    </div>
    <div className="record-wide">
      <Row label="Home Address" value={student.homeAddress ?? student.location} />
      <Row label="Health Notes" value={student.healthNotes} />
    </div>

    <h3 className="record-section">Father / Guardian</h3>
    <div className="record-grid">
      <Row label="Name" value={student.fatherName} />
      <Row label="Occupation" value={student.fatherOccupation} />
      <Row label="Phone" value={student.fatherPhone} />
    </div>

    <h3 className="record-section">Mother / Guardian</h3>
    <div className="record-grid">
      <Row label="Name" value={student.motherName} />
      <Row label="Occupation" value={student.motherOccupation} />
      <Row label="Phone" value={student.motherPhone} />
    </div>

    <h3 className="record-section">Contact &amp; Collection</h3>
    <div className="record-grid">
      <Row label="Email on Account" value={student.email} />
      <Row label="Phone on Account" value={student.phone} />
      <Row label="Authorised for Pickup" value={student.pickupPerson} />
      <Row label="Pickup Phone" value={student.pickupPhone} />
    </div>

    <div className="record-footer">
      <span>Generated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      <span>Citadel of Highflyers Int'l Academy &mdash; Raising Future Generals in all their Fields</span>
    </div>
  </div>
);

export default StudentRecordSheet;
