from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    TEACHER = "teacher"
    STUDENT = "student"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False)
    preferred_language = Column(String(2), nullable=True)  # For students
    grade_level = Column(Integer, nullable=True)  # For students
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    lectures = relationship("Lecture", back_populates="teacher")


class Lecture(Base):
    __tablename__ = "lectures"
    
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String, nullable=True)
    grade_level = Column(Integer, nullable=True)
    original_language = Column(String(2), nullable=False)
    original_file_path = Column(String, nullable=False)
    transcript_path = Column(String, nullable=True)
    transcript_text = Column(Text, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    teacher = relationship("User", back_populates="lectures")
    dubbed_versions = relationship("DubbedLecture", back_populates="lecture")
    worksheets = relationship("Worksheet", back_populates="lecture")


class DubbedLecture(Base):
    __tablename__ = "dubbed_lectures"
    
    id = Column(Integer, primary_key=True, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id"), nullable=False)
    target_language = Column(String(2), nullable=False)
    dubbed_audio_path = Column(String, nullable=False)
    translated_transcript_path = Column(String, nullable=True)
    translated_transcript_text = Column(Text, nullable=True)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    lecture = relationship("Lecture", back_populates="dubbed_versions")


class Worksheet(Base):
    __tablename__ = "worksheets"
    
    id = Column(Integer, primary_key=True, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id"), nullable=False)
    target_language = Column(String(2), nullable=False)
    pdf_path = Column(String, nullable=False)
    content_json = Column(Text, nullable=True)  # Store summary, questions, answers as JSON
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    lecture = relationship("Lecture", back_populates="worksheets")
