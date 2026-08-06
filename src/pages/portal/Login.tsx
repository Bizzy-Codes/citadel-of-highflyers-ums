import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Registration state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'student' | 'teacher'>('student');
  const [regGrade, setRegGrade] = useState('Grade 1');
  const [registrationSuccess, setRegistrationSuccess] = useState<{id: string, name: string} | null>(null);

  const navigate = useNavigate();
  const { login, registerStudent, registerStaff } = useAuth();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      const user = login(id, password, role);
      setIsLoading(false);

      if (user) {
        if (user.role === 'student') navigate('/portal');
        else if (user.role === 'teacher') navigate('/portal/teacher');
        else if (user.role === 'admin') navigate('/portal/admin');
      } else {
        setError('Invalid credentials. Please check your ID/Name and Password.');
      }
    }, 1500);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    let newUser;
    if (regRole === 'student') {
      newUser = registerStudent(regName, regPassword, regGrade);
    } else {
      newUser = registerStaff(regName, regPassword, 'teacher');
    }
    setRegistrationSuccess({ id: newUser.id, name: newUser.name });
    setIsRegistering(false);
    setRegName('');
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

          {!isRegistering && !registrationSuccess && (
            <>
              <div className="role-switcher" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                <button 
                  className={role === 'student' ? 'active' : ''} 
                  onClick={() => setRole('student')}
                >
                  Student
                </button>
                <button 
                  className={role === 'teacher' ? 'active' : ''} 
                  onClick={() => setRole('teacher')}
                >
                  Staff
                </button>
                <button 
                  className={role === 'admin' ? 'active' : ''} 
                  onClick={() => setRole('admin')}
                >
                  Admin
                </button>
              </div>

              {error && <div className="error-message" style={{ color: 'var(--error)', fontSize: '13px', textAlign: 'center', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{error}</div>}

              <form className="login-form" onSubmit={handleLogin}>
                <div className="input-group">
                  <label>{role === 'student' ? 'Student ID or Name' : 'Staff/Admin Username'}</label>
                  <div className="input-field">
                    <User size={18} className="input-icon" />
                    <input 
                      type="text" 
                      placeholder={role === 'student' ? "CH 001 or Name" : "CH-STAFF-01"} 
                      value={id}
                      onChange={(e) => setId(e.target.value)}
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
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '24px' }}>Register to receive your unique portal ID.</p>
              
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
                    required 
                  />
                </div>
              </div>

              <button type="submit" className="login-submit btn-primary" style={{ marginTop: '16px' }}>
                <UserPlus size={18} style={{ marginRight: '8px' }} />
                Register Now
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

          {registrationSuccess && (
            <div className="registration-success animate-fade-in" style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <UserPlus size={32} />
              </div>
              <h2 style={{ fontSize: '22px', marginBottom: '12px' }}>Registration Successful!</h2>
              <p style={{ marginBottom: '24px', color: 'var(--text-muted)' }}>Welcome, <strong>{registrationSuccess.name}</strong>. Your unique Student ID is:</p>
              
              <div style={{ background: 'var(--bg-light)', padding: '20px', borderRadius: '16px', border: '1px solid var(--glass-border)', marginBottom: '32px' }}>
                <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '2px' }}>{registrationSuccess.id}</span>
              </div>
              
              <button 
                className="login-submit btn-primary"
                onClick={() => {
                  setId(registrationSuccess.id);
                  setRegistrationSuccess(null);
                }}
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
