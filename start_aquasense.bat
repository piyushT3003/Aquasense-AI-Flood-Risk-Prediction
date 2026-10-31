@echo off
echo ==============================================================
echo  AquaSense: Bengaluru flood early warning
echo ==============================================================
if not exist ".venv" (
    echo [1/4] Creating Python virtual environment...
    python -m venv .venv
)
echo [2/4] Installing backend packages...
.\.venv\Scripts\pip install -q -r requirements.txt
if not exist "backend\models\model_meta.json" (
    echo [3/4] Training the flood model - about 2 minutes, first run only...
    cd backend && ..\.venv\Scripts\python -m ml.train && cd ..
) else (
    echo [3/4] Trained model found.
)
if not exist "frontend\node_modules" (
    cd frontend && call npm install && cd ..
)
echo [4/4] Starting servers...
start "AquaSense Backend" cmd /k "cd backend && ..\.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000"
start "AquaSense Frontend" cmd /k "cd frontend && npm run dev -- --host 127.0.0.1 --port 5173 --open"
echo.
echo  Dashboard: http://127.0.0.1:5173
echo  API docs:  http://127.0.0.1:8000/docs
pause
