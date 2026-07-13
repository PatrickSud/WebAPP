# Ministério App — PWA

Aplicação Web Progressiva (PWA) para gerenciamento de ministério, construída com Next.js, TypeScript e Firebase.

## 🛠 Stack Tecnológica

- **Framework:** Next.js 16 (App Router)
- **Linguagem:** TypeScript
- **Estilo:** Vanilla CSS com variáveis customizadas
- **Backend:** Firebase (Auth + Firestore + Realtime Database)
- **PWA:** Service Worker + Manifesto nativo

## 📋 Pré-requisitos

- Node.js 18+
- npm 9+
- Projeto Firebase configurado (Auth, Firestore, Realtime Database)

## 🚀 Como Rodar Localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar Firebase

Copie o arquivo de exemplo e preencha com suas credenciais:

```bash
cp .env.local.example .env.local
```

Edite `.env.local` com as credenciais do seu projeto Firebase:

```
NEXT_PUBLIC_FIREBASE_API_KEY=sua-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=seu-app-id
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://seu-projeto-default-rtdb.firebaseio.com
```

### 3. Configurar Firebase (Console)

No [Firebase Console](https://console.firebase.google.com):

1. **Authentication:** Ativar o provider "Anonymous" (Authentication > Sign-in method)
2. **Firestore:** Criar o banco de dados (Cloud Firestore > Create database)
3. **Realtime Database:** Criar o banco (Realtime Database > Create database)
4. **Versão (opcional):** Criar o documento `config/version` no Firestore com campo `version: "0.1.0"`

### 4. Rodar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## 📦 Build de Produção

```bash
npm run build
npm start
```

O servidor de produção roda na porta 3000 por padrão.

## 📁 Estrutura de Pastas

```
src/
├── app/                    # Páginas (App Router)
│   ├── layout.tsx          # Layout raiz com providers
│   ├── page.tsx            # Redirect baseado em auth
│   ├── providers.tsx       # Context providers (client)
│   ├── globals.css         # Design system + variáveis CSS
│   ├── login/page.tsx      # Tela de login
│   ├── home/page.tsx       # Página Início (placeholder)
│   └── ministrar/page.tsx  # Página Ministrar (placeholder)
├── components/
│   ├── ui/                 # Componentes reutilizáveis
│   │   ├── Button.tsx      # Botão com variantes e loading
│   │   ├── Input.tsx       # Input com máscara e validação
│   │   └── Notification.tsx # Banner de atualização
│   ├── layout/
│   │   ├── AppShell.tsx    # Shell principal (header + nav)
│   │   └── FloatingNav.tsx # Menu flutuante pill-style
│   └── auth/
│       └── AuthGuard.tsx   # Guard de autenticação
├── contexts/
│   └── AuthContext.tsx     # Estado global de auth
├── hooks/
│   ├── useVersionCheck.ts  # Verificação de versão
│   └── useInstallPrompt.ts # Prompt de instalação PWA
├── lib/
│   ├── firebase.ts         # Inicialização Firebase
│   ├── firestore.ts        # Operações Firestore
│   ├── rtdb.ts             # Operações RTDB
│   ├── localStorage.ts     # Cache local seguro
│   └── version.ts          # Lógica de versionamento
├── types/
│   └── index.ts            # Tipos TypeScript
└── constants/
    └── index.ts            # Constantes da aplicação
```

## 🔐 Autenticação

O sistema usa **Firebase Anonymous Auth** combinado com validação de username + telefone no Firestore:

1. Usuário digita nome de usuário + telefone
2. Sistema verifica no Firestore se o username existe
3. Se existe, valida se o telefone corresponde
4. Se não existe, cria um novo registro (signup implícito)
5. Firebase Anonymous Auth gerencia a sessão

> **Upgrade futuro:** Pode ser elevado para Firebase Phone Auth (SMS OTP) sem mudanças na estrutura de dados.

## 📱 PWA

- **Manifesto:** `public/manifest.json`
- **Service Worker:** `public/sw.js`
- **Instalação:** O navegador exibe o prompt nativo automaticamente
- **Offline:** Cache-first para assets, network-first para navegação

## 🔄 Versionamento

1. A versão é definida em `package.json`
2. Ao carregar, a app compara com `config/version` no Firestore
3. Se há atualização, exibe banner com opção de recarregar
4. O service worker limpa caches antigos na ativação

## ♿ Acessibilidade

- Fonte mínima: 16px (evita zoom no iOS)
- Área de toque mínima: 48x48px
- Contraste: WCAG AA
- Navegação por teclado (`:focus-visible`)
- ARIA labels e roles semânticos
- Labels associados a inputs
