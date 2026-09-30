import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'

interface Lecture {
  id: number
  title: string
  description: string | null
  subject: string | null
  grade_level: number | null
  original_language: string
  created_at: string
  has_transcript: boolean
  available_languages: string[]
}

export default function TeacherDashboard() {
  const { user, logout } = useAuthStore()
  const queryClient = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    subject: '',
    grade_level: 1,
    original_language: 'en',
  })
  const [file, setFile] = useState<File | null>(null)

  const { data: lectures, isLoading } = useQuery({
    queryKey: ['lectures'],
    queryFn: async () => {
      const response = await api.get<Lecture[]>('/lectures/')
      return response.data
    },
  })

  const lectureList = Array.isArray(lectures) ? lectures : []

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected')
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', uploadData.title)
      formData.append('description', uploadData.description)
      formData.append('subject', uploadData.subject)
      formData.append('grade_level', uploadData.grade_level.toString())
      formData.append('original_language', uploadData.original_language)

      const response = await api.post('/lectures/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lectures'] })
      setShowUpload(false)
      setFile(null)
      setUploadData({
        title: '',
        description: '',
        subject: '',
        grade_level: 1,
        original_language: 'en',
      })
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <h1 className="text-2xl font-bold text-primary-700">Teacher Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">
              {user?.full_name}
            </span>
            <button onClick={logout} className="btn btn-secondary text-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">My Uploaded Lectures</h2>
            <p className="text-sm text-gray-500">Manage audio/video lessons and track AI language dubbing status</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/live/teacher"
              className="btn bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1.5 font-bold text-sm"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              <span>Go Live</span>
            </Link>
            <Link
              to="/ncert"
              className="btn btn-secondary shadow-sm flex items-center gap-2 border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100"
            >
              <span>🇮🇳</span>
              <span>NCERT Books</span>
            </Link>
            <button
              onClick={() => setShowUpload(true)}
              className="btn btn-primary shadow-sm flex items-center gap-2"
            >
              <span>+</span> Upload Lecture
            </button>
          </div>
        </div>

        {showUpload && (
          <div className="card mb-6 shadow-md border border-gray-100">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Upload New Lecture</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                uploadMutation.mutate()
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Lecture Audio or Video File</label>
                <input
                  type="file"
                  accept="audio/*,video/*,.mp4,.mp3,.wav,.m4a,.webm"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Introduction to Solar System"
                  value={uploadData.title}
                  onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Description</label>
                <textarea
                  placeholder="Summary of concepts covered..."
                  value={uploadData.description}
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Science, Maths"
                    value={uploadData.subject}
                    onChange={(e) => setUploadData({ ...uploadData, subject: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Class / Grade</label>
                  <select
                    value={uploadData.grade_level}
                    onChange={(e) => setUploadData({ ...uploadData, grade_level: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((grade) => (
                      <option key={grade} value={grade}>
                        Class {grade}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Original Language</label>
                  <select
                    value={uploadData.original_language}
                    onChange={(e) => setUploadData({ ...uploadData, original_language: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="en">English</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                    <option value="te">తెలుగు (Telugu)</option>
                    <option value="kn">ಕನ್ನಡ (Kannada)</option>
                    <option value="bn">বাংলা (Bengali)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn btn-primary" disabled={uploadMutation.isPending}>
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload & Start AI Dubbing'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent"></div>
            <p className="mt-3 text-gray-600">Loading your lectures...</p>
          </div>
        ) : lectureList.length > 0 ? (
          <div className="grid gap-4">
            {lectureList.map((lecture: Lecture) => (
              <div key={lecture.id} className="card hover:shadow-md transition border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg text-gray-900">{lecture.title}</h3>
                    {lecture.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{lecture.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-gray-500">
                      <span className="bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full">
                        Class {lecture.grade_level}
                      </span>
                      <span>•</span>
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                        {lecture.subject || 'General'}
                      </span>
                      <span>•</span>
                      <span className="text-gray-400">
                        Original: {lecture.original_language.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-2 shrink-0">
                    <div className="text-xs text-gray-500">
                      <span>Available in: </span>
                      <span className="font-semibold text-gray-800">
                        {lecture.available_languages && lecture.available_languages.length > 0
                          ? lecture.available_languages.map(l => (l || '').toUpperCase()).join(', ')
                          : (lecture.original_language || 'EN').toUpperCase()}
                      </span>
                    </div>
                    <Link
                      to={`/lecture/${lecture.id}`}
                      className="btn btn-primary text-sm inline-flex items-center gap-1.5 self-start md:self-auto"
                    >
                      <span>Open Lesson Player</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500 card">
            <div className="text-5xl mb-3">📁</div>
            <p className="text-lg font-medium text-gray-700">No lectures uploaded yet</p>
            <p className="text-sm text-gray-500 mt-1">Click "+ Upload Lecture" above to add your first educational lesson.</p>
          </div>
        )}
      </div>
    </div>
  )
}
