import React, { useEffect, useRef, useState } from 'react'

interface SyncedTeacherVideoProps {
  isTeacherStreaming?: boolean
  teacherName: string
  currentSpeech: string
  translatedSpeech: string
  selectedLanguageName: string
  syncDelayMs: number
  isDelayEnabled: boolean
  onToggleDelay: (enabled: boolean) => void
  onDelayChange: (ms: number) => void
  incomingTeacherFrame?: string | null
}

export const SyncedTeacherVideo: React.FC<SyncedTeacherVideoProps> = ({
  teacherName,
  currentSpeech,
  translatedSpeech,
  selectedLanguageName,
  syncDelayMs,
  isDelayEnabled,
  onToggleDelay,
  onDelayChange,
  incomingTeacherFrame,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Circular frame buffer for video delay (stores timestamped captured frames)
  const frameBufferRef = useRef<Array<{ time: number; image: HTMLCanvasElement }>>([])

  // Preloaded teacher presenter images
  const speakingImgRef = useRef<HTMLImageElement | null>(null)
  const listeningImgRef = useRef<HTMLImageElement | null>(null)
  const incomingImgRef = useRef<HTMLImageElement | null>(null)

  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [videoMode, setVideoMode] = useState<'classroom' | 'webcam'>('classroom')

  // Preload realistic teacher video presenter frames
  useEffect(() => {
    let loadedCount = 0
    const checkAll = () => {
      loadedCount++
      if (loadedCount >= 2) setImagesLoaded(true)
    }

    const speaking = new Image()
    speaking.src = '/teacher_speaking.jpg'
    speaking.onload = checkAll
    speaking.onerror = checkAll
    speakingImgRef.current = speaking

    const listening = new Image()
    listening.src = '/teacher_listening.jpg'
    listening.onload = checkAll
    listening.onerror = checkAll
    listeningImgRef.current = listening
  }, [])

  // Update incoming frame from teacher if received over liveSync
  useEffect(() => {
    if (incomingTeacherFrame) {
      const img = new Image()
      img.src = incomingTeacherFrame
      img.onload = () => {
        incomingImgRef.current = img
        setVideoMode('webcam')
      }
    }
  }, [incomingTeacherFrame])

  // Main Circular Frame Delay Rendering Engine
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let renderActive = true
    let t = 0

    const render = () => {
      if (!renderActive) return

      const now = Date.now()
      const width = canvas.width
      const height = canvas.height
      t += 0.05

      // 1. Render Source Teacher Video Frame to Offscreen Canvas
      const offscreen = document.createElement('canvas')
      offscreen.width = width
      offscreen.height = height
      const offCtx = offscreen.getContext('2d')

      if (offCtx) {
        const isSpeaking = Boolean(currentSpeech && currentSpeech.trim().length > 0)

        if (videoMode === 'webcam' && incomingImgRef.current) {
          // Render real-time camera broadcast received from teacher
          offCtx.drawImage(incomingImgRef.current, 0, 0, width, height)
        } else {
          // Render High-Definition Teacher Video Presenter
          const sourceImg = isSpeaking ? speakingImgRef.current : listeningImgRef.current

          if (sourceImg && sourceImg.complete && sourceImg.naturalWidth > 0) {
            // Natural breathing and presentation micro-motion
            const scale = 1.0 + (isSpeaking ? Math.sin(t) * 0.012 : Math.sin(t * 0.5) * 0.006)
            const offsetX = Math.sin(t * 0.7) * (isSpeaking ? 3 : 1)
            const offsetY = Math.cos(t * 0.5) * (isSpeaking ? 2 : 1)

            offCtx.save()
            offCtx.translate(width / 2 + offsetX, height / 2 + offsetY)
            offCtx.scale(scale, scale)
            offCtx.drawImage(sourceImg, -width / 2, -height / 2, width, height)
            offCtx.restore()

            // Dynamic voice energy indicator on the smart board
            if (isSpeaking) {
              offCtx.fillStyle = 'rgba(56, 189, 248, 0.15)'
              offCtx.beginPath()
              offCtx.arc(width * 0.22, height * 0.45, 60 + Math.sin(t * 4) * 15, 0, Math.PI * 2)
              offCtx.fill()
            }
          } else {
            // Fallback digital presentation if images still downloading
            const grad = offCtx.createLinearGradient(0, 0, width, height)
            grad.addColorStop(0, '#0f172a')
            grad.addColorStop(1, '#1e293b')
            offCtx.fillStyle = grad
            offCtx.fillRect(0, 0, width, height)

            offCtx.fillStyle = '#38bdf8'
            offCtx.font = 'bold 20px Inter, sans-serif'
            offCtx.fillText(`👨‍🏫 ${teacherName} (Teacher)`, 36, 50)
          }
        }

        // Push current timestamped frame into Circular Buffer
        frameBufferRef.current.push({
          time: now,
          image: offscreen,
        })
      }

      // 2. Query Delay Buffer for frame matching (now - syncDelayMs)
      const delay = isDelayEnabled ? syncDelayMs : 0
      const targetTime = now - delay

      // Prune frames older than 6 seconds to keep memory lean
      while (frameBufferRef.current.length > 0 && frameBufferRef.current[0].time < now - 6000) {
        frameBufferRef.current.shift()
      }

      // Find frame closest to targetTime
      let frameToDraw = frameBufferRef.current[frameBufferRef.current.length - 1]?.image
      for (let i = frameBufferRef.current.length - 1; i >= 0; i--) {
        if (frameBufferRef.current[i].time <= targetTime) {
          frameToDraw = frameBufferRef.current[i].image
          break
        }
      }

      // 3. Render the synchronized delayed frame onto the visible canvas
      if (frameToDraw) {
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(frameToDraw, 0, 0, width, height)
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      renderActive = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [imagesLoaded, videoMode, isDelayEnabled, syncDelayMs, teacherName, currentSpeech])

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80 flex flex-col items-center justify-center group">
      {/* Main Canvas rendering delayed Lip-Sync video stream */}
      <canvas
        ref={canvasRef}
        width={720}
        height={405}
        className="w-full h-full object-cover"
      />

      {/* Top Floating Badges (Google Meet Style) */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        {/* Left: Live Status & Teacher Name */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-lg animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            LIVE
          </span>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-900/80 backdrop-blur-md text-slate-200 border border-slate-700/60 shadow">
            👨‍🏫 {teacherName} (Teacher)
          </span>

          {/* Mode Switcher */}
          <button
            onClick={() => setVideoMode(videoMode === 'classroom' ? 'webcam' : 'classroom')}
            className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/80 backdrop-blur-md text-slate-300 hover:text-white border border-slate-700/60 shadow transition hidden sm:inline-flex items-center gap-1"
            title="Toggle between Smart Classroom presenter and webcam"
          >
            <span>{videoMode === 'classroom' ? '🎥 Studio Feed' : '📹 Webcam'}</span>
          </button>
        </div>

        {/* Right: AI Lip-Sync Engine Pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-lg border backdrop-blur-md ${
              isDelayEnabled
                ? 'bg-emerald-950/85 border-emerald-500/60 text-emerald-300 ring-2 ring-emerald-500/20'
                : 'bg-slate-900/85 border-slate-700 text-slate-400'
            }`}
          >
            <span>✨</span>
            <span>AI Lip-Sync: {isDelayEnabled ? `${(syncDelayMs / 1000).toFixed(1)}s Delayed` : 'Live (0s)'}</span>
            <span className="text-[10px]">⚙️</span>
          </button>
        </div>
      </div>

      {/* Settings Dropdown for Lip-Sync Delay Slider */}
      {showSettings && (
        <div className="absolute top-16 right-4 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl z-30 w-80 text-white text-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold flex items-center gap-1.5 text-sm">
              <span>⏱️</span> Audio-Video Lip-Sync Engine
            </span>
            <button
              onClick={() => setShowSettings(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            Delays teacher video by <strong>{(syncDelayMs / 1000).toFixed(1)}s</strong> so mouth and hand gestures match the dubbed <strong>{selectedLanguageName}</strong> audio perfectly.
          </p>

          <div className="flex items-center justify-between pt-1">
            <span className="font-semibold text-slate-300">Enable Delay Sync:</span>
            <button
              onClick={() => onToggleDelay(!isDelayEnabled)}
              className={`w-11 h-6 rounded-full transition relative p-0.5 ${
                isDelayEnabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition transform ${
                  isDelayEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex justify-between">
              <span className="text-[11px] text-slate-400">Delay Buffer:</span>
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
              onChange={(e) => onDelayChange(Number(e.target.value))}
              disabled={!isDelayEnabled}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0s (Live/Ahead)</span>
              <span>1.8s (Dubbed Sync)</span>
              <span>3.0s</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Closed Captions Overlay (Google Meet Style) */}
      {(currentSpeech || translatedSpeech) && (
        <div className="absolute bottom-6 left-6 right-6 flex flex-col items-center pointer-events-none z-10">
          <div className="max-w-2xl px-6 py-3.5 rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 shadow-2xl text-center space-y-1">
            {currentSpeech && (
              <p className="text-xs text-slate-300 font-medium tracking-wide">
                {currentSpeech}
              </p>
            )}
            {translatedSpeech && (
              <p className="text-base sm:text-lg font-bold text-amber-300 tracking-normal drop-shadow">
                {translatedSpeech}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SyncedTeacherVideo
