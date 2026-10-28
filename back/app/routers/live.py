"""
Live Classroom Real-Time Translation, Transcription, and Audio Hub.
Provides WebSocket endpoints and REST APIs for interactive live classes:
- Teacher broadcasting with real-time speech transcription
- Student multi-lingual reception with live translated captions and mother-tongue speech audio
- Live student Q&A / doubt translation
- Automatic post-class lecture archiving and worksheet generation
"""

import os
import json
import logging
import asyncio
import base64
import urllib.parse
from datetime import datetime
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, status, Response, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models import User, Lecture, UserRole
from app.routers.auth import get_current_user
from app.config import settings
from app.services.translation_service import translate_text
from app.services.tts_service import text_to_speech, get_tts_audio_bytes
from app.services.asr_service import transcribe_audio, transcribe_audio_bytes
from app.services.worksheet_service import create_or_get_worksheet
from app.services.video_sync_buffer import VideoSyncBuffer, VideoFrame
from app.services.speech_worker import SpeechTranslationWorker

logger = logging.getLogger(__name__)
router = APIRouter()


class RoomCreateRequest(BaseModel):
    title: str
    subject: str = "General"
    grade_level: int = 5
    original_language: str = "en"


class RoomInfo(BaseModel):
    room_code: str
    title: str
    subject: str
    grade_level: int
    original_language: str
    teacher_id: int
    teacher_name: str
    student_count: int
    created_at: str
    is_active: bool


