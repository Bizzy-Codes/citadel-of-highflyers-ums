import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/marketing/Home'
import Founders from './pages/marketing/Founders'
import Login from './pages/portal/Login'
import ForgotPassword from './pages/portal/ForgotPassword'
import ResetPassword from './pages/portal/ResetPassword'
import PendingApproval from './pages/portal/PendingApproval'
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
import ProtectedRoute from './components/common/ProtectedRoute'
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
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/portal/pending" element={
          <ProtectedRoute allowedRoles={['teacher_pending']}><PendingApproval /></ProtectedRoute>
        } />

        {/* Student Routes */}
        <Route path="/portal" element={
          <ProtectedRoute allowedRoles={['student']}><Dashboard /></ProtectedRoute>
        } />
        <Route path="/portal/fees" element={
          <ProtectedRoute allowedRoles={['student']}><Financial /></ProtectedRoute>
        } />

        {/* Shared authenticated routes (student + teacher; results also useful to review as teacher) */}
        <Route path="/portal/results" element={
          <ProtectedRoute allowedRoles={['student', 'teacher']}><Results /></ProtectedRoute>
        } />
        <Route path="/portal/profile" element={
          <ProtectedRoute><Profile /></ProtectedRoute>
        } />
        <Route path="/portal/messages" element={
          <ProtectedRoute><Messages /></ProtectedRoute>
        } />
        <Route path="/portal/support" element={
          <ProtectedRoute><Support /></ProtectedRoute>
        } />
        <Route path="/portal/timetable" element={
          <ProtectedRoute><Timetable /></ProtectedRoute>
        } />

        {/* Teacher Routes */}
        <Route path="/portal/teacher" element={
          <ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>
        } />
        <Route path="/portal/teacher/class/:className" element={
          <ProtectedRoute allowedRoles={['teacher']}><ClassManagement /></ProtectedRoute>
        } />

        {/* Admin Routes */}
        <Route path="/portal/admin" element={
          <ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/portal/admin/users" element={
          <ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
