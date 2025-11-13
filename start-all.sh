#!/bin/bash

echo "========================================"
echo " Iniciando Sistema Completo"
echo "========================================"
echo ""

# Backend
echo "[1/3] Iniciando Backend (porta 3001)..."
cd backend
gnome-terminal -- bash -c "npm run dev; exec bash" 2>/dev/null || \
  xterm -e "npm run dev" 2>/dev/null || \
  osascript -e 'tell app "Terminal" to do script "cd '$(pwd)' && npm run dev"' 2>/dev/null &
cd ..
sleep 2

# Frontend Principal
echo "[2/3] Iniciando Frontend Principal (porta 5173)..."
cd frontend
gnome-terminal -- bash -c "npm run dev; exec bash" 2>/dev/null || \
  xterm -e "npm run dev" 2>/dev/null || \
  osascript -e 'tell app "Terminal" to do script "cd '$(pwd)' && npm run dev"' 2>/dev/null &
cd ..
sleep 2

# Onboarding
echo "[3/3] Iniciando Onboarding (porta 3002)..."
cd onboarding
gnome-terminal -- bash -c "npm run dev; exec bash" 2>/dev/null || \
  xterm -e "npm run dev" 2>/dev/null || \
  osascript -e 'tell app "Terminal" to do script "cd '$(pwd)' && npm run dev"' 2>/dev/null &
cd ..
sleep 2

echo ""
echo "========================================"
echo " Todos os servidores iniciados!"
echo "========================================"
echo ""
echo "  Backend:     http://localhost:3001"
echo "  Frontend:    http://localhost:5173"
echo "  Onboarding:  http://localhost:3002"
echo ""
echo "========================================"
