import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Upload, Copy } from 'lucide-react';
import { useAuth, type NewAdmissionApplicationInput } from '../../context/AuthContext';
import './Founders.css';
import './Admissions.css';

const APPLICATION_FEE = 2000;
const PHYSICAL_COPY_FEE = 2500;

const BANK_DETAILS = {
  bankName: 'First Bank',
  accountNumber: '2032386769',
  accountName: 'Citadel of Highflyers Int\'l Academy',
};

const WHATSAPP_LINK = "https://wa.me/2347064970003?text=Hello,%20I%20just%20submitted%20my%20child's%20admission%20application%20and%20payment%20receipt.%20I'd%20like%20some%20further%20information.";

const CLASSES = ["Daycare", "Reception", "Kindergarten 1", "Kindergarten 2", "Pre-Grade", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"];

const emptyInput: NewAdmissionApplicationInput = {
  surname: '', firstName: '', otherNames: '', email: '', classApplyingFor: CLASSES[0], sex: 'Male', dateOfBirth: '',
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

type Step = 'form' | 'payment' | 'done';

const Admissions = () => {
  const { submitAdmissionApplication, submitAdmissionPayment } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [form, setForm] = useState<NewAdmissionApplicationInput>(emptyInput);
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wantsPhysicalCopy, setWantsPhysicalCopy] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const totalDue = APPLICATION_FEE + (wantsPhysicalCopy ? PHYSICAL_COPY_FEE : 0);

  const set = (patch: Partial<NewAdmissionApplicationInput>) => setForm({ ...form, ...patch });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: submitError, applicationId: newId } = await submitAdmissionApplication(form, photo);
    setSubmitting(false);
    if (submitError || !newId) { setError(submitError ?? 'Something went wrong. Please try again.'); return; }
    setApplicationId(newId);
    setStep('payment');
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationId) return;
    if (!receipt) { setError('Please upload your payment receipt.'); return; }
    setSubmitting(true);
    setError(null);
    const { error: payError } = await submitAdmissionPayment(applicationId, wantsPhysicalCopy, totalDue, receipt);
    setSubmitting(false);
    if (payError) { setError(payError); return; }
    setStep('done');
  };

  const copyToClipboard = (text: string) => navigator.clipboard?.writeText(text);

  if (step === 'done') {
    return (
      <div className="founders-root">
        <nav className="founders-nav">
          <Link to="/" className="back-btn"><ArrowLeft size={20} /> Back to Home</Link>
        </nav>
        <div className="admission-success">
          <CheckCircle2 size={64} color="var(--success)" />
          <h1>Application Submitted!</h1>
          <p>Thank you for applying to Citadel of Highflyers Int'l Academy. We've received your details and payment receipt -- our admissions team will confirm your payment and reach out to you shortly.</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/" className="btn btn-primary lg">Back to Home</Link>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-outline lg">Reach Us on WhatsApp</a>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'payment') {
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
          <span className="badge">Step 2 of 2</span>
          <h1>Complete Your <span>Payment</span></h1>
          <p>Your application details have been received. Pay the processing fee below to complete your application.</p>
        </header>

        <main className="container admission-form-container">
          <form onSubmit={handlePaymentSubmit} className="card glass admission-form">
            {error && <div className="admission-form-error">{error}</div>}

            <div className="admission-fee-row">
              <span>Application Processing Fee</span>
              <strong>₦{APPLICATION_FEE.toLocaleString()}</strong>
            </div>

            <label className="admission-physical-copy-toggle">
              <input type="checkbox" checked={wantsPhysicalCopy} onChange={(e) => setWantsPhysicalCopy(e.target.checked)} />
              <span>Also purchase a physical copy of the form from the school (+₦{PHYSICAL_COPY_FEE.toLocaleString()})</span>
            </label>

            <div className="admission-total-row">
              <span>Total Due</span>
              <strong>₦{totalDue.toLocaleString()}</strong>
            </div>

            <div className="admission-bank-details">
              <h4>Pay by Bank Transfer</h4>
              <div className="admission-bank-row">
                <span>Bank Name</span>
                <strong>{BANK_DETAILS.bankName}</strong>
              </div>
              <div className="admission-bank-row">
                <span>Account Number</span>
                <strong>{BANK_DETAILS.accountNumber}
                  <button type="button" className="icon-btn sm" onClick={() => copyToClipboard(BANK_DETAILS.accountNumber)} title="Copy"><Copy size={14} /></button>
                </strong>
              </div>
              <div className="admission-bank-row">
                <span>Account Name</span>
                <strong>{BANK_DETAILS.accountName}</strong>
              </div>
            </div>

            <Field label="Upload your payment receipt (image or PDF)">
              <label className="admission-photo-upload">
                <Upload size={18} />
                <span>{receipt ? receipt.name : 'Choose a file...'}</span>
                <input type="file" accept="image/*,application/pdf" required style={{ display: 'none' }} onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
              </label>
            </Field>

            <button type="submit" className="btn btn-primary lg" style={{ width: '100%', marginTop: '10px' }} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Payment Receipt'}
            </button>
          </form>
        </main>

        <footer className="founders-footer">
          <div className="footer-blob"></div>
          <p>&copy; {new Date().getFullYear()} Citadel of Highflyers Int'l Academy. The Foundation for Future Generals.</p>
        </footer>
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
            <Field label="Email Address"><input type="email" style={inputStyle} required value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@example.com" /></Field>
            <Field label="Class Applying For">
              <select style={inputStyle} required value={form.classApplyingFor} onChange={(e) => set({ classApplyingFor: e.target.value })}>
                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
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
