# System Intelligence KB (Humano)

Este documento e a versao legivel para onboarding humano.
A fonte canonica continua sendo `docs/system-intelligence-kb.yaml`.

## 1) Contexto do sistema

- Produto: marketplace de diaristas (clientes x diaristas).
- Superficies: Web (React Router) + Mobile (Expo/React Native).
- Integracao: backend remoto por REST + WebSocket autenticado.
- Observacao importante: nao ha codigo Go local neste repositorio.

## 2) Entradas principais do projeto

- Web entrypoint: `src/index.js`
- Mobile entrypoint: `src/mobile/app/MobileApp.js`
- Mobile shell: `src/mobile/shell/AppShell.js`
- Cliente HTTP/API: `src/config/api.js`
- Cliente Realtime/WS: `src/config/realtime.js`

## 3) Dominios centrais

- `auth`: login, registro, reset/forgot password, verify email.
- `profile_address`: perfil, foto, enderecos, upload de documentos.
- `subscription_billing`: status de assinatura e checkout Mercado Pago (redirect via URL da API).
- `offers_negotiation`: criacao de oferta, contraproposta, aceitacao/recusa/cancelamento.
- `services_lifecycle`: agenda e acoes do servico (accept/start/complete/cancel/start-with-pin).
- `chat_presence_location`: mensagens, recibo de leitura, localizacao e presenca online.
- `discovery_map`: busca de diaristas proximas e reviews.

## 4) Estado global (Context API)

- `AddressProvider` (`src/context/address.js`)
  - Sessao, role, e-mail verificado, status de assinatura e enderecos.
- `ChatCenterProvider` (`src/context/chatCenter.js`)
  - Chats ativos, resumo de mensagens, unread e drawer global.
- `OnlinePresenceProvider` (`src/context/onlinePresence.js`)
  - Presenca online por role (polling + websocket).
- `ReviewProvider` (`src/context/service.js`)
  - Estado simples de review.

## 5) Entidades de dominio (resumo)

- `User`: id, role, email_verified, is_test_user, name, photo.
- `Address`: id, street, number, neighborhood, city, state, zipcode, latitude, longitude, rooms.
- `Subscription`: has_valid_subscription, plan, status.
- `Offer`: id, status, service_type, scheduled_at, duration_hours, initial_value, address_id.
- `Negotiation`: id, offer_id, counter_value, counter_duration_hours, message, status.
- `Service`: id, status, offer_id, client_id, diarist_id, scheduled_at, duration_hours, total_price.
- `Message`: id, service_id, sender_id, content, created_at, read.
- `Location`: service_id, user_id, latitude, longitude, updated_at.

## 6) Fluxos principais

### 6.1 Auth bootstrap
1. Login (ou restauracao por token).
2. Buscar role em `/api/users-role/`.
3. Buscar assinatura em `/api/subscriptions/access-status`.
4. Aplicar gates de role/e-mail/assinatura.

### 6.2 Registro com assinatura
1. Registro.
2. Auto-login (em alguns fluxos).
3. Criacao de sessao de checkout no backend (preferencia Mercado Pago / URL de pagamento).
4. Retorno success/denied + validacao de acesso.

### 6.3 Oferta -> Servico
1. Cliente cria oferta.
2. Diarista aceita ou negocia.
3. Cliente aceita contraproposta.
4. Oferta evolui para servico.
5. Lifecycle do servico.

### 6.4 Chat e realtime de servico
1. Carregar mensagens/localizacoes por `service_id`.
2. Conectar em `/api/ws/chat`.
3. Processar eventos de mensagem, leitura, localizacao e presenca.

### 6.5 Presenca e atualizacoes
1. Polling de online users por role.
2. WS de ofertas para atualizacoes de estado.

## 7) Contratos de API inferidos

- Login: retorna `token` (e possivelmente `email_verified`).
- Role: retorna `role`, `email_verified`, `is_test_user`.
- Access status: retorna `has_valid_subscription` + `subscription`.
- Listas paginadas: `items[]` + `pagination`.
- Checkout: retorna `url`, `init_point` ou `sandbox_init_point` (Mercado Pago).

Variacoes frequentes no payload:
- `id` vs `ID`
- `name` vs `Name`
- `photo` vs `Photo`
- `address` vs `Address`
- `reviews` vs `Reviews`

## 8) Semantica de status e eventos

- HTTP `401`: invalida sessao no cliente.
- HTTP `402`: bloqueio por assinatura.
- Evento UI: `subscription-access-blocked-change`.
- WS chat: `message`, `read`, `location`, `presence_state`, `user_joined`, `user_left`, `error`.
- WS offers: `service.updated`, `presence_state`.

## 9) Pontos criticos atuais

- Duplicacao alta entre web e mobile em fluxos de negocio.
- Componentes extensos com regra de negocio + fetch direto.
- Mistura de `fetch` e `apiFetch` (tratamento de erro/sessao desigual).
- Inconsistencias de contrato de API (normalizacao defensiva espalhada).
- Documentacao antiga menciona backend Go local nao presente.

## 10) Como usar este KB com outra IA

### 10.1 Para responder perguntas sobre codigo
- Identificar dominio da pergunta.
- Rastrear service e endpoint no YAML canonico.
- Cruzar com gates de role/assinatura e contexto global.

### 10.2 Para sugerir mudancas
- Mapear impacto por dominio.
- Validar paridade web + mobile.
- Revisar efeitos em providers e eventos WS.

### 10.3 Para gerar feature nova
- Definir entidade e fluxo alvo.
- Definir contrato de API e normalizadores.
- Implementar UI e comportamento em web/mobile (ou declarar escopo unico).
- Cobrir edge cases de sessao, assinatura e realtime.

## 11) Playbook rapido de prompts

- "Rastreie o endpoint `<PATH>` do cliente HTTP ate componentes web/mobile impactados."
- "Se alterarmos contrato de `<ENTITY>`, liste impacto e plano de migracao incremental."
- "Crie esqueleto de feature para `<FEATURE>` com paridade web/mobile."
- "Investigue bug no fluxo `<FLOW_ID>` e proponha causa raiz + correcao minima."
