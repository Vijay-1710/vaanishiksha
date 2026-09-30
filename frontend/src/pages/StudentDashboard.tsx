import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'

interface Lecture {
  id: number
  title: string
  description: string | null
  subject: string | null
  grade_level: number | null
  original_language: string
  media_url?: string | null
  media_type?: 'audio' | 'video'
  created_at: string
  has_transcript: boolean
  available_languages: string[]
}

interface LiveRoom {
  room_code: string
  title: string
  subject: string
  grade_level: number
  original_language: string
  teacher_name: string
  student_count: number
  created_at: string
  is_active: boolean
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  kn: 'ಕನ್ನಡ',
  bn: 'বাংলা',
}

export default function StudentDashboard() {
  const { user, logout } = useAuthStore()
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>(user?.grade_level || 'all')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: lectures, isLoading } = useQuery({
    queryKey: ['lectures'],
    queryFn: async () => {
      const response = await api.get<Lecture[]>('/lectures/')
      return response.data
    },
  })

  // Poll active live classrooms every 5 seconds
  const { data: activeRooms } = useQuery({
    queryKey: ['activeLiveRooms'],
    queryFn: async () => {
      const response = await api.get<LiveRoom[]>('/live/rooms/active')
      return response.data
    },
    refetchInterval: 5000,
  })

  const filteredLectures = lectures?.filter((lecture: Lecture) => {
    const matchesGrade = selectedGrade === 'all' || lecture.grade_level === selectedGrade
    const matchesSearch =
      !searchQuery.trim() ||
      lecture.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lecture.description && lecture.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (lecture.subject && lecture.subject.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesGrade && matchesSearch
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/60 via-indigo-50/30 to-purple-50/50">
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📚</span>
            <div>
              <h1 className="text-2xl font-extrabold text-primary-700 tracking-tight">मातृभाषा शिक्षा</h1>
              <p className="text-xs text-gray-500 font-medium">
                Welcome, <strong className="text-gray-800">{user?.full_name}</strong> • Preferred Language: {LANGUAGE_NAMES[user?.preferred_language || 'en']}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/live/student"
              className="btn btn-secondary text-xs sm:text-sm font-semibold flex items-center gap-1.5 border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span>Live Class</span>
            </Link>
            <Link
              to="/ncert"
              className="btn btn-secondary text-xs sm:text-sm font-semibold flex items-center gap-1.5 border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100"
            >
              <span>🇮🇳</span>
              <span>NCERT Books</span>
            </Link>
            <button onClick={logout} className="btn btn-secondary text-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Active Live Rooms Alert */}
        {activeRooms && activeRooms.length > 0 && (
          <div className="mb-6 space-y-3">
            {activeRooms.map((room) => (
              <div
                key={room.room_code}
                className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-700 text-white shadow-lg border border-rose-300/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse-subtle"
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shrink-0">
                    🎙️
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-white text-rose-700 flex items-center gap-1 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                        LIVE NOW
                      </span>
                      <span className="text-xs text-rose-100 font-medium">
                        Class {room.grade_level} • {room.subject}
                      </span>
                      <span className="text-xs text-rose-200">
                        • Room {room.room_code}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold">
                      {room.title}
                    </h3>
                    <p className="text-xs text-rose-100">
                      Teacher: <strong className="text-white">{room.teacher_name}</strong> • Real-time dubbing to your mother tongue ({LANGUAGE_NAMES[user?.preferred_language || 'en']})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <Link
                    to={`/live/student/${room.room_code}`}
                    className="btn bg-white text-rose-700 hover:bg-rose-50 text-xs sm:text-sm font-bold py-2.5 px-5 rounded-xl shadow-md whitespace-nowrap flex items-center gap-1.5 transform hover:scale-105 transition"
                  >
                    <span>Join Class Now →</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NCERT Callout Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full inline-block mb-1">
              Indian School Curriculum
            </span>
            <h2 className="text-lg font-bold">NCERT Textbooks for Classes 1 to 8</h2>
            <p className="text-xs text-blue-100">
              Listen to standard NCERT lessons dubbed in your mother tongue with auto-generated practice quizzes.
            </p>
          </div>
          <Link
            to="/ncert"
            className="btn bg-white text-primary-700 hover:bg-blue-50 text-xs font-bold py-2 px-4 shadow-sm whitespace-nowrap self-start sm:self-auto"
          >
            <span>Explore NCERT Books →</span>
          </Link>
        </div>
        {/* Search and Filter Row */}
        <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search lessons by title, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
            />
          </div>

          {/* Grade filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedGrade('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm whitespace-nowrap ${
                selectedGrade === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              All Classes
            </button>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((grade) => (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm whitespace-nowrap ${
                  selectedGrade === grade
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                Class {grade}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-3 border-primary-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading lessons...</p>
          </div>
        ) : filteredLectures && filteredLectures.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLectures.map((lecture: Lecture) => {
              const langs = lecture.available_languages || []
              const hasUserLang = langs.includes(user?.preferred_language || 'en')

              return (
                <Link
                  key={lecture.id}
                  to={`/lecture/${lecture.id}`}
                  className="card hover:shadow-xl transition-all duration-200 flex flex-col justify-between border border-gray-100/80 hover:-translate-y-0.5 group"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <span className="bg-primary-100/80 text-primary-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        Class {lecture.grade_level || 'General'}
                      </span>
                      {hasUserLang ? (
                        <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                          <span>✓</span> In your language
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          AI Dub Available
                        </span>
                      )}
                      <span className="bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                        <span>📝</span> Worksheets
                      </span>
                    </div>

                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary-600 transition mb-2 line-clamp-2">
                      {lecture.title}
                    </h3>
                    
                    {lecture.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                        {lecture.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-100 mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                        {lecture.subject || 'General'}
                      </span>
                      <span>
                        Original: {(lecture.original_language || 'EN').toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <span>Languages ready:</span>
                      <span className="font-bold text-gray-800">
                        {langs.length > 0
                          ? langs.map((l) => LANGUAGE_NAMES[l] || l.toUpperCase()).join(', ')
                          : (lecture.original_language || 'EN').toUpperCase()}
                      </span>
                    </div>

                    <button className="w-full btn btn-primary flex items-center justify-center gap-2 group-hover:bg-primary-700">
                      <span>Start Learning</span>
                      <span>→</span>
                    </button>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20 card max-w-md mx-auto">
            <div className="text-6xl mb-4">📖</div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">No lessons found</h3>
            <p className="text-gray-500 text-sm">
              {searchQuery
                ? `No lessons match "${searchQuery}". Try a different keyword.`
                : selectedGrade === 'all'
                ? 'No lessons have been published yet.'
                : `No lessons for Class ${selectedGrade} yet.`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
