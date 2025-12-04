# start-production.ps1
# Inicia o sistema completo: Backend + Worker + Frontend
# Backend e Worker em modo producao (sem tsx watch)
# Frontend em modo desenvolvimento (Vite)

Write-Host "Limpando processos Node existentes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

$nodeCount = (Get-Process -Name node -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "Processos Node apos limpeza: $nodeCount" -ForegroundColor Green

Write-Host ""
Write-Host "Iniciando BACKEND (producao)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host 'BACKEND (node dist/index.js)' -ForegroundColor Cyan; node dist/index.js"

Start-Sleep -Seconds 3

Write-Host "Iniciando WORKER (producao com protecao de instancia unica)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host 'WORKER (node dist/worker.js)' -ForegroundColor Yellow; node dist/worker.js"

Start-Sleep -Seconds 3

Write-Host "Iniciando FRONTEND (desenvolvimento)..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host 'FRONTEND (npm run dev)' -ForegroundColor Magenta; npm run dev"

Start-Sleep -Seconds 3

$finalNodeCount = (Get-Process -Name node -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host ""
Write-Host "Sistema iniciado!" -ForegroundColor Green
Write-Host "Total de processos Node: $finalNodeCount (esperado: 4-5)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Monitoramento:" -ForegroundColor Cyan
Write-Host "  - Logs do WORKER devem mostrar: [SingleInstance] Worker registrado: PID xxxxx"
Write-Host "  - Se aparecer multiplas instancias, a segunda sera encerrada automaticamente"
Write-Host "  - Distributed locks: [DistributedLock] campaigns:tick - lock adquirido por PID xxxxx"
Write-Host ""
Write-Host "URLs:" -ForegroundColor Green
Write-Host "  - Frontend: http://localhost:3000"
Write-Host "  - Backend:  http://localhost:5000"
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Red
Write-Host "  - NAO inicie manualmente npm run dev ou npm run worker no diretorio backend"
Write-Host "  - Frontend usa npm run dev (normal para Vite)"
Write-Host "  - Use CTRL+C nas janelas para encerrar"
Write-Host "  - Backend/Worker em modo PRODUCAO para evitar duplicacao de processos"
Write-Host ""
