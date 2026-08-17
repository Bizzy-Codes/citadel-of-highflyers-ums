import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, User, Eye, EyeOff, ArrowLeft, Loader2, UserPlus, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

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
  const [regRole, setRegRole] = useState<'student' | 'teacher'>('student');
  const [regGrade, setRegGrade] = useState('Grade 1');

  // OTP verification state -- shown after a successful registerStudent/
  // registerStaff call, since Supabase requires the emailed code before
  // the account can sign in at all.
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');

  const navigate = useNavigate();
  const { login, registerStudent, registerStaff, verifySignupOtp, currentUser } = useAuth();

  // login() only starts the sign-in; currentUser updates asynchronously
  // via AuthContext's onAuthStateChange listener. Reacting to that
  // change here (rather than reading currentUser right after awaiting
  // login()) avoids acting on a stale closure value.
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'admin') navigate('/portal/admin');
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
      setError('Invalid credentials. Please check your email/login ID and password.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error } = regRole === 'student'
      ? await registerStudent(regName, regEmail, regPassword, regGrade)
      : await registerStaff(regName, regEmail, regPassword);

    setIsLoading(false);

    if (error) {
      setError(error);
      return;
    }

    setOtpEmail(regEmail);
    setIsRegistering(false);
    setRegName('');
    setRegEmail('');
    setRegPassword('');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail) return;
    setOtpError('');
    setIsLoading(true);

    const { error } = await verifySignupOtp(otpEmail, otpCode);
    setIsLoading(false);

    if (error) {
      setOtpError(error);
      return;
    }
    // Success sets a real session; the currentUser effect above handles
    // routing to the right dashboard once AuthContext picks it up.
  };

  const classes = [
    "Kindergarten 1", "Kindergarten 2", "Pre-Grade",
    "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"
  ];

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
              <img src="/src/assets/logo.jpg" alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '50%' }} />
            </div>
            <h1>Citadel of Highflyers Int'l Academy</h1>
            <p>Access your secure portal to manage your academic profile.</p>
          </div>

          {!isRegistering && !otpEmail && (
            <>
              {error && <div className="error-message" style={{ color: 'var(--error)', fontSize: '13px', textAlign: 'center', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{error}</div>}

              <form className="login-form" onSubmit={handleLogin}>
                <div className="input-group">
                  <label>Email or Login ID</label>
                  <div className="input-field">
                    <Mail size={18} className="input-icon" />
                    <input
                      type="text"
                      placeholder="you@example.com or CH 001"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Password</label>
                  <div className="input-field">
                    <Lock size={18} className="input-icon" />
                    <input
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

                <button type="submit" className="login-submit btn-primary" disabled={isLoading}>
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
                <p>New here? <button onClick={() => setIsRegistering(true)} style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline' }}>Create an Account</button></p>
              </div>
            </>
          )}

          {isRegistering && (
            <form className="login-form animate-fade-in" onSubmit={handleRegister}>
              <h2 style={{ fontSize: '20px', marginBottom: '8px', textAlign: 'center' }}>Portal Registration</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '24px' }}>Register with your email address.</p>

              {error && <div className="error-message" style={{ color: 'var(--error)', fontSize: '13px', textAlign: 'center', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{error}</div>}

              <div className="input-group">
                <label>I am registering as a:</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setRegRole('student')}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: regRole === 'student' ? 'var(--primary)' : 'transparent', color: regRole === 'student' ? 'white' : 'inherit' }}
                  >Student</button>
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
                    type="text"
                    placeholder="John Doe"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Email Address {regRole === 'student' ? '(yours or a parent/guardian\'s)' : ''}</label>
                <div className="input-field">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {regRole === 'student' && (
                <div className="input-group">
                  <label>Current Class / Grade</label>
                  <select
                    value={regGrade}
                    onChange={(e) => setRegGrade(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' }}
                  >
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div className="input-group">
                <label>Create Password</label>
                <div className="input-field">
                  <Lock size={18} className="input-icon" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="login-submit btn-primary" style={{ marginTop: '16px' }} disabled={isLoading}>
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

          {otpEmail && (
            <form className="login-form animate-fade-in" onSubmit={handleVerifyOtp}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <KeyRound size={32} />
                </div>
                <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Verify Your Email</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  We sent a verification code to <strong>{otpEmail}</strong>. Enter it below to activate your account.
                </p>
              </div>

              {otpError && <div className="error-message" style={{ color: 'var(--error)', fontSize: '13px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{otpError}</div>}

              <div className="input-group">
                <label>Verification Code</label>
                <div className="input-field">
                  <KeyRound size={18} className="input-icon" />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter the code from your email"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    style={{ letterSpacing: '4px', fontSize: '18px' }}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <button type="submit" className="login-submit btn-primary" disabled={isLoading || otpCode.length < 6}>
                {isLoading ? (<><Loader2 size={20} className="animate-spin" /> Verifying...</>) : 'Verify & Continue'}
              </button>

              <button
                type="button"
                onClick={() => { setOtpEmail(null); setOtpCode(''); setOtpError(''); }}
                style={{ width: '100%', fontSize: '14px', color: 'var(--text-muted)' }}
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
