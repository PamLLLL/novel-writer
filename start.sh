#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting 墨韵 MoYun..."

# Backend
echo "Starting backend..."
cd "$DIR/backend"
source "$DIR/.venv/bin/activate"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Frontend
echo "Starting frontend..."
cd "$DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo ""

cleanup() {
    echo "Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

wait
