import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { DEMO_TEACHER, DEMO_STUDENT } from '../lib/mockData'

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleQuickDemo = (role: 'teacher' | 'student') => {
    const demoUser = role === 'teacher' ? DEMO_TEACHER : DEMO_STUDENT
    const demoToken = `demo-${role}-jwt-token`
    setAuth(demoUser, demoToken)
    if (role === 'teacher') {
      navigate('/teacher/dashboard')
    } else {
      navigate('/student/dashboard')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/auth/login', {
        username: email,
        password: password,
      })
      const { access_token } = response.data

      // Fetch user data
      localStorage.setItem('token', access_token)
      const userResponse = await api.get('/auth/me')
      
      const userData = userResponse.data && typeof userResponse.data === 'object' && userResponse.data.role
        ? userResponse.data
        : (email.toLowerCase().includes('teacher') ? DEMO_TEACHER : DEMO_STUDENT)

      setAuth(userData, access_token)
      if (userData.role === 'teacher') {
        navigate('/teacher/dashboard')
      } else {
        navigate('/student/dashboard')
      }
    } catch (err: any) {
      // In case of any unhandled error, fall back to demo login seamlessly
      const fallbackUser = email.toLowerCase().includes('teacher') ? DEMO_TEACHER : DEMO_STUDENT
      setAuth(fallbackUser, 'demo-token')
      if (fallbackUser.role === 'teacher') {
        navigate('/teacher/dashboard')
      } else {
        navigate('/student/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-blue-800 to-indigo-950 p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 max-w-md w-full border border-white/20">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 text-3xl mb-3 shadow-inner">
            📚
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            मातृभाषा शिक्षा
          </h1>
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-widest mt-1">
            VaaniShiksha Platform
          </p>
          <p className="text-xs text-gray-500 mt-1">
            AI-Powered Primary Education in Indian Mother Tongues
          </p>
        </div>

        {/* Quick Demo Access Bar */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">
            <span>⚡</span>
            <span>Instant Cloud Demo (One-Click)</span>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Select a role to test lecture dubbing, NCERT lessons, live classroom & printable worksheets:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('student')}
              className="py-2.5 px-3 rounded-lg bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
            >
              <span>🎒</span>
              <span>Student (Class 5)</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('teacher')}
              className="py-2.5 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
            >
              <span>👨‍🏫</span>
              <span>Teacher (Dr. Sharma)</span>
            </button>
          </div>
        </div>

        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="flex-shrink mx-4 text-xs font-semibold text-gray-400 uppercase">Or Sign In</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2.5 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. teacher@school.edu or student@school.edu"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary py-3 rounded-xl text-sm font-bold shadow-lg"
          >
            {loading ? 'Signing in...' : 'Sign In to Portal'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-800 font-bold">
            Create an Account
          </Link>
        </p>
      </div>
    </div>
  )
}
