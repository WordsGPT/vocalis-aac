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

# Prefer the adjacent Qwen runtime, which already contains the model and GPU stack.
QWEN_PYTHON="$DIR/../qwen3-tts-runtime/.venv/bin/python"
PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x "$QWEN_PYTHON" ]; then
    PYTHON_BIN="$QWEN_PYTHON"
    export HF_HOME="${HF_HOME:-$DIR/../qwen3-tts-runtime/huggingface}"
fi

# Check Python environment
if ! command -v "$PYTHON_BIN" &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check Ollama status
if "$PYTHON_BIN" -c "import urllib.request; urllib.request.urlopen('http://localhost:11434/api/tags', timeout=1)" > /dev/null 2>&1; then
    echo "✅ Local Ollama is active with Gemma 3!"
else
    echo "⚠️  Ollama is not running on port 11434. App will use smart heuristic fallback or Gemini API if key is provided."
fi

# Function to kill child processes on exit
cleanup() {
    trap - SIGINT SIGTERM EXIT
    echo ""
    echo "Shutting down Vocalis AAC..."
    CHILD_PIDS="$(jobs -p)"
    if [ -n "$CHILD_PIDS" ]; then
        kill $CHILD_PIDS 2>/dev/null || true
        for _ in {1..25}; do
            REMAINING=""
            for pid in $CHILD_PIDS; do
                if kill -0 "$pid" 2>/dev/null; then REMAINING="$REMAINING $pid"; fi
            done
            [ -z "$REMAINING" ] && break
            sleep 0.2
        done
        [ -n "$REMAINING" ] && kill -KILL $REMAINING 2>/dev/null || true
    fi
    exit
}
trap cleanup SIGINT SIGTERM EXIT

# Start Backend
FAST_TTS_PYTHON="$DIR/../faster-qwen3-tts/.venv/bin/python"
if [ -x "$FAST_TTS_PYTHON" ]; then
    echo "⚡ Starting low-latency Qwen worker on http://127.0.0.1:8002..."
    HF_HOME="${HF_HOME:-$DIR/../qwen3-tts-runtime/huggingface}" \
        "$FAST_TTS_PYTHON" -m uvicorn backend.streaming_voice_server:app \
        --host 127.0.0.1 --port 8002 &
    STREAMING_TTS_PID=$!
else
    echo "⚠️  Low-latency Qwen environment is not installed; standard voice remains available."
fi

echo "🚀 Starting Python FastAPI backend on http://localhost:8000..."
"$PYTHON_BIN" -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend..."
for i in {1..20}; do
    if "$PYTHON_BIN" -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health', timeout=1)" > /dev/null 2>&1; then
        echo "✅ Backend is healthy and ready!"
        break
    fi
    sleep 0.5
done

if [ -f "$DIR/frontend/dist/index.html" ]; then
    echo "✅ Using the built frontend served by FastAPI."
    APP_URL="http://localhost:8000"
else
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js 20+ is required to run the unbuilt frontend."
        exit 1
    fi
    echo "⚡ Starting Vite Frontend on http://localhost:5173..."
    cd frontend
    npm run dev -- --host &
    FRONTEND_PID=$!
    APP_URL="http://localhost:5173"
fi

echo ""
echo "=================================================="
echo "✨ Vocalis AAC is running!"
echo "👉 Open your browser at: $APP_URL"
echo "👉 Backend API active at: http://localhost:8000"
echo "=================================================="
echo "Press Ctrl+C to stop all servers."

wait
