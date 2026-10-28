# Stage 1: Build Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Backend & Runtime
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install system dependencies (ffmpeg and build utilities)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY back/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY back/app ./app
COPY back/Procfile ./

# Copy built frontend assets into static distribution folder
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure storage directories exist
RUN mkdir -p storage/lectures storage/dubbed storage/transcripts storage/worksheets

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
