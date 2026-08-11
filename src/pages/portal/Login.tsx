import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, User, Eye, EyeOff, ArrowLeft, Loader2, UserPlus } from 'lucide-react';
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
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null);

  const navigate = useNavigate();
  const { login, registerStudent, registerStaff, currentUser } = useAuth();

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
      setError('Invalid credentials. Please check your email and password.');
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

    setRegistrationMessage(
      regRole === 'student'
        ? 'Account created! Check your email to confirm it, then sign in.'
        : "Account created! It's pending admin approval before you can access the teacher portal. You'll be notified once approved."
    );
    setIsRegistering(false);
    setRegName('');
    setRegEmail('');
    setRegPassword('');
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

          {!isRegistering && !registrationMessage && (
            <>
              {error && <div className="error-message" style={{ color: 'var(--error)', fontSize: '13px', textAlign: 'center', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{error}</div>}

              <form className="login-form" onSubmit={handleLogin}>
                <div className="input-group">
                  <label>Email Address</label>
                  <div className="input-field">
                    <Mail size={18} className="input-icon" />
                    <input
                      type="email"
                      placeholder="you@example.com"
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

          {registrationMessage && (
            <div className="registration-success animate-fade-in" style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <UserPlus size={32} />
              </div>
              <h2 style={{ fontSize: '22px', marginBottom: '12px' }}>Registration Received</h2>
              <p style={{ marginBottom: '24px', color: 'var(--text-muted)' }}>{registrationMessage}</p>

              <button
                className="login-submit btn-primary"
                onClick={() => setRegistrationMessage(null)}
              >
                Continue to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
