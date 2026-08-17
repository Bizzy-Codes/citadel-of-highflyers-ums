import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Upload } from 'lucide-react';
import { useAuth, type NewAdmissionApplicationInput } from '../../context/AuthContext';
import './Founders.css';
import './Admissions.css';

const emptyInput: NewAdmissionApplicationInput = {
  surname: '', firstName: '', otherNames: '', sex: 'Male', dateOfBirth: '',
  homeAddress: '', nationality: '', stateOfOrigin: '', lga: '', religion: '',
  bloodGroup: '', genotype: '',
  fatherName: '', fatherOccupation: '', fatherOfficeAddress: '', fatherPhone: '',
  motherName: '', motherOccupation: '', motherOfficeAddress: '', motherPhone: '',
  healthChallenge: '', healthChallengeDetails: '', schoolLastAttended: '',
  pickupPerson: '', pickupPhone: '', siblingNames: '',
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="input-group">
    <label>{label}</label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' };

const Admissions = () => {
  const { submitAdmissionApplication } = useAuth();
  const [form, setForm] = useState<NewAdmissionApplicationInput>(emptyInput);
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<NewAdmissionApplicationInput>) => setForm({ ...form, ...patch });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: submitError } = await submitAdmissionApplication(form, photo);
    setSubmitting(false);
    if (submitError) { setError(submitError); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="founders-root">
        <nav className="founders-nav">
          <Link to="/" className="back-btn"><ArrowLeft size={20} /> Back to Home</Link>
        </nav>
        <div className="admission-success">
          <CheckCircle2 size={64} color="var(--success)" />
          <h1>Application Submitted!</h1>
          <p>Thank you for applying to Citadel of Highflyers Int'l Academy. Our admissions team will review your application and reach out to you shortly.</p>
          <Link to="/" className="btn btn-primary lg">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="founders-root">
      <nav className="founders-nav">
        <Link to="/" className="back-btn"><ArrowLeft size={20} /> Back to Home</Link>
        <div className="school-logo-small">
          <img src="/logo.jpg" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '10px' }} />
          Citadel of Highflyers Int'l Academy
        </div>
      </nav>

      <header className="founders-header animate-fade-in">
        <span className="badge">Admissions Open</span>
        <h1>Admission <span>Application Form</span></h1>
        <p>Fill out the form below to apply for a place at Citadel of Highflyers Int'l Academy.</p>
      </header>

      <main className="container admission-form-container">
        <form onSubmit={handleSubmit} className="card glass admission-form">
          {error && <div className="admission-form-error">{error}</div>}

          <h3 className="admission-section-title">Child's Information</h3>
          <div className="admission-grid">
            <Field label="Surname"><input style={inputStyle} required value={form.surname} onChange={(e) => set({ surname: e.target.value })} /></Field>
            <Field label="First Name"><input style={inputStyle} required value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} /></Field>
            <Field label="Other Names"><input style={inputStyle} value={form.otherNames} onChange={(e) => set({ otherNames: e.target.value })} /></Field>
            <Field label="Sex">
              <select style={inputStyle} value={form.sex} onChange={(e) => set({ sex: e.target.value as 'Male' | 'Female' })}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </Field>
            <Field label="Date of Birth"><input type="date" style={inputStyle} required value={form.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} /></Field>
            <Field label="Nationality"><input style={inputStyle} required value={form.nationality} onChange={(e) => set({ nationality: e.target.value })} /></Field>
            <Field label="State of Origin"><input style={inputStyle} required value={form.stateOfOrigin} onChange={(e) => set({ stateOfOrigin: e.target.value })} /></Field>
            <Field label="L.G.A"><input style={inputStyle} required value={form.lga} onChange={(e) => set({ lga: e.target.value })} /></Field>
            <Field label="Religion"><input style={inputStyle} value={form.religion} onChange={(e) => set({ religion: e.target.value })} /></Field>
            <Field label="Blood Group"><input style={inputStyle} value={form.bloodGroup} onChange={(e) => set({ bloodGroup: e.target.value })} /></Field>
            <Field label="Genotype"><input style={inputStyle} value={form.genotype} onChange={(e) => set({ genotype: e.target.value })} /></Field>
          </div>
          <Field label="Home Address"><input style={inputStyle} required value={form.homeAddress} onChange={(e) => set({ homeAddress: e.target.value })} /></Field>

          <h3 className="admission-section-title">Father's Information</h3>
          <div className="admission-grid">
            <Field label="Father's Name"><input style={inputStyle} value={form.fatherName} onChange={(e) => set({ fatherName: e.target.value })} /></Field>
            <Field label="Father's Occupation"><input style={inputStyle} value={form.fatherOccupation} onChange={(e) => set({ fatherOccupation: e.target.value })} /></Field>
            <Field label="Office Address"><input style={inputStyle} value={form.fatherOfficeAddress} onChange={(e) => set({ fatherOfficeAddress: e.target.value })} /></Field>
            <Field label="Phone No"><input type="tel" style={inputStyle} value={form.fatherPhone} onChange={(e) => set({ fatherPhone: e.target.value })} /></Field>
          </div>

          <h3 className="admission-section-title">Mother's Information</h3>
          <div className="admission-grid">
            <Field label="Mother's Name"><input style={inputStyle} value={form.motherName} onChange={(e) => set({ motherName: e.target.value })} /></Field>
            <Field label="Mother's Occupation"><input style={inputStyle} value={form.motherOccupation} onChange={(e) => set({ motherOccupation: e.target.value })} /></Field>
            <Field label="Office Address"><input style={inputStyle} value={form.motherOfficeAddress} onChange={(e) => set({ motherOfficeAddress: e.target.value })} /></Field>
            <Field label="Phone Number"><input type="tel" style={inputStyle} value={form.motherPhone} onChange={(e) => set({ motherPhone: e.target.value })} /></Field>
          </div>

          <h3 className="admission-section-title">Additional Information</h3>
          <div className="admission-grid">
            <Field label="Any Health Challenge?"><input style={inputStyle} value={form.healthChallenge} onChange={(e) => set({ healthChallenge: e.target.value })} /></Field>
            <Field label="If any, specify"><input style={inputStyle} value={form.healthChallengeDetails} onChange={(e) => set({ healthChallengeDetails: e.target.value })} /></Field>
            <Field label="School Last Attended (transfer pupils only)"><input style={inputStyle} value={form.schoolLastAttended} onChange={(e) => set({ schoolLastAttended: e.target.value })} /></Field>
            <Field label="Who is responsible for picking the child"><input style={inputStyle} required value={form.pickupPerson} onChange={(e) => set({ pickupPerson: e.target.value })} /></Field>
            <Field label="Their Phone Number(s)"><input type="tel" style={inputStyle} required value={form.pickupPhone} onChange={(e) => set({ pickupPhone: e.target.value })} /></Field>
          </div>
          <Field label="Does the child have siblings at Citadel? If yes, state names">
            <input style={inputStyle} placeholder="e.g. John Doe, Jane Doe" value={form.siblingNames} onChange={(e) => set({ siblingNames: e.target.value })} />
          </Field>

          <h3 className="admission-section-title">Child's Photo</h3>
          <Field label="Upload a recent photo of the child (optional)">
            <label className="admission-photo-upload">
              <Upload size={18} />
              <span>{photo ? photo.name : 'Choose a photo...'}</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </label>
          </Field>

          <button type="submit" className="btn btn-primary lg" style={{ width: '100%', marginTop: '10px' }} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </main>

      <footer className="founders-footer">
        <div className="footer-blob"></div>
        <p>&copy; {new Date().getFullYear()} Citadel of Highflyers Int'l Academy. The Foundation for Future Generals.</p>
      </footer>
    </div>
  );
};

export default Admissions;
