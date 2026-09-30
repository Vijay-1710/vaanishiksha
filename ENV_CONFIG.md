# Environment Configuration Guide

## Required Environment Variables for `.env`

Copy `backend/.env.example` to `backend/.env` and configure the following:

### Critical Variables (Must Set Before Running)

**GEMINI_API_KEY** - Required for translation service
- Variable name: `GEMINI_API_KEY`
- Get free key from: https://makersuite.google.com/app/apikey
- The code reads this from `app.config.Settings.gemini_api_key`
- Used in: `app/services/translation_service.py` line 66
- No hardcoded keys anywhere - all read from environment

### Database & Redis (Pre-configured for Docker)
- `DATABASE_URL=postgresql://eduuser:edupass123@localhost:5432/eduplat`
- `REDIS_URL=redis://localhost:6379/0`
- `CELERY_BROKER_URL=redis://localhost:6379/0`
- `CELERY_RESULT_BACKEND=redis://localhost:6379/0`

These match the credentials in `docker-compose.yml` - no changes needed if using Docker.

### Other Variables (Defaults Are Fine for MVP)
- `SECRET_KEY` - Change for production, default OK for dev
- `STORAGE_PATH=./storage` - Local file storage
- `CORS_ORIGINS=http://localhost:5173,http://localhost:3000` - Frontend URLs

## Verification Checklist

Before running the verification test:
- [ ] Docker Desktop installed and running
- [ ] `docker-compose up -d` started PostgreSQL and Redis
- [ ] `backend/.env` file created with GEMINI_API_KEY set
- [ ] All other variables copied from `.env.example`

## How the Code Reads Configuration

1. `app/config.py` uses `pydantic_settings` to load from `.env`
2. All services import: `from app.config import settings`
3. Access via: `settings.gemini_api_key`, `settings.database_url`, etc.
4. No hardcoded credentials anywhere in the codebase
