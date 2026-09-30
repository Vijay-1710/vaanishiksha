"""
Worksheet API Router.
Provides endpoints for creating, retrieving, and listing educational practice worksheets.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel
import json

from app.database import get_db
from app.models import User, Lecture, Worksheet
from app.routers.auth import get_current_user
from app.config import settings
from app.services.worksheet_service import create_or_get_worksheet

router = APIRouter()


class WorksheetResponse(BaseModel):
    id: int
    lecture_id: int
    target_language: str
    pdf_url: str
    content: Optional[Dict[str, Any]] = None
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None


class WorksheetListItem(BaseModel):
    id: int
    lecture_id: int
    target_language: str
    pdf_url: str
    status: str
    created_at: datetime


def _to_response(ws: Worksheet) -> Dict[str, Any]:
    content_dict = None
    if ws.content_json:
        try:
            content_dict = json.loads(ws.content_json)
        except Exception:
            pass
            
    return {
        "id": ws.id,
        "lecture_id": ws.lecture_id,
        "target_language": ws.target_language,
        "pdf_url": ws.pdf_path,
        "content": content_dict,
        "status": ws.status,
        "created_at": ws.created_at,
        "completed_at": ws.completed_at
    }


@router.post("/generate/{lecture_id}/{target_language}", response_model=WorksheetResponse)
@router.post("/lecture/{lecture_id}/dub/{target_language}", response_model=WorksheetResponse)
async def generate_worksheet(
    lecture_id: int,
    target_language: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate or fetch a cached multi-lingual worksheet for the given lecture and language.
    """
    if target_language not in settings.supported_languages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language '{target_language}' not supported. Supported: {settings.supported_languages}"
        )

    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found")

    try:
        ws = create_or_get_worksheet(lecture_id, target_language, db)
        return _to_response(ws)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate worksheet: {str(e)}"
        )


@router.get("/lecture/{lecture_id}", response_model=List[WorksheetListItem])
async def list_lecture_worksheets(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all generated worksheets for a specific lecture.
    """
    worksheets = db.query(Worksheet).filter(Worksheet.lecture_id == lecture_id).all()
    return [
        {
            "id": ws.id,
            "lecture_id": ws.lecture_id,
            "target_language": ws.target_language,
            "pdf_url": ws.pdf_path,
            "status": ws.status,
            "created_at": ws.created_at
        }
        for ws in worksheets
    ]


@router.get("/{worksheet_id}", response_model=WorksheetResponse)
async def get_worksheet_by_id(
    worksheet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve full worksheet questions, summary, vocabulary, and answers.
    """
    ws = db.query(Worksheet).filter(Worksheet.id == worksheet_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worksheet not found")
    return _to_response(ws)
