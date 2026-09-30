from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime
from pydantic import BaseModel
import os
import re
import shutil
from app.database import get_db
from app.models import User, Lecture, DubbedLecture, UserRole
from app.routers.auth import get_current_user
from app.config import settings
from app.tasks import dispatch_lecture_dubbing

router = APIRouter()


class LectureCreate(BaseModel):
    title: str
    description: str | None = None
    subject: str | None = None
    grade_level: int | None = None
    original_language: str


class LectureResponse(BaseModel):
    id: int
    title: str
    description: str | None
    subject: str | None
    grade_level: int | None
    original_language: str
    media_url: str | None = None
    media_type: str | None = "audio"
    duration_seconds: int | None
    created_at: datetime
    has_transcript: bool
    available_languages: List[str]


class DubbedLectureResponse(BaseModel):
    id: int
    lecture_id: int
    target_language: str
    status: str
    dubbed_audio_url: str | None
    transcript_url: str | None
    created_at: datetime
    completed_at: datetime | None


def _get_media_info(file_path: str):
    if not file_path:
        return None, "audio"
    filename = os.path.basename(file_path)
    file_ext = os.path.splitext(filename)[1].lower()
    media_type = "video" if file_ext in {'.mp4', '.webm', '.mkv', '.mov'} else "audio"
    media_url = f"/storage/lectures/{filename}"
    return media_url, media_type


