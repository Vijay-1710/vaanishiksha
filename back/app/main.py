from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base
from app.routers import auth, lectures, users, worksheets, ncert, live
import os

# Create database tables
Base.metadata.create_all(bind=engine)

# Create storage directories
os.makedirs(settings.storage_path, exist_ok=True)
os.makedirs(f"{settings.storage_path}/lectures", exist_ok=True)
os.makedirs(f"{settings.storage_path}/dubbed", exist_ok=True)
os.makedirs(f"{settings.storage_path}/transcripts", exist_ok=True)
os.makedirs(f"{settings.storage_path}/worksheets", exist_ok=True)

app = FastAPI(
    title="Mother-Tongue Education Platform",
    description="Breaking language barriers in primary education",
    version="0.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for serving media
app.mount("/storage", StaticFiles(directory=settings.storage_path), name="storage")

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(lectures.router, prefix="/api/lectures", tags=["Lectures"])
app.include_router(worksheets.router, prefix="/api/worksheets", tags=["Worksheets"])
app.include_router(ncert.router, prefix="/api/ncert", tags=["NCERT Curriculum"])
app.include_router(live.router, prefix="/api/live", tags=["Live Class"])



@app.get("/")
async def root():
    return {
        "message": "Mother-Tongue Education Platform API",
        "version": "0.1.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
