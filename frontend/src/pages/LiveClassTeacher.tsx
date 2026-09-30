import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'
import { LiveSyncManager, LiveMessage } from '../lib/liveSync'
import teacherSpeakingSrc from '../assets/teacher_speaking.jpg'
import teacherListeningSrc from '../assets/teacher_listening.jpg'

interface StudentInfo {
  name: string
  language: string
  joined_at: string
}

interface StudentDoubt {
  id?: string
  student_name: string
  question: string
  student_lang: string
  translated_question: string
  audio_url?: string
  original_audio_url?: string
  timestamp: string
  is_voice?: boolean
}

export default function LiveClassTeacher() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Room state
  const [inRoom, setInRoom] = useState(false)
  const [roomCode, setRoomCode] = useState('LIVE-2026')
  const [title, setTitle] = useState('Primary Science: Plant Biology & Water Cycle (जल चक्र)')
  const [subject, setSubject] = useState('General Science')
  const gradeLevel = 5
  const [loading, setLoading] = useState(false)

  // Live session state
  const [isListening, setIsListening] = useState(false)
  const [speechInput, setSpeechInput] = useState('')
  const [transcriptFeed, setTranscriptFeed] = useState<Array<{ text: string; time: string }>>([
    {
      text: 'Welcome students to our live interactive science class on the Water Cycle and Plant Ecosystems!',
      time: '10:00 AM',
    },
  ])
  const [students, setStudents] = useState<StudentInfo[]>([
    { name: 'Aarav Patel', language: 'Hindi (हिन्दी)', joined_at: '10:00 AM' },
    { name: 'Priya Sundaram', language: 'Tamil (தமிழ்)', joined_at: '10:01 AM' },
    { name: 'Rahul Reddy', language: 'Telugu (తెలుగు)', joined_at: '10:02 AM' },
  ])
  const [doubts, setDoubts] = useState<StudentDoubt[]>([])
  const [activeAnswerDoubtId, setActiveAnswerDoubtId] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [ending, setEnding] = useState(false)

  // UI meeting state
  const [activeTab, setActiveTab] = useState<'doubts' | 'students' | 'transcript' | 'simulation'>('doubts')
  const [showSidePanel, setShowSidePanel] = useState(true)
  const [cameraOn, setCameraOn] = useState(true)

  // Audio In state
  const [asrEngine, setAsrEngine] = useState<'browser' | 'server'>('browser')
  const [audioLevel, setAudioLevel] = useState(0)
  const [isWebcamActive, setIsWebcamActive] = useState(false)

  const recognitionRef = useRef<any>(null)
  const liveSyncRef = useRef<LiveSyncManager | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const teacherCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const teacherVideoRef = useRef<HTMLVideoElement | null>(null)
  const lastBroadcastRef = useRef<number>(0)
  const speakingImgRef = useRef<HTMLImageElement | null>(null)
  const listeningImgRef = useRef<HTMLImageElement | null>(null)

  // Preload studio teacher presenter frames
  useEffect(() => {
    const s = new Image()
    s.src = teacherSpeakingSrc
    speakingImgRef.current = s

    const l = new Image()
    l.src = teacherListeningSrc
    listeningImgRef.current = l
  }, [])

  // Camera stream capture
  useEffect(() => {
    let stream: MediaStream | null = null
    async function initCam() {
      if (cameraOn && inRoom) {
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: false })
            if (teacherVideoRef.current) {
              teacherVideoRef.current.srcObject = stream
              teacherVideoRef.current.play().catch(() => {})
              setIsWebcamActive(true)
            }
          }
        } catch {
          setIsWebcamActive(false)
        }
      } else {
        if (teacherVideoRef.current && teacherVideoRef.current.srcObject) {
          const s = teacherVideoRef.current.srcObject as MediaStream
          s.getTracks().forEach((t) => t.stop())
          teacherVideoRef.current.srcObject = null
        }
        setIsWebcamActive(false)
      }
    }
    initCam()
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [cameraOn, inRoom])

  // Setup Web Speech recognition if supported
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRec) {
      const recognition = new SpeechRec()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = 'en-IN'

      recognition.onresult = (event: any) => {
        const last = event.results.length - 1
        const text = event.results[last][0].transcript.trim()
        if (text) {
          sendSpeech(text)
        }
      }

      recognition.onerror = () => {
        // Fallback silently
      }

      recognition.onend = () => {
        if (isListening && asrEngine === 'browser') {
          try {
            recognition.start()
          } catch {}
        }
      }

      recognitionRef.current = recognition
    }
  }, [isListening, asrEngine])

  // Canvas visualizer for teacher presentation & live frame broadcast
  useEffect(() => {
    if (!inRoom) return
    const canvas = teacherCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let active = true
    let wave = 0

    const render = () => {
      if (!active) return
      const w = canvas.width
      const h = canvas.height
      wave += 0.08
      const now = Date.now()

      const isSpeaking = isListening || audioLevel > 5

      if (isWebcamActive && teacherVideoRef.current && teacherVideoRef.current.readyState >= 2) {
        ctx.drawImage(teacherVideoRef.current, 0, 0, w, h)
      } else {
        const sourceImg = isSpeaking ? speakingImgRef.current : listeningImgRef.current

        if (sourceImg && sourceImg.complete && sourceImg.naturalWidth > 0) {
          const scale = 1.0 + (isSpeaking ? Math.sin(wave) * 0.012 : 0)
          ctx.save()
          ctx.translate(w / 2, h / 2)
          ctx.scale(scale, scale)
          ctx.drawImage(sourceImg, -w / 2, -h / 2, w, h)
          ctx.restore()
        } else {
          // Background
          const grad = ctx.createLinearGradient(0, 0, w, h)
          grad.addColorStop(0, '#090d16')
          grad.addColorStop(1, '#1e293b')
          ctx.fillStyle = grad
          ctx.fillRect(0, 0, w, h)
        }
      }

      // Animated Voice Wave overlay on teacher feed
      if (isSpeaking) {
        ctx.strokeStyle = '#4ade80'
        ctx.lineWidth = 3
        ctx.beginPath()
        const midY = h - 25
        for (let x = 20; x < w - 20; x += 6) {
          const amp = audioLevel > 5 ? 18 : 8
          const y = midY + Math.sin(x * 0.05 + wave) * amp
          if (x === 20) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // Broadcast video frame to student tabs every 120ms (~8-10 fps)
      if (now - lastBroadcastRef.current > 120) {
        lastBroadcastRef.current = now
        try {
          const frameData = canvas.toDataURL('image/jpeg', 0.45)
          liveSyncRef.current?.broadcast('teacher_video_frame', {
            frame: frameData,
            timestamp: now,
          })
        } catch {
          // ignore
        }
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      active = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [inRoom, isListening, audioLevel, isWebcamActive])

  // Mic capture
  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioContextRef.current = audioCtx

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
        const average = sum / dataArray.length
        setAudioLevel(Math.min(100, Math.round((average / 128) * 100)))
        animFrameRef.current = requestAnimationFrame(updateVolume)
      }
      updateVolume()
    } catch {
      // Simulate volume level for demo
      const interval = setInterval(() => {
        setAudioLevel(Math.floor(Math.random() * 45) + 15)
      }, 200)
      return () => clearInterval(interval)
    }
  }

  const stopAudioCapture = () => {
    setAudioLevel(0)
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
  }

  const toggleMic = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
      stopAudioCapture()
      setIsListening(false)
    } else {
      setIsListening(true)
      await startAudioCapture()
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start()
        } catch {}
      }
    }
  }

  const handleStartClass = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)

    const code = (roomCode || 'LIVE-2026').toUpperCase()

    try {
      await api.post('/live/rooms/create', {
        room_code: code,
        title,
        subject,
        grade_level: gradeLevel,
        original_language: 'en',
      })
    } catch {
      // Offline/demo fallback
    }

    setRoomCode(code)
    setInRoom(true)
    connectLiveSync(code)
    setLoading(false)
  }

  const connectLiveSync = (code: string) => {
    liveSyncRef.current?.close()

    liveSyncRef.current = new LiveSyncManager(
      code,
      user?.full_name || 'Dr. Ramesh Sharma',
      'teacher',
      (msg: LiveMessage) => {
        if (msg.type === 'student_join') {
          const sName = msg.payload?.name || msg.senderName
          const sLang = msg.payload?.language || 'Hindi'
          setStudents((prev) => {
            if (prev.some((s) => s.name === sName)) return prev
            return [
              ...prev,
              {
                name: sName,
                language: sLang,
                joined_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]
          })
        } else if (msg.type === 'student_doubt') {
          // PROPERLY EXTRACT DOUBT & PRESERVE is_voice FLAG
          const doubtPayload = msg.payload?.doubt || {}
          const newDoubt: StudentDoubt = {
            id: doubtPayload.id || `doubt_${Date.now()}`,
            student_name: doubtPayload.student_name || msg.senderName || 'Student',
            question: doubtPayload.question || 'Question asked',
            student_lang: doubtPayload.student_lang || 'hi',
            translated_question: doubtPayload.translated_question || doubtPayload.question || 'Question asked',
            timestamp: doubtPayload.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            is_voice: Boolean(doubtPayload.is_voice), // PRESERVES TRUE/FALSE ACCURATELY!
          }

          setDoubts((prev) => [newDoubt, ...prev])
        }
      }
    )
  }

  // Teacher broadcasts speech to students
  const sendSpeech = (text: string) => {
    if (!text.trim()) return
    const trimmed = text.trim()
    const speechTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // 1. Update teacher's local feed
    setTranscriptFeed((prev) => [{ text: trimmed, time: speechTime }, ...prev])

    // 2. Broadcast to all student tabs/devices
    liveSyncRef.current?.broadcast('teacher_speech', {
      text: trimmed,
      language: 'en',
      timestamp: speechTime,
    })

    setSpeechInput('')
  }

  // Teacher answers a specific student doubt
  const handleAnswerDoubt = (doubt: StudentDoubt) => {
    if (!answerText.trim()) return
    const speechTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const fullAnswer = `To ${doubt.student_name}: ${answerText.trim()}`

    setTranscriptFeed((prev) => [{ text: fullAnswer, time: speechTime }, ...prev])

    // Broadcast answer to all students
    liveSyncRef.current?.broadcast('teacher_answer', {
      doubt_id: doubt.id,
      answer: fullAnswer,
      timestamp: speechTime,
    })

    setAnswerText('')
    setActiveAnswerDoubtId(null)
  }

  const handleEndClass = async () => {
    if (!confirm('End this live classroom? The lesson will be archived for students to practice.')) return

    setEnding(true)
    stopAudioCapture()
    setIsListening(false)

    try {
      liveSyncRef.current?.broadcast('class_ended', { lecture_id: 1 })
      liveSyncRef.current?.close()
      await api.post(`/live/rooms/${roomCode}/end`)
    } catch {}

    navigate('/teacher/dashboard')
  }

  // Simulations for testing
  const simulateBroadcast = (sampleText: string) => {
    sendSpeech(sampleText)
  }

  const simulateIncomingDoubt = (isVoice: boolean) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const studentName = isVoice ? 'Priya Sundaram (Tamil)' : 'Aarav Patel (Hindi)'
    const questionText = isVoice
      ? '🎙️ [Spoken Doubt] "Sir, how does water evaporate without boiling?"'
      : 'Why do clouds look dark before heavy rainfall? (बादल काले क्यों दिखते हैं?)'

    const simDoubt: StudentDoubt = {
      id: `sim_${Date.now()}`,
      student_name: studentName,
      question: questionText,
      student_lang: isVoice ? 'ta' : 'hi',
      translated_question: questionText,
      timestamp: nowTime,
      is_voice: isVoice, // EXACT FLAG
    }

    setDoubts((prev) => [simDoubt, ...prev])
  }

  // ROOM CREATION SCREEN
  if (!inRoom) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <Link to="/teacher/dashboard" className="text-xs text-slate-400 hover:text-white">
              ← Dashboard
            </Link>
            <span className="text-[11px] bg-rose-500/20 text-rose-400 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              Live Broadcast
            </span>
          </div>

          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary-600/20 text-primary-400 flex items-center justify-center text-3xl mx-auto mb-3">
              🎙️
            </div>
            <h1 className="text-xl font-bold">Start Live Classroom</h1>
            <p className="text-xs text-slate-400 mt-1">
              Host a smart live meeting. Your speech is instantly dubbed in students' mother tongues!
            </p>
          </div>

          <form onSubmit={handleStartClass} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Lesson Topic
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-primary-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-amber-300 text-center focus:border-primary-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 mt-4"
            >
              <span>🔴</span>
              <span>{loading ? 'Creating Classroom...' : 'Start Live Meeting Now'}</span>
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ACTIVE TEACHER GOOGLE MEET STYLE CLASSROOM VIEW
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* 1. TOP MEETING HEADER */}
      <header className="h-14 bg-slate-900/90 border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            HOSTING LIVE
          </span>

          <div className="hidden sm:block">
            <h1 className="text-xs font-bold text-white truncate max-w-sm">{title}</h1>
          </div>

          {/* Room Code Badge */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(roomCode)
              alert(`Room code ${roomCode} copied!`)
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-mono font-bold text-amber-300 transition"
            title="Click to copy room code"
          >
            <span>Room: {roomCode}</span>
            <span className="text-slate-400 text-[10px]">📋</span>
          </button>
        </div>

        {/* Right Header: Fast Mic Mode & End Class */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center bg-slate-800 rounded-lg p-0.5 text-[11px] border border-slate-700">
            <button
              onClick={() => setAsrEngine('browser')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                asrEngine === 'browser' ? 'bg-primary-600 text-white' : 'text-slate-400'
              }`}
            >
              ⚡ Fast Mic
            </button>
            <button
              onClick={() => setAsrEngine('server')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                asrEngine === 'server' ? 'bg-primary-600 text-white' : 'text-slate-400'
              }`}
            >
              🧠 Whisper
            </button>
          </div>

          <button
            onClick={handleEndClass}
            disabled={ending}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow"
          >
            <span>⏹</span>
            <span>{ending ? 'Ending...' : 'End Class'}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN MEETING STAGE */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Host Presentation & Video Canvas */}
        <div className="flex-1 p-3 sm:p-5 flex flex-col min-w-0">
          <div className="relative w-full flex-1 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800/80 shadow-2xl flex flex-col">
            {/* Hidden Video element for webcam capture */}
            <video ref={teacherVideoRef} autoPlay playsInline muted className="hidden" />

            {/* Whiteboard / Presentation Canvas */}
            <canvas
              ref={teacherCanvasRef}
              width={720}
              height={420}
              className="w-full flex-1 object-cover"
            />

            {/* Quick Broadcast Bar directly under video */}
            <div className="bg-slate-950/95 border-t border-slate-800 p-3 flex gap-2 items-center">
              <button
                onClick={toggleMic}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md ${
                  isListening
                    ? 'bg-rose-600 text-white ring-2 ring-rose-500 animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <span>{isListening ? '🎙️ Speaking Live...' : '🎤 Start Mic'}</span>
                {isListening && (
                  <span className="text-[10px] font-mono bg-black/30 px-1.5 py-0.5 rounded">
                    VU: {audioLevel}%
                  </span>
                )}
              </button>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendSpeech(speechInput)
                }}
                className="flex-1 flex gap-2"
              >
                <input
                  type="text"
                  value={speechInput}
                  onChange={(e) => setSpeechInput(e.target.value)}
                  placeholder="Or type a sentence and broadcast live to all students..."
                  className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-primary-500"
                />
                <button
                  type="submit"
                  disabled={!speechInput.trim()}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition"
                >
                  Broadcast
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* 3. RIGHT MEETING DRAWER (Doubts, Students, Transcript, Simulation) */}
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
                {doubts.length > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                    {doubts.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('students')}
                className={`flex-1 py-3 text-center transition flex items-center justify-center gap-1 border-b-2 ${
                  activeTab === 'students'
                    ? 'border-primary-500 text-primary-400 bg-slate-900'
                    : 'border-transparent hover:text-white'
                }`}
              >
                <span>👥 Students ({students.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('transcript')}
                className={`flex-1 py-3 text-center transition flex items-center justify-center gap-1 border-b-2 ${
                  activeTab === 'transcript'
                    ? 'border-primary-500 text-primary-400 bg-slate-900'
                    : 'border-transparent hover:text-white'
                }`}
              >
                <span>📝 Transcript</span>
              </button>

              <button
                onClick={() => setActiveTab('simulation')}
                className={`py-3 px-3 text-center transition flex items-center justify-center border-b-2 ${
                  activeTab === 'simulation'
                    ? 'border-amber-500 text-amber-400 bg-slate-900'
                    : 'border-transparent hover:text-white text-slate-400'
                }`}
                title="Simulation Tools"
              >
                <span>⚡ Test</span>
              </button>
            </div>

            {/* TAB 1: STUDENT DOUBTS (With PROPER Text vs Voice classification) */}
            {activeTab === 'doubts' && (
              <div className="flex-1 p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Live Doubts from Students</span>
                  <span className="text-[11px] text-slate-400">{doubts.length} pending</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                  {doubts.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs italic text-center p-4">
                      When students ask questions in their mother tongue, they will appear translated here in real time!
                    </div>
                  ) : (
                    doubts.map((d, idx) => (
                      <div
                        key={d.id || idx}
                        className="p-3 bg-slate-950 rounded-xl border border-amber-500/30 space-y-2"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-amber-300 flex items-center gap-1.5">
                            <span>{d.student_name}</span>
                            <span className="text-[9px] bg-slate-800 px-1.5 py-0.2 rounded font-mono uppercase">
                              {d.student_lang}
                            </span>
                          </span>

                          {/* PROPER TEXT VS VOICE BADGE */}
                          {d.is_voice ? (
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
                        </div>

                        <p className="text-slate-200 text-xs font-semibold leading-relaxed">
                          {d.translated_question || d.question}
                        </p>

                        {/* Answer Doubt Action */}
                        {activeAnswerDoubtId === d.id ? (
                          <div className="pt-2 border-t border-slate-800 space-y-2">
                            <input
                              type="text"
                              value={answerText}
                              onChange={(e) => setAnswerText(e.target.value)}
                              placeholder={`Answer to ${d.student_name}...`}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setActiveAnswerDoubtId(null)}
                                className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleAnswerDoubt(d)}
                                className="px-3 py-1 bg-primary-600 hover:bg-primary-500 text-white font-bold text-[11px] rounded"
                              >
                                Send Answer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] text-slate-500">{d.timestamp}</span>
                            <button
                              onClick={() => {
                                setActiveAnswerDoubtId(d.id || `${idx}`)
                                setAnswerText(`Regarding your doubt: `)
                              }}
                              className="px-2.5 py-1 bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 border border-primary-500/30 rounded text-[11px] font-bold transition"
                            >
                              ✍️ Answer Doubt
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CONNECTED STUDENTS */}
            {activeTab === 'students' && (
              <div className="flex-1 p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Connected Students</span>
                  <span className="text-[11px] text-emerald-400 font-bold">● {students.length} Online</span>
                </div>

                <div className="space-y-2 overflow-y-auto flex-1 pr-1 text-xs">
                  {students.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-white">{s.name}</p>
                        <p className="text-[10px] text-slate-400">Joined at {s.joined_at}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                        {s.language}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: SPOKEN TRANSCRIPT FEED */}
            {activeTab === 'transcript' && (
              <div className="flex-1 p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Spoken Broadcast Transcript</span>
                  <span className="text-[11px] text-slate-500 font-mono">{transcriptFeed.length} sent</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                  {transcriptFeed.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1"
                    >
                      <span className="text-[10px] font-mono text-primary-400">{item.time}</span>
                      <p className="text-slate-200 text-xs leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: TEACHER SIMULATION & TESTING */}
            {activeTab === 'simulation' && (
              <div className="flex-1 p-4 flex flex-col space-y-3 overflow-y-auto text-xs">
                <div className="pb-2 border-b border-slate-800">
                  <h3 className="font-bold text-white flex items-center gap-1.5">
                    <span>⚡ Teacher Simulation Toolbar</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Broadcast speech and test how student doubts arrive!
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    1. 1-Click Broadcast Topics:
                  </span>
                  <button
                    onClick={() =>
                      simulateBroadcast(
                        'The sun warms water in rivers and oceans. This water evaporates into invisible vapor!'
                      )
                    }
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 transition flex items-center gap-2"
                  >
                    <span>🌊</span>
                    <div>
                      <p className="font-bold text-slate-200">Broadcast: Water Evaporation</p>
                      <p className="text-[10px] text-slate-400">Streams live to student with Hindi/Tamil translation</p>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      simulateBroadcast(
                        'As vapor rises into the cold air it condenses to form clouds, and falls as rain precipitation.'
                      )
                    }
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 transition flex items-center gap-2"
                  >
                    <span>🌧️</span>
                    <div>
                      <p className="font-bold text-slate-200">Broadcast: Cloud Condensation & Rain</p>
                      <p className="text-[10px] text-slate-400">Lip-synced with delayed video buffer</p>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      simulateBroadcast(
                        'Plants absorb water and minerals through their roots, and green leaves trap sunlight for food.'
                      )
                    }
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 transition flex items-center gap-2"
                  >
                    <span>🌱</span>
                    <div>
                      <p className="font-bold text-slate-200">Broadcast: Plant Roots & Sunlight</p>
                      <p className="text-[10px] text-slate-400">Biology core primary syllabus</p>
                    </div>
                  </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    2. Simulate Incoming Student Doubts:
                  </span>
                  <button
                    onClick={() => simulateIncomingDoubt(false)}
                    className="w-full text-left p-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 font-bold transition flex items-center gap-2"
                  >
                    <span>💬</span>
                    <span>Simulate Incoming Text Doubt</span>
                  </button>

                  <button
                    onClick={() => simulateIncomingDoubt(true)}
                    className="w-full text-left p-2 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 font-bold transition flex items-center gap-2"
                  >
                    <span>🎙️</span>
                    <span>Simulate Incoming Voice Doubt</span>
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* 4. GOOGLE MEET STYLE BOTTOM MEETING CONTROLS */}
      <footer className="h-20 bg-slate-950/95 border-t border-slate-800/80 px-4 sm:px-8 flex items-center justify-between z-20 backdrop-blur-md">
        <div className="hidden md:flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-slate-400">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-xs text-slate-500">|</span>
          <span className="text-xs font-bold text-slate-300">{roomCode}</span>
        </div>

        {/* Center Controls */}
        <div className="flex items-center gap-3 sm:gap-4 mx-auto md:mx-0">
          <button
            onClick={toggleMic}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition shadow-md ${
              isListening
                ? 'bg-rose-600 text-white ring-4 ring-rose-500/30 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={isListening ? 'Turn Microphone Off' : 'Turn Microphone On'}
          >
            {isListening ? '🎙️' : '🎤'}
          </button>

          <button
            onClick={() => setCameraOn(!cameraOn)}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition shadow-md ${
              !cameraOn
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Toggle Camera"
          >
            {cameraOn ? '📹' : '📷'}
          </button>

          {/* End Call */}
          <button
            onClick={handleEndClass}
            className="px-5 h-11 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
            title="End Meeting"
          >
            <span>📞</span>
            <span className="hidden sm:inline">End Meeting</span>
          </button>
        </div>

        {/* Right Drawer Toggles */}
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
            title="Student Doubts"
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
