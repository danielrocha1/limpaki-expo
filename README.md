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
EXPO_PUBLIC_API_URL=https://limpaki-expo.onrender.com
# Opcional: desativar fluxo de planos apos cadastro (padrao: habilitado)
# EXPO_PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED=false
```

Observacoes:

- `EXPO_PUBLIC_API_URL` e a variavel usada pelo app Expo (fallback em codigo tambem aponta para `https://limpaki-expo.onrender.com`).
- Assinatura usa Mercado Pago no backend; o app so redireciona para o link (`url` / `init_point`) devolvido pela API. Para desativar o passo de planos no cadastro, use `EXPO_PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED=false`.
- Copie `.env.example` para `.env` local se precisar sobrescrever a URL.

### Backend no Render (servico Go / API)

No painel do **mesmo** servico que hospeda a API (ex.: `limpaki-expo.onrender.com`), configure pelo menos:

| Variavel | Descricao |
|----------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL (Render Postgres ou externo). |
| `MERCADO_PAGO_ACCESS_TOKEN` | Access token de producao ou teste do Mercado Pago. |
| `MERCADO_PAGO_WEBHOOK_URL` | URL publica do webhook, ex. `https://limpaki-expo.onrender.com/api/mercadopago/webhook` (ajuste se o host for outro). |
| `MERCADO_PAGO_SUCCESS_URL` | Pagina do app web apos pagamento OK (ex. app na Vercel: `.../assinatura/success`). |
| `MERCADO_PAGO_FAILURE_URL` | Pagina se falhar ou cancelar. |
| `MERCADO_PAGO_PENDING_URL` | Pagina se pagamento ficar pendente (boleto etc.). |
| `JWT_SECRET` | Segredo para assinar e validar JWT (obrigatorio para login funcionar). |
| `ALLOWED_ORIGINS` | Lista separada por virgula de origens CORS (ex.: web Expo, Vercel). |
| `FRONT_END_URL` / `FRONT_END_URL1` | Origens extra aceites pelo backend (ver `go/src/config/auth.go`). |

Outras variaveis que o backend pode usar localmente (email, Supabase, etc.) continuam no `.env` carregado pelo Go em `src/config/.env` em desenvolvimento; no Render define-as tambem em **Environment**. No Mercado Pago, cadastra o webhook igual ao `MERCADO_PAGO_WEBHOOK_URL`.

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
