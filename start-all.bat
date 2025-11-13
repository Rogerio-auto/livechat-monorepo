@echo off
echo ========================================
echo  Iniciando Sistema Completo
echo ========================================
echo.

REM Abre terminal para o backend
echo [1/3] Iniciando Backend (porta 3001)...
start "Backend - Porta 3001" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 2 /nobreak >nul

REM Abre terminal para o frontend principal
echo [2/3] Iniciando Frontend Principal (porta 5173)...
start "Frontend Principal - Porta 5173" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 2 /nobreak >nul

REM Abre terminal para o onboarding
echo [3/3] Iniciando Onboarding (porta 3002)...
start "Onboarding - Porta 3002" cmd /k "cd /d %~dp0onboarding && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo  Todos os servidores iniciados!
echo ========================================
echo.
echo  Backend:     http://localhost:3001
echo  Frontend:    http://localhost:5173
echo  Onboarding:  http://localhost:3002
echo.
echo  Pressione qualquer tecla para fechar esta janela...
echo  (Os servidores continuarao rodando)
echo ========================================
pause >nul
