"""
Decoupled asynchronous worker pipeline for speech processing:
VAD -> ASR -> Machine Translation -> TTS synthesis with cumulative latency tracking.
"""

import time
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Callable, Awaitable

from app.services.asr_service import transcribe_audio_bytes
from app.services.translation_service import translate_text
from app.services.tts_service import get_tts_audio_bytes

logger = logging.getLogger(__name__)


# =============================================================================
# MODULAR ENGINE INTERFACES (Pluggable for Whisper/Deepgram, IndicTrans2/LLM, etc.)
# =============================================================================

class ASREngine(ABC):
    @abstractmethod
    def transcribe(self, audio_bytes: bytes, file_ext: str = "webm", language: Optional[str] = None) -> str:
        pass


class TranslationEngine(ABC):
    @abstractmethod
    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        pass


class TTSEngine(ABC):
    @abstractmethod
    def synthesize(self, text: str, language: str) -> bytes:
        pass


class FasterWhisperASREngine(ASREngine):
    def transcribe(self, audio_bytes: bytes, file_ext: str = "webm", language: Optional[str] = None) -> str:
        return transcribe_audio_bytes(audio_bytes, file_ext=file_ext, language=language)


class DefaultTranslationEngine(TranslationEngine):
    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        return translate_text(text, source_lang=source_lang, target_lang=target_lang)


class DefaultTTSEngine(TTSEngine):
    def synthesize(self, text: str, language: str) -> bytes:
        return get_tts_audio_bytes(text, language=language)


# =============================================================================
# VOICE ACTIVITY DETECTOR (VAD) & CHUNKER
# =============================================================================

