#!/usr/bin/env bash
# ==============================================================================
# Vocalis AAC - Fast Restart & Tailscale Guardian
# ==============================================================================
# Quickly restarts the backend, verifies Tailscale connectivity, and detects
# if Tailscale assigned a '-1' collision name, instructing how to unbusy the URL.
# ==============================================================================

set -euo pipefail

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
DIR="$(cd "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

FORCE_COLLISION=0
CHECK_ONLY=0
REBUILD_FRONTEND=0

for arg in "$@"; do
    case "$arg" in
        -f|--force)
            FORCE_COLLISION=1
            ;;
        -c|--check)
            CHECK_ONLY=1
            ;;
        -b|--build)
            REBUILD_FRONTEND=1
            ;;
        -h|--help)
            echo "Uso: $0 [opciones]"
            echo ""
            echo "Opciones:"
            echo "  -f, --force    Continuar incluso si Tailscale forzó el sufijo '-1' (URL ocupada)"
            echo "  -c, --check    Verificar el estado del servidor y Tailscale sin reiniciar"
            echo "  -b, --build    Reconstruir el frontend (npm run build) antes de iniciar"
            echo "  -h, --help     Mostrar esta ayuda"
            exit 0
            ;;
        *)
            echo "Opción desconocida: $arg"
            echo "Usa '$0 --help' para ver las opciones."
            exit 1
            ;;
    esac
done

echo "=================================================================="
echo "  🚀 Vocalis AAC - Gestor de Reinicio y Tailscale"
echo "=================================================================="

# ------------------------------------------------------------------------------
# 1. Verificar y levantar tailscaled si está caído
# ------------------------------------------------------------------------------
echo "🔍 [1/4] Verificando daemon de Tailscale (tailscaled)..."
if ! pgrep -x "tailscaled" >/dev/null 2>&1; then
    echo "  ⚠️  tailscaled no está corriendo. Iniciando en modo userspace..."
    mkdir -p /var/run/tailscale /var/lib/tailscale
    setsid tailscaled --tun=userspace-networking \
      --state=/var/lib/tailscale/tailscaled.state \
      > /tmp/tailscaled.log 2>&1 &
    disown $! 2>/dev/null || true
    
    # Esperar hasta 10 segundos para que responda el socket
    for _ in {1..20}; do
        if tailscale status >/dev/null 2>&1; then
            break
        fi
        sleep 0.5
    done
fi

if ! tailscale status >/dev/null 2>&1; then
    echo "❌ Error: tailscaled no pudo iniciarse. Revisa /tmp/tailscaled.log" >&2
    exit 2
fi
echo "  ✅ tailscaled está activo."

# ------------------------------------------------------------------------------
# 2. Comprobar colisión de nombre Tailscale (-1 forzado)
# ------------------------------------------------------------------------------
echo "🔍 [2/4] Comprobando nombre y URL de Tailscale..."
CHECK_OPTS=""
if [ "$FORCE_COLLISION" -eq 1 ]; then
    CHECK_OPTS="--allow-collision"
fi

if ! python3 "$DIR/scripts/check_tailscale.py" $CHECK_OPTS; then
    # El script ya imprimió la alerta y las instrucciones de Tailscale admin
    exit 1
fi

TAILSCALE_URL="$(python3 "$DIR/scripts/check_tailscale.py" --url-only 2>/dev/null || true)"

# ------------------------------------------------------------------------------
# 3. Asegurar que Funnel está activo para el puerto 8000
# ------------------------------------------------------------------------------
FUNNEL_INFO="$(tailscale funnel status --json 2>/dev/null || echo "{}")"
if ! echo "$FUNNEL_INFO" | grep -q "http://127.0.0.1:8000"; then
    echo "  🌐 Configurando Tailscale Funnel para el puerto 8000..."
    tailscale funnel --bg --yes 8000 >/dev/null 2>&1 || tailscale serve --bg --yes 8000 >/dev/null 2>&1 || true
fi

# Si solo es chequeo de estado, verificar puerto 8000 y salir
if [ "$CHECK_ONLY" -eq 1 ]; then
    echo ""
    echo "🔍 Verificando estado del servidor web (puerto 8000)..."
    if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
        HEALTH_JSON="$(curl -s http://127.0.0.1:8000/api/health)"
        echo "  ✅ Backend activo y saludable."
        echo "  📊 Diagnóstico: $HEALTH_JSON"
        echo "  🔗 URL Pública: $TAILSCALE_URL/"
    else
        echo "  ❌ El backend no responde en http://127.0.0.1:8000."
    fi
    exit 0
fi

# ------------------------------------------------------------------------------
# 4. Detener procesos existentes en el puerto 8000
# ------------------------------------------------------------------------------
echo "🛑 [3/4] Deteniendo instancias anteriores en el puerto 8000..."
PID_8000="$(ss -tulpn 2>/dev/null | grep ':8000 ' | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -n1 || true)"
if [ -n "$PID_8000" ]; then
    echo "  Deteniendo PID $PID_8000..."
    kill -15 "$PID_8000" 2>/dev/null || true
    for _ in {1..10}; do
        if ! kill -0 "$PID_8000" 2>/dev/null; then
            break
        fi
        sleep 0.2
    done
    if kill -0 "$PID_8000" 2>/dev/null; then
        kill -9 "$PID_8000" 2>/dev/null || true
    fi
fi
pkill -f "uvicorn backend.app:app" 2>/dev/null || true
sleep 0.5

# Reconstruir frontend si es necesario o si se solicitó
if [ "$REBUILD_FRONTEND" -eq 1 ] || [ ! -f "$DIR/frontend/dist/index.html" ]; then
    echo "  📦 Construyendo frontend (Vite)..."
    (cd "$DIR/frontend" && npm run build)
fi

# ------------------------------------------------------------------------------
# 5. Iniciar FastAPI / Uvicorn backend
# ------------------------------------------------------------------------------
echo "🚀 [4/4] Iniciando backend Uvicorn (FastAPI)..."
PYTHON_BIN="$DIR/../qwen3-tts-runtime/.venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
    PYTHON_BIN="python3"
fi

setsid "$PYTHON_BIN" -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 \
    > /tmp/uvicorn.log 2>&1 &
UVICORN_PID=$!
disown "$UVICORN_PID" 2>/dev/null || true

# Esperar a que el backend responda en /api/health
echo "  Esperando a que el backend esté listo..."
READY=0
for _ in {1..30}; do
    if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
        READY=1
        break
    fi
    sleep 0.5
done

if [ "$READY" -ne 1 ]; then
    echo "❌ Error: El backend no respondió después de 15s. Revisa /tmp/uvicorn.log" >&2
    tail -n 25 /tmp/uvicorn.log >&2
    exit 3
fi

# ------------------------------------------------------------------------------
# 6. Resumen de estado
# ------------------------------------------------------------------------------
echo ""
echo "=================================================================="
echo "✨ ¡Servidor reiniciado con éxito y conectado a Tailscale!"
echo "=================================================================="
echo "👉 URL Pública Tailscale:  $TAILSCALE_URL/"
echo "👉 URL Local:              http://127.0.0.1:8000/"
echo "👉 Backend API:            $TAILSCALE_URL/api/health"
echo "=================================================================="
