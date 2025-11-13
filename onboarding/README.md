# Frontend de Onboarding - Porta 3002

## 🚀 Sistema de Cadastro e Onboarding

Frontend dedicado para o fluxo de registro e onboarding de novos usuários.

### 📦 Instalação

```bash
cd onboarding
npm install
```

### 🏃 Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3002

### 🏗️ Build para Produção

```bash
npm run build
```

### 🌐 Configuração

O arquivo `.env` contém:
```env
VITE_API_URL=http://localhost:3001
```

Para produção, altere para o domínio do seu backend:
```env
VITE_API_URL=https://api.seudominio.com.br
```

## 📁 Estrutura

```
onboarding/
├── src/
│   ├── pages/
│   │   └── onboarding/
│   │       ├── index.tsx           # Container principal
│   │       ├── signup-step.tsx     # Step 1: Cadastro
│   │       ├── company-step.tsx    # Step 2: Empresa
│   │       ├── pricing-step.tsx    # Step 3: Plano
│   │       ├── step1.tsx          # Step 4: Nicho
│   │       ├── step2.tsx          # Step 5: Desafio
│   │       ├── step3.tsx          # Step 6: Recursos
│   │       └── step4.tsx          # Step 7: Finalizar
│   ├── hooks/
│   │   ├── useOnboarding.ts       # Hook de configuração
│   │   └── useSignup.ts           # Hook de signup
│   ├── types/
│   │   └── onboarding.ts          # Tipos TypeScript
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .env
```

## 🔧 Proxy para Backend

O Vite está configurado para fazer proxy de `/api` para o backend na porta 3001:

```javascript
server: {
  port: 3002,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

## 🎯 Fluxo de Cadastro

1. **Signup** - Dados pessoais
2. **Empresa** - Informações da empresa
3. **Plano** - Seleção de plano (Starter/Professional/Business)
4. **Nicho** - Tipo de negócio (6 opções)
5. **Desafio** - Principal desafio
6. **Recursos** - Agente IA, templates, catálogo
7. **Finalizar** - Aplicar configurações

## 🌍 Deploy

### Subdomínio (Recomendado)

Configure DNS para: `registro.seudominio.com.br` ou `onboarding.seudominio.com.br`

### Nginx

```nginx
server {
    listen 80;
    server_name registro.seudominio.com.br;

    root /var/www/onboarding/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### CORS no Backend

Adicione o domínio ao CORS:

```javascript
app.use(cors({
  origin: [
    'https://app.seudominio.com.br',
    'https://registro.seudominio.com.br',
  ],
  credentials: true,
}));
```

## 📝 Notas

- **Porta**: 3002 (configurada no vite.config.ts)
- **Backend**: Aponta para porta 3001
- **Build**: Gera arquivos estáticos em `/dist`
- **Hot Reload**: Ativo em desenvolvimento