class LiveClassManager:
    """Manages active live classroom sessions, WebSockets, and real-time translation."""

    def __init__(self):
        self.rooms: Dict[str, Dict[str, Any]] = {}
        self.teacher_sockets: Dict[str, WebSocket] = {}
        self.student_sockets: Dict[str, List[Dict[str, Any]]] = {}
        self.video_buffers: Dict[str, VideoSyncBuffer] = {}
        self.speech_workers: Dict[str, SpeechTranslationWorker] = {}

    def create_room(
        self,
        title: str,
        subject: str,
        grade_level: int,
        original_language: str,
        teacher_id: int,
        teacher_name: str,
    ) -> str:
        # Generate memorable 6-character room code like "SCI-501" or "LIVE-123"
        import random
        prefix = subject[:3].upper() if len(subject) >= 3 else "CLS"
        num = random.randint(100, 999)
        room_code = f"{prefix}-{num}"

        # Avoid collision
        while room_code in self.rooms and self.rooms[room_code]["is_active"]:
            room_code = f"{prefix}-{random.randint(100, 999)}"

        self.rooms[room_code] = {
            "room_code": room_code,
            "title": title,
            "subject": subject,
            "grade_level": grade_level,
            "original_language": original_language,
            "teacher_id": teacher_id,
            "teacher_name": teacher_name,
            "transcript_history": [],
            "qa_history": [],
            "created_at": datetime.utcnow().isoformat(),
            "is_active": True,
            "enable_live_translation": True,
        }
        self.student_sockets[room_code] = []

        # Initialize synchronized video ring buffer and speech worker queue
        self.video_buffers[room_code] = VideoSyncBuffer(max_capacity=300)
        worker = SpeechTranslationWorker(
            room_code=room_code,
            on_result_callback=self._handle_speech_worker_result,
        )
        worker.start()
        self.speech_workers[room_code] = worker

        logger.info(f"Created live classroom: {room_code} by {teacher_name}")
        return room_code

    def get_room(self, room_code: str) -> Optional[Dict[str, Any]]:
        return self.rooms.get(room_code)

    def list_active_rooms(self) -> List[Dict[str, Any]]:
        active = []
        for code, r in self.rooms.items():
            if r.get("is_active"):
                students = self.student_sockets.get(code, [])
                active.append({
                    "room_code": code,
                    "title": r["title"],
                    "subject": r["subject"],
                    "grade_level": r["grade_level"],
                    "original_language": r["original_language"],
                    "teacher_id": r["teacher_id"],
                    "teacher_name": r["teacher_name"],
                    "student_count": len(students),
                    "created_at": r["created_at"],
                    "is_active": True,
                })
        return active

    async def register_teacher(self, room_code: str, websocket: WebSocket):
        await websocket.accept()
        self.teacher_sockets[room_code] = websocket
        logger.info(f"Teacher connected to live room {room_code}")

    def unregister_teacher(self, room_code: str):
        if room_code in self.teacher_sockets:
            del self.teacher_sockets[room_code]
        logger.info(f"Teacher disconnected from live room {room_code}")

    async def register_student(self, room_code: str, websocket: WebSocket, student_info: Dict[str, Any]):
        await websocket.accept()
        if room_code not in self.student_sockets:
            self.student_sockets[room_code] = []
        
        entry = {"ws": websocket, "info": student_info}
        self.student_sockets[room_code].append(entry)
        logger.info(f"Student {student_info.get('name')} ({student_info.get('language')}) joined {room_code}")

        # Notify teacher of student count update
        await self._notify_teacher_roster(room_code)

    async def unregister_student(self, room_code: str, websocket: WebSocket):
        if room_code in self.student_sockets:
            self.student_sockets[room_code] = [
                s for s in self.student_sockets[room_code] if s["ws"] != websocket
            ]
        await self._notify_teacher_roster(room_code)

    async def _notify_teacher_roster(self, room_code: str):
        teacher_ws = self.teacher_sockets.get(room_code)
        if teacher_ws:
            students = self.student_sockets.get(room_code, [])
            try:
                await teacher_ws.send_json({
                    "type": "roster_update",
                    "student_count": len(students),
                    "students": [s["info"] for s in students],
                })
            except Exception:
                pass

    async def _handle_speech_worker_result(self, result: Dict[str, Any]):
        """
        Receives asynchronously processed speech chunks from the SpeechTranslationWorker,
        retrieves the matching delayed video frame from VideoSyncBuffer, and simultaneously
        broadcasts synchronized media packets to students.
        """
        room_code = result["room_code"]
        room = self.get_room(room_code)
        if not room or not room.get("is_active"):
            return

        original_text = result["original_text"]
        source_lang = result["source_lang"]
        translations = result["translations"]
        telemetry = result["telemetry"]
        pacing_rate = result.get("pacing_rate", 1.0)
        recommended_delay = telemetry.get("recommended_video_delay_ms", 1800.0)
        is_translation_enabled = room.get("enable_live_translation", True)

        # Retrieve synchronized delayed video frame from in-memory ring buffer
        video_buf = self.video_buffers.get(room_code)
        delayed_frame: Optional[VideoFrame] = None
        if video_buf:
            if is_translation_enabled:
                delayed_frame = video_buf.get_delayed_frame(video_delay_ms=recommended_delay)
            else:
                delayed_frame = video_buf.get_latest_frame()

        frame_data = delayed_frame.frame_data if delayed_frame else None
        frame_pts = delayed_frame.pts_ms if delayed_frame else result.get("pts_ms")
        timestamp = datetime.utcnow().strftime("%H:%M:%S")

        # 1. Update live transcript history with telemetry
        room["transcript_history"].append({
            "speaker": "teacher",
            "text": original_text,
            "source_lang": source_lang,
            "translations": translations,
            "timestamp": timestamp,
            "telemetry": telemetry,
        })

        # 2. Acknowledge back to teacher socket with latency telemetry
        teacher_ws = self.teacher_sockets.get(room_code)
        if teacher_ws:
            try:
                await teacher_ws.send_json({
                    "type": "speech_ack",
                    "text": original_text,
                    "timestamp": timestamp,
                    "telemetry": telemetry,
                    "pacing_rate": pacing_rate,
                })
            except Exception:
                pass

        # 3. Synchronized egress release to students
        students = self.student_sockets.get(room_code, [])
        for s in list(students):
            ws = s["ws"]
            lang = s["info"].get("language", "hi")
            translated = translations.get(lang, original_text)
            audio_url = f"/api/live/tts?language={lang}&text={urllib.parse.quote(translated)}"
            try:
                # Standard caption for 100% backward compatibility
                await ws.send_json({
                    "type": "live_caption",
                    "original_text": original_text,
                    "translated_text": translated,
                    "target_language": lang,
                    "audio_url": audio_url,
                    "timestamp": timestamp,
                })
                # Synchronized media packet
                await ws.send_json({
                    "type": "synced_media_packet",
                    "original_text": original_text,
                    "translated_text": translated,
                    "target_language": lang,
                    "audio_url": audio_url,
                    "frame": frame_data,
                    "pts_ms": frame_pts,
                    "pacing_rate": pacing_rate,
                    "processing_latency_ms": telemetry.get("processing_latency_ms", 1800.0),
                    "video_delay_ms": recommended_delay if is_translation_enabled else 0.0,
                    "enable_live_translation": is_translation_enabled,
                    "timestamp": timestamp,
                })
            except Exception:
                pass

    async def broadcast_speech(self, room_code: str, raw_text: str, source_lang: str):
        """
        Receives speech transcribed from the teacher, translates on-the-fly for
        each student's unique language preference, and sends live translated captions
        along with audio playback triggers and synchronized video packets.
        """
        room = self.get_room(room_code)
        if not room:
            return

        text = raw_text.strip()
        if not text:
            return

        timestamp = datetime.utcnow().strftime("%H:%M:%S")

        # 1. Identify which target languages are needed for connected students
        students = self.student_sockets.get(room_code, [])
        needed_languages = {s["info"].get("language", "en") for s in students}
        needed_languages.add(source_lang)

        # 2. Batch-translate for needed languages
        translations = {source_lang: text}
        for target_lang in needed_languages:
            if target_lang != source_lang:
                try:
                    translations[target_lang] = translate_text(text, source_lang, target_lang)
                except Exception as e:
                    logger.warning(f"Live translation failed for {target_lang}: {e}")
                    translations[target_lang] = text

        # 3. Store in live transcript history
        room["transcript_history"].append({
            "speaker": "teacher",
            "text": text,
            "source_lang": source_lang,
            "translations": translations,
            "timestamp": timestamp,
        })

        # 4. Acknowledge back to teacher socket
        teacher_ws = self.teacher_sockets.get(room_code)
        if teacher_ws:
            try:
                await teacher_ws.send_json({
                    "type": "speech_ack",
                    "text": text,
                    "timestamp": timestamp,
                })
            except Exception:
                pass

        # 5. Query delayed video frame from in-memory ring buffer
        is_translation_enabled = room.get("enable_live_translation", True)
        video_buf = self.video_buffers.get(room_code)
        delayed_frame: Optional[VideoFrame] = None
        if video_buf:
            delayed_frame = (
                video_buf.get_delayed_frame(video_delay_ms=1800.0)
                if is_translation_enabled
                else video_buf.get_latest_frame()
            )
        frame_data = delayed_frame.frame_data if delayed_frame else None
        frame_pts = delayed_frame.pts_ms if delayed_frame else None

        # 6. Broadcast to each student in their exact target language with speech audio url & synced media packet
        for student_entry in list(students):
            ws = student_entry["ws"]
            lang = student_entry["info"].get("language", "en")
            student_translated = translations.get(lang, text)
            audio_url = f"/api/live/tts?language={lang}&text={urllib.parse.quote(student_translated)}"

            # Pacing adjustment calculation for speech expansion/contraction (>15%)
            word_ratio = len(student_translated.split()) / max(1, len(text.split()))
            pacing_rate = round(max(0.85, min(1.25, word_ratio)), 2) if abs(word_ratio - 1.0) > 0.15 else 1.0

            try:
                # Standard live_caption for 100% backward compatibility with legacy consumers
                await ws.send_json({
                    "type": "live_caption",
                    "original_text": text,
                    "translated_text": student_translated,
                    "target_language": lang,
                    "audio_url": audio_url,
                    "timestamp": timestamp,
                })

                # Synchronized media packet with PTS & delayed video frame when video streaming is active
                has_video = (video_buf is not None and len(video_buf._buffer) > 0) or frame_data is not None
                if has_video:
                    await ws.send_json({
                        "type": "synced_media_packet",
                        "original_text": text,
                        "translated_text": student_translated,
                        "target_language": lang,
                        "audio_url": audio_url,
                        "frame": frame_data,
                        "pts_ms": frame_pts,
                        "pacing_rate": pacing_rate,
                        "processing_latency_ms": 1600.0,
                        "video_delay_ms": 1800.0 if is_translation_enabled else 0.0,
                        "enable_live_translation": is_translation_enabled,
                        "timestamp": timestamp,
                    })
            except Exception as e:
                logger.debug(f"Failed to send to student socket: {e}")

    async def handle_student_doubt(
        self,
        room_code: str,
        student_name: str,
        question: str,
        student_lang: str,
    ):
        """
        Receives a question from a student in their mother tongue,
        translates it into the teacher's language, and pushes it to teacher's live dashboard.
        """
        room = self.get_room(room_code)
        if not room:
            return

        teacher_lang = room.get("original_language", "en")
        translated_q = question
        if student_lang != teacher_lang:
            try:
                translated_q = translate_text(question, student_lang, teacher_lang)
            except Exception:
                translated_q = question

        timestamp = datetime.utcnow().strftime("%H:%M:%S")
        entry = {
            "student_name": student_name,
            "question": question,
            "student_lang": student_lang,
            "translated_question": translated_q,
            "audio_url": f"/api/live/tts?language={teacher_lang}&text={urllib.parse.quote(translated_q)}",
            "original_audio_url": f"/api/live/tts?language={student_lang}&text={urllib.parse.quote(question)}",
            "timestamp": timestamp,
        }
        room["qa_history"].append(entry)

        teacher_ws = self.teacher_sockets.get(room_code)
        if teacher_ws:
            try:
                await teacher_ws.send_json({
                    "type": "student_doubt",
                    "doubt": entry,
                })
            except Exception:
                pass

    async def end_room(self, room_code: str, db: Session) -> Optional[Lecture]:
        """
        Ends the live room, archives the transcript into a permanent Lecture,
        pre-generates practice worksheets, and notifies all participants.
        """
        room = self.get_room(room_code)
        if not room:
            return None

        room["is_active"] = False

        # Compile full lecture transcript
        segments = [item["text"] for item in room["transcript_history"] if item.get("text")]
        full_transcript = " ".join(segments).strip()
        if not full_transcript:
            full_transcript = f"Live classroom session for {room['title']}. Topics covered: {room['subject']}."

        # 1. Save transcript file
        os.makedirs(f"{settings.storage_path}/transcripts", exist_ok=True)
        os.makedirs(f"{settings.storage_path}/lectures", exist_ok=True)

        stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_code = room_code.replace("-", "_")
        trans_file = f"transcript_live_{safe_code}_{stamp}.txt"
        trans_path = f"{settings.storage_path}/transcripts/{trans_file}"
        with open(trans_path, "w", encoding="utf-8") as f:
            f.write(full_transcript)

        # 2. Synthesize complete audio archive
        audio_file = f"live_{safe_code}_{stamp}.mp3"
        audio_path = f"{settings.storage_path}/lectures/{audio_file}"
        try:
            text_to_speech(full_transcript[:2000], room["original_language"], audio_path)
        except Exception:
            with open(audio_path, "wb") as f:
                f.write(b"")

        # 3. Create Lecture record
        lecture = Lecture(
            teacher_id=room["teacher_id"],
            title=f"[Live Class] {room['title']}",
            description=f"Recorded live session ({room_code}) - {room['subject']}. Taught by {room['teacher_name']}.",
            subject=room["subject"],
            grade_level=room["grade_level"],
            original_language=room["original_language"],
            original_file_path=audio_path,
            transcript_text=full_transcript,
            transcript_path=trans_path,
            duration_seconds=len(full_transcript.split()) // 2,
        )
        db.add(lecture)
        db.commit()
        db.refresh(lecture)

        # 4. Auto-generate practice worksheet for the live class
        try:
            create_or_get_worksheet(lecture.id, room["original_language"], db)
            create_or_get_worksheet(lecture.id, "hi", db)
        except Exception as e:
            logger.warning(f"Could not auto-generate worksheet for live class: {e}")

        # 5. Broadcast class ended to all sockets
        end_payload = {
            "type": "class_ended",
            "message": "The live classroom has ended. The session is now archived as an interactive lesson!",
            "lecture_id": lecture.id,
        }

        teacher_ws = self.teacher_sockets.get(room_code)
        if teacher_ws:
            try:
                await teacher_ws.send_json(end_payload)
            except Exception:
                pass

        for s in self.student_sockets.get(room_code, []):
            try:
                await s["ws"].send_json(end_payload)
            except Exception:
                pass

        # Stop speech worker and flush video buffer
        worker = self.speech_workers.get(room_code)
        if worker:
            try:
                await worker.stop()
            except Exception:
                pass
            self.speech_workers.pop(room_code, None)

        if room_code in self.video_buffers:
            self.video_buffers.pop(room_code, None)

        logger.info(f"Live class {room_code} archived as Lecture ID={lecture.id}")
        return lecture


