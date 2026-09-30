from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/me")
async def read_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "preferred_language": current_user.preferred_language,
        "grade_level": current_user.grade_level
    }
