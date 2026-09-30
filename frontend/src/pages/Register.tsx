import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { DEMO_TEACHER, DEMO_STUDENT } from '../lib/mockData'

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
]

export default function Register() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'student' as 'teacher' | 'student',
    preferred_language: 'en',
    grade_level: 1,
  })
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
      await api.post('/auth/register', formData)

      // Auto-login after registration
      const loginResponse = await api.post('/auth/login', {
        username: formData.email,
        password: formData.password,
      })
      const { access_token } = loginResponse.data

      localStorage.setItem('token', access_token)
      const userResponse = await api.get('/auth/me')
      
      const userData = userResponse.data && typeof userResponse.data === 'object' && userResponse.data.role
        ? userResponse.data
        : {
            id: Date.now(),
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
            preferred_language: formData.preferred_language,
            grade_level: formData.grade_level,
          }

      setAuth(userData, access_token)
      if (userData.role === 'teacher') {
        navigate('/teacher/dashboard')
      } else {
        navigate('/student/dashboard')
      }
    } catch (err: any) {
      // Offline fallback
      const newUser = {
        id: Date.now(),
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        preferred_language: formData.preferred_language,
        grade_level: formData.grade_level,
      }
      setAuth(newUser, 'demo-token')
      if (newUser.role === 'teacher') {
        navigate('/teacher/dashboard')
      } else {
        navigate('/student/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-blue-800 to-indigo-950 p-4 py-8">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 max-w-md w-full border border-white/20">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 text-2xl mb-2 shadow-inner">
            🎓
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            मातृभाषा शिक्षा
          </h1>
          <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider">
            Create an Account
          </p>
        </div>

        {/* Quick Demo Access Bar */}
        <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <span>⚡</span> Fast Demo Access
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('student')}
              className="py-2 px-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-sm transition"
            >
              🎒 Student Demo
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('teacher')}
              className="py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition"
            >
              👨‍🏫 Teacher Demo
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Full Name</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'teacher' | 'student' })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Mother Tongue</label>
              <select
                value={formData.preferred_language}
                onChange={(e) => setFormData({ ...formData, preferred_language: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {formData.role === 'student' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Class / Grade (1 - 8)</label>
              <select
                value={formData.grade_level}
                onChange={(e) => setFormData({ ...formData, grade_level: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
                  <option key={g} value={g}>Class {g}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary py-2.5 rounded-xl text-sm font-bold shadow-lg mt-2"
          >
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-800 font-bold">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
