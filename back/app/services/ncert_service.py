"""
NCERT Curriculum Service.
Handles querying the authentic NCERT book curriculum and automatically
converting NCERT chapters into interactive lectures with multilingual audio and practice worksheets.
"""

import os
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Lecture, User, UserRole
from app.data.ncert_data import (
    NCERT_CURRICULUM,
    get_all_chapters,
    get_chapters_by_grade,
    get_chapter_by_id,
)
from app.services.tts_service import text_to_speech
from app.services.worksheet_service import create_or_get_worksheet

logger = logging.getLogger(__name__)


def get_curriculum_overview() -> Dict[str, Any]:
    """
    Returns an overview of all classes (1 to 8), total books, and subjects available.
    """
    classes_summary = []
    for grade in range(1, 9):
        grade_chapters = [c for c in NCERT_CURRICULUM if c["grade_level"] == grade]
        subjects = list(dict.fromkeys(c["subject"] for c in grade_chapters))
        books = list(dict.fromkeys(c["book_name"] for c in grade_chapters))
        classes_summary.append({
            "grade_level": grade,
            "grade_name": f"Class {grade}",
            "chapter_count": len(grade_chapters),
            "subjects": subjects,
            "books": books,
        })

    return {
        "board": "NCERT (National Council of Educational Research and Training)",
        "country": "India",
        "total_chapters": len(NCERT_CURRICULUM),
        "classes": classes_summary,
    }


def search_ncert_chapters(
    grade_level: Optional[int] = None,
    subject: Optional[str] = None,
    query: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Filter and search NCERT chapters by grade, subject, and keyword.
    """
    results = NCERT_CURRICULUM

    if grade_level is not None:
        results = [c for c in results if c["grade_level"] == grade_level]

    if subject:
        sub_lower = subject.lower()
        results = [c for c in results if sub_lower in c["subject"].lower()]

    if query:
        q_lower = query.lower()
        results = [
            c for c in results
            if q_lower in c["title"].lower()
            or q_lower in c["title_hindi"].lower()
            or q_lower in c["book_name"].lower()
            or q_lower in c["description"].lower()
            or any(q_lower in concept.lower() for concept in c.get("core_concepts", []))
        ]

    return results


def adopt_ncert_chapter_as_lecture(
    chapter_id: str,
    user: User,
    db: Session,
) -> Lecture:
    """
    Converts an NCERT chapter into an active interactive Lecture in the platform:
    1. Generates authentic audio narration file via TTS.
    2. Persists the Lecture into the database.
    3. Auto-generates initial practice worksheets.
    """
    chapter = get_chapter_by_id(chapter_id)
    if not chapter:
        raise ValueError(f"NCERT chapter '{chapter_id}' not found in curriculum database")

    # Format official title
    lecture_title = f"NCERT Class {chapter['grade_level']} {chapter['book_name']}: {chapter['title']}"

    # Check if this chapter is already adopted in DB
    existing = db.query(Lecture).filter(Lecture.title == lecture_title).first()
    if existing:
        return existing

    # Find a teacher ID to associate with this lecture
    teacher_id = user.id if user.role == UserRole.TEACHER else None
    if not teacher_id:
        teacher = db.query(User).filter(User.role == UserRole.TEACHER).first()
        teacher_id = teacher.id if teacher else user.id

    # 1. Create media file for the lecture (TTS of lesson script)
    os.makedirs(f"{settings.storage_path}/lectures", exist_ok=True)
    os.makedirs(f"{settings.storage_path}/transcripts", exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_slug = chapter_id.replace("-", "_")
    audio_filename = f"{timestamp}_{safe_slug}.mp3"
    audio_file_path = f"{settings.storage_path}/lectures/{audio_filename}"

    # Generate speech audio
    script_text = chapter.get("lesson_script", chapter["description"])
    try:
        text_to_speech(script_text, "en", audio_file_path)
    except Exception as e:
        logger.warning(f"Could not generate TTS for NCERT chapter ({e}). Creating blank marker file.")
        with open(audio_file_path, "wb") as f:
            f.write(b"")

    # 2. Save transcript
    transcript_filename = f"transcript_{safe_slug}_en.txt"
    transcript_path = f"{settings.storage_path}/transcripts/{transcript_filename}"
    with open(transcript_path, "w", encoding="utf-8") as f:
        f.write(script_text)

    # 3. Create Lecture record
    description = (
        f"{chapter['description']} "
        f"[NCERT Book: {chapter['book_name']} ({chapter['book_hindi_name']}), Chapter {chapter['chapter_number']}]"
    )

    lecture = Lecture(
        teacher_id=teacher_id,
        title=lecture_title,
        description=description,
        subject=chapter["subject"],
        grade_level=chapter["grade_level"],
        original_language="en",
        original_file_path=audio_file_path,
        transcript_text=script_text,
        transcript_path=transcript_path,
        duration_seconds=90,
    )
    db.add(lecture)
    db.commit()
    db.refresh(lecture)

    # 4. Automatically generate English and Hindi practice worksheets for this NCERT lesson
    try:
        create_or_get_worksheet(lecture.id, "en", db)
        create_or_get_worksheet(lecture.id, "hi", db)
    except Exception as e:
        logger.warning(f"Could not pre-generate worksheets for lecture {lecture.id}: {e}")

    return lecture
