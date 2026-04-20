# Limpae Expo

Frontend mobile/web em Expo para o marketplace de diaristas Limpae.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- Expo Go no celular ou um emulador Android/iOS

## Instalar

```bash
npm install
```

## Variaveis de ambiente

Crie um `.env` a partir de `.env.example` e ajuste os valores do backend:

```env
EXPO_PUBLIC_API_URL=https://seu-backend.onrender.com
EXPO_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_sua_chave_publica
```

Observacoes:

- `EXPO_PUBLIC_API_URL` e a variavel usada pelo app Expo.
- `EXPO_PUBLIC_STRIPE_PUBLIC_KEY` so e necessaria se o fluxo de assinatura com Stripe estiver habilitado.
- Neste repositorio ja existe um `.env` apontando para o backend atual usado no projeto.

## Rodar com Expo

```bash
npm start
```

Comandos uteis:

```bash
npm run android
npm run ios
npm run web
npm run doctor
```

## Rodar com proxy no Expo

Quando quiser forcar o app a bater em um proxy local apontando para `https://limpae-jcqa.onrender.com`, use:

```bash
npm run start:proxy
```

Ou direto para Android:

```bash
npm run android:proxy
```

Esse fluxo:

- sobe um proxy local em `0.0.0.0:8787`
- aponta o Expo para `http://SEU_IP_LOCAL:8787`
- encaminha requisicoes HTTP e WebSocket para `https://limpae-jcqa.onrender.com`

Observacao:

- celular e computador precisam estar na mesma rede local

## Estrutura relevante

- `App.js`: entrada do Expo
- `src/mobile`: experiencia principal mobile/web responsiva
- `src/config/api.js`: configuracao da API e autenticacao

## Observacoes do projeto

- O projeto ainda carrega algumas dependencias antigas do fluxo web legado (`react-scripts`, `antd`, `react-router-dom`), mas o caminho principal para execucao agora e o Expo.
- Para web local com proxy, ainda existe o script `npm run proxy:web`.
- Para gerar export web estatico, use `npm run export:web`.