# Singleton manager
live_manager = LiveClassManager()


# =============================================================================
# REST API ENDPOINTS
# =============================================================================

@router.post("/rooms/create", response_model=RoomInfo)
async def create_live_room(
    data: RoomCreateRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Teacher endpoint to initialize a new live classroom room.
    """
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can create live classroom sessions.",
        )

    room_code = live_manager.create_room(
        title=data.title,
        subject=data.subject,
        grade_level=data.grade_level,
        original_language=data.original_language,
        teacher_id=current_user.id,
        teacher_name=current_user.full_name,
    )

    room = live_manager.get_room(room_code)
    return {
        "room_code": room_code,
        "title": room["title"],
        "subject": room["subject"],
        "grade_level": room["grade_level"],
        "original_language": room["original_language"],
        "teacher_id": room["teacher_id"],
        "teacher_name": room["teacher_name"],
        "student_count": 0,
        "created_at": room["created_at"],
        "is_active": True,
    }


@router.get("/rooms/active", response_model=List[RoomInfo])
async def list_active_rooms():
    """
    List all currently live classrooms for students to browse and join.
    """
    return live_manager.list_active_rooms()


@router.get("/rooms/{room_code}", response_model=RoomInfo)
async def get_room_details(room_code: str):
    """
    Get metadata for a specific live classroom.
    """
    room = live_manager.get_room(room_code)
    if not room or not room["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Live classroom not found or has ended.",
        )

    students = live_manager.student_sockets.get(room_code, [])
    return {
        "room_code": room["room_code"],
        "title": room["title"],
        "subject": room["subject"],
        "grade_level": room["grade_level"],
        "original_language": room["original_language"],
        "teacher_id": room["teacher_id"],
        "teacher_name": room["teacher_name"],
        "student_count": len(students),
        "created_at": room["created_at"],
        "is_active": room["is_active"],
    }


@router.post("/rooms/{room_code}/end")
async def end_live_room(
    room_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Teacher concludes the live class. Automatically creates an archived lecture
    with synchronized transcripts and worksheets.
    """
    room = live_manager.get_room(room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room["teacher_id"] != current_user.id and current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Unauthorized to end this room")

    lecture = await live_manager.end_room(room_code, db)
    return {
        "message": "Live class ended and successfully archived.",
        "room_code": room_code,
        "lecture_id": lecture.id if lecture else None,
    }


@router.get("/tts")
async def live_text_to_speech(
    text: str = Query(..., description="Text to synthesize"),
    language: str = Query("hi", description="Target language code"),
):
    """
    Synthesize and stream live spoken translation audio in MP3 format.
    Cached in-memory for instant playback on student and teacher clients.
    """
    cleaned = text.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    audio_bytes = get_tts_audio_bytes(cleaned, language)
    if not audio_bytes:
        raise HTTPException(status_code=500, detail="Could not generate speech audio")

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f'inline; filename="tts_{language}.mp3"',
        },
    )


