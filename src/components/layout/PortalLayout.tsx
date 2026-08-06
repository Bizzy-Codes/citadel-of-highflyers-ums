import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  User, 
  GraduationCap, 
  CreditCard, 
  MessageSquare, 
  LogOut, 
  Menu, 
  Search, 
  Bell, 
  Settings,
  HelpCircle,
  Users,
  Calendar
} from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './PortalLayout.css';

interface PortalLayoutProps {
  children: React.ReactNode;
  title: string;
}

const PortalLayout = ({ children, title }: PortalLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  // Simple role detection from path for demo purposes
  const isTeacher = currentUser?.role === 'teacher';
  const isAdmin = currentUser?.role === 'admin';

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: isTeacher ? '/portal/teacher' : isAdmin ? '/portal/admin' : '/portal', show: true },
    { label: 'My Students', icon: <Users size={20} />, path: '/portal/teacher/students', show: isTeacher },
    { label: 'Academic Results', icon: <GraduationCap size={20} />, path: '/portal/results', show: !isAdmin },
    { label: 'Financial / Fees', icon: <CreditCard size={20} />, path: '/portal/fees', show: !isTeacher && !isAdmin },
    { label: 'User Management', icon: <Settings size={20} />, path: '/portal/admin/users', show: isAdmin },
    { label: 'Messages', icon: <MessageSquare size={20} />, path: '/portal/messages', show: true },
    { label: 'Timetable', icon: <Calendar size={20} />, path: '/portal/timetable', show: true },
    { label: 'Profile', icon: <User size={20} />, path: '/portal/profile', show: true },
    { label: 'Help & Support', icon: <HelpCircle size={20} />, path: '/portal/support', show: true },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={`portal-root ${!isSidebarOpen ? 'sidebar-closed' : ''} ${isMobileOpen ? 'sidebar-open' : ''}`}>
      {/* Sidebar Overlay for Mobile */}
      {isMobileOpen && <div className="sidebar-overlay" onClick={() => setIsMobileOpen(false)}></div>}

      <aside className="portal-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/src/assets/logo.jpg" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '10px' }} />
            <span className="logo-text nav-label glowing-text">Citadel of Highflyers</span>
          </div>
          <button className="sidebar-toggle-desktop" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
             <Menu size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.filter(item => item.show).map((item, idx) => (
            <Link 
              key={`${item.path}-${idx}`} 
              to={item.path} 
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setIsMobileOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>

      <main className="portal-main">
        <header className="portal-header glass">
          <div className="header-left">
            <button className="mobile-toggle" onClick={() => setIsMobileOpen(true)}>
              <Menu size={24} />
            </button>
            <h2>{title}</h2>
          </div>

          <div className="header-right">
            <div className="search-bar">
              <Search className="search-icon" size={18} />
              <input type="text" placeholder="Search for results, students..." />
            </div>
            
            <div className="header-actions">
              <button className="icon-btn">
                <Bell size={20} />
                <span className="notification-dot"></span>
              </button>
              <div className="user-profile">
                <div className="user-info">
                  <span className="user-name">{currentUser?.name || 'User'}</span>
                  <span className="user-role">{isTeacher ? 'Teacher' : isAdmin ? 'Administrator' : 'Student'}</span>
                </div>
                <div className="user-avatar">{currentUser ? getInitials(currentUser.name) : 'U'}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="portal-content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default PortalLayout;
