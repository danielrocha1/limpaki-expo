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

Ha dois arquivos de exemplo:

| Arquivo | Uso |
|---------|-----|
| [`.env.example`](.env.example) | App Expo / proxy (`EXPO_PUBLIC_*`, `LIMPAE_PROXY_*`) |
| [`go/src/config/.env.example`](go/src/config/.env.example) | API Go local (`DATABASE_URL`, JWT, Resend, Mercado Pago, Supabase) |

### App Expo (raiz do projeto)

Copie `.env.example` para `.env`:

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `EXPO_PUBLIC_API_URL` | Sim (recomendado) | URL base da API. Fallback em codigo: `https://limpaki-expo-fvjj.onrender.com`. |
| `EXPO_PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED` | Nao | `false` desativa o passo de planos apos cadastro. |
| `EXPO_PUBLIC_SUPPORT_WHATSAPP` | Nao | Numero WhatsApp (somente digitos) na Central de Ajuda. |
| `REACT_APP_API_URL` | Nao | Build web CRA legado, se ainda usado. |
| `LIMPAE_PROXY_TARGET` | Nao | Destino do proxy local (`npm run start:proxy`). |
| `LIMPAE_PROXY_PORT` | Nao | Porta do proxy (padrao `8787`). |

### Backend Go (`go/src/config/.env` ou Environment no Render)

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | PostgreSQL. |
| `JWT_SECRET` | Sim | Assinatura de JWT no login. |
| `PORT` | Nao | Porta HTTP (Render define automaticamente). |
| `APP_ENV` | Nao | `production` / `staging` / `render` ativa cookies `Secure` no login. |
| `ALLOWED_ORIGINS` | Nao* | CORS: lista separada por virgula. |
| `FRONT_END_URL`, `FRONT_END_URL1` | Nao* | Origens CORS e base do link de verificacao de e-mail. |
| `APP_URL`, `PUBLIC_APP_URL` | Nao | Fallback para URL de verificacao de e-mail. |
| `INTERNAL_TEST_USER_EMAILS` | Nao | E-mails (virgula) marcados como `is_test_user` **somente no cadastro**. Nao pode ser alterado pela API. |
| `RESEND_API_KEY` | Sim** | Envio de e-mail de verificacao. |
| `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` | Sim** | Remetente Resend. |
| `EMAIL_FROM`, `EMAIL_ALERT_TO`, `EMAIL_PASSWORD` | Nao | SMTP legado (alertas/upload). |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET` | Sim*** | Fotos de perfil no storage. |
| `MERCADO_PAGO_ACCESS_TOKEN` | Sim**** | Checkout Pro / assinaturas. |
| `MERCADO_PAGO_WEBHOOK_URL` | Sim**** | Webhook publico (`/api/mercadopago/webhook`). |
| `MERCADO_PAGO_SUCCESS_URL` / `FAILURE_URL` / `PENDING_URL` | Nao | Redirects web; app nativo pode enviar URLs no checkout. |
| `SUBSCRIPTION_*_URL` | Nao | Aliases opcionais das URLs acima. |
| `CHAT_ALLOWED_ORIGINS` | Nao | CORS do WebSocket de chat. |
| `CHAT_LOCATION_MIN_INTERVAL` | Nao | Ex.: `1s` entre updates de localizacao. |
| `CHAT_WS_READ_BUFFER`, `CHAT_WS_WRITE_BUFFER` | Nao | Buffers do WebSocket. |

\* Se `ALLOWED_ORIGINS` estiver vazio, o backend usa `FRONT_END_URL` / `FRONT_END_URL1` ou defaults locais (`go/src/config/auth.go`).

\*\* Obrigatorias para enviar e-mail de confirmacao de conta.

\*\*\* Obrigatorias para upload/resolucao de foto de perfil.

\*\*\*\* Obrigatorias para assinatura paga; usuarios em `INTERNAL_TEST_USER_EMAILS` ou com `is_test_user` no banco têm acesso premium sem assinatura.

**Seguranca `is_test_user`:** o campo nao aceita `is_test_user` no `PUT /api/users/:id` (JSON estrito rejeita o campo). No `POST /api/users`, o payload `is_test_user` e ignorado; use `INTERNAL_TEST_USER_EMAILS` ou atualize direto no banco.

No Render, defina as variaveis do backend em **Environment** do servico da API. Cadastre no Mercado Pago o webhook igual a `MERCADO_PAGO_WEBHOOK_URL`.

### Testes Mercado Pago (Checkout Pro / preferencias)

Este projeto usa **Checkout Pro** (API de [preferencias](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/integration-test/test-cards)), nao Checkout Bricks. Segue a documentacao oficial de **contas de teste**:

| Papel | Onde usar no teu fluxo |
|-------|-------------------------|
| **Vendedor** | Credenciais da **tua aplicacao** no painel: `MERCADO_PAGO_ACCESS_TOKEN` de **teste** (`TEST-...`) no backend / Render. E o mesmo pais (ex. Brasil) da conta compradora de teste. |
| **Comprador** | Ao abrir o `sandbox_init_point`, faz login no checkout com o **usuario de teste comprador** criado em [Suas integracoes](https://www.mercadopago.com.br/developers/panel/app) > aplicacao > **Contas de teste** (username + senha; codigo de 6 digitos se pedir verificacao por email). |
| **Cartoes de teste** | [Cartoes de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/integration-test/test-cards) (numero, nome titular, validade, CVV conforme a doc). |

Notas:

- Para **Checkout Pro**, o painel pode **criar contas de teste automaticamente** ao criar a aplicacao; tambem podes criar manualmente (**Vendedor** / **Comprador** / ate 15 contas).
- **Checkout Bricks** tem fluxo de teste diferente e a doc indica limitacoes a **usuarios de teste** nessa seccao — nao se aplica aqui.
- O app Expo prefere **`sandbox_init_point`** quando existe (token de teste), para nao misturar checkout de producao com cartoes de teste.

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

Quando quiser forcar o app a bater em um proxy local apontando para o backend em Render (padrao `https://limpaki-expo-fvjj.onrender.com`), use:

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
- encaminha requisicoes HTTP e WebSocket para o destino em `LIMPAE_PROXY_TARGET` (padrao `https://limpaki-expo-fvjj.onrender.com`)

Para apontar para o Go na maquina local: `set LIMPAE_PROXY_TARGET=http://127.0.0.1:PORT` (Windows) antes de `npm run proxy:web` ou `npm run start:proxy`.

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
