# Quick Start Guide

## Current Status
✅ Project structure created
✅ Backend dependencies installed (FastAPI, SQLAlchemy, Celery, Redis client, faster-whisper, CPU torch, gTTS)
✅ Frontend dependencies installed (React + TypeScript, node_modules present)
✅ PostgreSQL + Redis running via Docker Compose (port 5433 / 6379)
✅ Omniroute LLM translation provider verified (cl/anthropic/claude-opus-4.8)
✅ **Module 1 COMPLETE — end-to-end dubbing pipeline verified (English → Hindi, Tamil, Kannada)**
⏳ Module 2: Auto worksheet generation (ready to start)

## What's Built

### Backend (FastAPI)
- **Authentication**: JWT-based auth with teacher/student roles
- **Database models**: User, Lecture, DubbedLecture, Worksheet
- **API endpoints**:
  - `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
  - `/api/lectures/` - list, upload, get lecture details
  - `/api/lectures/{id}/dub/{language}` - request dubbed version
  - `/api/lectures/{id}/dub/{language}/status` - check dubbing progress
- **Background jobs**: Celery task for ASR → translate → TTS pipeline
- **Services**: ASR, translation (LLM-based), TTS (gTTS)

### Frontend (React + TypeScript)
- **Pages**: Login, Register, Teacher Dashboard, Student Dashboard, Lecture Player
- **Features**:
  - Role-based routing
  - Lecture upload with metadata
  - Language selection with visual feedback
  - Status polling for async dubbing jobs
  - Grade-level filtering
  - PWA support

## Next Steps to Get Running

### 1. Install and Start Database Services

**Option A: Docker (Recommended)**
```powershell
docker compose up -d
# PostgreSQL 15 on host port 5433, Redis 7 on 6379 (see docker-compose.yml)
```

**Option B: Native Installation**
- Install PostgreSQL 15+ and create database `eduplat`
- Install Redis 7+
- Update `backend\.env` with your credentials

### 2. Configure API Keys

Edit `backend\.env` and add:
```
GEMINI_API_KEY=your-api-key-here
```
Get a free API key from: https://makersuite.google.com/app/apikey

### 3. Initialize Database

```powershell
cd backend
.\venv\Scripts\activate
python -c "from app.database import engine, Base; from app.models import *; Base.metadata.create_all(bind=engine)"
```

### 4. Install Frontend Dependencies

```powershell
cd frontend
npm install
```

### 5. Start All Services

**Terminal 1 - Backend API:**
```powershell
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Celery Worker:**
```powershell
cd backend
.\venv\Scripts\activate
celery -A app.tasks worker --loglevel=info --pool=solo
```

**Terminal 3 - Frontend:**
```powershell
cd frontend
npm run dev
```

**Access the app:** http://localhost:5173

### 6. Install ML Dependencies (When Ready to Test)

The heavy ML libraries (PyTorch, Whisper) are commented out in requirements.txt to speed up initial setup. Install them when you're ready to test actual dubbing:

```powershell
cd backend
.\venv\Scripts\activate
pip install faster-whisper
```

Note: This will download ~500MB+ of dependencies. For now, the app will show dubbing errors until these are installed.

## Test Flow

1. Register as a teacher
2. Upload a short audio/video file (keep it small for testing)
3. Register as a student with a preferred language
4. Browse lectures and click one
5. Select a different language → dubbing starts in background
6. Wait for status to change from "processing" to "completed"
7. Play the dubbed audio

## Known Limitations (Current MVP)

- **No ASR yet** - Whisper not installed, will fail on first dubbing attempt
- **Translation requires API key** - Must add GEMINI_API_KEY to .env
- **TTS quality basic** - Using Google TTS, voices are robotic
- **No caption sync** - Shows full transcript, not word-by-word
- **Local storage only** - Files stored in `backend/storage/`, not production-ready
- **No error recovery** - Failed jobs stay failed, no retry mechanism
- **No file validation** - Accepts any file type, no size limits

## File Structure

```
📁 New folder/
├── 📁 backend/
│   ├── 📁 app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Settings and configuration
│   │   ├── database.py          # SQLAlchemy setup
│   │   ├── models.py            # Database models
│   │   ├── tasks.py             # Celery background jobs
│   │   ├── 📁 routers/          # API endpoints
│   │   │   ├── auth.py          # Authentication
│   │   │   ├── lectures.py      # Lecture management
│   │   │   └── users.py         # User management
│   │   └── 📁 services/         # Business logic
│   │       ├── asr_service.py   # Speech-to-text
│   │       ├── translation_service.py  # Translation
│   │       └── tts_service.py   # Text-to-speech
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # Configuration (SECRET!)
│   └── 📁 venv/                 # Virtual environment
│
├── 📁 frontend/
│   ├── 📁 src/
│   │   ├── App.tsx              # Main app component
│   │   ├── main.tsx             # Entry point
│   │   ├── 📁 pages/            # Page components
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── TeacherDashboard.tsx
│   │   │   ├── StudentDashboard.tsx
│   │   │   └── LecturePlayer.tsx
│   │   ├── 📁 stores/           # State management
│   │   │   └── authStore.ts     # Auth state (Zustand)
│   │   └── 📁 lib/              # Utilities
│   │       └── api.ts           # API client (Axios)
│   ├── package.json             # Node dependencies
│   └── vite.config.ts           # Build configuration
│
├── README.md                    # Full documentation
├── PROGRESS.md                  # Development progress tracker
└── setup.bat                    # Automated setup script
```

## Troubleshooting

**"Connection refused" errors**
→ PostgreSQL or Redis not running

**"Import error: No module named 'faster_whisper'"**
→ ML dependencies not installed yet, see step 6 above

**"Could not validate credentials"**
→ Check that SECRET_KEY in .env is set

**"Translation failed"**
→ GEMINI_API_KEY not set in .env

**Celery worker crashes on Windows**
→ Use `--pool=solo` flag (already in instructions)

**Frontend shows 404 for API calls**
→ Backend not running on port 8000

## What Works Right Now (Without ML Libraries)

- ✅ User registration and login
- ✅ Teacher can upload files (stored but not processed)
- ✅ Student can browse lectures
- ✅ UI for language selection
- ✅ Background job queueing
- ❌ Actual dubbing (needs Whisper installation)

## Production Readiness Checklist (Future)

- [ ] Install ML dependencies and test full pipeline
- [ ] Integrate IndicTrans2 for better Indian language translation
- [ ] Switch to AI4Bharat IndicTTS for better voices
- [ ] Configure S3 for file storage
- [ ] Add file validation and size limits
- [ ] Implement retry logic for failed jobs
- [ ] Add caption synchronization with timestamps
- [ ] Set up proper logging and monitoring
- [ ] Add rate limiting
- [ ] Configure HTTPS
- [ ] Set up CI/CD pipeline
- [ ] Add comprehensive error handling
- [ ] Implement Module 2 (worksheets)
- [ ] Implement Module 3 (live translation)
