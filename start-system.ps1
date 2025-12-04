# SCRIPT DE INICIALIZAÇÃO LIMPA
# Garante que apenas 1 backend e 1 worker estão rodando

Write-Host "🔴 Parando todos os processos Node..." -ForegroundColor Red
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

$nodeCount = (Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "✅ Processos Node finalizados. Total: $nodeCount" -ForegroundColor Green

Write-Host "`n🚀 Iniciando Backend (API)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev"
Start-Sleep -Seconds 8

Write-Host "🚀 Iniciando Worker (Filas + Campanhas)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run worker"
Start-Sleep -Seconds 5

$finalCount = (Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "`n✅ SISTEMA INICIADO!" -ForegroundColor Green
Write-Host "📊 Processos Node ativos: $finalCount (esperado: 4-6)" -ForegroundColor Yellow
Write-Host "`n🔍 Para verificar:" -ForegroundColor White
Write-Host "   Get-Process node | Select-Object Id, ProcessName, StartTime" -ForegroundColor Gray

Write-Host "`n⚠️  IMPORTANTE: NÃO inicie mais instâncias manualmente!" -ForegroundColor Yellow
Write-Host "   Para parar tudo: Stop-Process -Name node -Force" -ForegroundColor Gray