@router.post("/transcribe")
async def transcribe_live_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """
    Transcribe uploaded audio snippet/chunk (WebM, WAV, MP3, etc.) using Whisper ASR.
    Allows browsers without Web Speech API or microphone recordings to obtain server-side speech recognition.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Audio file is empty")

        filename = file.filename or "recording.webm"
        ext = os.path.splitext(filename)[1].lstrip(".") or "webm"
        text = transcribe_audio_bytes(content, file_ext=ext, language=language)
        return {
            "text": text,
            "language": language,
            "filename": filename,
        }
    except Exception as e:
        logger.error(f"Live audio transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# =============================================================================
# WEBSOCKET REAL-TIME ENDPOINTS
# =============================================================================

@router.websocket("/ws/{room_code}/teacher")
async def teacher_websocket(websocket: WebSocket, room_code: str):
    """
    Teacher WebSocket connection:
    - Streams speech text / recognized speech in real time
    - Accepts direct audio chunks (audio_data) with server-side Whisper ASR
    - Receives student doubt notifications and student attendance updates
    """
    room = live_manager.get_room(room_code)
    if not room or not room["is_active"]:
        await websocket.close(code=4004, reason="Room does not exist or has ended")
        return

    await live_manager.register_teacher(room_code, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "speech":
                # Teacher spoke a sentence (from browser speech recognition or text)
                raw_text = data.get("text", "")
                source_lang = data.get("language", room["original_language"])
                await live_manager.broadcast_speech(room_code, raw_text, source_lang)

            elif msg_type == "audio_data":
                # Teacher streamed an audio chunk (base64)
                audio_base64 = data.get("audio_base64") or data.get("audio", "")
                format_ext = data.get("format", "webm")
                source_lang = data.get("language", room["original_language"])
                if audio_base64:
                    try:
                        raw_bytes = base64.b64decode(audio_base64)
                        # Feed into decoupled speech worker queue for async processing
                        worker = live_manager.speech_workers.get(room_code)
                        if worker:
                            target_langs = [
                                s["info"].get("language", "hi")
                                for s in live_manager.student_sockets.get(room_code, [])
                            ]
                            if not target_langs:
                                target_langs = ["hi"]
                            await worker.enqueue_audio_chunk(
                                audio_bytes=raw_bytes,
                                source_lang=source_lang,
                                target_languages=target_langs,
                                file_ext=format_ext,
                            )

                        recognized = transcribe_audio_bytes(raw_bytes, file_ext=format_ext, language=source_lang)
                        if recognized and recognized.strip():
                            await live_manager.broadcast_speech(room_code, recognized.strip(), source_lang)
                        else:
                            await websocket.send_json({
                                "type": "speech_empty",
                                "message": "No audible speech recognized in this audio snippet.",
                            })
                    except Exception as e:
                        logger.error(f"Teacher audio chunk processing error: {e}")
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Audio processing error: {str(e)}",
                        })

            elif msg_type == "video_frame":
                # Teacher streamed a video frame (base64 or JPEG data url)
                frame_data = data.get("frame") or data.get("frame_data")
                pts_ms = data.get("pts_ms") or data.get("timestamp")
                is_keyframe = data.get("is_keyframe", False)
                video_buf = live_manager.video_buffers.get(room_code)
                if video_buf and frame_data:
                    video_buf.push_frame(frame_data, pts_ms=pts_ms, is_keyframe=is_keyframe)

            elif msg_type == "toggle_translation":
                # Teacher toggles real-time delayed video translation pipeline
                enabled = bool(data.get("enabled", True))
                if room:
                    room["enable_live_translation"] = enabled
                    await websocket.send_json({
                        "type": "translation_toggled",
                        "enabled": enabled,
                    })

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        live_manager.unregister_teacher(room_code)
    except Exception as e:
        logger.error(f"Teacher WS error in {room_code}: {e}")
        live_manager.unregister_teacher(room_code)


@router.websocket("/ws/{room_code}/student")
async def student_websocket(
    websocket: WebSocket,
    room_code: str,
    name: str = Query("Student"),
    language: str = Query("hi"),
):
    """
    Student WebSocket connection:
    - Automatically receives live captions translated to student's mother tongue with audio URLs
    - Can submit doubts / questions in student's mother tongue via text or microphone (audio_doubt)
    """
    room = live_manager.get_room(room_code)
    if not room or not room["is_active"]:
        await websocket.close(code=4004, reason="Room does not exist or has ended")
        return

    student_info = {
        "name": name,
        "language": language,
        "joined_at": datetime.utcnow().strftime("%H:%M:%S"),
    }

    await live_manager.register_student(room_code, websocket, student_info)

    # Send welcome state and historical recent transcripts
    try:
        recent_transcripts = []
        for item in room["transcript_history"][-8:]:
            translated = item["translations"].get(language, item["text"])
            recent_transcripts.append({
                "original_text": item["text"],
                "translated_text": translated,
                "audio_url": f"/api/live/tts?language={language}&text={urllib.parse.quote(translated)}",
                "timestamp": item["timestamp"],
            })

        await websocket.send_json({
            "type": "welcome",
            "room_code": room_code,
            "title": room["title"],
            "teacher_name": room["teacher_name"],
            "preferred_language": language,
            "recent_transcripts": recent_transcripts,
        })
    except Exception:
        pass

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ask_doubt":
                # Student asked a question in their language (text)
                question = data.get("question", "")
                await live_manager.handle_student_doubt(
                    room_code=room_code,
                    student_name=name,
                    question=question,
                    student_lang=language,
                )
                await websocket.send_json({
                    "type": "doubt_sent",
                    "question": question,
                    "status": "Delivered to teacher",
                })

            elif msg_type == "audio_doubt":
                # Student asked a doubt via microphone (Audio In)
                audio_base64 = data.get("audio_base64") or data.get("audio", "")
                format_ext = data.get("format", "webm")
                student_lang = data.get("language", language)
                if audio_base64:
                    try:
                        raw_bytes = base64.b64decode(audio_base64)
                        recognized_question = transcribe_audio_bytes(raw_bytes, file_ext=format_ext, language=student_lang)
                        if recognized_question and recognized_question.strip():
                            await live_manager.handle_student_doubt(
                                room_code=room_code,
                                student_name=name,
                                question=recognized_question.strip(),
                                student_lang=student_lang,
                            )
                            await websocket.send_json({
                                "type": "doubt_sent",
                                "question": recognized_question.strip(),
                                "status": "Transcribed & delivered to teacher",
                            })
                        else:
                            await websocket.send_json({
                                "type": "doubt_error",
                                "message": "Could not recognize speech in audio doubt.",
                            })
                    except Exception as e:
                        logger.error(f"Student audio doubt error: {e}")
                        await websocket.send_json({
                            "type": "doubt_error",
                            "message": f"Audio processing error: {str(e)}",
                        })

            elif msg_type == "change_language":
                # Student switched preferred language mid-class
                new_lang = data.get("language", language)
                student_info["language"] = new_lang
                await websocket.send_json({
                    "type": "language_changed",
                    "language": new_lang,
                })

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        await live_manager.unregister_student(room_code, websocket)
    except Exception as e:
        logger.error(f"Student WS error in {room_code}: {e}")
        await live_manager.unregister_student(room_code, websocket)

