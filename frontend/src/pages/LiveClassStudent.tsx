import React, { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'

const LANGUAGES: Record<string, string> = {
  hi: 'हिन्दी (Hindi)',
  ta: 'தமிழ் (Tamil)',
  te: 'తెలుగు (Telugu)',
  kn: 'ಕನ್ನಡ (Kannada)',
  bn: 'বাংলা (Bengali)',
  en: 'English',
}

const VOICE_LANG_MAP: Record<string, string> = {
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  bn: 'bn-IN',
  en: 'en-IN',
}

interface CaptionItem {
  original_text: string
  translated_text: string
  audio_url?: string
  timestamp: string
}

export default function LiveClassStudent() {
  const { roomCode: paramCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [roomCode, setRoomCode] = useState(paramCode || '')
  const [inRoom, setInRoom] = useState(Boolean(paramCode))
  const [roomMeta, setRoomMeta] = useState<any>(null)
  const [selectedLanguage, setSelectedLanguage] = useState(user?.preferred_language || 'hi')

  // Audio Out controls
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [volume, setVolume] = useState(1.0)
  const [ttsEngine, setTtsEngine] = useState<'server' | 'browser'>('server')
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null)

  // Real-time caption state
  const [captions, setCaptions] = useState<CaptionItem[]>([])
  const [currentCaption, setCurrentCaption] = useState<CaptionItem | null>(null)

  // Doubts state
  const [doubtText, setDoubtText] = useState('')
  const [myDoubts, setMyDoubts] = useState<Array<{ text: string; time: string; isVoice?: boolean }>>([])
  const [showOriginal, setShowOriginal] = useState(false)

  // Student Audio In (Voice Doubt) state
  const [isRecordingDoubt, setIsRecordingDoubt] = useState(false)
  const [doubtRecordingTime, setDoubtRecordingTime] = useState(0)
  const [isSubmittingVoiceDoubt, setIsSubmittingVoiceDoubt] = useState(false)

  // Class ended state
  const [endedLectureId, setEndedLectureId] = useState<number | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const captionsEndRef = useRef<HTMLDivElement>(null)

  // Audio Queue refs
  const audioQueueRef = useRef<string[]>([])
  const isAudioPlayingRef = useRef<boolean>(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  // MediaRecorder refs for Student Audio In
  const doubtRecorderRef = useRef<MediaRecorder | null>(null)
  const doubtTimerRef = useRef<any>(null)

  // Auto-scroll captions
  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [captions])

  // Join room automatically if paramCode exists
  useEffect(() => {
    if (paramCode) {
      joinRoom(paramCode)
    }
  }, [paramCode])

  const joinRoom = async (code: string) => {
    const cleanCode = code.trim().toUpperCase()
    try {
      const res = await api.get(`/live/rooms/${cleanCode}`)
      setRoomMeta(res.data)
      setRoomCode(cleanCode)
      setInRoom(true)
      connectWebSocket(cleanCode, selectedLanguage)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Live room not found or class has ended.')
    }
  }

  const connectWebSocket = (code: string, lang: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const studentName = encodeURIComponent(user?.full_name || 'Student')
    const wsUrl = `${protocol}//${window.location.host}/api/live/ws/${code}/student?name=${studentName}&language=${lang}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('Student WS connected to room', code)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'welcome') {
          if (data.recent_transcripts && data.recent_transcripts.length > 0) {
            setCaptions(data.recent_transcripts)
            setCurrentCaption(data.recent_transcripts[data.recent_transcripts.length - 1])
          }
        } else if (data.type === 'live_caption') {
          const item: CaptionItem = {
            original_text: data.original_text,
            translated_text: data.translated_text,
            audio_url: data.audio_url,
            timestamp: data.timestamp,
          }
          setCaptions((prev) => [...prev, item])
          setCurrentCaption(item)

          // Play audio in mother tongue if audio is enabled
          if (audioEnabled) {
            if (ttsEngine === 'server' && item.audio_url) {
              enqueueAudio(item.audio_url)
            } else if ('speechSynthesis' in window) {
              speakTranslatedText(item.translated_text, selectedLanguage)
            }
          }
        } else if (data.type === 'doubt_sent') {
          setMyDoubts((prev) => [
            { text: data.question, time: new Date().toLocaleTimeString(), isVoice: true },
            ...prev,
          ])
          setIsSubmittingVoiceDoubt(false)
        } else if (data.type === 'class_ended') {
          setEndedLectureId(data.lecture_id)
        }
      } catch (e) {
        console.error('WS message error:', e)
      }
    }

    ws.onclose = () => {
      console.log('Student WS disconnected')
    }

    socketRef.current = ws
  }

  // Audio Out Queue processor: plays sentences smoothly one by one without overlap
  const enqueueAudio = (url: string) => {
    audioQueueRef.current.push(url)
    processAudioQueue()
  }

  const processAudioQueue = () => {
    if (isAudioPlayingRef.current || audioQueueRef.current.length === 0) {
      return
    }

    const nextUrl = audioQueueRef.current.shift()
    if (!nextUrl) return

    isAudioPlayingRef.current = true
    setIsPlayingAudio(true)

    const audio = new Audio(nextUrl)
    audio.volume = volume
    currentAudioRef.current = audio

    audio.onended = () => {
      isAudioPlayingRef.current = false
      setIsPlayingAudio(false)
      currentAudioRef.current = null
      processAudioQueue()
    }

    audio.onerror = () => {
      isAudioPlayingRef.current = false
      setIsPlayingAudio(false)
      currentAudioRef.current = null
      processAudioQueue()
    }

    audio.play().catch((err) => {
      console.warn('Playback blocked or failed:', err)
      isAudioPlayingRef.current = false
      setIsPlayingAudio(false)
      processAudioQueue()
    })
  }

  // Synthesize translated speech using Web Speech API as fallback
  const speakTranslatedText = (text: string, langCode: string) => {
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = VOICE_LANG_MAP[langCode] || 'hi-IN'
      utterance.volume = volume
      utterance.rate = 1.0

      const voices = window.speechSynthesis.getVoices()
      const targetLang = VOICE_LANG_MAP[langCode]
      const matchedVoice = voices.find((v) => v.lang.startsWith(targetLang?.slice(0, 2) || 'hi'))
      if (matchedVoice) {
        utterance.voice = matchedVoice
      }

      setIsPlayingAudio(true)
      utterance.onend = () => setIsPlayingAudio(false)
      utterance.onerror = () => setIsPlayingAudio(false)

      window.speechSynthesis.speak(utterance)
    } catch (err) {
      console.warn('Speech synthesis error:', err)
      setIsPlayingAudio(false)
    }
  }

  // Play or replay an individual sentence directly
  const playSentenceAudio = (caption: CaptionItem, index: number) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    window.speechSynthesis.cancel()

    setActiveSentenceIndex(index)
    setIsPlayingAudio(true)

    if (caption.audio_url && ttsEngine === 'server') {
      const audio = new Audio(caption.audio_url)
      audio.volume = volume
      currentAudioRef.current = audio

      audio.onended = () => {
        setIsPlayingAudio(false)
        setActiveSentenceIndex(null)
      }
      audio.onerror = () => {
        setIsPlayingAudio(false)
        setActiveSentenceIndex(null)
      }
      audio.play().catch(() => {
        setIsPlayingAudio(false)
        setActiveSentenceIndex(null)
      })
    } else {
      speakTranslatedText(caption.translated_text, selectedLanguage)
      setTimeout(() => {
        setActiveSentenceIndex(null)
      }, 3000)
    }
  }

  // Handle mid-class language change
  const handleLanguageChange = (newLang: string) => {
    setSelectedLanguage(newLang)
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'change_language',
          language: newLang,
        })
      )
    }
  }

  // Send Text Doubt
  const handleSendDoubt = (e: React.FormEvent) => {
    e.preventDefault()
    if (!doubtText.trim() || !socketRef.current) return
    socketRef.current.send(
      JSON.stringify({
        type: 'ask_doubt',
        question: doubtText.trim(),
      })
    )
    setMyDoubts((prev) => [
      { text: doubtText.trim(), time: new Date().toLocaleTimeString(), isVoice: false },
      ...prev,
    ])
    setDoubtText('')
  }

  // Student Audio In: Voice Doubt Recording (Microphone)
  const startDoubtRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        setIsSubmittingVoiceDoubt(true)

        // Convert audioBlob to base64 and send via WS audio_doubt
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64Data = (reader.result as string).split(',')[1]
          if (base64Data && socketRef.current) {
            socketRef.current.send(
              JSON.stringify({
                type: 'audio_doubt',
                audio_base64: base64Data,
                format: 'webm',
                language: selectedLanguage,
              })
            )
          }
        }
        reader.readAsDataURL(audioBlob)
      }

      doubtRecorderRef.current = recorder
      recorder.start()
      setIsRecordingDoubt(true)
      setDoubtRecordingTime(0)

      doubtTimerRef.current = setInterval(() => {
        setDoubtRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Mic access error for doubt:', err)
      alert('Could not access microphone. Please enable microphone permissions in your browser.')
    }
  }

  const stopDoubtRecording = () => {
    if (doubtRecorderRef.current && isRecordingDoubt) {
      doubtRecorderRef.current.stop()
      setIsRecordingDoubt(false)
      clearInterval(doubtTimerRef.current)
    }
  }

  // Room Join Screen
  if (!inRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full shadow-lg border border-gray-100">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🎓</div>
            <h1 className="text-2xl font-bold text-gray-900">Join Live Classroom</h1>
            <p className="text-xs text-gray-500 mt-1">
              Listen to your teacher in your mother tongue with synchronized live subtitles and audio!
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              joinRoom(roomCode)
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                Classroom Code
              </label>
              <input
                type="text"
                required
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. SCI-501"
                className="w-full px-4 py-2.5 border rounded-xl font-mono text-center text-lg font-bold tracking-wider focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                Your Mother Tongue / अपनी भाषा चुनें
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none"
              >
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full btn btn-primary flex items-center justify-center gap-2 py-3 mt-4 font-bold shadow-md"
            >
              <span>🎧</span>
              <span>Join Class & Listen Live</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <Link to="/student/dashboard" className="text-xs text-gray-500 hover:text-gray-700">
              ← Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Active Reception Classroom Screen
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link to="/student/dashboard" className="text-xs text-slate-400 hover:text-white mr-2">
            ← Dashboard
          </Link>
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">
              {roomMeta?.title || 'Live Classroom'}
            </h1>
            <p className="text-[11px] text-slate-400">
              Taught by {roomMeta?.teacher_name || 'Teacher'} • Room: {roomCode}
            </p>
          </div>
        </div>

        {/* Audio & Language Controls */}
        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 hidden sm:inline">My Language:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-slate-800 text-amber-300 font-bold border border-slate-700 rounded-lg px-2.5 py-1 text-xs outline-none"
            >
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Engine Toggle */}
          <div className="hidden md:flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setTtsEngine('server')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                ttsEngine === 'server'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Studio-quality native Indian pronunciation"
            >
              💎 Native HD Voice
            </button>
            <button
              onClick={() => setTtsEngine('browser')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                ttsEngine === 'browser'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Device built-in speech engine"
            >
              💻 Browser Voice
            </button>
          </div>

          {/* Audio Output Mute Toggle & Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAudioEnabled(!audioEnabled)
                if (audioEnabled) {
                  window.speechSynthesis.cancel()
                  if (currentAudioRef.current) {
                    currentAudioRef.current.pause()
                  }
                  audioQueueRef.current = []
                }
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                audioEnabled
                  ? isPlayingAudio
                    ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400 animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <span>{audioEnabled ? (isPlayingAudio ? '🔊 Speaking...' : '🔊 Audio ON') : '🔇 Muted'}</span>
            </button>

            {audioEnabled && (
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400 hidden sm:block"
                title={`Volume: ${Math.round(volume * 100)}%`}
              />
            )}
          </div>
        </div>
      </header>

      {/* Class Ended Banner Modal */}
      {endedLectureId && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 text-center shadow-lg flex items-center justify-center gap-4">
          <div>
            <span className="font-extrabold text-sm block">🎉 This live class has concluded!</span>
            <span className="text-xs opacity-90">
              The full session has been archived. You can now re-listen and practice the auto-generated worksheets.
            </span>
          </div>
          <button
            onClick={() => navigate(`/lecture/${endedLectureId}`)}
            className="btn bg-white text-emerald-800 font-bold text-xs px-4 py-2 hover:bg-emerald-50 shadow-sm"
          >
            Open Lesson & Quiz →
          </button>
        </div>
      )}

      {/* Main Classroom Content */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col space-y-6">
        {/* Prominent Live Subtitle Card (Classroom Projection Mode) */}
        <div className="bg-slate-900 border-2 border-primary-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
            <span className="flex items-center gap-2 font-bold text-primary-400 uppercase tracking-wider text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-400 animate-ping"></span>
              Live Mother-Tongue Subtitles ({LANGUAGES[selectedLanguage] || selectedLanguage})
            </span>
            <div className="flex items-center gap-3">
              {currentCaption && (
                <button
                  onClick={() => playSentenceAudio(currentCaption, captions.length - 1)}
                  className="bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 border border-primary-500/40 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <span>🔊 Re-listen</span>
                </button>
              )}
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                {showOriginal ? 'Hide Original English' : 'Show Original English'}
              </button>
            </div>
          </div>

          {currentCaption ? (
            <div className="space-y-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-relaxed tracking-tight">
                {currentCaption.translated_text}
              </h2>
              {showOriginal && (
                <p className="text-sm text-slate-400 italic pt-2 border-t border-slate-800">
                  Original: "{currentCaption.original_text}"
                </p>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-sm italic">
              Listening to teacher... Captions and spoken translations will stream here in real time.
            </div>
          )}
        </div>

        {/* Two Column Row: Live Transcript History & Doubt Asking */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
          {/* Live Transcript Stream (2 cols) */}
          <div className="md:col-span-2 bg-slate-900/80 rounded-2xl border border-slate-800 p-4 flex flex-col max-h-[380px]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 mb-2 border-b border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>📜</span>
                <span>Live Class Transcript History</span>
              </span>
              <span className="text-[11px] text-slate-500">{captions.length} sentences</span>
            </h3>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 text-xs">
              {captions.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                  No sentences transcribed yet.
                </div>
              ) : (
                captions.map((c, idx) => {
                  const isActive = activeSentenceIndex === idx
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-primary-950/60 border-primary-500/60'
                          : 'bg-slate-950/60 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span className="font-semibold text-slate-400">Teacher • {c.timestamp}</span>
                        <button
                          onClick={() => playSentenceAudio(c, idx)}
                          title="Replay this sentence"
                          className="text-amber-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1"
                        >
                          <span>{isActive ? '🔊 Playing...' : '▶ Listen'}</span>
                        </button>
                      </div>
                      <p className="text-slate-200 font-medium text-sm leading-relaxed">
                        {c.translated_text}
                      </p>
                      {showOriginal && (
                        <p className="text-[11px] text-slate-500 italic mt-1">"{c.original_text}"</p>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={captionsEndRef} />
            </div>
          </div>

          {/* Ask Doubt Box (1 col) with Mother-Tongue Audio In */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 mb-3 border-b border-slate-800 flex items-center gap-1.5">
                <span>💬</span>
                <span>Ask Teacher a Doubt</span>
              </h3>
              <p className="text-xs text-slate-400 mb-3 leading-normal">
                Ask your question in <strong>{LANGUAGES[selectedLanguage]}</strong>. Your teacher
                will receive it translated with audio!
              </p>

              {/* Student Voice Doubt (Audio In) Card */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-3 text-center">
                {isRecordingDoubt ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
                      <span className="text-xs font-bold text-rose-400 font-mono">
                        Recording: 00:{doubtRecordingTime < 10 ? `0${doubtRecordingTime}` : doubtRecordingTime}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Speak your question clearly now...</p>
                    <button
                      onClick={stopDoubtRecording}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 rounded-lg shadow transition"
                    >
                      ⏹ Finish & Send Voice Doubt
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startDoubtRecording}
                    disabled={isSubmittingVoiceDoubt}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-lg shadow transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span>🎙️</span>
                    <span>
                      {isSubmittingVoiceDoubt ? 'Transcribing & Delivering...' : 'Speak Doubt (Microphone)'}
                    </span>
                  </button>
                )}
              </div>

              {/* Or Type Doubt */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-2 text-[10px] text-slate-500 uppercase">or type below</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <form onSubmit={handleSendDoubt} className="space-y-2 mt-2">
                <textarea
                  rows={2}
                  value={doubtText}
                  onChange={(e) => setDoubtText(e.target.value)}
                  placeholder="Type doubt in your language..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-primary-500 resize-none"
                />
                <button
                  type="submit"
                  disabled={!doubtText.trim()}
                  className="w-full btn btn-primary text-xs py-2 font-bold disabled:opacity-50"
                >
                  Send Typed Doubt
                </button>
              </form>
            </div>

            {/* My Doubts list */}
            {myDoubts.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Sent Doubts to Teacher:
                </span>
                <div className="space-y-1.5 max-h-24 overflow-y-auto">
                  {myDoubts.map((d, i) => (
                    <div
                      key={i}
                      className="text-xs text-emerald-400 bg-emerald-950/40 p-2 rounded border border-emerald-900/50 flex items-center justify-between"
                    >
                      <span className="truncate">✓ {d.text}</span>
                      <span className="text-[10px] text-slate-500 shrink-0 ml-1">
                        {d.isVoice ? '🎙️ Spoken' : '⌨️ Typed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
