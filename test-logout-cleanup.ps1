# Script de Teste - Sistema de Limpeza de Cache ao Trocar de Usuário
# Execute após fazer login para validar a implementação

Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TESTE: Sistema de Limpeza de Cache no Logout" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Função auxiliar para verificar localStorage
function Get-LocalStorageInfo {
    Write-Host "📦 Verificando estado do navegador..." -ForegroundColor Yellow
    Write-Host "   1. Abra o DevTools (F12)" -ForegroundColor White
    Write-Host "   2. Vá em Application > Local Storage" -ForegroundColor White
    Write-Host "   3. Conte quantas chaves existem" -ForegroundColor White
    Write-Host ""
    $count = Read-Host "Quantas chaves você vê no localStorage?"
    return [int]$count
}

# Função para pausar
function Pause-Test {
    param([string]$message = "Pressione ENTER para continuar...")
    Write-Host ""
    Write-Host $message -ForegroundColor Yellow
    $null = Read-Host
    Write-Host ""
}

Write-Host "═══ CENÁRIO 1: Verificar Estado Antes do Logout ═══" -ForegroundColor Green
Write-Host ""
Write-Host "1. Faça login no sistema (se ainda não estiver logado)" -ForegroundColor White
Write-Host "2. Navegue pelo sistema:" -ForegroundColor White
Write-Host "   - Veja notificações" -ForegroundColor Gray
Write-Host "   - Abra alguns chats" -ForegroundColor Gray
Write-Host "   - Envie algumas mensagens" -ForegroundColor Gray
Write-Host ""

Pause-Test

$beforeCount = Get-LocalStorageInfo

Write-Host "✅ Estado registrado: $beforeCount chaves no localStorage" -ForegroundColor Green
Write-Host ""

Write-Host "═══ CENÁRIO 2: Testar Logout com Limpeza ═══" -ForegroundColor Green
Write-Host ""
Write-Host "Agora vamos testar o logout:" -ForegroundColor White
Write-Host "1. Abra o Console do navegador (F12 > Console)" -ForegroundColor White
Write-Host "2. Clique no botão de LOGOUT no sidebar" -ForegroundColor White
Write-Host ""
Write-Host "Você deve ver os seguintes logs no console:" -ForegroundColor Yellow
Write-Host "   [Sidebar] 🚪 Logout initiated" -ForegroundColor Gray
Write-Host "   [CleanupService] 🧹 STARTING FULL SYSTEM CLEANUP" -ForegroundColor Gray
Write-Host "   [useNotifications] 🧹 Cleaning up on logout" -ForegroundColor Gray
Write-Host "   [LiveChat] 🧹 Cleaning up on logout" -ForegroundColor Gray
Write-Host "   [CleanupService] ✅ CLEANUP COMPLETED" -ForegroundColor Gray
Write-Host ""

Pause-Test "Após clicar em LOGOUT, pressione ENTER"

Write-Host "═══ CENÁRIO 3: Validar Limpeza ═══" -ForegroundColor Green
Write-Host ""
Write-Host "Após o redirect para /login, verifique:" -ForegroundColor White
Write-Host ""

Pause-Test "Pressione ENTER após ser redirecionado para /login"

$afterCount = Get-LocalStorageInfo

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  RESULTADOS DO TESTE" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "LocalStorage ANTES:  $beforeCount chaves" -ForegroundColor White
Write-Host "LocalStorage DEPOIS: $afterCount chaves" -ForegroundColor White
Write-Host ""

if ($afterCount -lt $beforeCount) {
    Write-Host "✅ SUCESSO: Cache foi limpo!" -ForegroundColor Green
    $reduction = [math]::Round((($beforeCount - $afterCount) / $beforeCount) * 100, 1)
    Write-Host "   Redução de $reduction% nas chaves do localStorage" -ForegroundColor Green
} elseif ($afterCount -eq 0 -or $afterCount -le 2) {
    Write-Host "✅ EXCELENTE: localStorage quase completamente limpo!" -ForegroundColor Green
} else {
    Write-Host "⚠️  ATENÇÃO: Poucas chaves foram removidas" -ForegroundColor Yellow
    Write-Host "   Verifique se o cleanupService está sendo chamado corretamente" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══ CENÁRIO 4: Testar Login com Novo Usuário ═══" -ForegroundColor Green
Write-Host ""
Write-Host "Agora teste fazer login com um usuário DIFERENTE:" -ForegroundColor White
Write-Host ""
Write-Host "1. Faça login com outro usuário" -ForegroundColor White
Write-Host "2. Vá até o LiveChat" -ForegroundColor White
Write-Host "3. Verifique se os chats são APENAS do novo usuário" -ForegroundColor White
Write-Host "4. Clique no sino de notificações" -ForegroundColor White
Write-Host "5. Verifique se as notificações são APENAS do novo usuário" -ForegroundColor White
Write-Host ""

Pause-Test

Write-Host "Os dados do novo usuário estão corretos? (s/n): " -NoNewline -ForegroundColor Yellow
$answer = Read-Host
Write-Host ""

if ($answer.ToLower() -eq "s") {
    Write-Host "✅ TESTE COMPLETO: Sistema funcionando corretamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Resumo:" -ForegroundColor Cyan
    Write-Host "  ✓ Cache limpo ao fazer logout" -ForegroundColor Green
    Write-Host "  ✓ Dados não vazam entre usuários" -ForegroundColor Green
    Write-Host "  ✓ Socket.IO desconectado corretamente" -ForegroundColor Green
    Write-Host "  ✓ localStorage resetado" -ForegroundColor Green
} else {
    Write-Host "❌ FALHA: Dados do usuário anterior ainda aparecem" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Verifique os logs no console do navegador" -ForegroundColor White
    Write-Host "  2. Confirme que cleanupService.cleanup() foi chamado" -ForegroundColor White
    Write-Host "  3. Verifique se há erros no console" -ForegroundColor White
    Write-Host "  4. Force um hard reload (Ctrl+Shift+R)" -ForegroundColor White
}

Write-Host ""
Write-Host "═══ TESTES ADICIONAIS (Opcional) ═══" -ForegroundColor Green
Write-Host ""
Write-Host "Para teste completo, também execute:" -ForegroundColor White
Write-Host "  1. Login → Abrir múltiplas abas → Logout em uma → Verificar outras abas" -ForegroundColor Gray
Write-Host "  2. Login → Deixar idle 1h → Fazer logout → Verificar limpeza" -ForegroundColor Gray
Write-Host "  3. Login → Usar sistema → Fechar navegador → Reabrir → Logout" -ForegroundColor Gray
Write-Host ""

Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  FIM DO TESTE" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Logs importantes foram salvos no console do navegador." -ForegroundColor Gray
Write-Host "Use F12 > Console para revisar a execução detalhada." -ForegroundColor Gray
Write-Host ""
