import os
import time
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.routers import auth, lectures, users, worksheets, ncert, live

# Track startup timestamp for uptime metrics
APP_START_TIME = time.time()

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
@app.get("/api/health")
async def health_check():
    """Comprehensive health check checking database ping, disk storage, and uptime."""
    db_ok = False
    db_error = None
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
            db_ok = True
    except Exception as exc:
        db_error = str(exc)

    storage_writable = os.access(settings.storage_path, os.W_OK)
    uptime_seconds = round(time.time() - APP_START_TIME, 2)

    all_healthy = db_ok and storage_writable
    status_code = status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if all_healthy else "degraded",
            "uptime_seconds": uptime_seconds,
            "checks": {
                "database": {"healthy": db_ok, "error": db_error},
                "storage_writable": {"healthy": storage_writable, "path": settings.storage_path}
            },
            "version": "0.1.0"
        }
    )


@app.get("/api/ready")
async def readiness_probe():
    """Readiness probe for container orchestrators and load balancers."""
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
        return {"ready": True}
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"ready": False, "error": str(exc)}
        )
