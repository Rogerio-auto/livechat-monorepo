#!/bin/bash
# Script para sincronizar package-lock.json antes do deploy

echo "🔄 Sincronizando package-lock.json..."

# Backend
echo "📦 Backend..."
cd backend
npm install --package-lock-only
cd ..

# Frontend
echo "🎨 Frontend..."
cd frontend
npm install --package-lock-only
cd ..

echo "✅ Package-lock.json sincronizados!"
echo ""
echo "Agora você pode commitar:"
echo "  git add backend/package-lock.json frontend/package-lock.json"
echo "  git commit -m 'chore: sync package-lock.json'"
