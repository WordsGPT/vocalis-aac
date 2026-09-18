#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

# Load local .env if present
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi


echo "=================================================="
echo "    🎙️ Vocalis AAC - Assistive Voice App         "
echo "=================================================="

# Check Python environment
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check Node environment
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

# Check Ollama status
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Local Ollama is active with Gemma 3!"
else
    echo "⚠️  Ollama is not running on port 11434. App will use smart heuristic fallback or Gemini API if key is provided."
fi

# Function to kill child processes on exit
cleanup() {
    echo ""
    echo "Shutting down Vocalis AAC..."
    kill $(jobs -p) 2>/dev/null || true
    exit
}
trap cleanup SIGINT SIGTERM EXIT

# Start Backend
echo "🚀 Starting Python FastAPI backend on http://localhost:8000..."
python3 -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend..."
for i in {1..20}; do
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy and ready!"
        break
    fi
    sleep 0.5
done

# Start Frontend Vite Dev Server
echo "⚡ Starting Vite Frontend on http://localhost:5173..."
cd frontend
npm run dev -- --host &
FRONTEND_PID=$!

echo ""
echo "=================================================="
echo "✨ Vocalis AAC is running!"
echo "👉 Open your browser at: http://localhost:5173"
echo "👉 Backend API active at: http://localhost:8000"
echo "=================================================="
echo "Press Ctrl+C to stop all servers."

wait
