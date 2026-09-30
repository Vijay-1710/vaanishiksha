import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Login from './pages/Login'
import Register from './pages/Register'
import TeacherDashboard from './pages/TeacherDashboard'
import StudentDashboard from './pages/StudentDashboard'
import LecturePlayer from './pages/LecturePlayer'
import NCERTExplorer from './pages/NCERTExplorer'
import LiveClassTeacher from './pages/LiveClassTeacher'
import LiveClassStudent from './pages/LiveClassStudent'

function App() {
  const { user } = useAuthStore()
  const role = user?.role ? String(user.role).toLowerCase() : null

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/" replace />} />
      
      <Route 
        path="/" 
        element={
          user ? (
            role === 'teacher' ? <Navigate to="/teacher/dashboard" replace /> : <Navigate to="/student/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />
      
      <Route 
        path="/teacher/dashboard" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : role === 'teacher' ? (
            <TeacherDashboard />
          ) : (
            <Navigate to="/student/dashboard" replace />
          )
        } 
      />
      
      <Route 
        path="/student/dashboard" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : role === 'student' ? (
            <StudentDashboard />
          ) : (
            <Navigate to="/teacher/dashboard" replace />
          )
        } 
      />
      
      <Route 
        path="/lecture/:lectureId" 
        element={user ? <LecturePlayer /> : <Navigate to="/login" replace />} 
      />

      <Route 
        path="/ncert" 
        element={user ? <NCERTExplorer /> : <Navigate to="/login" replace />} 
      />

      <Route 
        path="/live/teacher" 
        element={user ? <LiveClassTeacher /> : <Navigate to="/login" replace />} 
      />

      <Route 
        path="/live/student" 
        element={user ? <LiveClassStudent /> : <Navigate to="/login" replace />} 
      />

      <Route 
        path="/live/student/:roomCode" 
        element={user ? <LiveClassStudent /> : <Navigate to="/login" replace />} 
      />
    </Routes>
  )
}

export default App
