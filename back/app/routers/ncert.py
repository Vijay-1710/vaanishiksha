"""
NCERT Curriculum API Router.
Exposes endpoints for browsing official NCERT textbooks (Classes 1-8),
searching topics, and adopting NCERT chapters as interactive lessons.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user
from app.services.ncert_service import (
    get_curriculum_overview,
    search_ncert_chapters,
    adopt_ncert_chapter_as_lecture,
)
from app.data.ncert_data import get_chapter_by_id

router = APIRouter()


class AdoptChapterResponse(BaseModel):
    message: str
    lecture_id: int
    title: str
    subject: str
    grade_level: int
    media_url: str
    worksheet_available: bool


@router.get("/overview")
async def get_overview():
    """
    Get overview of NCERT curriculum structure across Classes 1 to 8.
    """
    return get_curriculum_overview()


@router.get("/chapters")
async def list_chapters(
    grade_level: Optional[int] = Query(None, ge=1, le=8, description="Class / Grade level (1 to 8)"),
    subject: Optional[str] = Query(None, description="Subject filter (e.g. Science, Mathematics, EVS)"),
    query: Optional[str] = Query(None, description="Search keyword in title, concepts or book name"),
):
    """
    List and filter authentic NCERT curriculum chapters.
    """
    return search_ncert_chapters(grade_level=grade_level, subject=subject, query=query)


@router.get("/chapter/{chapter_id}")
async def get_chapter(chapter_id: str):
    """
    Get detailed information for a specific NCERT chapter.
    """
    chapter = get_chapter_by_id(chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCERT chapter '{chapter_id}' not found"
        )
    return chapter


@router.post("/chapter/{chapter_id}/adopt", response_model=AdoptChapterResponse)
async def adopt_chapter(
    chapter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Convert an NCERT textbook chapter into an active interactive lesson:
    - Generates lesson narration audio
    - Registers the lecture in the database
    - Generates bilingual practice worksheets and quiz questions
    """
    chapter = get_chapter_by_id(chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NCERT chapter '{chapter_id}' not found"
        )

    try:
        lecture = adopt_ncert_chapter_as_lecture(chapter_id, current_user, db)
        return {
            "message": "NCERT chapter successfully adopted as an interactive lesson!",
            "lecture_id": lecture.id,
            "title": lecture.title,
            "subject": lecture.subject or "General",
            "grade_level": lecture.grade_level or chapter["grade_level"],
            "media_url": f"/storage/lectures/{lecture.original_file_path.split('/')[-1]}",
            "worksheet_available": True,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to adopt NCERT chapter: {str(e)}"
        )