class AudioVADChunker:
    """
    Detects voice energy and groups audio frames into 1.0s–2.0s chunks
    or detects silence boundaries to prevent cutting off words mid-speech.
    """

    def __init__(self, energy_threshold: float = 0.015, min_chunk_seconds: float = 1.0, max_chunk_seconds: float = 2.0):
        self.energy_threshold = energy_threshold
        self.min_chunk_seconds = min_chunk_seconds
        self.max_chunk_seconds = max_chunk_seconds
        self.buffer = bytearray()
        self.last_flush_time = time.time()

    def has_voice_activity(self, audio_bytes: bytes) -> bool:
        """
        Lightweight energy check to filter pure background silence.
        """
        if not audio_bytes or len(audio_bytes) < 100:
            return False
        # Calculate root-mean-square (RMS) energy approximation on raw byte samples
        try:
            # Simple sample amplitude check
            sample_stride = max(1, len(audio_bytes) // 500)
            samples = [abs(audio_bytes[i] - 128) for i in range(0, len(audio_bytes), sample_stride)]
            if not samples:
                return True
            avg_deviation = sum(samples) / len(samples)
            return avg_deviation > 2.0
        except Exception:
            return True


# =============================================================================
# DECOUPLED ASYNC SPEECH TRANSLATION WORKER
# =============================================================================

class SpeechTranslationWorker:
    """
    Worker queue that ingests audio frames, performs ASR -> MT -> TTS,
    and calculates end-to-end processing latency Δt (processing_latency_ms).
    """

    def __init__(
        self,
        room_code: str,
        asr_engine: Optional[ASREngine] = None,
        translation_engine: Optional[TranslationEngine] = None,
        tts_engine: Optional[TTSEngine] = None,
        on_result_callback: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
    ):
        self.room_code = room_code
        self.asr_engine = asr_engine or FasterWhisperASREngine()
        self.translation_engine = translation_engine or DefaultTranslationEngine()
        self.tts_engine = tts_engine or DefaultTTSEngine()
        self.vad_chunker = AudioVADChunker()
        self.on_result_callback = on_result_callback

        self.queue: asyncio.Queue = asyncio.Queue(maxsize=50)
        self.worker_task: Optional[asyncio.Task] = None
        self.is_running = False

        # Telemetry metrics
        self.last_latency_ms: float = 1800.0
        self.jitter_margin_ms: float = 200.0
        self.total_processed_chunks: int = 0

    def start(self):
        """Start the background consumer task."""
        if not self.is_running:
            self.is_running = True
            self.worker_task = asyncio.create_task(self._process_queue_loop())
            logger.info(f"Started SpeechTranslationWorker for room {self.room_code}")

    async def stop(self):
        """Stop worker cleanly."""
        self.is_running = False
        if self.worker_task:
            self.worker_task.cancel()
            try:
                await self.worker_task
            except asyncio.CancelledError:
                pass
            self.worker_task = None

    async def enqueue_audio_chunk(
        self,
        audio_bytes: bytes,
        source_lang: str = "en",
        target_languages: Optional[list[str]] = None,
        file_ext: str = "webm",
        pts_ms: Optional[float] = None,
    ):
        """
        Enqueues an incoming audio chunk from WebSocket or REST ingress.
        """
        if not self.vad_chunker.has_voice_activity(audio_bytes):
            logger.debug(f"Audio chunk dropped by VAD (silence) for room {self.room_code}")
            return

        payload = {
            "audio_bytes": audio_bytes,
            "source_lang": source_lang,
            "target_languages": target_languages or ["hi"],
            "file_ext": file_ext,
            "ingest_time_ms": time.time() * 1000.0,
            "pts_ms": pts_ms or (time.time() * 1000.0),
        }

        try:
            self.queue.put_nowait(payload)
        except asyncio.QueueFull:
            logger.warning(f"Speech worker queue full for room {self.room_code}, dropping oldest item")
            try:
                self.queue.get_nowait()
                self.queue.put_nowait(payload)
            except Exception:
                pass

    async def _process_queue_loop(self):
        """Consumes audio chunks and runs ASR -> MT -> TTS asynchronously."""
        while self.is_running:
            try:
                item = await self.queue.get()
                await self._execute_pipeline(item)
                self.queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in speech translation worker loop: {e}", exc_info=True)

    async def _execute_pipeline(self, item: Dict[str, Any]):
        t0 = time.time() * 1000.0
        audio_bytes = item["audio_bytes"]
        source_lang = item["source_lang"]
        target_languages = item["target_languages"]
        file_ext = item["file_ext"]
        ingest_time_ms = item["ingest_time_ms"]
        pts_ms = item["pts_ms"]

        # 1. ASR Transcription
        t_asr_start = time.time() * 1000.0
        loop = asyncio.get_running_loop()
        recognized_text = await loop.run_in_executor(
            None,
            self.asr_engine.transcribe,
            audio_bytes,
            file_ext,
            source_lang,
        )
        t_asr_end = time.time() * 1000.0
        asr_latency = t_asr_end - t_asr_start

        cleaned_text = recognized_text.strip() if recognized_text else ""
        if not cleaned_text:
            return

        # Estimate source spoken duration (roughly ~130-150 words per minute => ~400ms per word)
        word_count = max(1, len(cleaned_text.split()))
        est_source_duration_ms = word_count * 380.0

        # 2. Machine Translation (Batch for target languages)
        t_mt_start = time.time() * 1000.0
        translations: Dict[str, str] = {source_lang: cleaned_text}
        for tgt in target_languages:
            if tgt != source_lang:
                try:
                    translations[tgt] = await loop.run_in_executor(
                        None,
                        self.translation_engine.translate,
                        cleaned_text,
                        source_lang,
                        tgt,
                    )
                except Exception as e:
                    logger.warning(f"Translation failed for {tgt}: {e}")
                    translations[tgt] = cleaned_text
        t_mt_end = time.time() * 1000.0
        mt_latency = t_mt_end - t_mt_start

        # 3. TTS Synthesis for primary target language
        primary_tgt = target_languages[0] if target_languages else "hi"
        primary_translated_text = translations.get(primary_tgt, cleaned_text)

        t_tts_start = time.time() * 1000.0
        tts_audio = await loop.run_in_executor(
            None,
            self.tts_engine.synthesize,
            primary_translated_text,
            primary_tgt,
        )
        t_tts_end = time.time() * 1000.0
        tts_latency = t_tts_end - t_tts_start

        # Estimate TTS audio duration (~110-130 words per minute for synthesized speech)
        tgt_word_count = max(1, len(primary_translated_text.split()))
        est_tts_duration_ms = max(800.0, tgt_word_count * 420.0)

        # 4. Speech Expansion / Contraction Detection
        # If translated duration differs by > 15%, compute playback pacing factor
        expansion_ratio = est_tts_duration_ms / max(1.0, est_source_duration_ms)
        pacing_rate = 1.0
        if abs(expansion_ratio - 1.0) > 0.15:
            # Gracefully clamp pacing between 0.85x and 1.25x
            pacing_rate = round(max(0.85, min(1.25, expansion_ratio)), 2)

        # 5. Cumulative End-to-End Latency Tracking (Δt)
        total_pipeline_latency_ms = (time.time() * 1000.0) - ingest_time_ms
        self.last_latency_ms = total_pipeline_latency_ms
        self.total_processed_chunks += 1

        # Recommended video delay buffer duration
        recommended_video_delay_ms = round(total_pipeline_latency_ms + self.jitter_margin_ms, 1)

        result_payload = {
            "room_code": self.room_code,
            "pts_ms": pts_ms,
            "original_text": cleaned_text,
            "source_lang": source_lang,
            "translations": translations,
            "primary_target_lang": primary_tgt,
            "tts_audio_bytes": tts_audio,
            "pacing_rate": pacing_rate,
            "expansion_ratio": round(expansion_ratio, 2),
            "telemetry": {
                "asr_latency_ms": round(asr_latency, 1),
                "mt_latency_ms": round(mt_latency, 1),
                "tts_latency_ms": round(tts_latency, 1),
                "processing_latency_ms": round(total_pipeline_latency_ms, 1),
                "recommended_video_delay_ms": recommended_video_delay_ms,
            },
        }

        # 6. Egress to callback if provided
        if self.on_result_callback:
            try:
                await self.on_result_callback(result_payload)
            except Exception as e:
                logger.error(f"Result callback error in speech worker: {e}")
