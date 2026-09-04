#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "=================================================="
echo " Starting HackWave Flood Engine"
echo " Backend:  http://localhost:8000"
echo " Frontend: http://localhost:3000"
echo " Model:    13-Feature LightGBM (lgb_flood_model.txt)"
echo " AI Agent: Featherless AI (Qwen/Qwen2.5-72B-Instruct)"
echo "=================================================="

# Start backend
cd "$DIR/backend"
./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start frontend
cd "$DIR/frontend"
npm run dev &
FRONTEND_PID=$!

cleanup() {
    echo "Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
}

trap cleanup INT TERM EXIT

wait
