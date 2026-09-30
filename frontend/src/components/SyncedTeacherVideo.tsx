import React, { useEffect, useRef, useState } from 'react'
import teacherSpeakingSrc from '../assets/teacher_speaking.jpg'
import teacherListeningSrc from '../assets/teacher_listening.jpg'

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

  // Circular ring buffer of captured video frames with timestamps
  const frameBufferRef = useRef<Array<{ time: number; image: ImageBitmap | HTMLCanvasElement }>>([])
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastSampleTimeRef = useRef<number>(0)

  // Preloaded teacher presenter images
  const speakingImgRef = useRef<HTMLImageElement | null>(null)
  const listeningImgRef = useRef<HTMLImageElement | null>(null)
  const incomingImgRef = useRef<HTMLImageElement | null>(null)

  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [videoMode, setVideoMode] = useState<'classroom' | 'webcam'>('classroom')

  // Preload teacher video presenter images using bundled Vite assets
  useEffect(() => {
    let count = 0
    const onLoaded = () => {
      count++
      if (count >= 1) setImagesLoaded(true)
    }

    const sImg = new Image()
    sImg.src = teacherSpeakingSrc
    sImg.onload = onLoaded
    sImg.onerror = () => {
      // Fallback to public path if needed
      sImg.src = '/teacher_speaking.jpg'
    }
    speakingImgRef.current = sImg

    const lImg = new Image()
    lImg.src = teacherListeningSrc
    lImg.onload = onLoaded
    lImg.onerror = () => {
      lImg.src = '/teacher_listening.jpg'
    }
    listeningImgRef.current = lImg

    // Initialize reusable offscreen canvas for zero-allocation sampling
    const off = document.createElement('canvas')
    off.width = 720
    off.height = 405
    offscreenCanvasRef.current = off
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

  // Video Delay Engine & Rendering Loop
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
      t += 0.04

      const isSpeaking = Boolean(currentSpeech && currentSpeech.trim().length > 0)

      // 1. Sample current video frame into reusable offscreen canvas every 80ms (~12 fps)
      if (now - lastSampleTimeRef.current >= 80 && offscreenCanvasRef.current) {
        lastSampleTimeRef.current = now
        const offCanvas = offscreenCanvasRef.current
        const offCtx = offCanvas.getContext('2d')

        if (offCtx) {
          if (videoMode === 'webcam' && incomingImgRef.current) {
            // Live webcam broadcast from teacher
            offCtx.drawImage(incomingImgRef.current, 0, 0, width, height)
          } else {
            // High-definition teacher video presenter
            const sourceImg = isSpeaking ? speakingImgRef.current : listeningImgRef.current
            const fallbackImg = speakingImgRef.current || listeningImgRef.current
            const targetImg = (sourceImg && sourceImg.complete && sourceImg.naturalWidth > 0)
              ? sourceImg
              : fallbackImg

            if (targetImg && targetImg.complete && targetImg.naturalWidth > 0) {
              // Natural teacher presentation movement
              const scale = 1.0 + (isSpeaking ? Math.sin(t * 1.5) * 0.015 : Math.sin(t * 0.6) * 0.005)
              const offsetX = Math.sin(t * 0.8) * (isSpeaking ? 3 : 1)
              const offsetY = Math.cos(t * 0.6) * (isSpeaking ? 2 : 1)

              offCtx.save()
              offCtx.translate(width / 2 + offsetX, height / 2 + offsetY)
              offCtx.scale(scale, scale)
              offCtx.drawImage(targetImg, -width / 2, -height / 2, width, height)
              offCtx.restore()

              // Interactive voice energy wave across the digital blackboard
              if (isSpeaking) {
                offCtx.strokeStyle = 'rgba(56, 189, 248, 0.85)'
                offCtx.lineWidth = 3
                offCtx.beginPath()
                const midY = height * 0.35
                for (let x = 40; x < width * 0.38; x += 5) {
                  const amp = 14 * Math.sin((x * 0.08) + t * 4)
                  if (x === 40) offCtx.moveTo(x, midY + amp)
                  else offCtx.lineTo(x, midY + amp)
                }
                offCtx.stroke()
              }
            } else {
              // Loading placeholder with animated teacher avatar
              offCtx.fillStyle = '#0f172a'
              offCtx.fillRect(0, 0, width, height)
              offCtx.fillStyle = '#38bdf8'
              offCtx.font = 'bold 20px Inter, sans-serif'
              offCtx.fillText(`👨‍🏫 Connecting Teacher Video Stream...`, 40, height / 2)
            }
          }

          // Push a copy into the circular buffer
          const frameSnapshot = document.createElement('canvas')
          frameSnapshot.width = width
          frameSnapshot.height = height
          const snapCtx = frameSnapshot.getContext('2d')
          if (snapCtx) snapCtx.drawImage(offCanvas, 0, 0)

          frameBufferRef.current.push({
            time: now,
            image: frameSnapshot,
          })
        }
      }

      // 2. Query Delay Buffer for target delayed frame
      const delay = isDelayEnabled ? syncDelayMs : 0
      const targetTime = now - delay

      // Prune frames older than 6s
      while (frameBufferRef.current.length > 0 && frameBufferRef.current[0].time < now - 6000) {
        frameBufferRef.current.shift()
      }

      // Find frame matching targetTime
      let frameToDraw: HTMLCanvasElement | ImageBitmap | undefined = undefined

      if (frameBufferRef.current.length > 0) {
        frameToDraw = frameBufferRef.current[frameBufferRef.current.length - 1].image
        for (let i = frameBufferRef.current.length - 1; i >= 0; i--) {
          if (frameBufferRef.current[i].time <= targetTime) {
            frameToDraw = frameBufferRef.current[i].image
            break
          }
        }
      }

      // 3. Render frame to visible screen
      if (frameToDraw) {
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(frameToDraw, 0, 0, width, height)
      } else if (speakingImgRef.current && speakingImgRef.current.complete) {
        // Immediate fallback so there is never a blank screen
        ctx.drawImage(speakingImgRef.current, 0, 0, width, height)
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
      {/* Fallback image in background for instant visibility */}
      <img
        src={teacherSpeakingSrc}
        alt="Teacher Presenter"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40 blur-sm"
      />

      {/* Main Canvas rendering delayed Lip-Sync video stream */}
      <canvas
        ref={canvasRef}
        width={720}
        height={405}
        className="relative z-1 w-full h-full object-cover"
      />

      {/* Top Floating Badges (Google Meet Style) */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        {/* Left: Live Status & Teacher Name */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-lg animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white"></span>
            LIVE VIDEO
          </span>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-900/80 backdrop-blur-md text-slate-200 border border-slate-700/60 shadow">
            👨‍🏫 {teacherName}
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
            <span>Lip-Sync: {isDelayEnabled ? `${(syncDelayMs / 1000).toFixed(1)}s Delayed` : 'Live (0s)'}</span>
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
