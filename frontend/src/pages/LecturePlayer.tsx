import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'
import WorksheetSection from '../components/WorksheetSection'

interface Lecture {
  id: number
  title: string
  description: string | null
  subject: string | null
  grade_level: number | null
  original_language: string
  media_url?: string | null
  media_type?: 'audio' | 'video'
  available_languages: string[]
}

interface DubbedLecture {
  id: number
  lecture_id: number
  target_language: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  dubbed_audio_url: string | null
  transcript_url: string | null
}

const LANGUAGES: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी (Hindi)',
  ta: 'தமிழ் (Tamil)',
  te: 'తెలుగు (Telugu)',
  kn: 'ಕನ್ನಡ (Kannada)',
  bn: 'বাংলা (Bengali)',
}

export default function LecturePlayer() {
  const { lectureId } = useParams<{ lectureId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [selectedLanguage, setSelectedLanguage] = useState(user?.preferred_language || 'en')
  const [activeTab, setActiveTab] = useState<'listen' | 'worksheet'>('listen')
  const [transcript, setTranscript] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)

  const { data: lecture, isLoading: lectureLoading } = useQuery({
    queryKey: ['lecture', lectureId],
    queryFn: async () => {
      const response = await api.get<Lecture>(`/lectures/${lectureId}`)
      return response.data
    },
  })

  // Set default language once lecture is loaded
  useEffect(() => {
    if (lecture && !selectedLanguage) {
      setSelectedLanguage(user?.preferred_language || lecture.original_language)
    }
  }, [lecture, selectedLanguage, user?.preferred_language])

  const isOriginal = lecture ? selectedLanguage === lecture.original_language : false

  const requestDubMutation = useMutation({
    mutationFn: async (language: string) => {
      const response = await api.post<DubbedLecture>(
        `/lectures/${lectureId}/dub/${language}`
      )
      return response.data
    },
  })

  const { data: dubbedLecture, refetch: refetchDubStatus } = useQuery({
    queryKey: ['dubbed-lecture', lectureId, selectedLanguage],
    queryFn: async () => {
      const response = await api.get<DubbedLecture>(
        `/lectures/${lectureId}/dub/${selectedLanguage}/status`
      )
      return response.data
    },
    enabled: Boolean(lecture && !isOriginal),
  })

  // Poll for status if processing or pending
  useEffect(() => {
    if (!isOriginal && (dubbedLecture?.status === 'processing' || dubbedLecture?.status === 'pending')) {
      const interval = setInterval(() => {
        refetchDubStatus()
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [dubbedLecture?.status, isOriginal, refetchDubStatus])

  // Trigger dub request when language changes (if not original)
  useEffect(() => {
    if (selectedLanguage && lecture) {
      if (selectedLanguage === lecture.original_language) {
        return
      }

      if (lecture.available_languages.includes(selectedLanguage)) {
        refetchDubStatus()
      } else {
        requestDubMutation.mutate(selectedLanguage, {
          onSuccess: () => {
            refetchDubStatus()
          },
        })
      }
    }
  }, [selectedLanguage, lecture])

  // Load transcript text
  useEffect(() => {
    let transcriptUrl: string | null | undefined = null
    if (isOriginal) {
      transcriptUrl = dubbedLecture?.transcript_url || (lecture ? `/storage/transcripts/transcript_${lecture.id}_${lecture.original_language}.txt` : null)
    } else {
      transcriptUrl = dubbedLecture?.transcript_url
    }

    if (transcriptUrl) {
      fetch(transcriptUrl)
        .then((res) => {
          if (res.ok) return res.text()
          return ''
        })
        .then((text) => setTranscript(text))
        .catch(console.error)
    } else {
      setTranscript('')
    }
  }, [dubbedLecture?.transcript_url, isOriginal, lecture])

  if (lectureLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading lesson...</p>
        </div>
      </div>
    )
  }

  if (!lecture) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center card max-w-sm mx-auto">
          <p className="text-xl font-semibold text-gray-700">Lesson not found</p>
          <button onClick={() => navigate(-1)} className="btn btn-primary mt-4">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const mediaUrl = isOriginal ? lecture.media_url : dubbedLecture?.dubbed_audio_url
  const isCompleted = isOriginal || (dubbedLecture?.status === 'completed' && Boolean(dubbedLecture.dubbed_audio_url))
  const isProcessing = !isOriginal && (dubbedLecture?.status === 'processing' || dubbedLecture?.status === 'pending' || requestDubMutation.isPending)
  const isFailed = !isOriginal && dubbedLecture?.status === 'failed'

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium transition"
          >
            ← Back to Lessons
          </button>
          <span className="text-sm text-gray-500">
            Class {lecture.grade_level || 'General'} • {lecture.subject || 'All Subjects'}
          </span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card mb-6 shadow-sm border border-gray-100">
          <div className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{lecture.title}</h1>
                {lecture.description && (
                  <p className="text-gray-600 mt-2 leading-relaxed">{lecture.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                  Class {lecture.grade_level}
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold uppercase">
                  {lecture.subject || 'General'}
                </span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 mb-6 gap-2">
            <button
              onClick={() => setActiveTab('listen')}
              className={`flex items-center gap-2 py-3 px-5 font-semibold text-sm border-b-2 transition ${
                activeTab === 'listen'
                  ? 'border-primary-600 text-primary-700 bg-primary-50/60 rounded-t-lg'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>🎧</span>
              <span>Lesson Audio & Dubbing</span>
            </button>
            <button
              onClick={() => setActiveTab('worksheet')}
              className={`flex items-center gap-2 py-3 px-5 font-semibold text-sm border-b-2 transition ${
                activeTab === 'worksheet'
                  ? 'border-primary-600 text-primary-700 bg-primary-50/60 rounded-t-lg'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>📝</span>
              <span>Practice Worksheet & Quiz</span>
              <span className="text-[10px] bg-primary-100 text-primary-700 font-bold px-2 py-0.5 rounded-full ml-1">
                Auto-Gen
              </span>
            </button>
          </div>

          {activeTab === 'listen' ? (
            <>
              {/* Language selector bar */}
              <div className="mb-6 p-4 bg-primary-50/50 rounded-xl border border-primary-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <label htmlFor="language-select" className="block text-sm font-semibold text-gray-700 mb-1">
                    Listen in your mother tongue / अपनी भाषा चुनें:
                  </label>
                  <p className="text-xs text-gray-500">
                    AI will automatically translate and voice-dub this lesson into your chosen language.
                  </p>
                </div>
                <select
                  id="language-select"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full md:w-60 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 transition shadow-sm"
                >
                  {Object.entries(LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name} {code === lecture.original_language ? ' (Original)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Media Player Area */}
              <div className="bg-gray-900 text-white rounded-xl p-5 shadow-inner">
                {isCompleted && mediaUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-300 pb-2 border-b border-gray-800">
                      <span>
                        Language: <strong className="text-white">{LANGUAGES[selectedLanguage] || selectedLanguage}</strong>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {isOriginal ? 'Original Track' : 'AI Voice Dubbed'}
                      </span>
                    </div>

                    {isOriginal && lecture.media_type === 'video' ? (
                      <video
                        controls
                        className="w-full max-h-[460px] rounded-lg bg-black"
                        src={mediaUrl}
                      >
                        Your browser does not support video playback.
                      </video>
                    ) : (
                      <div className="pt-2">
                        <audio
                          ref={audioRef}
                          controls
                          autoPlay={false}
                          className="w-full"
                          src={mediaUrl}
                        >
                          Your browser does not support audio playback.
                        </audio>
                      </div>
                    )}
                  </div>
                ) : isProcessing ? (
                  <div className="text-center py-10">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-primary-400 border-t-transparent mb-4"></div>
                    <h3 className="text-lg font-semibold text-white">
                      Dubbing lesson into {LANGUAGES[selectedLanguage] || selectedLanguage}...
                    </h3>
                    <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
                      Translating speech and generating natural voice track. This takes less than a minute. Please wait.
                    </p>
                  </div>
                ) : isFailed ? (
                  <div className="text-center py-8">
                    <p className="text-base font-medium text-rose-400 mb-3">
                      Dubbing encountered a temporary issue.
                    </p>
                    <button
                      onClick={() => requestDubMutation.mutate(selectedLanguage)}
                      className="btn btn-primary"
                    >
                      Retry Dubbing
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    Select a language to start listening.
                  </div>
                )}
              </div>
            </>
          ) : (
            <WorksheetSection
              lectureId={lecture.id}
              language={selectedLanguage}
              languageName={LANGUAGES[selectedLanguage] || selectedLanguage}
            />
          )}
        </div>

        {/* Transcript Section */}
        {activeTab === 'listen' && transcript && (
          <div className="card shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>📝</span>
                <span>Lesson Transcript ({LANGUAGES[selectedLanguage] || selectedLanguage})</span>
              </h2>
              <button
                onClick={() => navigator.clipboard.writeText(transcript)}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1.5 rounded-lg hover:bg-primary-100 transition"
              >
                Copy Text
              </button>
            </div>
            <div className="prose max-w-none text-gray-700 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50/70 p-4 rounded-lg border border-gray-200/60">
              {transcript}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
