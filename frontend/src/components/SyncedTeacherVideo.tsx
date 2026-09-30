import React, { useEffect, useRef, useState } from 'react'

interface SyncedTeacherVideoProps {
  isTeacherStreaming: boolean
  teacherName: string
  currentSpeech: string
  translatedSpeech: string
  selectedLanguageName: string
  audioLevel?: number
  syncDelayMs: number
  isDelayEnabled: boolean
  onToggleDelay: (enabled: boolean) => void
  onDelayChange: (ms: number) => void
}

export const SyncedTeacherVideo: React.FC<SyncedTeacherVideoProps> = ({
  isTeacherStreaming: _isTeacherStreaming = true,
  teacherName,
  currentSpeech,
  translatedSpeech,
  selectedLanguageName,
  audioLevel: _audioLevel = 35,
  syncDelayMs,
  isDelayEnabled,
  onToggleDelay,
  onDelayChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Circular frame buffer for video delay
  const frameBufferRef = useRef<Array<{ time: number; image: ImageBitmap | HTMLCanvasElement }>>([])
  const [isWebcamActive, setIsWebcamActive] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Setup video source or animated interactive classroom presentation
  useEffect(() => {
    let active = true

    async function setupStream() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: false })
          if (active && videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.play().catch(() => {})
            setIsWebcamActive(true)
          }
        }
      } catch (err) {
        // Fallback to animated interactive classroom presentation canvas
        setIsWebcamActive(false)
      }
    }

    setupStream()

    return () => {
      active = false
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Video Delay Buffer Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let renderActive = true
    let waveOffset = 0

    const render = () => {
      if (!renderActive) return

      const now = Date.now()
      const width = canvas.width
      const height = canvas.height

      // 1. Capture current source frame
      const offscreen = document.createElement('canvas')
      offscreen.width = width
      offscreen.height = height
      const offCtx = offscreen.getContext('2d')

      if (offCtx) {
        if (isWebcamActive && videoRef.current && videoRef.current.readyState >= 2) {
          offCtx.drawImage(videoRef.current, 0, 0, width, height)
        } else {
          // Draw high-fidelity interactive digital whiteboard presentation
          const grad = offCtx.createLinearGradient(0, 0, width, height)
          grad.addColorStop(0, '#0f172a')
          grad.addColorStop(1, '#1e293b')
          offCtx.fillStyle = grad
          offCtx.fillRect(0, 0, width, height)

          // Whiteboard frame
          offCtx.strokeStyle = '#334155'
          offCtx.lineWidth = 4
          offCtx.strokeRect(16, 16, width - 32, height - 32)

          // Teacher avatar & presentation
          offCtx.fillStyle = '#38bdf8'
          offCtx.font = 'bold 20px Inter, system-ui, sans-serif'
          offCtx.fillText('👨‍🏫 ' + teacherName, 36, 52)

          offCtx.fillStyle = '#94a3b8'
          offCtx.font = '13px Inter, system-ui, sans-serif'
          offCtx.fillText('Live Smart Classroom • Primary Science', 36, 74)

          // Animated speech waveform
          waveOffset += 0.08
          offCtx.strokeStyle = '#38bdf8'
          offCtx.lineWidth = 3
          offCtx.beginPath()
          const midY = height / 2 + 10
          for (let x = 36; x < width - 36; x += 6) {
            const yOffset = Math.sin(x * 0.04 + waveOffset) * (currentSpeech ? 24 : 6)
            if (x === 36) offCtx.moveTo(x, midY + yOffset)
            else offCtx.lineTo(x, midY + yOffset)
          }
          offCtx.stroke()

          // Live topic graphic
          offCtx.fillStyle = '#f8fafc'
          offCtx.font = 'bold 16px Inter, system-ui, sans-serif'
          offCtx.fillText('🌍 Topic: Water Cycle & Plant Ecosystems', 36, height - 60)
        }

        // Store into delay frame buffer
        frameBufferRef.current.push({
          time: now,
          image: offscreen,
        })
      }

      // 2. Determine which frame to draw based on Lip-Sync delay setting
      const delay = isDelayEnabled ? syncDelayMs : 0
      const targetTime = now - delay

      // Prune old frames (keep max 5s of buffer)
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
  }, [isWebcamActive, isDelayEnabled, syncDelayMs, teacherName, currentSpeech])

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col items-center justify-center group">
      {/* Hidden background video capture */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />

      {/* Main Canvas rendering either live or delayed video */}
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className="w-full h-full object-cover"
      />

      {/* Top Badges */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-600 text-white shadow-lg animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            LIVE
          </span>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-900/80 backdrop-blur-md text-slate-200 border border-slate-700/60 shadow">
            {teacherName} (Teacher)
          </span>
        </div>

        {/* AI Lip-Sync Status Pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-md border ${
              isDelayEnabled
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                : 'bg-slate-900/80 border-slate-700 text-slate-400'
            }`}
          >
            <span>✨</span>
            <span>AI Lip-Sync: {isDelayEnabled ? `${(syncDelayMs / 1000).toFixed(1)}s Delay` : 'OFF'}</span>
            <span className="text-[10px]">⚙️</span>
          </button>
        </div>
      </div>

      {/* Settings Dropdown for Lip-Sync Delay Slider */}
      {showSettings && (
        <div className="absolute top-16 right-4 p-4 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl z-30 w-72 text-white text-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold flex items-center gap-1.5">
              <span>⏱️</span> Audio-Video Sync Engine
            </span>
            <button
              onClick={() => setShowSettings(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Delays teacher video by <strong>{(syncDelayMs / 1000).toFixed(1)}s</strong> so mouth movements match the dubbed <strong>{selectedLanguageName}</strong> audio perfectly.
          </p>

          <div className="flex items-center justify-between">
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

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[11px] text-slate-400">Delay Buffer:</span>
              <span className="text-emerald-400 font-bold">{(syncDelayMs / 1000).toFixed(1)}s</span>
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
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0s (Live)</span>
              <span>1.8s (Balanced)</span>
              <span>3.0s</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Closed Captions Overlay (Google Meet Style) */}
      {(currentSpeech || translatedSpeech) && (
        <div className="absolute bottom-6 left-6 right-6 flex flex-col items-center pointer-events-none">
          <div className="max-w-2xl px-5 py-3 rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 shadow-2xl text-center space-y-1">
            {/* English Original */}
            <p className="text-xs text-slate-300 font-medium tracking-wide">
              {currentSpeech}
            </p>
            {/* Dubbed Mother Tongue Translation */}
            <p className="text-base sm:text-lg font-bold text-amber-300 tracking-normal drop-shadow">
              {translatedSpeech}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
export default SyncedTeacherVideo
