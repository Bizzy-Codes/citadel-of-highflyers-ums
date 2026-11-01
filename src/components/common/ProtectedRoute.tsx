import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type User } from '../../context/AuthContext';
import PortalLocked from '../../pages/portal/PortalLocked';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: User['role'][];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { currentUser, loading, portalLocked, lockChecked } = useAuth();
  const location = useLocation();

  if (loading || (currentUser?.role === 'student' && !lockChecked)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '14px', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // A locked pupil sees only the neutral locked page. The one exception is
  // the fees page, so a parent can send a payment receipt.
  if (currentUser.role === 'student' && portalLocked && !location.pathname.startsWith('/portal/fees')) {
    return <PortalLocked />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    const fallback = currentUser.role === 'admin' ? '/portal/admin'
      : currentUser.role === 'teacher' ? '/portal/teacher'
      : currentUser.role === 'teacher_pending' ? '/portal/pending'
      : '/portal';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
