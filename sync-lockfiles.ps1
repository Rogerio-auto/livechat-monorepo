# Script PowerShell para sincronizar package-lock.json antes do deploy

Write-Host "🔄 Sincronizando package-lock.json..." -ForegroundColor Cyan

# Backend
Write-Host "📦 Backend..." -ForegroundColor Yellow
Set-Location backend
npm install --package-lock-only
Set-Location ..

# Frontend
Write-Host "🎨 Frontend..." -ForegroundColor Yellow
Set-Location frontend
npm install --package-lock-only
Set-Location ..

Write-Host "✅ Package-lock.json sincronizados!" -ForegroundColor Green
Write-Host ""
Write-Host "Agora você pode commitar:" -ForegroundColor Cyan
Write-Host "  git add backend/package-lock.json frontend/package-lock.json" -ForegroundColor White
Write-Host "  git commit -m 'chore: sync package-lock.json'" -ForegroundColor White
