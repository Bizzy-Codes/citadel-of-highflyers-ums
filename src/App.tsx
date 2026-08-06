import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/marketing/Home'
import Founders from './pages/marketing/Founders'
import Login from './pages/portal/Login'
import Dashboard from './pages/portal/Dashboard'
import Profile from './pages/portal/Profile'
import Results from './pages/portal/Results'
import Messages from './pages/portal/Messages'
import TeacherDashboard from './pages/portal/TeacherDashboard'
import AdminDashboard from './pages/portal/AdminDashboard'
import UserManagement from './pages/portal/UserManagement'
import ClassManagement from './pages/portal/ClassManagement'
import Timetable from './pages/portal/Timetable'
import Financial from './pages/portal/Financial'
import Support from './pages/portal/Support'
import MouseGlow from './components/common/MouseGlow'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <MouseGlow />
      <Routes>
        {/* Public Marketing Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/founders" element={<Founders />} />
        <Route path="/login" element={<Login />} />

        {/* Protected Portal Routes */}
        <Route path="/portal" element={<Dashboard />} />
        <Route path="/portal/profile" element={<Profile />} />
        <Route path="/portal/results" element={<Results />} />
        <Route path="/portal/fees" element={<Financial />} />
        <Route path="/portal/messages" element={<Messages />} />
        <Route path="/portal/support" element={<Support />} />
        <Route path="/portal/timetable" element={<Timetable />} />
        
        {/* Teacher & Admin Routes */}
        <Route path="/portal/teacher" element={<TeacherDashboard />} />
        <Route path="/portal/teacher/class/:className" element={<ClassManagement />} />
        <Route path="/portal/admin" element={<AdminDashboard />} />
        <Route path="/portal/admin/users" element={<UserManagement />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
