#!/bin/bash
# AquaSense one-command launcher for macOS / Linux.
#   cd ~/Downloads/AquaSense && bash start_aquasense.sh
# Ctrl+C stops everything. Backend output goes to backend.log in this folder.
cd "$(dirname "$0")"
ROOT="$(pwd)"
LOG="$ROOT/backend.log"
red() { printf "\033[31m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }

echo "== AquaSense: Bengaluru flood early warning =="

# 1. Find a Python that is 3.10 or newer
PY=""
for c in python3.12 python3.13 python3.11 python3.10 python3.14 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then
  red "Python 3.10 or newer is needed. Install it with:  brew install python@3.12   then run this script again."
  exit 1
fi
command -v npm >/dev/null 2>&1 || { red "Node.js is needed. Install it with:  brew install node   then run this script again."; exit 1; }
echo "[1/5] Using $($PY --version)"

# 2. Python environment (recreated if it was made with an old Python)
if [ -d .venv ] && ! .venv/bin/python -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then
  echo "      Old Python environment found, recreating it..."; rm -rf .venv
fi
[ -d .venv ] || "$PY" -m venv .venv || { red "Could not create the Python environment."; exit 1; }
source .venv/bin/activate
echo "[2/5] Installing backend packages (first run takes a few minutes)..."
python -m pip install -q --upgrade pip >/dev/null 2>&1
if ! python -m pip install -q -r requirements.txt; then
  red "Package install failed (see the messages above). Check your internet connection and try again."; exit 1
fi
if ! python -c "import xgboost" 2>/dev/null; then
  red "XGBoost could not load. On a Mac run:  brew install libomp   then run this script again."; exit 1
fi

# 3. Free the ports if an old run is still holding them
for port in 8000 5173; do
  pids=$(lsof -ti tcp:$port 2>/dev/null); [ -n "$pids" ] && kill $pids 2>/dev/null && sleep 1
done

# 4. Start the backend and wait until it answers
echo "[3/5] Starting the backend (the first start may train the model, about 1-2 minutes)..."
(cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000 > "$LOG" 2>&1) &
BACKEND=$!
trap 'kill $BACKEND 2>/dev/null; exit' INT TERM EXIT
ok=""
for i in $(seq 1 240); do
  if curl -sf http://127.0.0.1:8000/api/simulation/state >/dev/null 2>&1; then ok=1; break; fi
  if ! kill -0 $BACKEND 2>/dev/null; then break; fi
  sleep 1
done
if [ -z "$ok" ]; then
  red "The backend did not start. Last lines of backend.log:"
  tail -n 25 "$LOG"
  red "Send these lines to get help. Full log: $LOG"
  exit 1
fi
green "[4/5] Backend running: http://127.0.0.1:8000/docs"

# 5. Frontend
cd frontend
[ -d node_modules ] || { echo "      Installing frontend packages..."; npm install --no-audit --no-fund || { red "npm install failed."; exit 1; }; }
green "[5/5] Opening http://127.0.0.1:5173   (keep this window open; Ctrl+C to stop)"
npm run dev -- --host 127.0.0.1 --port 5173 --open
