import React from 'react'
import { SyncedTeacherVideo, SyncedTeacherVideoProps } from './SyncedTeacherVideo'

export interface VideoPlayerContainerProps extends SyncedTeacherVideoProps {
  className?: string
}

/**
 * Modern real-time Video Player Container for Live Classrooms.
 * Supports:
 * 1. Direct WebRTC MediaStream and MediaStreamTrack ingestion.
 * 2. Asynchronous circular frame buffer with presentation timestamps (PTS).
 * 3. Playback speed and latency pacing matching real-time speech translation pipeline.
 * 4. Dual placement: Primary stage (top/left) and docked above transcript history.
 */
export const VideoPlayerContainer: React.FC<VideoPlayerContainerProps> = ({
  className,
  ...props
}) => {
  return (
    <div className={`w-full h-full ${className || ''}`}>
      <SyncedTeacherVideo {...props} />
    </div>
  )
}

export default VideoPlayerContainer
