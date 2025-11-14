# 🔊 Sons de Notificação

Arquivos de som configurados em `frontend/public/sounds/`.

## 📁 Arquivos Disponíveis

| Arquivo | Tipo | Uso | Fonte Original |
|---------|------|-----|----------------|
| `notification-default.mp3` | Neutro | Notificações padrão | mixkit-elevator-tone-2863.wav |
| `notification-message.mp3` | Mensagem | Chat, mensagens | mixkit-interface-hint-notification-911.wav |
| `notification-success.mp3` | Sucesso | Ações positivas | mixkit-software-interface-start-2574.wav |
| `notification-warning.mp3` | Aviso | Alertas moderados | mixkit-software-interface-remove-2576.wav |
| `notification-error.mp3` | Erro | Erros críticos | (cópia de warning - substituir com som mais agressivo) |
| `notification-urgent.mp3` | Urgente | Alertas urgentes | (cópia de warning - substituir com som mais forte) |

## 🎯 Mapeamento por Tipo de Notificação

### 🔔 Som: `default` (Elevator Tone)
- SYSTEM
- CHAT_ASSIGNED
- CHAT_TRANSFERRED
- PROPOSAL_VIEWED
- TASK_ASSIGNED
- TEAM_INVITE
- TECHNICAL_VISIT

### 💬 Som: `message` (Interface Hint)
- **CHAT_MESSAGE** ⭐ Principal
- MENTION
- USER_MESSAGE

### ✅ Som: `success` (Interface Start)
- **PROPOSAL_ACCEPTED** ⭐
- **PAYMENT_RECEIVED** ⭐
- NEW_LEAD
- LEAD_CONVERTED
- CAMPAIGN_COMPLETED
- MASS_DISPATCH

### ⚠️ Som: `warning` (Interface Remove)
- PROPOSAL_REJECTED
- PROPOSAL_EXPIRED
- TASK_DUE_SOON

### ❌ Som: `error` (Interface Remove - duplicado)
- CAMPAIGN_FAILED
- *(Recomendado: baixar som mais agressivo)*

### 🚨 Som: `urgent` (Interface Remove - duplicado)
- **SYSTEM_ALERT** ⭐
- **TASK_OVERDUE** ⭐
- **PAYMENT_OVERDUE** ⭐
- *(Recomendado: baixar som mais forte e chamativo)*

### 🔇 Som: `silent`
- CHAT_CLOSED (sem som)

## 🎨 Recomendações de Substituição

Para melhorar a experiência, baixe sons específicos para:

### Som de Erro (`notification-error.mp3`)
**Busque:** "error alert sound" ou "system error notification"
- Deve ser mais agressivo que o warning
- Tom grave e desagradável
- Duração: 0.3-0.7s
- **Sugestões do Mixkit:**
  - "mixkit-error-alert" - Som de erro clássico
  - "mixkit-negative-tone" - Tom negativo curto

### Som Urgente (`notification-urgent.mp3`)
**Busque:** "urgent alert" ou "critical alarm notification"
- Deve ser alto e repetitivo
- Tom agudo e chamativo
- Duração: 0.5-1.0s
- **Sugestões do Mixkit:**
  - "mixkit-urgent-simple-tone" - Tom urgente simples
  - "mixkit-alarm-tone" - Alarme de notificação

## 📊 Estatísticas de Uso

Com base nos tipos de notificação:

- **message** (3 tipos): 14% - Som mais usado em chat
- **success** (6 tipos): 29% - Maior variedade de eventos positivos
- **default** (7 tipos): 33% - Som mais comum
- **warning** (3 tipos): 14%
- **error** (1 tipo): 5%
- **urgent** (3 tipos): 14% - Crítico para alertas importantes
- **silent** (1 tipo): 5%

## 🔧 Como Testar

1. Acesse a página: `/notification-test` (adicione no router)
2. Clique em "Testar Sons" para cada tipo
3. Envie notificações de exemplo
4. Verifique se os sons tocam corretamente

## 🎵 Fontes Alternativas

Se quiser baixar mais sons de melhor qualidade:

- **Zapsplat**: https://www.zapsplat.com/sound-effect-categories/notification-sounds/
  - Grátis com atribuição
  - Biblioteca muito grande
  - Sons profissionais

- **Freesound**: https://freesound.org/search/?q=notification
  - Creative Commons
  - Comunidade ativa
  - Variedade enorme

- **Mixkit** (já usado): https://mixkit.co/free-sound-effects/notification/
  - Completamente grátis
  - Sem atribuição necessária
  - Alta qualidade

## ⚙️ Configuração Técnica

Os sons são pré-carregados no hook `useNotifications` para melhor performance:

```typescript
useEffect(() => {
  ["default", "message", "success", "warning", "error", "urgent"].forEach(type => {
    const audio = new Audio(`/sounds/notification-${type}.mp3`);
    audio.preload = "auto";
    audioCache[type] = audio;
  });
}, []);
```

Cache em memória garante reprodução instantânea sem delay.