@router.post("/upload", response_model=LectureResponse)
async def upload_lecture(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(None),
    subject: str = Form(None),
    grade_level: int = Form(None),
    original_language: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can upload lectures")
    
    # Validate file type
    allowed_extensions = ['.mp4', '.mp3', '.wav', '.m4a', '.webm']
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type not supported. Allowed: {allowed_extensions}")
    
    # Generate unique, sanitized filename
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    base_name = os.path.basename(file.filename)
    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', base_name)
    safe_filename = f"{timestamp}_{safe_name}"
    
    os.makedirs(f"{settings.storage_path}/lectures", exist_ok=True)
    file_path = f"{settings.storage_path}/lectures/{safe_filename}"
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Create lecture record
    lecture = Lecture(
        teacher_id=current_user.id,
        title=title,
        description=description,
        subject=subject,
        grade_level=grade_level,
        original_language=original_language,
        original_file_path=file_path
    )
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    
    media_url, media_type = _get_media_info(file_path)
    
    return {
        "id": lecture.id,
        "title": lecture.title,
        "description": lecture.description,
        "subject": lecture.subject,
        "grade_level": lecture.grade_level,
        "original_language": lecture.original_language,
        "media_url": media_url,
        "media_type": media_type,
        "duration_seconds": lecture.duration_seconds,
        "created_at": lecture.created_at,
        "has_transcript": lecture.transcript_text is not None,
        "available_languages": [lecture.original_language]
    }


@router.get("/", response_model=List[LectureResponse])
async def list_lectures(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Lecture).options(joinedload(Lecture.dubbed_versions))
    if current_user.role == UserRole.TEACHER:
        lectures = query.filter(Lecture.teacher_id == current_user.id).all()
    else:
        lectures = query.all()
    
    result = []
    for lecture in lectures:
        completed_dubs = [dub.target_language for dub in lecture.dubbed_versions if dub.status == "completed"]
        # Ensure original language is always presented as available
        available_languages = list(dict.fromkeys([lecture.original_language] + completed_dubs))
        media_url, media_type = _get_media_info(lecture.original_file_path)
        
        result.append({
            "id": lecture.id,
            "title": lecture.title,
            "description": lecture.description,
            "subject": lecture.subject,
            "grade_level": lecture.grade_level,
            "original_language": lecture.original_language,
            "media_url": media_url,
            "media_type": media_type,
            "duration_seconds": lecture.duration_seconds,
            "created_at": lecture.created_at,
            "has_transcript": lecture.transcript_text is not None,
            "available_languages": available_languages
        })
    
    return result


@router.get("/{lecture_id}", response_model=LectureResponse)
async def get_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lecture = db.query(Lecture).options(joinedload(Lecture.dubbed_versions)).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    completed_dubs = [dub.target_language for dub in lecture.dubbed_versions if dub.status == "completed"]
    available_languages = list(dict.fromkeys([lecture.original_language] + completed_dubs))
    media_url, media_type = _get_media_info(lecture.original_file_path)
    
    return {
        "id": lecture.id,
        "title": lecture.title,
        "description": lecture.description,
        "subject": lecture.subject,
        "grade_level": lecture.grade_level,
        "original_language": lecture.original_language,
        "media_url": media_url,
        "media_type": media_type,
        "duration_seconds": lecture.duration_seconds,
        "created_at": lecture.created_at,
        "has_transcript": lecture.transcript_text is not None,
        "available_languages": available_languages
    }


@router.post("/{lecture_id}/dub/{target_language}", response_model=DubbedLectureResponse)
async def request_dubbed_lecture(
    lecture_id: int,
    target_language: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate language
    if target_language not in settings.supported_languages:
        raise HTTPException(status_code=400, detail=f"Language not supported. Supported: {settings.supported_languages}")
    
    # Get lecture
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    # If target language is original language, return original media directly
    if target_language == lecture.original_language:
        media_url, _ = _get_media_info(lecture.original_file_path)
        transcript_url = f"/storage/transcripts/{os.path.basename(lecture.transcript_path)}" if lecture.transcript_path else None
        return {
            "id": 0,
            "lecture_id": lecture.id,
            "target_language": target_language,
            "status": "completed",
            "dubbed_audio_url": media_url,
            "transcript_url": transcript_url,
            "created_at": lecture.created_at,
            "completed_at": lecture.created_at
        }
    
    # Check if dubbed version already exists
    existing_dub = db.query(DubbedLecture).filter(
        DubbedLecture.lecture_id == lecture_id,
        DubbedLecture.target_language == target_language
    ).first()
    
    if existing_dub:
        dubbed_audio_url = f"/storage/dubbed/{os.path.basename(existing_dub.dubbed_audio_path)}" if (existing_dub.status == "completed" and existing_dub.dubbed_audio_path) else None
        transcript_url = f"/storage/transcripts/{os.path.basename(existing_dub.translated_transcript_path)}" if existing_dub.translated_transcript_path else None
        
        # If previous job failed, allow retrying
        if existing_dub.status == "failed":
            existing_dub.status = "pending"
            db.commit()
            dispatch_lecture_dubbing(existing_dub.id)
        
        return {
            "id": existing_dub.id,
            "lecture_id": existing_dub.lecture_id,
            "target_language": existing_dub.target_language,
            "status": existing_dub.status,
            "dubbed_audio_url": dubbed_audio_url,
            "transcript_url": transcript_url,
            "created_at": existing_dub.created_at,
            "completed_at": existing_dub.completed_at
        }
    
    # Create new dubbing job
    dubbed_lecture = DubbedLecture(
        lecture_id=lecture_id,
        target_language=target_language,
        dubbed_audio_path="",
        status="pending"
    )
    db.add(dubbed_lecture)
    db.commit()
    db.refresh(dubbed_lecture)
    
    # Dispatch background job (Celery or background thread fallback)
    dispatch_lecture_dubbing(dubbed_lecture.id)
    
    return {
        "id": dubbed_lecture.id,
        "lecture_id": dubbed_lecture.lecture_id,
        "target_language": dubbed_lecture.target_language,
        "status": dubbed_lecture.status,
        "dubbed_audio_url": None,
        "transcript_url": None,
        "created_at": dubbed_lecture.created_at,
        "completed_at": None
    }


@router.get("/{lecture_id}/dub/{target_language}/status", response_model=DubbedLectureResponse)
async def get_dubbing_status(
    lecture_id: int,
    target_language: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    if target_language == lecture.original_language:
        media_url, _ = _get_media_info(lecture.original_file_path)
        transcript_url = f"/storage/transcripts/{os.path.basename(lecture.transcript_path)}" if lecture.transcript_path else None
        return {
            "id": 0,
            "lecture_id": lecture.id,
            "target_language": target_language,
            "status": "completed",
            "dubbed_audio_url": media_url,
            "transcript_url": transcript_url,
            "created_at": lecture.created_at,
            "completed_at": lecture.created_at
        }
    
    dubbed_lecture = db.query(DubbedLecture).filter(
        DubbedLecture.lecture_id == lecture_id,
        DubbedLecture.target_language == target_language
    ).first()
    
    if not dubbed_lecture:
        raise HTTPException(status_code=404, detail="Dubbed version not found")
    
    dubbed_audio_url = f"/storage/dubbed/{os.path.basename(dubbed_lecture.dubbed_audio_path)}" if (dubbed_lecture.status == "completed" and dubbed_lecture.dubbed_audio_path) else None
    transcript_url = f"/storage/transcripts/{os.path.basename(dubbed_lecture.translated_transcript_path)}" if dubbed_lecture.translated_transcript_path else None
    
    return {
        "id": dubbed_lecture.id,
        "lecture_id": dubbed_lecture.lecture_id,
        "target_language": dubbed_lecture.target_language,
        "status": dubbed_lecture.status,
        "dubbed_audio_url": dubbed_audio_url,
        "transcript_url": transcript_url,
        "created_at": dubbed_lecture.created_at,
        "completed_at": dubbed_lecture.completed_at
    }

