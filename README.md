# Mother-Tongue Primary Education Platform

Breaking language barriers in Indian primary education through on-demand lecture translation and auto-generated worksheets.

## Overview

This platform enables:
1. **Recorded lecture translation** - Teachers upload lectures; students hear them dubbed in their mother tongue
2. **Auto worksheet generation** - Practice materials generated automatically in student's language (Module 2 - TODO)
3. **Live class translation** - Real-time translation in live classes (Module 3 - TODO)

## Tech Stack

**Backend:**
- FastAPI (Python)
- PostgreSQL + Redis
- Celery for background jobs
- Whisper (ASR), IndicTrans2 (translation), gTTS (TTS)

**Frontend:**
- React + TypeScript
- TailwindCSS
- React Query + Zustand
- PWA support

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL
- Redis

### Backend Setup

1. Create a virtual environment and install dependencies:

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

2. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start PostgreSQL and Redis (see database setup below)

4. Run migrations and start the server:

```bash
# Create database tables
python -c "from app.database import engine, Base; from app.models import *; Base.metadata.create_all(bind=engine)"

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

5. In a separate terminal, start Celery worker:

```bash
cd backend
venv\Scripts\activate  # or source venv/bin/activate
celery -A app.tasks worker --loglevel=info --pool=solo
```

### Frontend Setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start development server:

```bash
npm run dev
```

Frontend will be available at `http://localhost:5173`

### Database Setup

**Option 1: Local PostgreSQL**

Install PostgreSQL and create database:
```bash
createdb eduplat
```

Update `.env`:
```
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/eduplat
```

**Option 2: Docker (recommended)**

```bash
docker compose up -d
```

This starts PostgreSQL 15 (mapped to host port **5433** to avoid conflicts with any native PostgreSQL on 5432) and Redis 7. Credentials match the values in `docker-compose.yml`/`.env.example` (`eduuser`/`edupass123`, database `eduplat`).

## Current Status (Module 1)

### ✅ Completed
- Project scaffolding
- Database models and API structure
- Authentication (JWT)
- File upload handling
- Background job queue setup

### 🚧 In Progress
- ASR integration (Whisper)
- Translation pipeline (IndicTrans2 → LLM fallback)
- TTS integration (gTTS → will upgrade to IndicTTS)
- Caching mechanism
- Frontend lecture player with language selection

### ⏳ Todo
- End-to-end testing with real lecture
- Caption synchronization
- Module 2: Worksheet generation
- Module 3: Live class translation

## Usage

### For Teachers
1. Register as a teacher
2. Upload a lecture (video/audio file)
3. System will automatically transcribe it
4. Students can access it in their preferred language

### For Students
1. Register as a student with your preferred language
2. Browse available lectures by grade
3. Select a lecture and choose your language
4. Listen to the dubbed version with synchronized captions

## Supported Languages

- English (en)
- Hindi (hi)
- Tamil (ta)
- Telugu (te)
- Kannada (kn)
- Bengali (bn)

More languages can be added by updating the configuration.

## Development Notes

- Storage: Currently using local filesystem. For production, configure S3-compatible storage.
- TTS: Using Google TTS (gTTS) for MVP. Should integrate AI4Bharat IndicTTS for better Indian language quality.
- Translation: Placeholder for IndicTrans2. Currently falls back to LLM-based translation (requires API key).

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## License

This is an educational project.
