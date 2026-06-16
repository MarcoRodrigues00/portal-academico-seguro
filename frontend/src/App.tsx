import { type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage          from './pages/LoginPage'
import PublicCoursesPage  from './pages/PublicCoursesPage'
import CourseDetailsPage  from './pages/CourseDetailsPage'
import DashboardPage      from './pages/DashboardPage'
import RequestsPage       from './pages/RequestsPage'
import SubjectsPage       from './pages/SubjectsPage'
import GradesPage         from './pages/GradesPage'
import ContentsPage       from './pages/ContentsPage'
import AttendancePage     from './pages/AttendancePage'

function PrivateRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b0e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="neon-text animate-pulse-neon">▸</span>
            <span className="text-xs text-[#4a6172] tracking-widest uppercase animate-pulse">
              Verificando sessão...
            </span>
          </div>
          <div className="h-px w-28 bg-gradient-to-r from-transparent via-[#39ff8530] to-transparent" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"          element={<LoginPage />} />
        <Route path="/courses"        element={<PublicCoursesPage />} />
        <Route path="/courses/:id"    element={<CourseDetailsPage />} />

        {/* Private */}
        <Route path="/dashboard"  element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/requests"   element={<PrivateRoute><RequestsPage /></PrivateRoute>} />
        <Route path="/subjects"   element={<PrivateRoute><SubjectsPage /></PrivateRoute>} />
        <Route path="/grades"     element={<PrivateRoute><GradesPage /></PrivateRoute>} />
        <Route path="/contents"   element={<PrivateRoute><ContentsPage /></PrivateRoute>} />
        <Route path="/attendance" element={<PrivateRoute><AttendancePage /></PrivateRoute>} />

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
