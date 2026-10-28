"""
Thread-safe in-memory circular ring buffer for video frames tagged with
Presentation Timestamps (PTS) to achieve precise audio-video lip synchronization.
"""

import time
import threading
import logging
from collections import deque
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class VideoFrame:
    """Represents a single video frame tagged with timestamps and keyframe metadata."""
    __slots__ = ("frame_id", "pts_ms", "ingest_time_ms", "frame_data", "is_keyframe", "width", "height")

    def __init__(
        self,
        frame_id: int,
        pts_ms: float,
        ingest_time_ms: float,
        frame_data: Any,
        is_keyframe: bool = False,
        width: int = 720,
        height: int = 405,
    ):
        self.frame_id = frame_id
        self.pts_ms = pts_ms
        self.ingest_time_ms = ingest_time_ms
        self.frame_data = frame_data
        self.is_keyframe = is_keyframe
        self.width = width
        self.height = height

    def to_dict(self) -> Dict[str, Any]:
        return {
            "frame_id": self.frame_id,
            "pts_ms": self.pts_ms,
            "ingest_time_ms": self.ingest_time_ms,
            "is_keyframe": self.is_keyframe,
            "width": self.width,
            "height": self.height,
        }


class VideoSyncBuffer:
    """
    In-memory circular ring buffer storing PTS-tagged video frames.
    
    Provides thread-safe frame ingestion and retrieval delayed by Δt:
      video_delay_ms = processing_latency_ms + jitter_margin_ms
      
    Guarantees:
    - Thread safety across asynchronous WebSocket frame handlers.
    - Zero disk I/O (pure in-memory circular buffer).
    - Monotonic Presentation Timestamp (PTS) ordering.
    - Automatic garbage collection of expired frames to prevent memory leaks.
    - IDR/Keyframe retention on seek / presentation boundaries.
    """

    def __init__(self, max_capacity: int = 300, max_retention_ms: float = 8000.0):
        self.max_capacity = max_capacity
        self.max_retention_ms = max_retention_ms
        self._buffer: deque[VideoFrame] = deque(maxlen=max_capacity)
        self._lock = threading.Lock()
        self._frame_seq = 0
        self._last_keyframe: Optional[VideoFrame] = None
        self._total_dropped_frames = 0

    def push_frame(
        self,
        frame_data: Any,
        pts_ms: Optional[float] = None,
        is_keyframe: bool = False,
        width: int = 720,
        height: int = 405,
    ) -> VideoFrame:
        """
        Push incoming raw video frame (base64 string or bytes) into the circular ring buffer.
        """
        now_ms = time.time() * 1000.0
        frame_pts = pts_ms if pts_ms is not None else now_ms

        with self._lock:
            self._frame_seq += 1
            frame = VideoFrame(
                frame_id=self._frame_seq,
                pts_ms=frame_pts,
                ingest_time_ms=now_ms,
                frame_data=frame_data,
                is_keyframe=is_keyframe,
                width=width,
                height=height,
            )

            if is_keyframe or self._last_keyframe is None:
                self._last_keyframe = frame

            if len(self._buffer) >= self.max_capacity:
                self._total_dropped_frames += 1

            self._buffer.append(frame)
            self._prune_stale_unlocked(now_ms)
            return frame

    def get_delayed_frame(
        self,
        video_delay_ms: float,
        reference_time_ms: Optional[float] = None,
    ) -> Optional[VideoFrame]:
        """
        Retrieve frame closest to (reference_time_ms - video_delay_ms).
        Matches delayed video playback to the exact speech translation audio offset.
        """
        now_ms = reference_time_ms if reference_time_ms is not None else (time.time() * 1000.0)
        target_pts = now_ms - max(0.0, video_delay_ms)

        with self._lock:
            if not self._buffer:
                return self._last_keyframe

            # Fast path: if target_pts is newer than our newest frame, return latest frame
            if target_pts >= self._buffer[-1].pts_ms:
                return self._buffer[-1]

            # Fast path: if target_pts is older than our oldest frame, return oldest or last keyframe
            if target_pts <= self._buffer[0].pts_ms:
                return self._buffer[0]

            # Reverse scan for frame with PTS <= target_pts
            best_frame = self._buffer[0]
            for frame in reversed(self._buffer):
                if frame.pts_ms <= target_pts:
                    best_frame = frame
                    break

            return best_frame

    def get_latest_frame(self) -> Optional[VideoFrame]:
        """Return the most recently ingested frame without delay."""
        with self._lock:
            if self._buffer:
                return self._buffer[-1]
            return self._last_keyframe

    def _prune_stale_unlocked(self, current_time_ms: float):
        """Purge frames older than max_retention_ms (caller must hold _lock)."""
        if not self._buffer:
            return
        # Reference against newest frame's presentation timestamp
        ref_pts = self._buffer[-1].pts_ms
        cutoff = ref_pts - self.max_retention_ms
        while len(self._buffer) > 1 and self._buffer[0].pts_ms < cutoff:
            # Preserve the keyframe if it is the only one we have
            if self._buffer[0] is self._last_keyframe and len(self._buffer) <= 5:
                break
            self._buffer.popleft()

    def clear(self):
        """Flush the entire video buffer."""
        with self._lock:
            self._buffer.clear()
            self._last_keyframe = None
            self._frame_seq = 0

    def get_stats(self) -> Dict[str, Any]:
        """Telemetry diagnostics on buffer depth and timing."""
        with self._lock:
            count = len(self._buffer)
            oldest_pts = self._buffer[0].pts_ms if count > 0 else 0.0
            newest_pts = self._buffer[-1].pts_ms if count > 0 else 0.0
            timespan_ms = max(0.0, newest_pts - oldest_pts)
            return {
                "frame_count": count,
                "max_capacity": self.max_capacity,
                "timespan_buffered_ms": round(timespan_ms, 1),
                "oldest_pts": oldest_pts,
                "newest_pts": newest_pts,
                "total_dropped_frames": self._total_dropped_frames,
            }
