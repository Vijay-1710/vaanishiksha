import React, { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'
import { LiveSyncManager, LiveMessage, translateLiveText } from '../lib/liveSync'
import SyncedTeacherVideo from '../components/SyncedTeacherVideo'

const LANGUAGES: Record<string, { name: string; flag: string; voice: string }> = {
  hi: { name: 'हिन्दी (Hindi)', flag: '🇮🇳', voice: 'hi-IN' },
  ta: { name: 'தமிழ் (Tamil)', flag: '🇮🇳', voice: 'ta-IN' },
  te: { name: 'తెలుగు (Telugu)', flag: '🇮🇳', voice: 'te-IN' },
  kn: { name: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳', voice: 'kn-IN' },
  bn: { name: 'বাংলা (Bengali)', flag: '🇮🇳', voice: 'bn-IN' },
  en: { name: 'English', flag: '🇬🇧', voice: 'en-IN' },
}

interface CaptionItem {
  original_text: string
  translated_text: string
  audio_url?: string
  timestamp: string
}

interface StudentDoubtItem {
  id: string
  student_name: string
  text: string
  translated_text?: string
  time: string
  isVoice: boolean
  audioBlobUrl?: string
}

export default function LiveClassStudent() {
  const { roomCode: paramCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Room state - defaults to LIVE-2026 for seamless testing
  const roomCode = (paramCode || 'LIVE-2026').toUpperCase()
  const [roomMeta, setRoomMeta] = useState<any>({
    room_code: (paramCode || 'LIVE-2026').toUpperCase(),
    title: 'Primary Science: Water Cycle & Plant Ecosystems',
    teacher_name: 'Dr. Ramesh Sharma',
    subject: 'General Science',
    grade_level: 5,
  })
  const [selectedLanguage, setSelectedLanguage] = useState(user?.preferred_language || 'hi')

  // Meeting view state
  const [activeTab, setActiveTab] = useState<'doubts' | 'roster' | 'transcript' | 'simulation'>('doubts')
  const [showSidePanel, setShowSidePanel] = useState(true)
  const [showCC, setShowCC] = useState(true)
  const [myMicMuted, setMyMicMuted] = useState(true)
  const [myCamOff, setMyCamOff] = useState(false)

  // Lip-Sync Video Delay Engine state
  // Delays teacher video so mouth movements perfectly align with translated mother tongue audio!
  const [syncDelayMs, setSyncDelayMs] = useState(1800)
  const [isDelayEnabled, setIsDelayEnabled] = useState(true)

  // Audio Out controls
  const [audioEnabled, setAudioEnabled] = useState(true)
  const volume = 1.0
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  // Live incoming teacher video frame from broadcast
  const [incomingTeacherFrame, setIncomingTeacherFrame] = useState<string | null>(null)

  // Real-time caption state
  const [captions, setCaptions] = useState<CaptionItem[]>([
    {
      original_text: 'Welcome to our live science class! Today we explore how clouds form and bring rain.',
      translated_text: 'हमारी लाइव विज्ञान कक्षा में स्वागत है! आज हम जानेंगे कि बादल कैसे बनते हैं और बारिश कैसे लाते हैं।',
      timestamp: '10:00 AM',
    },
  ])
  const [currentCaption, setCurrentCaption] = useState<CaptionItem | null>({
    original_text: 'The sun warms water in rivers and oceans, causing it to evaporate into vapor.',
    translated_text: 'सूर्य नदियों और महासागरों में पानी को गर्म करता है, जिससे यह वाष्प बनकर ऊपर उठता है।',
    timestamp: '10:01 AM',
  })

  // Doubts state - cleanly separated text vs voice
  const [doubtText, setDoubtText] = useState('')
  const [myDoubts, setMyDoubts] = useState<StudentDoubtItem[]>([])

  // Student Audio In (Voice Doubt) state
  const [isRecordingDoubt, setIsRecordingDoubt] = useState(false)
  const [doubtRecordingTime, setDoubtRecordingTime] = useState(0)
  const [isSubmittingVoiceDoubt, setIsSubmittingVoiceDoubt] = useState(false)

  // Peers list in the meeting
  const [participants, setParticipants] = useState<Array<{ name: string; role: string; lang: string; isSelf?: boolean }>>([
    { name: 'Dr. Ramesh Sharma', role: 'Teacher (Host)', lang: 'English' },
    { name: user?.full_name || 'Aarav Patel', role: 'Student (You)', lang: LANGUAGES[selectedLanguage]?.name || 'Hindi', isSelf: true },
    { name: 'Priya Sundaram', role: 'Student', lang: 'Tamil' },
    { name: 'Rahul Reddy', role: 'Student', lang: 'Telugu' },
    { name: 'Meera Kulkarni', role: 'Student', lang: 'Kannada' },
  ])

  // Class ended state
  const [endedLectureId, setEndedLectureId] = useState<number | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const liveSyncRef = useRef<LiveSyncManager | null>(null)
  const captionsEndRef = useRef<HTMLDivElement>(null)
  const doubtRecorderRef = useRef<MediaRecorder | null>(null)
  const doubtTimerRef = useRef<any>(null)

  // Scroll captions
  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [captions])

  // Initialize room and LiveSync
  useEffect(() => {
    const code = (paramCode || roomCode || 'LIVE-2026').toUpperCase()
    initRoom(code)

    return () => {
      liveSyncRef.current?.close()
      if (socketRef.current) socketRef.current.close()
      window.speechSynthesis?.cancel()
    }
  }, [paramCode])

  const initRoom = async (code: string) => {
    try {
      const res = await api.get(`/live/rooms/${code}`)
      if (res.data && res.data.room_code) {
        setRoomMeta(res.data)
      }
    } catch {
      // Fallback works automatically
    }
    connectLiveSync(code, selectedLanguage)
  }

  const connectLiveSync = (code: string, lang: string) => {
    liveSyncRef.current?.close()

    liveSyncRef.current = new LiveSyncManager(
      code,
      user?.full_name || 'Aarav Patel',
      'student',
      (msg: LiveMessage) => {
        if (msg.type === 'teacher_speech') {
          const originalText = msg.payload?.text || ''
          const translatedText = translateLiveText(originalText, selectedLanguage)
          const item: CaptionItem = {
            original_text: originalText,
            translated_text: translatedText,
            timestamp: msg.payload?.timestamp || new Date().toLocaleTimeString(),
          }
          setCaptions((prev) => [...prev, item])
          setCurrentCaption(item)

          // Play dubbed voice in student's mother tongue
          if (audioEnabled) {
            speakTranslatedText(translatedText, selectedLanguage)
          }
        } else if (msg.type === 'teacher_answer') {
          const answerText = msg.payload?.answer || ''
          const translatedAnswer = translateLiveText(answerText, selectedLanguage)
          const item: CaptionItem = {
            original_text: `👨‍🏫 Teacher: ${answerText}`,
            translated_text: `👨‍🏫 शिक्षक: ${translatedAnswer}`,
            timestamp: new Date().toLocaleTimeString(),
          }
          setCaptions((prev) => [...prev, item])
          setCurrentCaption(item)
          if (audioEnabled) {
            speakTranslatedText(translatedAnswer, selectedLanguage)
          }
        } else if (msg.type === 'teacher_video_frame') {
          if (msg.payload?.frame) {
            setIncomingTeacherFrame(msg.payload.frame)
          }
        } else if (msg.type === 'class_ended') {
          setEndedLectureId(msg.payload?.lecture_id || 1)
        }
      }
    )

    // Broadcast student join
    liveSyncRef.current.broadcast('student_join', {
      name: user?.full_name || 'Aarav Patel',
      language: lang,
    })
  }

  // Synthesize translated speech using Web Speech API
  const speakTranslatedText = (text: string, langCode: string) => {
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = LANGUAGES[langCode]?.voice || 'hi-IN'
      utterance.volume = volume
      utterance.rate = 0.95

      const voices = window.speechSynthesis.getVoices()
      const prefix = (LANGUAGES[langCode]?.voice || 'hi-IN').slice(0, 2)
      const matched = voices.find((v) => v.lang.startsWith(prefix))
      if (matched) utterance.voice = matched

      setIsPlayingAudio(true)
      utterance.onend = () => setIsPlayingAudio(false)
      utterance.onerror = () => setIsPlayingAudio(false)

      window.speechSynthesis.speak(utterance)
    } catch {
      setIsPlayingAudio(false)
    }
  }

  const handleLanguageChange = (newLang: string) => {
    setSelectedLanguage(newLang)
    if (currentCaption) {
      const retranslated = translateLiveText(currentCaption.original_text, newLang)
      setCurrentCaption({
        ...currentCaption,
        translated_text: retranslated,
      })
      if (audioEnabled) {
        speakTranslatedText(retranslated, newLang)
      }
    }
    // Update self in participants
    setParticipants((prev) =>
      prev.map((p) => (p.isSelf ? { ...p, lang: LANGUAGES[newLang]?.name || newLang } : p))
    )
    liveSyncRef.current?.broadcast('student_join', {
      name: user?.full_name || 'Aarav Patel',
      language: newLang,
    })
  }

  // Send Text Doubt - EXPLICITLY MARKED AS TEXT (NOT VOICE)
  const handleSendTextDoubt = (e: React.FormEvent) => {
    e.preventDefault()
    if (!doubtText.trim()) return

    const text = doubtText.trim()
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const studentName = user?.full_name || 'Aarav Patel'
    const doubtId = `text_doubt_${Date.now()}`

    const newDoubt: StudentDoubtItem = {
      id: doubtId,
      student_name: studentName,
      text,
      time: nowTime,
      isVoice: false, // EXPLICITLY FALSE!
    }

    setMyDoubts((prev) => [newDoubt, ...prev])
    setDoubtText('')

    // Broadcast explicitly with is_voice: false & type: 'text'
    liveSyncRef.current?.broadcast('student_doubt', {
      doubt: {
        id: doubtId,
        student_name: studentName,
        question: text,
        student_lang: selectedLanguage,
        translated_question: text,
        timestamp: nowTime,
        is_voice: false, // EXPLICITLY FALSE
        type: 'text',
      },
    })
  }

  // Student Voice Doubt Recording
  const startDoubtRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        const audioBlobUrl = URL.createObjectURL(audioBlob)
        stream.getTracks().forEach((track) => track.stop())
        setIsSubmittingVoiceDoubt(true)

        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const studentName = user?.full_name || 'Aarav Patel'
        const voiceQuestion = `🎙️ Spoken doubt recorded in ${LANGUAGES[selectedLanguage]?.name}`
        const doubtId = `voice_doubt_${Date.now()}`

        const newVoiceDoubt: StudentDoubtItem = {
          id: doubtId,
          student_name: studentName,
          text: voiceQuestion,
          time: nowTime,
          isVoice: true, // EXPLICITLY TRUE
          audioBlobUrl,
        }

        setMyDoubts((prev) => [newVoiceDoubt, ...prev])
        setIsSubmittingVoiceDoubt(false)

        liveSyncRef.current?.broadcast('student_doubt', {
          doubt: {
            id: doubtId,
            student_name: studentName,
            question: voiceQuestion,
            student_lang: selectedLanguage,
            translated_question: voiceQuestion,
            timestamp: nowTime,
            is_voice: true, // EXPLICITLY TRUE
            type: 'voice',
          },
        })
      }

      doubtRecorderRef.current = recorder
      recorder.start()
      setIsRecordingDoubt(true)
      setDoubtRecordingTime(0)

      doubtTimerRef.current = setInterval(() => {
        setDoubtRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch {
      // If mic unavailable, simulate voice doubt for testing
      simulateVoiceDoubt()
    }
  }

  const stopDoubtRecording = () => {
    if (doubtRecorderRef.current && isRecordingDoubt) {
      doubtRecorderRef.current.stop()
      setIsRecordingDoubt(false)
      clearInterval(doubtTimerRef.current)
    }
  }

  // Simulation helpers for testing all features
  const simulateTeacherSpeech = (topic: 'water_cycle' | 'photosynthesis' | 'clouds') => {
    let originalText = ''
    if (topic === 'water_cycle') {
      originalText = 'The sun warms water in rivers and oceans. This water evaporates into invisible vapor!'
    } else if (topic === 'photosynthesis') {
      originalText = 'Green leaves have chlorophyll to trap sunlight and turn water and air into plant food.'
    } else {
      originalText = 'As warm vapor rises into the cold sky, it condenses to form rain clouds.'
    }

    const translatedText = translateLiveText(originalText, selectedLanguage)
    const item: CaptionItem = {
      original_text: originalText,
      translated_text: translatedText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setCaptions((prev) => [...prev, item])
    setCurrentCaption(item)
    if (audioEnabled) {
      speakTranslatedText(translatedText, selectedLanguage)
    }
  }

  const simulateTextDoubt = (sampleText: string) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const studentName = user?.full_name || 'Aarav Patel'
    const doubtId = `sim_text_${Date.now()}`

    const newDoubt: StudentDoubtItem = {
      id: doubtId,
      student_name: studentName,
      text: sampleText,
      time: nowTime,
      isVoice: false, // Text doubt!
    }

    setMyDoubts((prev) => [newDoubt, ...prev])
    liveSyncRef.current?.broadcast('student_doubt', {
      doubt: {
        id: doubtId,
        student_name: studentName,
        question: sampleText,
        student_lang: selectedLanguage,
        translated_question: sampleText,
        timestamp: nowTime,
        is_voice: false,
        type: 'text',
      },
    })
  }

  const simulateVoiceDoubt = () => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const studentName = user?.full_name || 'Aarav Patel'
    const voiceMsg = `🎙️ [Spoken Doubt] "Sir, how do plant roots suck water from deep soil?"`
    const doubtId = `sim_voice_${Date.now()}`

    const newDoubt: StudentDoubtItem = {
      id: doubtId,
      student_name: studentName,
      text: voiceMsg,
      time: nowTime,
      isVoice: true, // Voice doubt!
    }

    setMyDoubts((prev) => [newDoubt, ...prev])
    liveSyncRef.current?.broadcast('student_doubt', {
      doubt: {
        id: doubtId,
        student_name: studentName,
        question: voiceMsg,
        student_lang: selectedLanguage,
        translated_question: voiceMsg,
        timestamp: nowTime,
        is_voice: true,
        type: 'voice',
      },
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* 1. TOP GOOGLE MEET STYLE HEADER */}
      <header className="h-14 bg-slate-900/90 border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between z-20 backdrop-blur-md">
        {/* Left: Room & Meeting info */}
        <div className="flex items-center gap-3">
          <Link
            to="/student/dashboard"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition px-2 py-1 rounded-lg hover:bg-slate-800"
          >
            <span>←</span>
            <span className="hidden sm:inline">Exit</span>
          </Link>

          <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">LIVE CLASS</span>
          </div>

          <div className="hidden md:block">
            <h1 className="text-xs font-bold text-white truncate max-w-xs lg:max-w-md">
              {roomMeta?.title || 'Primary Science: Water Cycle & Plant Ecosystems'}
            </h1>
          </div>

          {/* Room Code Badge with Copy */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(roomCode)
              alert(`Room code ${roomCode} copied to clipboard!`)
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-[11px] font-mono font-bold text-amber-300 transition"
            title="Click to copy room code"
          >
            <span>🔑</span>
            <span>{roomCode}</span>
            <span className="text-slate-400 text-[10px]">📋</span>
          </button>
        </div>

        {/* Right: Mother Tongue Selector, Lip-Sync Chip, Audio Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mother Tongue Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 rounded-lg px-2.5 py-1">
            <span className="text-sm">{LANGUAGES[selectedLanguage]?.flag}</span>
            <select
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-amber-300 outline-none cursor-pointer"
            >
              {Object.entries(LANGUAGES).map(([code, item]) => (
                <option key={code} value={code} className="bg-slate-900 text-white">
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          {/* AI Lip-Sync Engine Pill */}
          <div
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
              isDelayEnabled
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <span>✨</span>
            <span>Lip-Sync: {isDelayEnabled ? `${(syncDelayMs / 1000).toFixed(1)}s Delay` : 'OFF'}</span>
          </div>

          {/* Audio Out Pill */}
          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled)
              if (audioEnabled) window.speechSynthesis.cancel()
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
              audioEnabled
                ? isPlayingAudio
                  ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400 border-emerald-400 animate-pulse'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <span>{audioEnabled ? (isPlayingAudio ? '🔊 Dubbing...' : '🔊 Dubbed Audio ON') : '🔇 Muted'}</span>
          </button>
        </div>
      </header>

      {/* Class Ended Banner */}
      {endedLectureId && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-3 shadow-md z-30">
          <span>🎉 This live class has concluded! Lesson archived with transcript & practice worksheet.</span>
          <button
            onClick={() => navigate(`/lecture/${endedLectureId}`)}
            className="bg-white text-emerald-900 px-3 py-1 rounded-md text-xs font-extrabold hover:bg-emerald-50 transition"
          >
            Open Lesson & Practice →
          </button>
        </div>
      )}

      {/* 2. MAIN MEETING STAGE AREA */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Center Stage: Synced Teacher Video with Delayed Lip-Sync & CC */}
        <div className="flex-1 p-3 sm:p-5 flex flex-col items-center justify-center min-w-0">
          <div className="relative w-full h-full max-h-[82vh] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800/80 shadow-2xl flex flex-col">
            {/* Synced Teacher Video with Delayed Lip-Sync Frame Buffer */}
            <div className="relative flex-1 w-full h-full">
              <SyncedTeacherVideo
                isTeacherStreaming={true}
                teacherName={roomMeta?.teacher_name || 'Dr. Ramesh Sharma'}
                currentSpeech={showCC ? currentCaption?.original_text || '' : ''}
                translatedSpeech={showCC ? currentCaption?.translated_text || '' : ''}
                selectedLanguageName={LANGUAGES[selectedLanguage]?.name || 'Hindi'}
                syncDelayMs={syncDelayMs}
                isDelayEnabled={isDelayEnabled}
                onToggleDelay={(enabled) => setIsDelayEnabled(enabled)}
                onDelayChange={(ms) => setSyncDelayMs(ms)}
                incomingTeacherFrame={incomingTeacherFrame}
              />

              {/* Floating Student Video Tile (Self View - PiP like Google Meet) */}
              <div className="absolute top-4 right-4 w-36 sm:w-48 aspect-video rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-xl overflow-hidden backdrop-blur-md flex flex-col justify-between p-2 z-10">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-300 truncate">{user?.full_name || 'Aarav (You)'}</span>
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 py-0.5 rounded uppercase font-mono">
                    {selectedLanguage}
                  </span>
                </div>

                {/* Avatar / Camera preview */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-lg shadow">
                    🎓
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{myMicMuted ? '🔇 Muted' : '🎙️ Mic ON'}</span>
                  <span className="text-emerald-400 font-bold">● Active</span>
                </div>
              </div>
            </div>

            {/* Quick Multi-Language Captions Bar at Bottom of Video Stage */}
            {showCC && currentCaption && (
              <div className="bg-slate-950/95 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between">
                <div className="flex-1 pr-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      Dubbed Subtitle ({LANGUAGES[selectedLanguage]?.name})
                    </span>
                    <button
                      onClick={() => speakTranslatedText(currentCaption.translated_text, selectedLanguage)}
                      className="text-[10px] text-primary-400 hover:text-primary-300 font-bold flex items-center gap-0.5"
                    >
                      <span>🔊 Replay Voice</span>
                    </button>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-white leading-tight">
                    {currentCaption.translated_text}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. RIGHT MEETING DRAWER (Doubts, Roster, Transcript, Simulation) */}
        {showSidePanel && (
          <aside className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full z-20 shadow-2xl">
            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-800 text-xs font-bold text-slate-400 bg-slate-950/40">
              <button
                onClick={() => setActiveTab('doubts')}
                className={`flex-1 py-3 text-center transition flex items-center justify-center gap-1.5 border-b-2 ${
                  activeTab === 'doubts'
                    ? 'border-primary-500 text-primary-400 bg-slate-900'
                    : 'border-transparent hover:text-white'
                }`}
              >
                <span>💬 Doubts</span>
                {myDoubts.length > 0 && (
                  <span className="bg-primary-500/20 text-primary-300 text-[10px] px-1.5 py-0.2 rounded-full">
                    {myDoubts.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('transcript')}
                className={`flex-1 py-3 text-center transition flex items-center justify-center gap-1 border-b-2 ${
                  activeTab === 'transcript'
                    ? 'border-primary-500 text-primary-400 bg-slate-900'
                    : 'border-transparent hover:text-white'
                }`}
              >
                <span>📜 Transcripts</span>
              </button>

              <button
                onClick={() => setActiveTab('roster')}
                className={`flex-1 py-3 text-center transition flex items-center justify-center gap-1 border-b-2 ${
                  activeTab === 'roster'
                    ? 'border-primary-500 text-primary-400 bg-slate-900'
                    : 'border-transparent hover:text-white'
                }`}
              >
                <span>👥 People ({participants.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('simulation')}
                className={`py-3 px-3 text-center transition flex items-center justify-center border-b-2 ${
                  activeTab === 'simulation'
                    ? 'border-amber-500 text-amber-400 bg-slate-900'
                    : 'border-transparent hover:text-white text-slate-400'
                }`}
                title="Simulation & Testing Tools"
              >
                <span>⚡ Test</span>
              </button>
            </div>

            {/* TAB 1: ASK DOUBT (Clear separation: Text vs Voice) */}
            {activeTab === 'doubts' && (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                <div className="mb-3">
                  <h3 className="text-xs font-bold text-white mb-0.5 flex items-center gap-1.5">
                    <span>🙋 Ask Teacher a Doubt</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Ask in <strong>{LANGUAGES[selectedLanguage]?.name}</strong>. Your teacher receives it translated instantly!
                  </p>
                </div>

                {/* Voice Doubt (Microphone) Card */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1">
                      <span>🎙️</span> Voice Doubt (Audio In)
                    </span>
                    {isRecordingDoubt && (
                      <span className="text-[10px] font-mono font-bold text-rose-400 animate-pulse">
                        ● Recording 00:{doubtRecordingTime < 10 ? `0${doubtRecordingTime}` : doubtRecordingTime}
                      </span>
                    )}
                  </div>

                  {isRecordingDoubt ? (
                    <button
                      onClick={stopDoubtRecording}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow transition flex items-center justify-center gap-2"
                    >
                      <span>⏹</span>
                      <span>Stop & Send Voice Doubt</span>
                    </button>
                  ) : (
                    <button
                      onClick={startDoubtRecording}
                      disabled={isSubmittingVoiceDoubt}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow transition flex items-center justify-center gap-2"
                    >
                      <span>🎙️</span>
                      <span>{isSubmittingVoiceDoubt ? 'Delivering Voice...' : 'Record Voice Doubt'}</span>
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div className="relative flex py-1 items-center mb-3">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-2 text-[10px] text-slate-500 uppercase font-bold">
                    or type text doubt
                  </span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                {/* Text Doubt Form */}
                <form onSubmit={handleSendTextDoubt} className="mb-4">
                  <textarea
                    rows={2}
                    value={doubtText}
                    onChange={(e) => setDoubtText(e.target.value)}
                    placeholder={`Type doubt in ${LANGUAGES[selectedLanguage]?.name || 'your language'}...`}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-primary-500 resize-none transition"
                  />
                  <button
                    type="submit"
                    disabled={!doubtText.trim()}
                    className="w-full mt-2 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow transition flex items-center justify-center gap-1.5"
                  >
                    <span>💬</span>
                    <span>Send Typed Doubt</span>
                  </button>
                </form>

                {/* Sent Doubts List with CRYSTAL CLEAR [Text] vs [Voice] badges */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    My Sent Doubts to Teacher:
                  </span>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                    {myDoubts.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs italic">
                        No doubts asked yet. Type or record above to ask Dr. Ramesh Sharma!
                      </div>
                    ) : (
                      myDoubts.map((d) => (
                        <div
                          key={d.id}
                          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            {/* EXPLICIT BADGE SHOWING TEXT DOUBT VS VOICE DOUBT */}
                            {d.isVoice ? (
                              <span className="bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                <span>🎙️</span>
                                <span>Voice Doubt</span>
                              </span>
                            ) : (
                              <span className="bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                <span>💬</span>
                                <span>Text Doubt</span>
                              </span>
                            )}
                            <span className="text-slate-500">{d.time}</span>
                          </div>

                          <p className="text-slate-200 text-xs font-medium leading-relaxed">{d.text}</p>

                          {d.audioBlobUrl && (
                            <audio controls src={d.audioBlobUrl} className="w-full h-6 mt-1" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TRANSCRIPT HISTORY */}
            {activeTab === 'transcript' && (
              <div className="flex-1 p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Live Transcript History</span>
                  <span className="text-[11px] text-slate-500 font-mono">{captions.length} sentences</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
                  {captions.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1"
                    >
                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-400">Teacher • {c.timestamp}</span>
                        <button
                          onClick={() => speakTranslatedText(c.translated_text, selectedLanguage)}
                          className="text-amber-400 hover:text-amber-300 font-bold text-[10px]"
                        >
                          🔊 Listen
                        </button>
                      </div>
                      <p className="text-slate-100 font-medium text-xs leading-relaxed">{c.translated_text}</p>
                      <p className="text-[11px] text-slate-400 italic">"{c.original_text}"</p>
                    </div>
                  ))}
                  <div ref={captionsEndRef} />
                </div>
              </div>
            )}

            {/* TAB 3: PARTICIPANTS ROSTER */}
            {activeTab === 'roster' && (
              <div className="flex-1 p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300">In This Live Classroom</span>
                  <span className="text-[11px] text-emerald-400 font-bold">● {participants.length} Online</span>
                </div>

                <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                  {participants.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-primary-400">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-white leading-tight">{p.name}</p>
                          <p className="text-[10px] text-slate-400">{p.role}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                        {p.lang}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: SIMULATION & TESTING TOOLS */}
            {activeTab === 'simulation' && (
              <div className="flex-1 p-4 flex flex-col space-y-3 overflow-y-auto text-xs">
                <div className="pb-2 border-b border-slate-800">
                  <h3 className="font-bold text-white flex items-center gap-1.5">
                    <span>⚡ Simulation & Testing Suite</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    1-Click test every meeting feature, audio broadcast, translation, and lip-sync buffer!
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    1. Simulate Teacher Broadcast:
                  </span>
                  <button
                    onClick={() => simulateTeacherSpeech('water_cycle')}
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 transition flex items-center gap-2"
                  >
                    <span>🌊</span>
                    <div>
                      <p className="font-bold text-slate-200">Teacher: Water Cycle Concept</p>
                      <p className="text-[10px] text-slate-400">Sun warms water → evaporates into clouds</p>
                    </div>
                  </button>

                  <button
                    onClick={() => simulateTeacherSpeech('photosynthesis')}
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 transition flex items-center gap-2"
                  >
                    <span>🌱</span>
                    <div>
                      <p className="font-bold text-slate-200">Teacher: Photosynthesis Lesson</p>
                      <p className="text-[10px] text-slate-400">Green leaves trap sunlight for food</p>
                    </div>
                  </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    2. Simulate Student Doubts:
                  </span>
                  <button
                    onClick={() => simulateTextDoubt('Teacher, how does rain fall from heavy clouds?')}
                    className="w-full text-left p-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 transition flex items-center gap-2 font-bold"
                  >
                    <span>💬</span>
                    <span>Send Simulated Text Doubt</span>
                  </button>

                  <button
                    onClick={simulateVoiceDoubt}
                    className="w-full text-left p-2 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 transition flex items-center gap-2 font-bold"
                  >
                    <span>🎙️</span>
                    <span>Send Simulated Voice Doubt</span>
                  </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    3. AI Lip-Sync Delay Setting:
                  </span>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300 font-medium">Delay Buffer:</span>
                      <span className="text-emerald-400 font-bold font-mono">
                        {(syncDelayMs / 1000).toFixed(1)}s ({syncDelayMs}ms)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={3000}
                      step={100}
                      value={syncDelayMs}
                      onChange={(e) => setSyncDelayMs(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>0s (Live)</span>
                      <span>1.8s (Dubbed Sync)</span>
                      <span>3.0s</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* 4. GOOGLE MEET STYLE FLOATING BOTTOM CONTROL BAR */}
      <footer className="h-20 bg-slate-950/95 border-t border-slate-800/80 px-4 sm:px-8 flex items-center justify-between z-20 backdrop-blur-md">
        {/* Left: Meeting Name & Time */}
        <div className="hidden md:flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-slate-400">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-xs text-slate-500">|</span>
          <span className="text-xs font-bold text-slate-300">{roomCode}</span>
        </div>

        {/* Center: Meeting Controls (Mic, Cam, CC, Hand, LipSync) */}
        <div className="flex items-center gap-3 sm:gap-4 mx-auto md:mx-0">
          {/* Mic Button */}
          <button
            onClick={() => setMyMicMuted(!myMicMuted)}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition shadow-md ${
              myMicMuted
                ? 'bg-rose-600/90 hover:bg-rose-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={myMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {myMicMuted ? '🔇' : '🎙️'}
          </button>

          {/* Camera Button */}
          <button
            onClick={() => setMyCamOff(!myCamOff)}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition shadow-md ${
              myCamOff
                ? 'bg-rose-600/90 hover:bg-rose-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={myCamOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {myCamOff ? '📷' : '📹'}
          </button>

          {/* Captions Toggle Button */}
          <button
            onClick={() => setShowCC(!showCC)}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold transition shadow-md border ${
              showCC
                ? 'bg-primary-600 border-primary-500 text-white ring-2 ring-primary-500/30'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400'
            }`}
            title="Toggle Subtitles"
          >
            CC
          </button>

          {/* Raise Hand / Ask Doubt */}
          <button
            onClick={() => {
              setShowSidePanel(true)
              setActiveTab('doubts')
            }}
            className="w-11 h-11 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 flex items-center justify-center text-lg shadow-md transition"
            title="Raise Hand & Ask Doubt"
          >
            ✋
          </button>

          {/* Leave Meeting (Red Button) */}
          <button
            onClick={() => {
              if (confirm('Leave this live classroom?')) {
                navigate('/student/dashboard')
              }
            }}
            className="px-5 h-11 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
            title="Leave Call"
          >
            <span>📞</span>
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>

        {/* Right: Drawer Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (showSidePanel && activeTab === 'doubts') setShowSidePanel(false)
              else {
                setShowSidePanel(true)
                setActiveTab('doubts')
              }
            }}
            className={`p-2.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 ${
              showSidePanel && activeTab === 'doubts'
                ? 'bg-primary-600/30 border-primary-500 text-primary-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400'
            }`}
            title="In-call Doubts"
          >
            <span>💬</span>
            <span className="hidden lg:inline">Doubts</span>
          </button>

          <button
            onClick={() => {
              if (showSidePanel && activeTab === 'simulation') setShowSidePanel(false)
              else {
                setShowSidePanel(true)
                setActiveTab('simulation')
              }
            }}
            className={`p-2.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 ${
              showSidePanel && activeTab === 'simulation'
                ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400'
            }`}
            title="Simulation Tools"
          >
            <span>⚡</span>
            <span className="hidden lg:inline">Test Tools</span>
          </button>
        </div>
      </footer>
    </div>
  )
}
