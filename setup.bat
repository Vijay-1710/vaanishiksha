@echo off
echo Setting up Mother-Tongue Education Platform (VaaniShiksha)...
echo.

echo [1/5] Setting up Python virtual environment (project root: venv\)...
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate

echo [2/5] Installing Python dependencies...
pip install -r back\requirements.txt

echo [3/5] Creating .env file...
if not exist back\.env (
    copy back\.env.example back\.env
    echo Please edit back\.env with your configuration if needed
)

echo [4/5] Creating storage directories...
if not exist back\storage mkdir back\storage
if not exist back\storage\lectures mkdir back\storage\lectures
if not exist back\storage\dubbed mkdir back\storage\dubbed
if not exist back\storage\transcripts mkdir back\storage\transcripts
if not exist back\storage\worksheets mkdir back\storage\worksheets

echo [5/5] Setting up frontend...
cd frontend
call npm install
cd ..

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo STARTING THE PLATFORM:
echo 1. Backend API:
echo    cd back
echo    ..\venv\Scripts\activate
echo    uvicorn app.main:app --reload
echo.
echo 2. Frontend Web App:
echo    cd frontend
echo    npm run dev
echo.
echo Visit http://localhost:5173 to access the application
echo.