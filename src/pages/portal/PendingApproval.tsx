import { useNavigate } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

// Shown to self-registered staff accounts (role: 'teacher_pending')
// until an admin approves them via User Management.
const PendingApproval = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="login-root">
      <div className="login-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>
      <div className="login-container">
        <div className="login-card glass animate-fade-in" style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Clock size={32} />
          </div>
          <h1 style={{ marginBottom: '12px' }}>Awaiting Admin Approval</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
            Your staff account has been created but needs to be approved by a school administrator before you can access the teacher portal. Check back soon.
          </p>
          <button onClick={handleLogout} className="login-submit btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <LogOut size={18} /> Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
