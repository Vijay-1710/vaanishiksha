# Progress Tracker

## Status: Modules 1 & 2 - COMPLETE ✅

### Module 1: Recorded-lecture translation (COMPLETE)
- [x] Project scaffolding
  - [x] Backend structure (FastAPI)
  - [x] Frontend structure (React + TypeScript)
  - [x] Database models (User, Lecture, DubbedLecture, Worksheet)
  - [x] Redis/Celery setup for background jobs
  - [x] Dependency management (requirements.txt, package.json)
- [x] Authentication system (JWT-based, teacher/student roles)
- [x] Lecture upload API with file-type validation and storage handling
- [x] Background job infrastructure (Celery task: ASR → translate → TTS → persist)
- [x] ASR service (faster-whisper small, CPU int8)
- [x] Translation service (IndicTrans2 implemented for en↔indic pairs; LLM fallback for the rest)
- [x] TTS service (gTTS for MVP)
- [x] Caching mechanism (check-cache-before-generate logic in API)
- [x] Student playback UI with language selector + status polling
- [x] Teacher dashboard (upload, view lectures)
- [x] Student dashboard (browse by grade, language indicators)
- [x] **End-to-end test: PASS (upload lecture → dub to Hindi, Tamil, Kannada)**
- [ ] Caption synchronization improvements (word-level timestamps - nice-to-have, not blocking)
- [ ] Performance optimization

### Module 2: Auto worksheet generation (COMPLETE)
- [x] Worksheet generation service (app/services/worksheet_service.py)
  - [x] Multi-tier generation: Omniroute LLM + robust NLP fallback
  - [x] Multi-lingual generation: English, Hindi, Tamil, Telugu, Kannada, Bengali
  - [x] Structured sections: Summary, Vocabulary, MCQs, Fill-in-the-blanks, Short questions
- [x] Printable classroom document rendering (storage/worksheets/worksheet_{id}_{lang}.html)
  - [x] School header, student info lines, ruled response lines, teacher answer key
- [x] Worksheet API endpoints (app/routers/worksheets.py)
  - [x] POST /api/worksheets/generate/{lecture_id}/{target_language}
  - [x] GET /api/worksheets/lecture/{lecture_id}
  - [x] GET /api/worksheets/{worksheet_id}
- [x] Interactive Frontend UI (WorksheetSection.tsx & LecturePlayer.tsx)
  - [x] Tab navigation: Audio Dubbing vs. Practice Worksheet & Quiz
  - [x] Interactive quiz with instant scoring, answer feedback, and explanations
  - [x] One-click Print / Save PDF document
  - [x] Dashboard badges
- [x] Verification tests: PASS (test_worksheets.py & test_worksheets_api.py)


### NCERT Curriculum Integration & Customization (COMPLETE)
- [x] Curated NCERT dataset (app/data/ncert_data.py) spanning Classes 1 to 8 across EVS, Science, Mathematics, and Social Science
- [x] Standard NCERT titles, Hindi translations, core concepts, learning outcomes, and educational scripts
- [x] NCERT service (app/services/ncert_service.py) with one-click conversion to interactive dubbed lessons
- [x] NCERT API router (app/routers/ncert.py): /api/ncert/overview, /api/ncert/chapters, /api/ncert/chapter/{id}/adopt
- [x] Frontend NCERT Explorer (NCERTExplorer.tsx): class tabs, subject filters, concept summaries, official NCERT e-portal links
- [x] Instant adoption: generates audio narration, multi-language dubs, and bilingual worksheets for Indian students
- [x] Verification test: PASS (scripts/test_ncert.py)

### Module 3: Live class real-time translation (NOT STARTED)
- Waiting for Module 2 completion

---

## Latest Changes (2026-09-25 → 2026-09-29)
- Completed backend API structure with FastAPI
- Implemented all database models (User, Lecture, DubbedLecture, Worksheet)
- Built authentication system with JWT and role-based access
- Created lecture upload endpoint with file handling + format validation
- Implemented Celery background job for dubbing pipeline (ASR → translate → TTS)
- Built React frontend with TypeScript, TailwindCSS, React Query
- Created views: Login/Register, Teacher Dashboard, Student Dashboard, Lecture Player
- Set up language selection and status polling for async dubbing jobs
- Added PWA support for offline capability
- Created setup script for Windows (setup.bat)
- **Omniroute integrated as LLM translation provider** — switched from Gemini SDK to Omniroute's OpenAI-compatible endpoint (`kr/claude-sonnet-4.5`), verified with standalone tests (`test_omniroute_openai.py`)
- **IndicTrans2 implemented** (not a placeholder): en→indic and indic→en via AI4Bharat distilled 200M HF checkpoints with lazy loading/caching and sentence-split batching; indic→indic pairs currently fall back to the LLM (the en-indic/indic-en checkpoints only cover pairs involving English, and the indic-indic model is not bundled)
- **Dockerized infra confirmed working**: PostgreSQL 15 on host port 5433 (5432 left free due to a native install conflict) + Redis 7, via `docker compose up -d`
- Python venv provisioned with full dependencies incl. CPU-only torch, faster-whisper, IndicTrans2 tooling, gTTS

## Known Issues
1. **IndicTrans2 gated checkpoints** - The en-indic/indic-en 200M models require a HuggingFace account with accepted license terms (HF_TOKEN) for the first download. Without HF_TOKEN the service falls back to LLM translation.
2. **Indic→indic pairs fall back to LLM** - IndicTrans2's indic-indic model is not bundled; en-indic/indic-en models only cover pairs involving English. Decision pending on whether the LLM fallback is acceptable long-term.
3. **Omniroute must be running** - Translation requires the local Omniroute gateway at `http://localhost:20128` with `GEMINI_API_KEY` (unified key) configured.
4. **Caption sync basic** - No word-level timestamp sync yet, just full transcript display. Marked nice-to-have.
5. **Storage local only** - Need to configure S3 for production.
6. **First-run model download** - faster-whisper downloads the `small` model (~460MB) on first transcription; IndicTrans2 downloads checkpoints on first translation.

## Decisions Made
1. **TTS choice: gTTS for MVP** - Google TTS for initial version; plan to integrate AI4Bharat IndicTTS later for better Indian language voices.
2. **Translation approach: IndicTrans2 + LLM fallback** - IndicTrans2 (HF checkpoints) for en↔indic; Omniroute LLM (`kr/claude-sonnet-4.5`) for indic→indic and any IndicTrans2 failure. Omniroute selected over direct Gemini SDK because the local gateway is already provisioned.
3. **Job queue: Celery with Redis** - Redis as both broker and result backend.
4. **File storage: Local for dev** - Filesystem storage; S3 config scaffolding present.
5. **ASR: faster-whisper** - Chosen over standard Whisper for better CPU performance.
6. **Frontend state: Zustand + React Query** - Zustand for persisted auth state, React Query for server state.
7. **Database: Postgres via Docker (port 5433)** - Native Postgres on 5432 caused a port conflict; compose file maps 5433→5432. SQLite remains the dev fallback default in config.
