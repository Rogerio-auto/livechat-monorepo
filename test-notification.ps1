# Script para testar notificações
# Execute este script após fazer login no sistema

$API_URL = "http://localhost:5000"
$TOKEN = Read-Host "Cole seu access_token aqui"

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

$body = @{
    title = "🔔 Teste de Notificação"
    message = "Esta é uma notificação de teste para verificar o sistema completo!"
    type = "SYSTEM"
    priority = "HIGH"
    category = "system"
    soundType = "success"
} | ConvertTo-Json

Write-Host "Enviando notificação de teste..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/notifications" -Method POST -Headers $headers -Body $body
    Write-Host "✓ Notificação criada com sucesso!" -ForegroundColor Green
    Write-Host "ID da notificação: $($response.id)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Agora:" -ForegroundColor Yellow
    Write-Host "1. Abra o sistema no navegador" -ForegroundColor White
    Write-Host "2. Clique no sino de notificações no topo" -ForegroundColor White
    Write-Host "3. A notificação deve aparecer na lista" -ForegroundColor White
} catch {
    Write-Host "✗ Erro ao criar notificação:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
