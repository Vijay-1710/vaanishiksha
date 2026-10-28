import React, { useEffect, useRef, useState } from 'react'
import teacherSpeakingSrc from '../assets/teacher_speaking.jpg'
import teacherListeningSrc from '../assets/teacher_listening.jpg'

export interface SyncedTeacherVideoProps {
  isTeacherStreaming?: boolean
  teacherName?: string
  currentSpeech?: string
  translatedSpeech?: string
  selectedLanguageName?: string
  syncDelayMs?: number
  isDelayEnabled?: boolean
  onToggleDelay?: (enabled: boolean) => void
  onDelayChange?: (ms: number) => void
  incomingTeacherFrame?: string | null
  mediaStream?: MediaStream | null
  videoTrack?: MediaStreamTrack | null
  playbackRate?: number
  placement?: 'primary' | 'drawer' | 'compact'
  containerTitle?: string
  audioLevel?: number
  isHost?: boolean
  cameraOn?: boolean
  onToggleCamera?: () => void
}

export const SyncedTeacherVideo: React.FC<SyncedTeacherVideoProps> = ({
  teacherName = 'Teacher',
  currentSpeech = '',
  translatedSpeech = '',
  selectedLanguageName = 'Hindi',
  syncDelayMs = 1800,
  isDelayEnabled = true,
  onToggleDelay,
  onDelayChange,
  incomingTeacherFrame,
  mediaStream,
  videoTrack,
  playbackRate = 1.0,
  placement = 'primary',
  containerTitle,
  audioLevel = 0,
  isHost = false,
  cameraOn = true,
  onToggleCamera,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Circular ring buffer of captured video frames with Presentation Timestamps (PTS)
  const frameBufferRef = useRef<Array<{ time: number; image: ImageBitmap | HTMLCanvasElement }>>([])
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastSampleTimeRef = useRef<number>(0)

  // Preloaded teacher presenter images
  const speakingImgRef = useRef<HTMLImageElement | null>(null)
  const listeningImgRef = useRef<HTMLImageElement | null>(null)
  const incomingImgRef = useRef<HTMLImageElement | null>(null)

  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [videoMode, setVideoMode] = useState<'classroom' | 'webcam' | 'webrtc'>('classroom')
  const [activeStreamLabel, setActiveStreamLabel] = useState<string>('Studio Feed')
  const [isMuted, setIsMuted] = useState(true)

  // 1. Preload teacher video presenter images using bundled Vite assets
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

  // 2. Accept incoming WebRTC MediaStream or video track
  useEffect(() => {
    const videoEl = videoElementRef.current
    if (!videoEl) return

    if (mediaStream) {
      videoEl.srcObject = mediaStream
      videoEl.play().catch(() => {})
      setVideoMode('webrtc')
      const tracks = mediaStream.getVideoTracks()
      setActiveStreamLabel(tracks[0]?.label || 'WebRTC Live Stream')
    } else if (videoTrack) {
      const stream = new MediaStream([videoTrack])
      videoEl.srcObject = stream
      videoEl.play().catch(() => {})
      setVideoMode('webrtc')
      setActiveStreamLabel(videoTrack.label || 'WebRTC Video Track')
    } else if (incomingTeacherFrame) {
      setVideoMode('webcam')
      setActiveStreamLabel('Teacher Relay Feed')
    } else {
      setVideoMode('classroom')
      setActiveStreamLabel('Smart Studio Feed')
    }
  }, [mediaStream, videoTrack, incomingTeacherFrame])

  // 3. Update incoming base64 frame from teacher if received over liveSync
  useEffect(() => {
    if (incomingTeacherFrame && !mediaStream && !videoTrack) {
      const img = new Image()
      img.src = incomingTeacherFrame
      img.onload = () => {
        incomingImgRef.current = img
        setVideoMode('webcam')
      }
    }
  }, [incomingTeacherFrame, mediaStream, videoTrack])

  // 4. Hook playbackRate / pacing into underlying video element
  useEffect(() => {
    const videoEl = videoElementRef.current
    if (videoEl && typeof videoEl.playbackRate === 'number') {
      try {
        const safePacing = Math.max(0.75, Math.min(1.4, playbackRate || 1.0))
        videoEl.playbackRate = safePacing
      } catch {
        // Some media streams do not allow playbackRate changes
      }
    }
  }, [playbackRate])

  // 5. Video Delay Engine & Rendering Loop with Pacing Adjustment
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

      const isSpeaking = Boolean(
        (currentSpeech && currentSpeech.trim().length > 0) || audioLevel > 5
      )

      // Sample incoming video frame into reusable offscreen canvas every 75ms (~13-14 fps)
      if (now - lastSampleTimeRef.current >= 75 && offscreenCanvasRef.current) {
        lastSampleTimeRef.current = now
        const offCanvas = offscreenCanvasRef.current
        const offCtx = offCanvas.getContext('2d')

        if (offCtx) {
          const videoEl = videoElementRef.current
          const isWebRTCActive =
            (videoMode === 'webrtc' || mediaStream || videoTrack) &&
            videoEl &&
            videoEl.readyState >= 2

          if (isWebRTCActive && videoEl) {
            // Priority 1: Direct WebRTC MediaStream / Video Track
            offCtx.drawImage(videoEl, 0, 0, width, height)
          } else if (videoMode === 'webcam' && incomingImgRef.current) {
            // Priority 2: Base64 JPEG frame relay from teacher
            offCtx.drawImage(incomingImgRef.current, 0, 0, width, height)
          } else {
            // Priority 3: Interactive High-Definition Teacher Studio Presenter
            const sourceImg = isSpeaking ? speakingImgRef.current : listeningImgRef.current
            const fallbackImg = speakingImgRef.current || listeningImgRef.current
            const targetImg =
              sourceImg && sourceImg.complete && sourceImg.naturalWidth > 0
                ? sourceImg
                : fallbackImg

            if (targetImg && targetImg.complete && targetImg.naturalWidth > 0) {
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
                  const amp = 14 * Math.sin(x * 0.08 + t * 4)
                  if (x === 40) offCtx.moveTo(x, midY + amp)
                  else offCtx.lineTo(x, midY + amp)
                }
                offCtx.stroke()
              }
            } else {
              offCtx.fillStyle = '#0f172a'
              offCtx.fillRect(0, 0, width, height)
              offCtx.fillStyle = '#38bdf8'
              offCtx.font = 'bold 18px Inter, sans-serif'
              offCtx.fillText('👨‍🏫 Synchronizing Teacher Video Stream...', 40, height / 2)
            }
          }

          // Push snapshot into circular ring buffer tagged with Presentation Timestamp (PTS)
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

      // Query Circular Buffer for target delayed frame with playback speed/pacing compensation
      const pacing = Math.max(0.75, Math.min(1.4, playbackRate || 1.0))
      const delay = isDelayEnabled ? syncDelayMs / pacing : 0
      const targetTime = now - delay

      // Memory safe: Prune frames older than (delay + 5000ms) to ensure zero memory leaks
      const purgeThreshold = now - Math.max(6000, delay + 5000)
      while (
        frameBufferRef.current.length > 0 &&
        frameBufferRef.current[0].time < purgeThreshold
      ) {
        frameBufferRef.current.shift()
      }

      // Cap maximum frames in ring buffer to prevent unbounded heap growth
      if (frameBufferRef.current.length > 220) {
        frameBufferRef.current.splice(0, frameBufferRef.current.length - 220)
      }

      // Find frame closest to targetTime (presentation ordering)
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

      // Render frame to visible canvas
      if (frameToDraw) {
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(frameToDraw, 0, 0, width, height)
      } else if (speakingImgRef.current && speakingImgRef.current.complete) {
        ctx.drawImage(speakingImgRef.current, 0, 0, width, height)
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      renderActive = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [
    imagesLoaded,
    videoMode,
    isDelayEnabled,
    syncDelayMs,
    playbackRate,
    teacherName,
    currentSpeech,
    audioLevel,
    mediaStream,
    videoTrack,
  ])

  const isDrawer = placement === 'drawer'

  return (
    <div
      className={`relative w-full ${
        isDrawer ? 'h-48 sm:h-52 rounded-xl mb-3' : 'h-full rounded-2xl'
      } bg-slate-950 overflow-hidden shadow-2xl border border-slate-800/80 flex flex-col items-center justify-center group`}
    >
      {/* Underlying WebRTC Video Element accepting MediaStream or MediaStreamTrack */}
      <video
        ref={videoElementRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="hidden"
      />

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
      <div
        className={`absolute ${
          isDrawer ? 'top-2 left-2 right-2' : 'top-4 left-4 right-4'
        } flex items-center justify-between pointer-events-none z-10`}
      >
        {/* Left: Live Status & Teacher Name */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          <span
            className={`flex items-center gap-1.5 ${
              isDrawer ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]'
            } rounded-full font-black uppercase tracking-wider bg-rose-600 text-white shadow-lg animate-pulse`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            LIVE
          </span>

          <span
            className={`${
              isDrawer ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
            } rounded-full font-bold bg-slate-900/85 backdrop-blur-md text-slate-200 border border-slate-700/60 shadow truncate max-w-[130px] sm:max-w-none`}
          >
            {containerTitle || `👨‍🏫 ${teacherName}`}
          </span>

          {/* Host Badge */}
          {isHost && (
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Host
            </span>
          )}

          {/* Stream Type Pill */}
          <span
            className={`${
              isDrawer ? 'hidden' : 'hidden sm:inline-flex'
            } px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-950/80 backdrop-blur-md text-indigo-300 border border-indigo-700/60 shadow items-center gap-1`}
          >
            <span>📹 {cameraOn ? activeStreamLabel : 'Camera Muted'}</span>
          </span>

          {/* Teacher Mode Switcher */}
          {!isDrawer && (
            <button
              onClick={() =>
                setVideoMode(videoMode === 'classroom' ? 'webcam' : 'classroom')
              }
              className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/80 backdrop-blur-md text-slate-300 hover:text-white border border-slate-700/60 shadow transition hidden md:inline-flex items-center gap-1"
              title="Toggle between Smart Classroom presenter and webcam"
            >
              <span>{videoMode === 'classroom' ? '🎥 Studio Feed' : '📹 Live Cam'}</span>
            </button>
          )}
        </div>

        {/* Right: AI Lip-Sync Engine Pill, Camera Toggle & Audio Control */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Optional Camera Toggle Button */}
          {onToggleCamera && (
            <button
              onClick={onToggleCamera}
              className={`w-7 h-7 rounded-full backdrop-blur-md border flex items-center justify-center text-xs transition ${
                cameraOn
                  ? 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:text-white'
                  : 'bg-rose-600/80 border-rose-500 text-white'
              }`}
              title={cameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
            >
              {cameraOn ? '📹' : '📷'}
            </button>
          )}

          {onToggleDelay && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`${
                isDrawer ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1.5 text-xs'
              } rounded-full font-bold transition flex items-center gap-1 shadow-lg border backdrop-blur-md ${
                isDelayEnabled
                  ? 'bg-emerald-950/85 border-emerald-500/60 text-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-slate-900/85 border-slate-700 text-slate-400'
              }`}
            >
              <span>✨</span>
              <span>
                Lip-Sync:{' '}
                {isDelayEnabled
                  ? `${(syncDelayMs / 1000).toFixed(1)}s`
                  : 'Live (0s)'}
              </span>
              {!isDrawer && <span className="text-[10px]">⚙️</span>}
            </button>
          )}

          {/* Pacing Speed Indicator Pill */}
          {playbackRate && playbackRate !== 1.0 && (
            <span
              className="hidden lg:inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-600/40"
              title="Speech duration pacing adjustment"
            >
              ⚡ {playbackRate.toFixed(2)}x
            </span>
          )}

          {/* Volume toggle if media stream present */}
          {(mediaStream || videoTrack) && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-7 h-7 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/80 flex items-center justify-center text-xs text-slate-300 hover:text-white"
              title={isMuted ? 'Unmute video audio' : 'Mute video audio'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          )}
        </div>
      </div>

      {/* Settings Dropdown for Lip-Sync Delay Slider */}
      {showSettings && onToggleDelay && onDelayChange && (
        <div
          className={`absolute ${
            isDrawer ? 'top-10 right-2 w-72' : 'top-16 right-4 w-80'
          } p-4 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl z-30 text-white text-xs space-y-3`}
        >
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
            Delays incoming teacher video by{' '}
            <strong>{(syncDelayMs / 1000).toFixed(1)}s</strong> so mouth and hand
            gestures match dubbed <strong>{selectedLanguageName}</strong> audio.
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
              <span>0s (Live)</span>
              <span>1.8s (Dubbed Sync)</span>
              <span>3.0s</span>
            </div>
          </div>

          {/* WebRTC Video Track Status */}
          <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
            <span>Video Track:</span>
            <span className="text-indigo-400 font-mono font-semibold">
              {activeStreamLabel}
            </span>
          </div>
        </div>
      )}

      {/* Floating Closed Captions Overlay (Google Meet Style) */}
      {!isDrawer && (currentSpeech || translatedSpeech) && (
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

// Export VideoPlayerContainer as well for explicit semantic imports
export const VideoPlayerContainer = SyncedTeacherVideo
export default SyncedTeacherVideo
