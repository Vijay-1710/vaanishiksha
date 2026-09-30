import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuthStore } from '../stores/authStore'

interface NCERTChapter {
  id: string
  grade_level: number
  subject: string
  book_name: string
  book_hindi_name: string
  chapter_number: number
  title: string
  title_hindi: string
  description: string
  core_concepts: string[]
  learning_outcomes: string[]
  official_pdf_url: string
}

interface NCERTOverview {
  board: string
  country: string
  total_chapters: number
  classes: {
    grade_level: number
    grade_name: string
    chapter_count: number
    subjects: string[]
    books: string[]
  }[]
}

export default function NCERTExplorer() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [selectedGrade, setSelectedGrade] = useState<number>(user?.grade_level || 5)
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [adoptingId, setAdoptingId] = useState<string | null>(null)

  // Fetch overview
  const { data: overview } = useQuery<NCERTOverview>({
    queryKey: ['ncert-overview'],
    queryFn: async () => {
      const response = await api.get<NCERTOverview>('/ncert/overview')
      return response.data
    },
  })

  // Fetch chapters for selected grade
  const { data: chapters, isLoading } = useQuery<NCERTChapter[]>({
    queryKey: ['ncert-chapters', selectedGrade, selectedSubject, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedGrade) params.append('grade_level', selectedGrade.toString())
      if (selectedSubject !== 'all') params.append('subject', selectedSubject)
      if (searchQuery.trim()) params.append('query', searchQuery.trim())

      const response = await api.get<NCERTChapter[]>(`/ncert/chapters?${params.toString()}`)
      return response.data
    },
  })

  // Adopt chapter mutation
  const adoptMutation = useMutation({
    mutationFn: async (chapterId: string) => {
      setAdoptingId(chapterId)
      const response = await api.post(`/ncert/chapter/${chapterId}/adopt`)
      return response.data
    },
    onSuccess: (data) => {
      setAdoptingId(null)
      // Navigate straight to the adopted lesson player
      navigate(`/lecture/${data.lecture_id}`)
    },
    onError: () => {
      setAdoptingId(null)
    },
  })

  const availableSubjects = [
    'all',
    'Science',
    'Environmental Studies (EVS)',
    'Mathematics',
    'Social Science (Geography)',
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50">
      {/* Top Navbar */}
      <nav className="bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-xs border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              to={user?.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'}
              className="text-gray-500 hover:text-gray-800 text-sm font-medium flex items-center gap-1"
            >
              <span>← Back to Dashboard</span>
            </Link>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🇮🇳</span>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  NCERT Curriculum Hub
                </h1>
                <p className="text-[11px] text-gray-500 font-medium">
                  National Council of Educational Research & Training • Classes 1 to 8
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs bg-primary-50 text-primary-700 font-semibold px-2.5 py-1 rounded-full border border-primary-100">
              {overview?.total_chapters || 16} Standard Chapters
            </span>
          </div>
        </div>
      </nav>

      {/* Main Body */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="card shadow-sm border border-primary-100/60 bg-gradient-to-r from-primary-600 to-indigo-700 text-white mb-8 p-6 md:p-8">
          <div className="max-w-3xl">
            <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-3">
              Standard Indian School Syllabus
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Learn Official NCERT Textbooks in Your Mother Tongue
            </h2>
            <p className="text-primary-100 mt-2 text-sm md:text-base leading-relaxed">
              Select any chapter from Class 1 to 8. Our platform automatically narrates the lesson,
              translates into your state language (हिन्दी, தமிழ், తెలుగు, ಕನ್ನಡ, বাংলা), and generates
              customized practice worksheets!
            </p>
          </div>
        </div>

        {/* Grade Selection Tabs */}
        <div className="mb-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
            Select Class / कक्षा चुनें:
          </label>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((grade) => {
              const isSelected = selectedGrade === grade
              return (
                <button
                  key={grade}
                  onClick={() => setSelectedGrade(grade)}
                  className={`py-2.5 px-3 rounded-xl text-center font-bold text-sm transition shadow-xs ${
                    isSelected
                      ? 'bg-primary-600 text-white ring-2 ring-primary-500 ring-offset-2'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span className="block text-xs font-medium opacity-80">Class</span>
                  <span className="text-base">{grade}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Search & Subject Filter Bar */}
        <div className="card shadow-xs border border-gray-200 mb-8 p-4 bg-white">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search NCERT chapters (e.g. Super Senses, Food, Solar System)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Subject Filters */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {availableSubjects.map((sub) => {
                const isSelected = selectedSubject === sub
                const label = sub === 'all' ? 'All Subjects' : sub.replace(/\(.*\)/, '').trim()
                return (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubject(sub)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      isSelected
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Chapters Grid */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-primary-600 border-t-transparent"></div>
            <p className="mt-3 text-gray-600 text-sm font-medium">Loading NCERT syllabus...</p>
          </div>
        ) : chapters && chapters.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chapters.map((chap) => {
              const isAdopting = adoptingId === chap.id

              return (
                <div
                  key={chap.id}
                  className="card hover:shadow-lg transition-all duration-200 border border-gray-200/80 bg-white flex flex-col justify-between"
                >
                  <div>
                    {/* Chapter Header Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="bg-primary-50 text-primary-700 font-bold text-xs px-2.5 py-1 rounded-md border border-primary-100">
                        {chap.book_name} ({chap.book_hindi_name})
                      </span>
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        Ch {chap.chapter_number}
                      </span>
                    </div>

                    {/* Titles */}
                    <h3 className="font-extrabold text-lg text-gray-900 mb-1 leading-snug">
                      {chap.title}
                    </h3>
                    <p className="text-xs font-semibold text-primary-600 mb-3">
                      {chap.title_hindi}
                    </p>

                    {/* Description */}
                    <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed mb-4">
                      {chap.description}
                    </p>

                    {/* Core Concepts */}
                    <div className="mb-4 pt-3 border-t border-gray-100">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
                        Key Concepts:
                      </span>
                      <ul className="space-y-1">
                        {chap.core_concepts.slice(0, 3).map((concept, idx) => (
                          <li key={idx} className="text-xs text-gray-700 flex items-start gap-1.5">
                            <span className="text-primary-500 font-bold">•</span>
                            <span className="line-clamp-1">{concept}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-gray-100 flex flex-col gap-2 mt-2">
                    <button
                      disabled={isAdopting}
                      onClick={() => adoptMutation.mutate(chap.id)}
                      className="w-full btn btn-primary text-xs flex items-center justify-center gap-1.5 shadow-sm py-2.5"
                    >
                      {isAdopting ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                          <span>Preparing Lesson & Worksheets...</span>
                        </>
                      ) : (
                        <>
                          <span>🎧</span>
                          <span>Study Lesson in Mother Tongue</span>
                          <span>→</span>
                        </>
                      )}
                    </button>

                    <a
                      href={chap.official_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-center text-xs font-medium text-gray-500 hover:text-primary-600 py-1 transition flex items-center justify-center gap-1"
                    >
                      <span>📖</span>
                      <span>Official NCERT e-Textbook Portal</span>
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20 card max-w-md mx-auto">
            <div className="text-5xl mb-3">📚</div>
            <h3 className="text-lg font-bold text-gray-800">No NCERT chapters found</h3>
            <p className="text-xs text-gray-500 mt-1">
              Try choosing another class or adjusting your search keyword.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
