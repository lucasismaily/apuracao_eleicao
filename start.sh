#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PORT="${PORT:-8765}"

# Encerra instância anterior do próprio backend se estiver rodando
pkill -f "$DIR/backend/app.py" 2>/dev/null || true

echo "Iniciando Back-end Python (porta $PORT)..."
python3 "$DIR/backend/app.py" &
BACKEND_PID=$!

trap "kill $BACKEND_PID 2>/dev/null || true" EXIT

echo "Iniciando Front-end React + Vite (porta 5173)..."
cd "$DIR/frontend"
npm run dev
