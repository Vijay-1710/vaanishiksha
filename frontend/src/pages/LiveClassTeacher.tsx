import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'
import { LiveSyncManager, LiveMessage } from '../lib/liveSync'

interface StudentInfo {
  name: string
  language: string
  joined_at: string
}

interface StudentDoubt {
  student_name: string
  question: string
  student_lang: string
  translated_question: string
  audio_url?: string
  original_audio_url?: string
  timestamp: string
}

export default function LiveClassTeacher() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Room setup state
  const [inRoom, setInRoom] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [title, setTitle] = useState('Primary Science: Plant Biology & Water Cycle')
  const [subject, setSubject] = useState('Science')
  const [gradeLevel, setGradeLevel] = useState(5)
  const [loading, setLoading] = useState(false)

  // Live session state
  const [isListening, setIsListening] = useState(false)
  const [speechInput, setSpeechInput] = useState('')
  const [transcriptFeed, setTranscriptFeed] = useState<Array<{ text: string; time: string }>>([])
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [doubts, setDoubts] = useState<StudentDoubt[]>([])
  const [ending, setEnding] = useState(false)

  // Audio In mode & state
  const [asrEngine, setAsrEngine] = useState<'browser' | 'server'>('browser')
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0) // 0 - 100 for VU visualizer
  const [currentlyPlayingDoubt, setCurrentlyPlayingDoubt] = useState<string | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const activeAudioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const liveSyncRef = useRef<LiveSyncManager | null>(null)

  // Initialize SpeechRecognition if available in browser
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
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

      recognition.onerror = (err: any) => {
        console.warn('SpeechRecognition error:', err)
        // Automatically suggest or fall back to server ASR if browser speech fails
        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
          setAsrEngine('server')
        }
      }

      recognition.onend = () => {
        // If still supposed to be listening in browser mode, restart automatically
        if (isListening && asrEngine === 'browser') {
          try {
            recognition.start()
          } catch (e) {}
        }
      }

      recognitionRef.current = recognition
    } else {
      // Browser doesn't have Web Speech API; default to server Whisper ASR
      setAsrEngine('server')
    }

    return () => {
      stopAudioCapture()
    }
  }, [isListening, asrEngine])

  // Setup / Teardown MediaStream and AudioContext for VU meter & Server Whisper recording
  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Setup Web Audio Analyser for real-time VU meter
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
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const average = sum / dataArray.length
        setAudioLevel(Math.min(100, Math.round((average / 128) * 100)))
        animFrameRef.current = requestAnimationFrame(updateVolume)
      }
      updateVolume()

      // If Server Whisper ASR is selected, setup MediaRecorder with periodic chunks
      if (asrEngine === 'server') {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
        const recorder = new MediaRecorder(stream, { mimeType })
        let chunks: BlobPart[] = []

        recorder.ondataavailable = async (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data)
            const audioBlob = new Blob(chunks, { type: 'audio/webm' })
            chunks = []

            if (audioBlob.size > 3000 && socketRef.current?.readyState === WebSocket.OPEN) {
              setIsProcessingAudio(true)
              const reader = new FileReader()
              reader.onloadend = () => {
                const base64Data = (reader.result as string).split(',')[1]
                if (base64Data && socketRef.current) {
                  socketRef.current.send(
                    JSON.stringify({
                      type: 'audio_data',
                      audio_base64: base64Data,
                      format: 'webm',
                      language: 'en',
                    })
                  )
                }
                setTimeout(() => setIsProcessingAudio(false), 800)
              }
              reader.readAsDataURL(audioBlob)
            }
          }
        }

        // Record in 3.5s conversational slices for real-time transcription
        recorder.start(3500)
        mediaRecorderRef.current = recorder
      }
    } catch (err) {
      console.error('Microphone access error:', err)
      alert('Could not access microphone. Please verify microphone permissions in your browser.')
      setIsListening(false)
    }
  }

  const stopAudioCapture = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    setAudioLevel(0)

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
      } catch (e) {}
      mediaRecorderRef.current = null
    }
  }

  const toggleMic = async () => {
    if (isListening) {
      if (recognitionRef.current && asrEngine === 'browser') {
        try {
          recognitionRef.current.stop()
        } catch (e) {}
      }
      stopAudioCapture()
      setIsListening(false)
    } else {
      setIsListening(true)
      await startAudioCapture()
      if (asrEngine === 'browser' && recognitionRef.current) {
        try {
          recognitionRef.current.start()
        } catch (err) {
          console.warn('Browser SpeechRecognition failed to start:', err)
          // Fall back to server Whisper ASR
          setAsrEngine('server')
        }
      }
    }
  }

  // Create room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/live/rooms/create', {
        title,
        subject,
        grade_level: gradeLevel,
        original_language: 'en',
      })
      const code = res.data.room_code
      setRoomCode(code)
      setInRoom(true)
      connectWebSocket(code)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create live room')
    } finally {
      setLoading(false)
    }
  }

  const connectWebSocket = (code: string) => {
    // 1. Initialize real-time cross-tab and cross-device LiveSyncManager
    liveSyncRef.current?.close()
    liveSyncRef.current = new LiveSyncManager(
      code,
      user?.full_name || 'Dr. Ramesh Sharma',
      'teacher',
      (msg: LiveMessage) => {
        if (msg.type === 'student_join') {
          const sName = msg.payload?.name || msg.senderName
          setStudents((prev) => {
            if (prev.some((s) => s.name === sName)) return prev
            return [
              ...prev,
              {
                name: sName,
                language: msg.payload?.language || 'hi',
                joined_at: new Date(msg.timestamp).toLocaleTimeString(),
              },
            ]
          })
        } else if (msg.type === 'student_doubt') {
          const doubt = msg.payload?.doubt || {
            student_name: msg.senderName,
            question: msg.payload?.question || 'Question asked',
            student_lang: msg.payload?.language || 'hi',
            translated_question: msg.payload?.question || 'Question asked',
            timestamp: new Date(msg.timestamp).toLocaleTimeString(),
          }
          setDoubts((prev) => [doubt, ...prev])
        }
      }
    )

    // 2. Also try native WebSocket if available
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/live/ws/${code}/teacher`
      const ws = new WebSocket(wsUrl)
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'roster_update') {
            setStudents(data.students || [])
          } else if (data.type === 'speech_ack') {
            setTranscriptFeed((prev) => [
              ...prev,
              { text: data.text, time: data.timestamp || new Date().toLocaleTimeString() },
            ])
            setIsProcessingAudio(false)
          } else if (data.type === 'student_doubt') {
            setDoubts((prev) => [data.doubt, ...prev])
          }
        } catch (e) {
          // ignore
        }
      }
      socketRef.current = ws
    } catch (e) {
      // ignore
    }
  }

  const sendSpeech = (text: string) => {
    if (!text.trim()) return
    const trimmed = text.trim()
    const speechTime = new Date().toLocaleTimeString()

    // 1. Update local teacher transcript feed immediately
    setTranscriptFeed((prev) => [
      ...prev,
      { text: trimmed, time: speechTime },
    ])

    // 2. Broadcast to all student tabs and devices via LiveSyncManager
    liveSyncRef.current?.broadcast('teacher_speech', {
      text: trimmed,
      language: 'en',
      timestamp: speechTime,
    })

    // 3. Also send to WebSocket if open
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'speech',
          text: trimmed,
          language: 'en',
        })
      )
    }

    setSpeechInput('')
  }

  // Play doubt spoken audio (Audio Out on Teacher dashboard)
  const playDoubtAudio = (doubt: StudentDoubt, isOriginal: boolean = false) => {
    const audioUrl = isOriginal ? doubt.original_audio_url : doubt.audio_url
    if (!audioUrl) return

    if (activeAudioPlayerRef.current) {
      activeAudioPlayerRef.current.pause()
      activeAudioPlayerRef.current = null
      if (currentlyPlayingDoubt === `${doubt.timestamp}-${isOriginal}`) {
        setCurrentlyPlayingDoubt(null)
        return
      }
    }

    const playKey = `${doubt.timestamp}-${isOriginal}`
    setCurrentlyPlayingDoubt(playKey)
    const audio = new Audio(audioUrl)
    activeAudioPlayerRef.current = audio

    audio.onended = () => {
      setCurrentlyPlayingDoubt(null)
      activeAudioPlayerRef.current = null
    }

    audio.onerror = () => {
      setCurrentlyPlayingDoubt(null)
      activeAudioPlayerRef.current = null
    }

    audio.play().catch((err) => {
      console.warn('Audio playback error:', err)
      setCurrentlyPlayingDoubt(null)
    })
  }

  const handleEndClass = async () => {
    if (
      !confirm(
        'Are you sure you want to end this live class? The lesson will be automatically archived with transcripts and practice worksheets!'
      )
    ) {
      return
    }

    setEnding(true)
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop()
      } catch (e) {}
    }
    stopAudioCapture()
    setIsListening(false)

    try {
      liveSyncRef.current?.broadcast('class_ended', { lecture_id: 1 })
      liveSyncRef.current?.close()
      const res = await api.post(`/live/rooms/${roomCode}/end`)
      alert('Live class ended successfully! The lesson has been archived.')
      if (res.data.lecture_id) {
        navigate(`/lecture/${res.data.lecture_id}`)
      } else {
        navigate('/teacher/dashboard')
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to end live room')
      navigate('/teacher/dashboard')
    } finally {
      setEnding(false)
    }
  }

  // If not yet in a room, show creation form
  if (!inRoom) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-lg w-full shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <Link to="/teacher/dashboard" className="text-xs text-gray-500 hover:text-gray-700">
              ← Back to Dashboard
            </Link>
            <span className="text-xs bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              Live Broadcast
            </span>
          </div>

          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🎙️</div>
            <h1 className="text-2xl font-bold text-gray-900">Start a Live Classroom</h1>
            <p className="text-xs text-gray-500 mt-1">
              Speak into your microphone. Your words will be transcribed and translated in real
              time into your students' mother tongues with live audio!
            </p>
          </div>

          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                Class Topic / Lesson Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Science: Photosynthesis and Plant Growth"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Science, Maths"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Grade / Class
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
                    <option key={g} value={g}>
                      Class {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary flex items-center justify-center gap-2 py-3 mt-4 font-bold shadow-md"
            >
              <span>🔴</span>
              <span>{loading ? 'Creating Room...' : 'Go Live Now'}</span>
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Active Live Classroom View
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Top Classroom Bar */}
      <header className="bg-slate-800/90 border-b border-slate-700 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="font-extrabold text-rose-400 text-sm tracking-wide uppercase">
              LIVE
            </span>
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">{title}</h1>
            <p className="text-xs text-slate-400">
              Class {gradeLevel} • {subject} • Taught by {user?.full_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Audio Input Engine Switcher */}
          <div className="hidden sm:flex items-center bg-slate-950/70 border border-slate-700 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setAsrEngine('browser')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                asrEngine === 'browser'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Instant in-browser speech recognition"
            >
              ⚡ Fast Browser Mic
            </button>
            <button
              onClick={() => setAsrEngine('server')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                asrEngine === 'server'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Server-side neural Whisper ASR for all browsers"
            >
              🧠 Server Whisper ASR
            </button>
          </div>

          {/* Room Code Badge */}
          <div className="bg-slate-700/80 px-3 py-1.5 rounded-lg border border-slate-600 flex items-center gap-2">
            <span className="text-xs text-slate-400">Room Code:</span>
            <span className="font-mono font-bold text-amber-300 text-sm">{roomCode}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(roomCode)
                alert(`Copied room code: ${roomCode}`)
              }}
              title="Copy code"
              className="text-xs text-slate-400 hover:text-white"
            >
              📋
            </button>
          </div>

          <button
            onClick={handleEndClass}
            disabled={ending}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <span>⏹</span>
            <span>{ending ? 'Ending...' : 'End Class & Save'}</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Broadcaster & Transcript on Left, Students & Doubts on Right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 overflow-hidden">
        {/* Left Column: Mic control and Speech stream */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          {/* Mic Broadcaster Card */}
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 flex flex-col items-center justify-center text-center relative overflow-hidden">
            {/* Audio In Level Visualizer Bar */}
            {isListening && (
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-900">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75"
                  style={{ width: `${Math.max(5, audioLevel)}%` }}
                ></div>
              </div>
            )}

            <div className="mb-3 relative">
              <button
                onClick={toggleMic}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all shadow-lg ${
                  isListening
                    ? 'bg-rose-600 text-white ring-8 ring-rose-500/30 animate-pulse'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
              >
                {isListening ? '🎙️' : '🎤'}
              </button>

              {/* Sound wave badge indicator */}
              {isListening && (
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-slate-950 font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow">
                  {audioLevel > 15 ? 'SPEECH DETECTED' : 'LIVE'}
                </div>
              )}
            </div>

            <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
              <span>{isListening ? 'Microphone Active — Speaking Live' : 'Microphone Muted'}</span>
              {isProcessingAudio && (
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono animate-pulse">
                  Transcribing...
                </span>
              )}
            </h3>

            <p className="text-xs text-slate-400 max-w-md">
              {isListening
                ? asrEngine === 'server'
                  ? 'Server Whisper ASR is listening. Audio chunks are transcribed with neural precision and broadcast instantly.'
                  : 'Browser Speech Recognition is active. Speak clearly into your mic to broadcast live captions.'
                : 'Click the microphone above to start speaking, or type sentences below.'}
            </p>

            {/* Live Audio In Meter Indicator */}
            {isListening && (
              <div className="flex items-center gap-1.5 mt-3">
                <span className="text-[10px] uppercase font-bold text-slate-400">Audio In:</span>
                <div className="flex items-center gap-1 h-3">
                  {[...Array(12)].map((_, i) => (
                    <span
                      key={i}
                      className={`w-1 rounded-full transition-all duration-75 ${
                        audioLevel > i * 8
                          ? i > 8
                            ? 'bg-rose-500 h-3'
                            : i > 5
                            ? 'bg-amber-400 h-2.5'
                            : 'bg-emerald-400 h-2'
                          : 'bg-slate-700 h-1'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quick manual speech box */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendSpeech(speechInput)
              }}
              className="w-full mt-4 flex gap-2 max-w-xl"
            >
              <input
                type="text"
                value={speechInput}
                onChange={(e) => setSpeechInput(e.target.value)}
                placeholder="Or type a sentence and hit enter to broadcast..."
                className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-primary-500"
              />
              <button type="submit" className="btn btn-primary text-xs px-4">
                Broadcast
              </button>
            </form>
          </div>

          {/* Live Transcript Stream */}
          <div className="flex-1 bg-slate-800 rounded-2xl p-5 border border-slate-700 flex flex-col overflow-hidden min-h-[300px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-3">
              <h3 className="font-bold text-sm text-slate-300 flex items-center gap-2">
                <span>📝</span>
                <span>Live Speech Transcript (Broadcasting to Students)</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {transcriptFeed.length} sentences spoke
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-2">
              {transcriptFeed.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                  Turn on your microphone or type a sentence above to begin teaching.
                </div>
              ) : (
                transcriptFeed.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-900/80 rounded-xl border border-slate-700/60 flex items-start gap-3"
                  >
                    <span className="text-[10px] font-mono text-primary-400 bg-slate-800 px-2 py-0.5 rounded">
                      {item.time}
                    </span>
                    <p className="text-sm text-slate-200 leading-relaxed">{item.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Connected Students & Live Q&A */}
        <div className="flex flex-col space-y-4">
          {/* Connected Students Roster */}
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                Connected Students ({students.length})
              </h3>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                Online
              </span>
            </div>

            {students.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                Share Classroom Code <strong className="text-amber-300">{roomCode}</strong> with
                students to join.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {students.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-slate-900 rounded-lg text-xs"
                  >
                    <span className="font-medium text-slate-200">{s.name}</span>
                    <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                      {s.language}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Student Doubts & Q&A */}
          <div className="flex-1 bg-slate-800 rounded-2xl p-4 border border-slate-700 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>💬</span>
                <span>Student Doubts & Questions ({doubts.length})</span>
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {doubts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs italic text-center p-4">
                  When students ask questions in their mother tongue, they will appear translated
                  here in real time with Audio Out playback.
                </div>
              ) : (
                doubts.map((d, idx) => {
                  const isPlayingTrans = currentlyPlayingDoubt === `${d.timestamp}-false`
                  const isPlayingOrig = currentlyPlayingDoubt === `${d.timestamp}-true`

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-900 rounded-xl border border-amber-500/30 text-xs flex flex-col space-y-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-amber-400 flex items-center gap-1.5">
                          <span>{d.student_name}</span>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-normal">
                            {d.student_lang.toUpperCase()}
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-500">{d.timestamp}</span>
                      </div>

                      <p className="text-slate-200 font-semibold leading-relaxed">
                        {d.translated_question}
                      </p>

                      {d.question !== d.translated_question && (
                        <p className="text-[11px] text-slate-400 italic">
                          Original ({d.student_lang}): "{d.question}"
                        </p>
                      )}

                      {/* Audio Out Actions for Doubt */}
                      <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                        <button
                          onClick={() => playDoubtAudio(d, false)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 ${
                            isPlayingTrans
                              ? 'bg-amber-400 text-slate-900'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                          }`}
                        >
                          <span>{isPlayingTrans ? '⏹ Stop' : '🔊 Listen (English)'}</span>
                        </button>

                        <button
                          onClick={() => playDoubtAudio(d, true)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 ${
                            isPlayingOrig
                              ? 'bg-amber-400 text-slate-900'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span>{isPlayingOrig ? '⏹ Stop' : '🎧 Student Voice'}</span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
