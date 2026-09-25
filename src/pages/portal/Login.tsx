import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Lock, Mail, User, Eye, EyeOff, ArrowLeft, Loader2, UserPlus, Upload } from 'lucide-react';
import { useAuth, type StudentDetails } from '../../context/AuthContext';
import './Login.css';
import { upperLoginId, upperName } from '../../lib/names';
import DateWheelInput from '../../components/common/DateWheelInput';

const regFieldStyle: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: '12px',
  border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)',
};

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Registration state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regRole, setRegRole] = useState<'student' | 'teacher'>('student');

  // A returning pupil fills in the same bio/guardian block a new
  // applicant does, so the school ends up with one complete record
  // either way instead of a half-empty one for anybody who didn't come
  // through the admissions form.
  const [details, setDetails] = useState<StudentDetails>({});
  const [regPhoto, setRegPhoto] = useState<File | null>(null);
  const setDetail = (patch: Partial<StudentDetails>) => setDetails((d) => ({ ...d, ...patch }));

  // /login?register=student or ?register=staff opens straight on the
  // sign-up form -- Citadel AI links here, and it works as a normal link.
  const [searchParams] = useSearchParams();
  // Applied when the link changes (not on every render), so the visitor
  // can still switch tabs by hand afterwards.
  const registerParam = searchParams.get('register');
  const [appliedParam, setAppliedParam] = useState<string | null>(null);
  if (registerParam && registerParam !== appliedParam) {
    setAppliedParam(registerParam);
    setIsRegistering(true);
    setRegRole(registerParam === 'staff' ? 'teacher' : 'student');
  }

  const navigate = useNavigate();
  const { login, registerStudent, registerStaff, currentUser } = useAuth();

  // login() only starts the sign-in; currentUser updates asynchronously
  // via AuthContext's onAuthStateChange listener. Reacting to that
  // change here (rather than reading currentUser right after awaiting
  // login()) avoids acting on a stale closure value.
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.mustChangePassword) navigate('/portal/set-password');
    else if (currentUser.role === 'admin') navigate('/portal/admin');
    else if (currentUser.role === 'teacher') navigate('/portal/teacher');
    else if (currentUser.role === 'teacher_pending') navigate('/portal/pending');
    else navigate('/portal');
  }, [currentUser, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error } = await login(email, password);
    setIsLoading(false);

    if (error) {
      setError('Invalid credentials. Please check your name/login ID/email and password.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error } = regRole === 'student'
      ? await registerStudent(regName, regEmail, regPassword, '', details, regPhoto)
      : await registerStaff(regName, regEmail, regPassword);

    if (error) {
      setIsLoading(false);
      setError(error);
      return;
    }

    // No email verification step -- the account is created and signed in
    // immediately. Leave isLoading true so the button keeps showing
    // "Registering..." during the brief async gap before the currentUser
    // effect above picks up the new session and redirects.
  };


  return (
    <div className="login-root">
      <div className="login-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>

      <div className="login-container">
        <Link to="/" className="back-link">
          <ArrowLeft size={18} />
          Back to Website
        </Link>

        <div className="login-card glass animate-fade-in">
          <div className="login-header">
            <div className="login-logo">
              <img src="/logo.jpg" alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '50%' }} />
            </div>
            <h1>Citadel of Highflyers Int'l Academy</h1>
            <p>Access your secure portal to manage your academic profile.</p>
          </div>

          {!isRegistering && (
            <>
              {error && <div className="error-message" style={{ color: 'var(--error)', fontSize: '13px', textAlign: 'center', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{error}</div>}

              <form className="login-form" onSubmit={handleLogin}>
                <div className="input-group">
                  <label>Name, Login ID, or Email</label>
                  <div className="input-field">
                    <Mail size={18} className="input-icon" />
                    <input
                      data-ai="login-id"
                      type="text"
                      placeholder="Your name, CH 001, or you@example.com"
                      value={email}
                      onChange={(e) => setEmail(upperLoginId(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Password</label>
                  <div className="input-field">
                    <Lock size={18} className="input-icon" />
                    <input
                      data-ai="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-actions">
                  <label className="remember-me">
                    <input type="checkbox" />
                    <span>Keep me signed in</span>
                  </label>
                  <Link to="/forgot-password">Forgot Password?</Link>
                </div>

                <button data-ai="login-submit" type="submit" className="login-submit btn-primary" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    "Sign In to Portal"
                  )}
                </button>
              </form>

              <div className="login-footer">
                <p>New here? <button data-ai="login-create" onClick={() => setIsRegistering(true)} style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline' }}>Create an Account</button></p>
              </div>
            </>
          )}

          {isRegistering && (
            <form className="login-form animate-fade-in" onSubmit={handleRegister}>
              <h2 style={{ fontSize: '20px', marginBottom: '8px', textAlign: 'center' }}>Portal Registration</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '24px' }}>Create your account instantly -- no email verification needed.</p>

              {error && <div className="error-message" style={{ color: 'var(--error)', fontSize: '13px', textAlign: 'center', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{error}</div>}

              <div className="input-group">
                <label>I am registering as a:</label>
                <div data-ai="reg-role" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setRegRole('student')}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: regRole === 'student' ? 'var(--primary)' : 'transparent', color: regRole === 'student' ? 'white' : 'inherit' }}
                  >Pupil</button>
                  <button
                    type="button"
                    onClick={() => setRegRole('teacher')}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: regRole === 'teacher' ? 'var(--primary)' : 'transparent', color: regRole === 'teacher' ? 'white' : 'inherit' }}
                  >Staff</button>
                </div>
                {regRole === 'teacher' && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '16px' }}>
                    Staff accounts require admin approval before portal access is granted.
                  </p>
                )}
              </div>

              <div className="input-group">
                <label>Full Name</label>
                <div className="input-field">
                  <User size={18} className="input-icon" />
                  <input
                    data-ai="reg-name"
                    type="text"
                    placeholder="JOHN DOE"
                    value={regName}
                    onChange={(e) => setRegName(upperName(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Email Address {regRole === 'student' ? '(yours or a parent/guardian\'s)' : ''}</label>
                <div className="input-field">
                  <Mail size={18} className="input-icon" />
                  <input
                    data-ai="reg-email"
                    type="email"
                    placeholder="you@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* No class picker. A pupil choosing their own class is how
                  a register ends up full of children who put themselves
                  in Grade 5 -- placement is the school's call. They can
                  sign in straight away; a teacher or the admin adds them
                  to a class afterwards. */}
              {regRole === 'student' && (
                <div style={{
                  padding: '12px 14px', borderRadius: '12px', marginBottom: '4px',
                  background: 'var(--accent)', color: 'var(--primary)', fontSize: '12.5px', lineHeight: 1.5,
                }}>
                  Your class is assigned by the school. You can sign in as soon as you register &mdash;
                  your teacher will add you to your class.
                </div>
              )}

              {regRole === 'student' && (
                <>
                  <p data-ai="reg-details" style={{ fontSize: '13px', fontWeight: 700, margin: '20px 0 4px' }}>Pupil Details</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    The school keeps these on your child's record. Everything here is optional &mdash;
                    but the more you fill in now, the less the office has to chase later.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="input-group">
                      <label>Sex</label>
                      <select value={details.sex ?? ''} onChange={(e) => setDetail({ sex: (e.target.value || undefined) as StudentDetails['sex'] })} style={regFieldStyle}>
                        <option value="">Select...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label>Date of Birth</label>
                      <DateWheelInput kind="birth" value={details.dateOfBirth} onChange={(v) => setDetail({ dateOfBirth: v })} />
                    </div>
                    <div className="input-group">
                      <label>Nationality</label>
                      <input value={details.nationality ?? ''} onChange={(e) => setDetail({ nationality: e.target.value })} placeholder="Nigerian" style={regFieldStyle} />
                    </div>
                    <div className="input-group">
                      <label>State of Origin</label>
                      <input value={details.stateOfOrigin ?? ''} onChange={(e) => setDetail({ stateOfOrigin: e.target.value })} style={regFieldStyle} />
                    </div>
                    <div className="input-group">
                      <label>L.G.A</label>
                      <input value={details.lga ?? ''} onChange={(e) => setDetail({ lga: e.target.value })} style={regFieldStyle} />
                    </div>
                    <div className="input-group">
                      <label>Religion</label>
                      <input value={details.religion ?? ''} onChange={(e) => setDetail({ religion: e.target.value })} style={regFieldStyle} />
                    </div>
                    <div className="input-group">
                      <label>Blood Group</label>
                      <input value={details.bloodGroup ?? ''} onChange={(e) => setDetail({ bloodGroup: e.target.value })} placeholder="e.g. O+" style={regFieldStyle} />
                    </div>
                    <div className="input-group">
                      <label>Genotype</label>
                      <input value={details.genotype ?? ''} onChange={(e) => setDetail({ genotype: e.target.value })} placeholder="e.g. AA" style={regFieldStyle} />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Home Address</label>
                    <input value={details.homeAddress ?? ''} onChange={(e) => setDetail({ homeAddress: e.target.value })} style={regFieldStyle} />
                  </div>

                  <p style={{ fontSize: '13px', fontWeight: 700, margin: '18px 0 10px' }}>Father / Guardian</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="input-group">
                      <label>Name</label>
                      <input value={details.fatherName ?? ''} onChange={(e) => setDetail({ fatherName: upperName(e.target.value) })} style={regFieldStyle} />
                    </div>
                    <div className="input-group">
                      <label>Occupation</label>
                      <input value={details.fatherOccupation ?? ''} onChange={(e) => setDetail({ fatherOccupation: e.target.value })} style={regFieldStyle} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Phone Number</label>
                    <input type="tel" value={details.fatherPhone ?? ''} onChange={(e) => setDetail({ fatherPhone: e.target.value })} style={regFieldStyle} />
                  </div>

                  <p style={{ fontSize: '13px', fontWeight: 700, margin: '18px 0 10px' }}>Mother / Guardian</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="input-group">
                      <label>Name</label>
                      <input value={details.motherName ?? ''} onChange={(e) => setDetail({ motherName: upperName(e.target.value) })} style={regFieldStyle} />
                    </div>
                    <div className="input-group">
                      <label>Occupation</label>
                      <input value={details.motherOccupation ?? ''} onChange={(e) => setDetail({ motherOccupation: e.target.value })} style={regFieldStyle} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Phone Number</label>
                    <input type="tel" value={details.motherPhone ?? ''} onChange={(e) => setDetail({ motherPhone: e.target.value })} style={regFieldStyle} />
                  </div>

                  <div className="input-group">
                    <label>Child's Photo (optional)</label>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '12px',
                      border: '1.5px dashed var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-muted)',
                      cursor: 'pointer', fontSize: '14px',
                    }}>
                      <Upload size={18} />
                      <span>{regPhoto ? regPhoto.name : 'Choose a photo...'}</span>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setRegPhoto(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                </>
              )}

              <div className="input-group">
                <label>Create Password</label>
                <div className="input-field">
                  <Lock size={18} className="input-icon" />
                  <input
                    data-ai="reg-password"
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                  >
                    {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button data-ai="reg-submit" type="submit" className="login-submit btn-primary" style={{ marginTop: '16px' }} disabled={isLoading}>
                {isLoading ? (<><Loader2 size={18} className="animate-spin" /> Registering...</>) : (<><UserPlus size={18} style={{ marginRight: '8px' }} /> Register Now</>)}
              </button>

              <button
                type="button"
                onClick={() => setIsRegistering(false)}
                style={{ width: '100%', marginTop: '12px', fontSize: '14px', color: 'var(--text-muted)' }}
              >
                Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
