# Relatório detalhado de rotas e handlers do backend

## Escopo e método

- Repositório analisado: `C:\Users\FIBRAMAR\Documents\Codex\limpae-push\go`
- Ponto de entrada HTTP: `main.go`
- Registrador efetivo de rotas: `src/routes/routes.go`
- Framework HTTP: Fiber v2
- ORM: GORM com PostgreSQL
- Observação importante: os arquivos `src/routes/user_routes.go`, `src/routes/service_routes.go`, `src/routes/review_routes.go`, `src/routes/payment_routes.go`, `src/routes/diaristprofile_routes.go`, `src/routes/subscriptions_routes.go` e `src/routes/controllers._routes.go` existem, mas não são chamados por `SetupRoutes`; aparentam ser código legado ou redundante.

## Middlewares globais e de grupo

- `logger.New()` em `main.go`: registra todas as requisições HTTP.
- `cors.New(...)` em `main.go`: valida origin por `config.ResolveAllowedOrigins()` e `config.IsAllowedOrigin()`, permite `GET,POST,HEAD,PUT,DELETE,PATCH` e credenciais.
- `config.JWTMiddleware` em `src/config/middleware.go`: aplicado ao grupo `/api`; extrai Bearer token ou cookie `auth_token`, valida JWT HMAC, injeta `user_id` e `email` em `Locals`.
- `handlers.RequireValidSubscriptionMiddleware` em `src/handlers/subscription_access.go`: aplicado a `/api/services`, `/api/offers`, `/api/negotiations`, `/api/realtime`, `/api/messages`, `/api/locations` e `GET /api/diarists-nearby`; libera acesso para usuário de teste ou assinatura com status `active`/`trialing`, senão responde `402`.
- `handlers.OfferWebSocketUpgradeMiddleware`: valida upgrade WebSocket, origin, token JWT, papel do usuário e assinatura premium antes de `GET /api/ws/offers`.
- `handlers.ChatWebSocketUpgradeMiddleware`: valida upgrade WebSocket, origin, token JWT, `service_id`, assinatura premium e acesso ao serviço antes de `GET /api/ws/chat`.

---

### 📌 Rota: [GET] /

**Arquivo:** main.go  
**Handler:** função anônima em `app.Get("/")`

**Descrição:**
Endpoint de healthcheck extremamente simples; responde texto fixo.

**Fluxo de execução:**
1. A rota é registrada diretamente em `main.go`.
2. O handler escreve log em stdout com `fmt.Println`.
3. Retorna `"Hello World!"` com `c.SendString`.

**Validações:**
- Nenhuma.

**Regras de negócio:**
- Nenhuma.

**Dependências:**
- Fiber `Ctx.SendString`.
- `fmt.Println` para log simples.

**Banco de dados:**
- Nenhuma operação.

**Autenticação/Autorização:**
- Nenhuma.

**Tratamento de erros:**
- Não há tratamento explícito; `SendString` retorna erro padrão do Fiber se falhar.

**Efeitos colaterais:**
- Log em stdout.

**Observações:**
- Serve apenas para disponibilidade básica.
- O processo também dispara um goroutine de keep-alive externo em `startRequestTimer`, mas isso não está ligado a esta rota.

---

### 📌 Rota: [GET] /api/ws/offers

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.OfferWebSocketHandler` com pré-validação por `handlers.OfferWebSocketUpgradeMiddleware`

**Descrição:**
Abre conexão WebSocket para eventos em tempo real do mural de ofertas, negociações, presença e serviços.

**Fluxo de execução:**
1. O middleware valida se a requisição é upgrade WebSocket, origin permitido e token JWT via `config.AuthenticateWebSocketUpgrade`.
2. Carrega `id` e `role` do usuário em `users` para confirmar perfil.
3. Verifica assinatura premium por `CanAccessPremiumFeatures`.
4. Armazena `user_id`, `email`, `user_role`, `ws_key` e protocolo selecionado em `Locals`.
5. O handler monta o `Sec-WebSocket-Accept`, responde `101 Switching Protocols` manualmente e usa `Hijack`.
6. Registra a conexão em `realtime.OfferHub.RegisterConnection`.
7. O hub passa a receber/enviar eventos `offer.created`, `offer.updated`, `negotiation.*`, `service.updated` e snapshots de presença.

**Validações:**
- Requisição precisa ser upgrade WebSocket.
- `Origin` deve ser permitido.
- `Sec-WebSocket-Key` é obrigatório.
- JWT válido é obrigatório.
- Usuário precisa existir no banco.
- Assinatura premium válida é obrigatória.

**Regras de negócio:**
- Sem assinatura válida o usuário não entra no canal realtime.
- O hub indexa conexões por `user_id` e `role`, então o escopo de broadcast depende desses atributos.

**Dependências:**
- `src/config/auth.go` → autenticação e validação de origin.
- `src/handlers/subscription_access.go` → gating de assinatura.
- `src/realtime/hub.go` → gerenciamento de clientes, ping/pong, dispatch e presença.
- `src/realtime/offers.go` → tipos e dispatch de eventos.
- `models.User` → lookup do papel do usuário.

**Banco de dados:**
- `SELECT id, role FROM users WHERE id = ?`.

**Autenticação/Autorização:**
- JWT via cabeçalho/protocolo/cookie.
- Autorização por assinatura premium.

**Tratamento de erros:**
- Erros de upgrade/autenticação retornam `400`, `401`, `403`, `426` ou `402`.
- Falha no lookup do usuário retorna `401`.
- Falha no handshake após hijack fecha a conexão.

**Efeitos colaterais:**
- Logs estruturados do handshake.
- Registro/desregistro da conexão no hub.
- Publicação automática de snapshots de presença.

**Observações:**
- O handshake é implementado manualmente; aumenta controle, mas eleva risco de incompatibilidades de protocolo.
- Não há rate limiting nem auditoria por mensagem nesse canal.

---

### 📌 Rota: [GET] /api/ws/chat

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.ChatWebSocketHandler()` com pré-validação por `handlers.ChatWebSocketUpgradeMiddleware`

**Descrição:**
Abre WebSocket do chat vinculado a um serviço específico, suportando mensagens, leitura e compartilhamento de localização.

**Fluxo de execução:**
1. `ensureChatRuntime()` sobe o container do módulo de chat e o hub interno se necessário.
2. O middleware valida upgrade, origin, token e `Sec-WebSocket-Key`.
3. Converte `service_id` da query usando `chathandler.ParseServiceID`.
4. Verifica assinatura premium e acesso do usuário ao serviço por `handler.ValidateConnection`, que usa `ServiceAccessService`.
5. O handler responde `101`, faz hijack do socket e entrega a conexão para `chathandler.WebSocketHandler.ServeConn`.
6. O client do chat passa a aceitar eventos inbound `message`, `read` e `location`.
7. Cada evento aciona `MessageService` ou `LocationService` e o hub do chat faz broadcast por serviço.

**Validações:**
- Upgrade WebSocket obrigatório.
- `service_id` na query é obrigatório e numérico.
- JWT válido obrigatório.
- Origin permitido.
- Assinatura premium válida obrigatória.
- Usuário precisa participar do serviço e o serviço não pode estar cancelado/concluído.

**Regras de negócio:**
- Chat só existe para participantes do serviço.
- Serviços concluídos/cancelados bloqueiam chat.
- Atualização de localização respeita intervalo mínimo configurável.

**Dependências:**
- `src/chat/container.go` → DI do módulo.
- `src/chat/handler/websocket.go` → processamento de eventos.
- `src/chat/service/service_access_service.go` → autorização do serviço.
- `src/chat/service/message_service.go` → persistência e leitura de mensagens.
- `src/chat/service/location_service.go` → upsert/listagem de localização.
- `src/chat/repository/*` → acesso a `services`, `chat_rooms`, `chat_messages`, `chat_locations`.

**Banco de dados:**
- `SELECT` em `services` com filtro por `client_id`/`diarist_id`.
- Criação ou reutilização de `chat_rooms` e `chat_room_users`.
- `INSERT` em `chat_messages`.
- `INSERT ... ON CONFLICT` em `chat_locations`.
- `INSERT ... ON CONFLICT DO NOTHING` em `chat_message_reads`.

**Autenticação/Autorização:**
- JWT.
- Assinatura premium.
- Autorização por participação no serviço.

**Tratamento de erros:**
- `400` para `service_id` inválido ou input ruim.
- `404` quando o usuário não tem acesso ao serviço.
- `409` para chat indisponível.
- `402` para assinatura inválida.
- `500` para erros internos.

**Efeitos colaterais:**
- Criação implícita de sala de chat.
- Broadcast realtime de mensagens, confirmações de leitura e localização.
- Logs estruturados via `slog`.

**Observações:**
- O chat depende de uma camada separada mais madura que a maioria dos handlers do projeto.
- O endpoint HTTP só faz listagem; a escrita acontece no canal WebSocket.

---

### 📌 Rota: [POST] /stripe/webhook

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.StripeWebhookHandler`

**Descrição:**
Recebe webhooks do Stripe para sincronizar o estado local de assinaturas recorrentes.

**Fluxo de execução:**
1. Valida presença de `STRIPE_WEBHOOK_SECRET` e configura `stripe.Key`.
2. Lê payload bruto e cabeçalho `Stripe-Signature`.
3. Constrói o evento com `webhook.ConstructEvent`.
4. Executa `processStripeWebhookEvent` dentro de transação.
5. Registra idempotência em `stripe_webhook_events`.
6. Para eventos de checkout, subscription ou invoice, carrega a assinatura Stripe e executa `syncSubscriptionFromStripe`.
7. Faz upsert do registro local em `subscriptions`.

**Validações:**
- Segredo do webhook precisa existir.
- Assinatura do webhook precisa ser válida.
- O evento precisa ter payload compatível com o tipo.

**Regras de negócio:**
- Eventos duplicados são ignorados por `event_id`.
- Eventos mais antigos que o último processado não sobrescrevem estado.
- `past_due`, `unpaid`, `incomplete` e afins derrubam acesso imediatamente.
- O `plan` persistido é mapeado para storage plan `"premium"`.

**Dependências:**
- Stripe SDK (`webhook`, `sub`, `invoice`, `checkout/session`, `customer`).
- `syncSubscriptionFromStripe` / `upsertSubscriptionRecord`.
- `models.Subscription` e `models.StripeWebhookEvent`.

**Banco de dados:**
- `SELECT/INSERT` em `stripe_webhook_events`.
- `SELECT/INSERT/UPDATE` em `subscriptions`.
- Eventuais consultas auxiliares em `users` para descobrir `role`.

**Autenticação/Autorização:**
- Sem JWT.
- Confiança baseada na assinatura do Stripe.

**Tratamento de erros:**
- `500` se a configuração Stripe estiver ausente.
- `400` para assinatura inválida.
- `502` para falha ao sincronizar com Stripe.

**Efeitos colaterais:**
- Logs extensivos.
- Atualização do acesso premium do usuário.

**Observações:**
- `PaymentStripeWebhookHandler` é alias deste mesmo fluxo.
- O handler está relativamente robusto e idempotente comparado ao restante do backend.

---

### 📌 Rota: [POST] /paymentstripe

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.PaymentStripeWebhookHandler`

**Descrição:**
Alias para o webhook principal do Stripe; executa exatamente o mesmo fluxo de `/stripe/webhook`.

**Fluxo de execução:**
1. Encaminha a chamada diretamente para `StripeWebhookHandler`.
2. Repete validação de assinatura, idempotência e sincronização local de assinatura.

**Validações:**
- Mesmas de `/stripe/webhook`.

**Regras de negócio:**
- Mesmas de `/stripe/webhook`.

**Dependências:**
- `handlers.StripeWebhookHandler`.

**Banco de dados:**
- Mesmas operações em `stripe_webhook_events` e `subscriptions`.

**Autenticação/Autorização:**
- Sem JWT; validação por assinatura Stripe.

**Tratamento de erros:**
- Mesmo comportamento da rota principal.

**Efeitos colaterais:**
- Mesmos da rota principal.

**Observações:**
- Duplicidade de endpoint aumenta superfície de manutenção.

---

### 📌 Rota: [POST] /register

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CreateUser`

**Descrição:**
Cadastro unificado de usuário, endereço e perfil, com fluxo diferente para cliente e diarista.

**Fluxo de execução:**
1. Faz `BodyParser` em `RegisterPayload`.
2. Valida campos obrigatórios, email, telefone, CPF e papel.
3. Consulta unicidade por email, telefone ou CPF.
4. Gera hash bcrypt da senha.
5. Inicia transação.
6. Cria `users`.
7. Cria `addresses` associado ao usuário.
8. Se o papel for cliente, exige pelo menos um cômodo, cria `address_rooms` e `user_profiles`.
9. Se o papel for diarista, serializa `specialties` e cria `diarists`.
10. Faz commit e responde com `id`, `email` e `role`.

**Validações:**
- `name`, `email`, `phone`, `cpf`, `password`, `role` obrigatórios.
- Email por regex.
- Telefone com 10 ou 11 dígitos.
- CPF validado por dígitos verificadores.
- `role` apenas `cliente` ou `diarista`.
- Unicidade de email/telefone/CPF.
- Para cliente, pelo menos um cômodo no endereço.

**Regras de negócio:**
- Cliente recebe `UserProfile`; diarista recebe `Diarists`.
- Foto inicial é sempre `defaultPhotoURL`.
- Usuário de teste é persistido pelo payload.

**Dependências:**
- GORM direto; não há service layer.
- `bcrypt.GenerateFromPassword`.
- Helpers locais de validação de CPF/email/telefone.

**Banco de dados:**
- `SELECT` em `users` para unicidade.
- `INSERT` em `users`, `addresses`, `address_rooms`, `user_profiles` ou `diarists`.
- Tudo em transação manual.

**Autenticação/Autorização:**
- Nenhuma.

**Tratamento de erros:**
- `400` para payload inválido ou conflito cadastral.
- `500` para falhas de hash, transação ou inserts.
- `Rollback` explícito em cada falha transacional.

**Efeitos colaterais:**
- Hash de senha.

**Observações:**
- Não usa `decodeStrictJSON`, então campos extras no payload são aceitos silenciosamente.
- Não há verificação de duplicidade de endereço/perfil.

---

### 📌 Rota: [POST] /users

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CreateUser`

**Descrição:**
Mesmo fluxo de `/register`; expõe um alias REST para cadastro.

**Fluxo de execução:**
1. Encaminha para `CreateUser`.
2. Executa cadastro transacional completo do usuário.

**Validações:**
- Mesmas de `/register`.

**Regras de negócio:**
- Mesmas de `/register`.

**Dependências:**
- `handlers.CreateUser`.

**Banco de dados:**
- Mesmas operações em `users`, `addresses`, `address_rooms`, `user_profiles` ou `diarists`.

**Autenticação/Autorização:**
- Nenhuma.

**Tratamento de erros:**
- Mesmo comportamento de `/register`.

**Efeitos colaterais:**
- Mesmo comportamento de `/register`.

**Observações:**
- Rota duplicada; aumenta chance de documentação divergente no frontend.

---

### 📌 Rota: [POST] /login

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.LoginHandler`

**Descrição:**
Autentica usuário por email e senha, emite JWT e grava cookie `auth_token`.

**Fluxo de execução:**
1. Faz `BodyParser` em `LoginRequest`.
2. Busca usuário por email.
3. Compara senha usando bcrypt.
4. Gera JWT HS256 com `user_id`, `email` e expiração de 24 horas.
5. Define cookie HTTP-only `auth_token`.
6. Retorna o token também no JSON.

**Validações:**
- Payload parseável.
- Email precisa existir.
- Senha precisa bater com o hash.

**Regras de negócio:**
- Cookie usa `Secure` apenas em `production`, `staging` ou `render`.
- `SameSite` é sempre `None`.

**Dependências:**
- GORM direto.
- `bcrypt.CompareHashAndPassword`.
- `github.com/golang-jwt/jwt/v4`.

**Banco de dados:**
- `SELECT * FROM users WHERE email = ?`.

**Autenticação/Autorização:**
- Gera autenticação JWT.

**Tratamento de erros:**
- `400` para input inválido.
- `401` para credenciais inválidas.
- `500` para falha na assinatura do token.

**Efeitos colaterais:**
- Emissão de JWT.
- Escrita de cookie no cliente.

**Observações:**
- `jwtSecret` é lido em variável global no init do pacote; se `JWT_SECRET` for carregado tardiamente, há risco de segredo vazio.
- Não há proteção contra brute force ou auditoria de login.

---

### 📌 Rota: [GET] /api/users

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetUsers`

**Descrição:**
Retorna apenas o próprio usuário autenticado em formato de lista.

**Fluxo de execução:**
1. `RequireAuthenticatedUser` lê `user_id` do contexto.
2. `findScopedUser(userID, userID)` faz preload de endereço e perfis.
3. `resolveUserPhoto` tenta converter o valor persistido da foto em signed URL.
4. Mapeia para `UserResponseDTO`.
5. Responde `[]UserResponseDTO` com um único item.

**Validações:**
- JWT obrigatório.
- Usuário precisa existir.

**Regras de negócio:**
- O escopo impede leitura de outros usuários.
- CPF sai mascarado no DTO.

**Dependências:**
- `findScopedUser`, `resolveUserPhoto`, `toUserResponseDTO`.
- `utils.ResolveStoredPhotoURL`.

**Banco de dados:**
- `SELECT` com preload de `addresses`, `address_rooms`, `diarists`, `user_profiles`.

**Autenticação/Autorização:**
- JWT.
- Escopo hardcoded para o próprio usuário.

**Tratamento de erros:**
- `404` se o usuário não existir.
- `500` se a resolução da foto falhar criticamente.

**Efeitos colaterais:**
- Geração de signed URL de foto, sem persistência.

**Observações:**
- O nome sugere listagem geral, mas devolve apenas o usuário autenticado.

---

### 📌 Rota: [GET] /api/users/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetUser`

**Descrição:**
Busca um usuário por `:id`, mas efetivamente restringe a consulta ao próprio usuário autenticado.

**Fluxo de execução:**
1. Valida autenticação.
2. Lê `:id`.
3. `findScopedUser` executa query `Where("id = ?", userID).First(&user, targetID)`.
4. Resolve foto.
5. Retorna DTO do usuário.

**Validações:**
- JWT obrigatório.
- Usuário alvo precisa cair no escopo da query.

**Regras de negócio:**
- Um usuário não consegue ler outro; a query força `id = userID`.

**Dependências:**
- `findScopedUser`.
- `resolveUserPhoto`.

**Banco de dados:**
- `SELECT` com preload igual ao de `/api/users`.

**Autenticação/Autorização:**
- JWT.
- Autorização implícita por filtro no próprio `id`.

**Tratamento de erros:**
- `404` se o registro não estiver no escopo.
- `500` se a foto falhar.

**Efeitos colaterais:**
- Signed URL de foto.

**Observações:**
- O parâmetro `:id` é redundante porque usuários só enxergam a si mesmos.

---

### 📌 Rota: [PUT] /api/users/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.UpdateUser`

**Descrição:**
Atualiza dados básicos do próprio usuário autenticado.

**Fluxo de execução:**
1. Valida autenticação.
2. Recupera o usuário no escopo próprio.
3. Decodifica JSON estrito em `UserUpdateRequestDTO`.
4. Valida `name`, `email` e `phone`.
5. Converte telefone para `int64`.
6. Atualiza struct em memória e faz `config.DB.Save(&user)`.
7. Resolve foto e retorna DTO atualizado.

**Validações:**
- Rejeita campos desconhecidos via `decodeStrictJSON`.
- `name` até 100 chars.
- Email válido.
- Telefone com 10/11 dígitos.

**Regras de negócio:**
- Só o próprio usuário pode se atualizar.
- `is_test_user` pode ser alterado via API se enviado no payload.

**Dependências:**
- `decodeStrictJSON`, `validationCollector`.
- `findScopedUser`.

**Banco de dados:**
- `SELECT` do usuário com preloads.
- `UPDATE users SET ...`.

**Autenticação/Autorização:**
- JWT.
- Escopo do próprio usuário.

**Tratamento de erros:**
- `400` para validação.
- `404` para usuário fora do escopo.
- `500` para falha ao resolver foto.

**Efeitos colaterais:**
- Geração de signed URL.

**Observações:**
- Não há validação de unicidade para email/telefone na atualização.
- Permitir troca de `is_test_user` por qualquer usuário é risco grave de negócio.

---

### 📌 Rota: [DELETE] /api/users/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.DeleteUser`

**Descrição:**
Exclui o próprio usuário autenticado.

**Fluxo de execução:**
1. Valida autenticação.
2. Busca usuário no próprio escopo.
3. Executa `Delete(&models.User{}, user.ID)`.
4. Retorna `204`.

**Validações:**
- JWT obrigatório.
- Usuário precisa existir no escopo.

**Regras de negócio:**
- Só a própria conta pode ser excluída.

**Dependências:**
- `findScopedUser`.

**Banco de dados:**
- `SELECT` do usuário.
- `DELETE FROM users WHERE id = ?`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `404` para usuário não encontrado.
- Não verifica erro do `Delete`.

**Efeitos colaterais:**
- Remoção em cascata potencial de relações com `OnDelete:CASCADE`.

**Observações:**
- Ausência de checagem do erro do `Delete` pode mascarar falhas de banco.

---

### 📌 Rota: [GET] /api/users-role

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetUserRole`

**Descrição:**
Retorna o papel (`role`) do usuário autenticado.

**Fluxo de execução:**
1. Lê `user_id` diretamente de `Locals`.
2. Faz lookup em `users`.
3. Retorna `{ "role": user.Role }`.

**Validações:**
- JWT obrigatório de forma implícita.

**Regras de negócio:**
- Nenhuma além de expor o papel atual.

**Dependências:**
- GORM direto.

**Banco de dados:**
- `SELECT * FROM users WHERE id = ?`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `404` se o usuário não existir.

**Efeitos colaterais:**
- `fmt.Println("ID", userID)` em stdout.

**Observações:**
- Usa cast direto `c.Locals("user_id").(uint)`; se o middleware não rodar, pode panic.

---

### 📌 Rota: [GET] /api/profile

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetUserProfile`

**Descrição:**
Carrega o perfil consolidado do usuário autenticado com endereço, cômodos e perfil específico.

**Fluxo de execução:**
1. Valida autenticação.
2. Preload de `UserProfile`, `DiaristProfile`, `Address`, `Address.Rooms`.
3. Resolve foto.
4. Retorna `UserResponseDTO`.

**Validações:**
- JWT obrigatório.

**Regras de negócio:**
- O retorno varia conforme o papel do usuário, porque os preloads populam um dos perfis 1:1.

**Dependências:**
- GORM direto.
- `resolveUserPhoto`.
- `toUserResponseDTO`.

**Banco de dados:**
- `SELECT` em `users` com múltiplos preloads.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `404` para usuário inexistente.
- `500` se a foto falhar.

**Efeitos colaterais:**
- Signed URL temporária.

**Observações:**
- Endpoint mais coerente que `/api/users` para leitura do próprio perfil.

---

### 📌 Rota: [PUT] /api/profile

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.UpdateProfile`

**Descrição:**
Atualiza dados básicos do usuário e o perfil associado ao papel atual dentro de uma transação.

**Fluxo de execução:**
1. Valida autenticação.
2. Decodifica `UpdateProfilePayload` estrito.
3. Carrega usuário e relações.
4. Valida nome, email e telefone opcionais.
5. Inicia transação.
6. Atualiza `users` com `Updates(map)`.
7. Se o usuário for diarista, valida e faz upsert em `diarists`.
8. Caso contrário, valida e faz upsert em `user_profiles`.
9. Faz commit, recarrega dados, resolve foto e retorna DTO.

**Validações:**
- JSON estrito.
- Email válido se enviado.
- Telefone válido se enviado.
- Para diarista: `experience_years >= 0`, preços não negativos, specialties serializáveis.
- Para cliente: enums de residência e frequência.

**Regras de negócio:**
- Só atualiza o perfil compatível com o papel atual.
- Usa `FirstOrCreate` + `Assign` para funcionar como upsert.

**Dependências:**
- `buildDiaristProfileFromDTO`.
- `buildUserProfileFromDTO`.
- GORM transacional.

**Banco de dados:**
- `SELECT` com preloads.
- `UPDATE users`.
- `SELECT/INSERT/UPDATE` em `diarists` ou `user_profiles`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `400`, `404`, `500`.

**Efeitos colaterais:**
- Signed URL de foto.

**Observações:**
- Não trata conflitos de unicidade de email/telefone.

---

### 📌 Rota: [POST] /api/diarists

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CreateDiaristProfile`

**Descrição:**
Cria ou atualiza o perfil profissional da diarista autenticada.

**Fluxo de execução:**
1. Valida autenticação.
2. Exige papel `diarista`.
3. Decodifica JSON estrito.
4. Valida e monta `models.Diarists`.
5. Faz upsert por `user_id`.
6. Retorna DTO.

**Validações:**
- JWT.
- Papel `diarista`.
- `bio` até 2000 chars.
- `experience_years >= 0`.
- `price_per_hour` e `price_per_day` não negativos.
- `specialties` serializáveis.

**Regras de negócio:**
- Age como upsert, não como create puro.

**Dependências:**
- `buildDiaristProfileFromDTO`.

**Banco de dados:**
- `SELECT/INSERT/UPDATE` em `diarists`.

**Autenticação/Autorização:**
- JWT.
- Role-based authorization.

**Tratamento de erros:**
- `403`, `400`, `500`.

**Efeitos colaterais:**
- Nenhum além da escrita no banco.

**Observações:**
- O nome da rota sugere create, mas ela também sobrescreve perfil existente.

---

### 📌 Rota: [GET] /api/diarists

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetDiarists`

**Descrição:**
Lista todos os registros da tabela `diarists`.

**Fluxo de execução:**
1. Faz `Find(&diarists)` sem filtros.
2. Mapeia cada registro para DTO.
3. Retorna array.

**Validações:**
- Apenas JWT do grupo `/api`.

**Regras de negócio:**
- Nenhuma filtragem por disponibilidade, localização ou assinatura.

**Dependências:**
- GORM direto.

**Banco de dados:**
- `SELECT * FROM diarists`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- Não trata erro do `Find`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- A ausência de preload para `users` limita bastante o retorno.

---

### 📌 Rota: [GET] /api/diarists/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetDiarist`

**Descrição:**
Busca um perfil de diarista pelo id primário da tabela `diarists`.

**Fluxo de execução:**
1. Lê `:id`.
2. Executa `First(&diarist, id)`.
3. Retorna DTO do perfil.

**Validações:**
- JWT do grupo `/api`.

**Regras de negócio:**
- Nenhuma além da existência do registro.

**Dependências:**
- GORM direto.

**Banco de dados:**
- `SELECT * FROM diarists WHERE id = ?`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `404` se não existir.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- O `:id` é do perfil, não do usuário.

---

### 📌 Rota: [PUT] /api/diarists/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.UpdateDiarist`

**Descrição:**
Atualiza o perfil da diarista autenticada dentro do próprio escopo.

**Fluxo de execução:**
1. Valida autenticação.
2. Busca perfil filtrando `user_id = ?`.
3. Decodifica JSON estrito.
4. Valida novo perfil.
5. Copia campos para a entidade existente.
6. Faz `Save(&diarist)`.
7. Retorna DTO.

**Validações:**
- JWT.
- Escopo por `user_id`.
- Mesmas validações do create.

**Regras de negócio:**
- Uma diarista só pode alterar o próprio perfil.

**Dependências:**
- `buildDiaristProfileFromDTO`.

**Banco de dados:**
- `SELECT * FROM diarists WHERE user_id = ?`.
- `UPDATE diarists`.

**Autenticação/Autorização:**
- JWT.
- Escopo do proprietário.

**Tratamento de erros:**
- `404`, `400`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Não verifica papel explicitamente; depende do vínculo do perfil ao `user_id`.

---

### 📌 Rota: [DELETE] /api/diarists/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.DeleteDiarist`

**Descrição:**
Exclui o perfil da diarista autenticada.

**Fluxo de execução:**
1. Valida autenticação.
2. Busca perfil por `user_id`.
3. Executa `Delete(&models.Diarists{}, diarist.ID)`.
4. Retorna mensagem de sucesso.

**Validações:**
- JWT.
- Escopo do proprietário.

**Regras de negócio:**
- Só o dono do perfil pode removê-lo.

**Dependências:**
- GORM direto.

**Banco de dados:**
- `SELECT` no escopo.
- `DELETE FROM diarists WHERE id = ?`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `404` e `500`.

**Efeitos colaterais:**
- Remoção do perfil profissional.

**Observações:**
- Não há proteção contra remoção enquanto existirem ofertas/serviços em aberto.

---

### 📌 Rota: [POST] /api/addresses

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CreateAddress`

**Descrição:**
Cria endereço do usuário autenticado e, opcionalmente, seus cômodos.

**Fluxo de execução:**
1. Valida autenticação.
2. Decodifica JSON estrito.
3. `buildAddressFromDTO` valida endereço e monta `Address` + `AddressRoom`.
4. Insere `addresses`.
5. Preenche `AddressID` em cada cômodo.
6. Insere `address_rooms` se existirem.
7. Retorna DTO do endereço.

**Validações:**
- Rua, bairro, cidade, estado e CEP obrigatórios.
- Estado deve ter 2 letras.
- CEP via regex.
- Nome do cômodo obrigatório e quantidade entre 1 e 99.

**Regras de negócio:**
- Diferente do cadastro de usuário, aqui cômodos são opcionais.

**Dependências:**
- `buildAddressFromDTO`.
- `validationCollector`.

**Banco de dados:**
- `INSERT` em `addresses`.
- `INSERT` em `address_rooms`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `400` para validação.
- `500` para falha ao inserir endereço ou cômodos.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Não usa transação; se o insert dos cômodos falhar, o endereço já terá sido criado.

---

### 📌 Rota: [GET] /api/addresses/

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetAddress` delegando para `handlers.GetAddresses`

**Descrição:**
Lista todos os endereços do usuário autenticado.

**Fluxo de execução:**
1. Valida autenticação.
2. Busca `addresses` por `user_id` com preload de `Rooms`.
3. Mapeia para DTO.
4. Retorna array.

**Validações:**
- JWT.

**Regras de negócio:**
- Só endereços do próprio usuário entram no resultado.

**Dependências:**
- `GetAddresses`.

**Banco de dados:**
- `SELECT * FROM addresses WHERE user_id = ?` com preload de `address_rooms`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `500` se a consulta falhar.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- A rota usa nome singular no handler e plural no comportamento.

---

### 📌 Rota: [PUT] /api/addresses/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.UpdateAddress`

**Descrição:**
Atualiza um endereço do usuário autenticado, substituindo integralmente os cômodos.

**Fluxo de execução:**
1. Valida autenticação e busca endereço por `user_id`.
2. Decodifica JSON estrito e revalida endereço/cômodos.
3. Faz `Save` do endereço.
4. Apaga todos os `address_rooms` existentes.
5. Recria os cômodos do payload.
6. Retorna DTO atualizado.

**Validações:**
- Mesmas do create.

**Regras de negócio:**
- Atualização de cômodos é destrutiva: sempre apaga e recria.

**Dependências:**
- `findOwnedAddress`.
- `buildAddressFromDTO`.

**Banco de dados:**
- `SELECT`, `UPDATE` em `addresses`.
- `DELETE` e `INSERT` em `address_rooms`.

**Autenticação/Autorização:**
- JWT; apenas proprietário.

**Tratamento de erros:**
- `404`, `400`, `500`.

**Efeitos colaterais:**
- Perda dos IDs antigos dos cômodos.

**Observações:**
- Também não usa transação; pode deixar o endereço inconsistente.

---

### 📌 Rota: [DELETE] /api/addresses/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.DeleteAddress`

**Descrição:**
Remove um endereço do usuário autenticado.

**Fluxo de execução:**
1. Valida autenticação e escopo.
2. Executa `Delete(&models.Address{}, address.ID)`.
3. Retorna `204`.

**Validações:**
- JWT.
- Endereço no escopo do usuário.

**Regras de negócio:**
- Só o próprio usuário pode remover o endereço.

**Dependências:**
- `findOwnedAddress`.

**Banco de dados:**
- `SELECT` em `addresses`.
- `DELETE FROM addresses`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `404`; não checa erro do `Delete`.

**Efeitos colaterais:**
- Remoção em cascade dos `address_rooms`.

**Observações:**
- Não protege contra exclusão de endereço referenciado por ofertas/serviços ativos.

---

### 📌 Rota: [POST] /api/services/

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CreateService`

**Descrição:**
Cria um agendamento direto entre cliente e diarista, sem passar pelo mural.

**Fluxo de execução:**
1. Autentica, exige assinatura premium e papel `cliente`.
2. Decodifica `ServiceCreateRequestDTO` estrito e valida campos.
3. Se `address_id` vier, garante propriedade do endereço.
4. Monta `models.Service`.
5. Executa transação `createServiceTx`, que bloqueia a diarista e checa conflito de agenda.
6. Recarrega serviço, resolve fotos, publica `service.updated`.
7. Retorna DTO.

**Validações:**
- `diarist_id` obrigatório.
- `total_price >= 0`.
- `duration_hours > 0`.
- `scheduled_at` futuro.
- `service_type` obrigatório.
- `room_count`/`bathroom_count` não negativos.
- Endereço opcional precisa pertencer ao cliente.

**Regras de negócio:**
- Status inicial `pendente`.
- Não pode haver sobreposição de agenda da diarista.

**Dependências:**
- `RequireValidSubscriptionMiddleware`.
- `createServiceTx`.
- `realtime.PublishServiceUpdated`.

**Banco de dados:**
- `SELECT` do endereço.
- Lock em `users`.
- `SELECT` e `INSERT` em `services`.

**Autenticação/Autorização:**
- JWT, assinatura premium, papel `cliente`.

**Tratamento de erros:**
- `400`, `403`, `404`, `409`, `500`.

**Efeitos colaterais:**
- Logs detalhados e evento realtime.

**Observações:**
- Não verifica disponibilidade (`Available`) da diarista.

---

### 📌 Rota: [GET] /api/services/

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetServices`

**Descrição:**
Lista todos os serviços em que o usuário participa.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Consulta `services` com preloads e filtro por participação.
3. Resolve fotos.
4. Mapeia para DTO e retorna array.

**Validações:**
- JWT e assinatura premium.

**Regras de negócio:**
- O DTO inclui `start_pin` apenas para a cliente via mapper.

**Dependências:**
- `resolveServicePhotos`.
- `toServiceResponseDTO`.

**Banco de dados:**
- `SELECT` em `services` com preloads.

**Autenticação/Autorização:**
- JWT e assinatura premium.

**Tratamento de erros:**
- `500` para falha em foto.

**Efeitos colaterais:**
- Signed URLs.

**Observações:**
- Não pagina.

---

### 📌 Rota: [GET] /api/services/my

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetServicesByClientID`

**Descrição:**
Lista serviços do usuário com paginação e filtro por grupo de status.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Lê `status_group`, `page` e `page_size`.
3. Monta query por participação e filtra ativos ou históricos.
4. Conta total, pagina, busca itens.
5. Resolve fotos e devolve payload com `pagination`.

**Validações:**
- JWT e assinatura premium.
- `page_size` normalizado para no máximo 20.

**Regras de negócio:**
- `active`: exclui concluído/cancelado.
- `history`: inclui apenas concluído/cancelado.

**Dependências:**
- `constants.StatusCompleted`, `constants.StatusCanceled`.

**Banco de dados:**
- `COUNT` e `SELECT` em `services` com preloads.

**Autenticação/Autorização:**
- JWT e assinatura premium.

**Tratamento de erros:**
- `500`.

**Efeitos colaterais:**
- Signed URLs.

**Observações:**
- O nome do handler é legado; vale para cliente e diarista.

---

### 📌 Rota: [GET] /api/services/pending-schedules/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetPendingSchedules`

**Descrição:**
Retorna datas de serviços não cancelados/concluídos de uma diarista específica.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Faz `Pluck("scheduled_at")` filtrando `diarist_id`.
3. Exclui `cancelado` e `concluído`.
4. Retorna `pending_schedules`.

**Validações:**
- JWT e assinatura premium.

**Regras de negócio:**
- Considera qualquer outro status como pendente.

**Dependências:**
- `constants.StatusCompleted`.

**Banco de dados:**
- `SELECT scheduled_at FROM services ...`.

**Autenticação/Autorização:**
- JWT e assinatura premium.

**Tratamento de erros:**
- `500`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Não valida relação do solicitante com a diarista consultada.

---

### 📌 Rota: [PUT] /api/services/:id/:action

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.UpdateService`

**Descrição:**
Executa transições de estado (`accept`, `start`, `complete`, `cancel`) de serviços.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Chama `updateServiceActionTx`.
3. O fluxo bloqueia o serviço, valida participação e papel.
4. Faz a transição permitida.
5. Recarrega serviço, resolve fotos, publica `service.updated`.
6. Retorna DTO.

**Validações:**
- Usuário deve ser cliente ou diarista do serviço.
- Regras de estado dependem da ação.

**Regras de negócio:**
- `complete` grava `CompletedAt`.
- `cancel` é idempotente.
- `start` sem PIN praticamente não altera estado real.

**Dependências:**
- `updateServiceActionTx`.

**Banco de dados:**
- `SELECT ... FOR UPDATE` e `UPDATE` em `services`.

**Autenticação/Autorização:**
- JWT, assinatura premium, participação e papel.

**Tratamento de erros:**
- `404`, `403`, `409`, `500`.

**Efeitos colaterais:**
- Evento realtime.

**Observações:**
- A ação `start` parece legado ou fluxo incompleto.

---

### 📌 Rota: [POST] /api/services/:id/start-with-pin

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.StartServiceWithPIN`

**Descrição:**
Inicia a jornada do serviço validando um PIN derivado do telefone da cliente.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Decodifica `{pin}` e valida 4 dígitos.
3. Chama `startServiceWithPINTx`.
4. O fluxo exige papel `diarista`, carrega telefone da cliente e compara os 4 últimos dígitos.
5. Atualiza status para `em jornada`.
6. Recarrega serviço, resolve fotos, publica evento e retorna DTO.

**Validações:**
- PIN exatamente com 4 dígitos.
- Serviço aceito/legado válido.
- Diarista do serviço deve ser a autenticada.

**Regras de negócio:**
- O PIN oficial é o final do telefone da cliente.
- Se já estiver `em jornada`, a operação é idempotente.

**Dependências:**
- `startServiceWithPINTx`.

**Banco de dados:**
- `SELECT ... FOR UPDATE` em `services`.
- `SELECT id, phone FROM users`.
- `UPDATE services`.

**Autenticação/Autorização:**
- JWT, assinatura premium, apenas diarista.

**Tratamento de erros:**
- `400`, `401`, `403`, `404`, `409`, `500`.

**Efeitos colaterais:**
- Evento realtime.

**Observações:**
- O PIN fica previsível e exposto à cliente via DTO.

---

### 📌 Rota: [DELETE] /api/services/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.DeleteService`

**Descrição:**
Exclui um serviço, mas apenas se o solicitante for a cliente.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Busca serviço no escopo.
3. Garante `ClientID == userID`.
4. Executa `Delete`.
5. Retorna `204`.

**Validações:**
- JWT.
- Assinatura premium.
- Participação no serviço.
- Usuário precisa ser a cliente.

**Regras de negócio:**
- Diarista não pode excluir o agendamento.

**Dependências:**
- `findScopedService`.

**Banco de dados:**
- `SELECT` e `DELETE` em `services`.

**Autenticação/Autorização:**
- JWT, assinatura premium, apenas cliente.

**Tratamento de erros:**
- `404`, `403`; sem checagem do erro de `Delete`.

**Efeitos colaterais:**
- Exclusão física do serviço.

**Observações:**
- Não publica evento realtime de remoção.

---

### 📌 Rota: [POST] /api/payments

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CreatePayment`

**Descrição:**
Cria registro local de pagamento vinculado a um serviço.

**Fluxo de execução:**
1. Autentica e decodifica `PaymentCreateRequestDTO`.
2. Valida `service_id`, `amount` e `method`.
3. Carrega serviço acessível.
4. Garante que o usuário seja a cliente.
5. Monta `models.Payment` com status `pendente`.
6. Se `amount == 0`, usa `service.TotalPrice`.
7. Insere e retorna DTO.

**Validações:**
- JWT.
- `service_id` obrigatório.
- `amount >= 0`.
- `method` até 20 chars.

**Regras de negócio:**
- Só a cliente cria pagamento.
- Há um pagamento por serviço pela constraint `unique`.

**Dependências:**
- `findScopedService`.

**Banco de dados:**
- `SELECT` em `services`.
- `INSERT` em `payments`.

**Autenticação/Autorização:**
- JWT; apenas cliente do serviço.

**Tratamento de erros:**
- `400`, `403`, `404`, `500`.

**Efeitos colaterais:**
- Nenhum externo.

**Observações:**
- Não integra pagamento real; é persistência local.

---

### 📌 Rota: [GET] /api/payments

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetPayments`

**Descrição:**
Lista pagamentos em que o usuário participa como cliente ou diarista.

**Fluxo de execução:**
1. Autentica.
2. Consulta por `client_id` ou `diarist_id`.
3. Mapeia para DTO e retorna array.

**Validações:**
- JWT.

**Regras de negócio:**
- Escopo por participação.

**Dependências:**
- `toPaymentResponseDTO`.

**Banco de dados:**
- `SELECT * FROM payments WHERE client_id = ? OR diarist_id = ?`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- Não trata erro do `Find`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Sem paginação.

---

### 📌 Rota: [GET] /api/payments/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetPayment`

**Descrição:**
Retorna um pagamento específico acessível ao usuário autenticado.

**Fluxo de execução:**
1. Autentica.
2. Busca pagamento por `findScopedPayment`.
3. Retorna DTO.

**Validações:**
- JWT.
- Escopo por participação.

**Regras de negócio:**
- Apenas cliente ou diarista relacionados podem consultar.

**Dependências:**
- `findScopedPayment`.

**Banco de dados:**
- `SELECT * FROM payments WHERE (client_id = ? OR diarist_id = ?) AND id = ?`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `404`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Retorno enxuto; não inclui dados do serviço.

---

### 📌 Rota: [PUT] /api/payments/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.UpdatePayment`

**Descrição:**
Atualiza valor e método do pagamento, mas apenas pela cliente.

**Fluxo de execução:**
1. Autentica e busca pagamento.
2. Garante `ClientID == userID`.
3. Decodifica payload estrito, valida e salva.
4. Retorna DTO.

**Validações:**
- `amount >= 0`.
- `method` até 20 chars.

**Regras de negócio:**
- Diarista só lê; não altera.

**Dependências:**
- `findScopedPayment`.

**Banco de dados:**
- `SELECT` e `UPDATE` em `payments`.

**Autenticação/Autorização:**
- JWT; apenas cliente.

**Tratamento de erros:**
- `404`, `403`, `400`, `500`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Não há trilha de auditoria.

---

### 📌 Rota: [DELETE] /api/payments/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.DeletePayment`

**Descrição:**
Exclui um pagamento local, apenas pela cliente.

**Fluxo de execução:**
1. Autentica e busca pagamento.
2. Garante que o usuário seja a cliente.
3. Executa `Delete`.
4. Retorna `204`.

**Validações:**
- JWT e escopo por participação.

**Regras de negócio:**
- Diarista não pode remover.

**Dependências:**
- `findScopedPayment`.

**Banco de dados:**
- `SELECT` e `DELETE` em `payments`.

**Autenticação/Autorização:**
- JWT; apenas cliente.

**Tratamento de erros:**
- `404`, `403`; sem checagem do erro do `Delete`.

**Efeitos colaterais:**
- Exclusão do histórico local.

**Observações:**
- Apaga o único rastro local do pagamento.

---

### 📌 Rota: [POST] /api/reviews

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CreateReview`

**Descrição:**
Cria a avaliação inicial da cliente ou complementa a mesma review com a resposta da diarista.

**Fluxo de execução:**
1. Autentica e decodifica `ReviewWriteRequestDTO`.
2. Valida `service_id`, comentários e notas.
3. Carrega o serviço no escopo.
4. Procura review existente por `service_id`.
5. Se não existir, exige cliente e cria.
6. Se existir, exige diarista e complementa.
7. Retorna DTO.

**Validações:**
- `service_id` obrigatório.
- Comentários até 1000 chars.
- Notas entre 1 e 5.

**Regras de negócio:**
- Uma review por serviço.
- Cliente cria; diarista complementa.

**Dependências:**
- `findScopedService`.
- `validateRating`.

**Banco de dados:**
- `SELECT` em `services`.
- `SELECT/INSERT/UPDATE` em `reviews`.

**Autenticação/Autorização:**
- JWT e participação no serviço.

**Tratamento de erros:**
- `400`, `403`, `404`, `500`.

**Efeitos colaterais:**
- Nenhum externo.

**Observações:**
- Não exige serviço concluído para avaliação.

---

### 📌 Rota: [GET] /reviews

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetReviews`

**Descrição:**
Lista todas as reviews do sistema, sem autenticação.

**Fluxo de execução:**
1. Faz `Find(&reviews)`.
2. Mapeia para DTO.
3. Retorna array.

**Validações:**
- Nenhuma.

**Regras de negócio:**
- Nenhuma filtragem por usuário ou visibilidade.

**Dependências:**
- GORM direto.

**Banco de dados:**
- `SELECT * FROM reviews`.

**Autenticação/Autorização:**
- Nenhuma.

**Tratamento de erros:**
- Não trata erro do `Find`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- É a única rota de review fora do grupo autenticado `/api`.

---

### 📌 Rota: [GET] /api/reviews/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetReview`

**Descrição:**
Retorna uma review específica acessível ao usuário participante.

**Fluxo de execução:**
1. Autentica.
2. Busca review por `findScopedReview`.
3. Retorna DTO.

**Validações:**
- JWT.
- Participação como cliente ou diarista.

**Regras de negócio:**
- Terceiros não acessam a review.

**Dependências:**
- `findScopedReview`.

**Banco de dados:**
- `SELECT` em `reviews` com filtro de escopo.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `404`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Retorno não inclui dados do serviço.

---

### 📌 Rota: [PUT] /api/reviews/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.UpdateReview`

**Descrição:**
Permite que cliente ou diarista atualizem apenas sua metade da review.

**Fluxo de execução:**
1. Autentica e busca review.
2. Decodifica payload estrito e revalida.
3. Se cliente, altera campos da cliente.
4. Se diarista, altera campos da diarista.
5. Faz `Save` e retorna DTO.

**Validações:**
- Comentários até 1000 chars.
- Notas entre 1 e 5.

**Regras de negócio:**
- Cada lado altera apenas seus próprios campos.

**Dependências:**
- `findScopedReview`.

**Banco de dados:**
- `SELECT` e `UPDATE` em `reviews`.

**Autenticação/Autorização:**
- JWT; participante da review.

**Tratamento de erros:**
- `404`, `400`, `403`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Não há bloqueio temporal ou por estado do serviço.

---

### 📌 Rota: [DELETE] /api/reviews/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.DeleteReview`

**Descrição:**
Exclui uma review acessível ao usuário participante.

**Fluxo de execução:**
1. Autentica e busca review.
2. Executa `Delete`.
3. Retorna mensagem JSON.

**Validações:**
- JWT.
- Participação na review.

**Regras de negócio:**
- Qualquer participante pode apagar.

**Dependências:**
- `findScopedReview`.

**Banco de dados:**
- `SELECT` e `DELETE` em `reviews`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `404`.

**Efeitos colaterais:**
- Remoção do histórico da avaliação.

**Observações:**
- Permissão ampla demais.

---

### 📌 Rota: [GET] /api/weightedRating/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetWeightedRating`

**Descrição:**
Calcula uma nota ponderada bayesiana para um usuário com base em reviews.

**Fluxo de execução:**
1. Faz `SELECT EXISTS` para descobrir se o usuário tem reviews como diarista.
2. Conta reviews e soma ratings com `CASE`.
3. Se não houver reviews, retorna média global `3.5`.
4. Senão aplica fórmula ponderada com `minReviews = 5`.
5. Retorna rating.

**Validações:**
- JWT do grupo `/api`.

**Regras de negócio:**
- Para diarista usa `client_rating`; para cliente usa `diarist_rating`.

**Dependências:**
- SQL bruto em GORM.
- `math.Round`.

**Banco de dados:**
- `SELECT EXISTS`, `COUNT`, `SUM` em `reviews`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `500`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- A chave do JSON muda de `weighted_rating` para `rating`; resposta inconsistente.

---

### 📌 Rota: [GET] /api/diarist-reviews/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetDiaristReviews`

**Descrição:**
Lista reviews de uma diarista ordenadas da mais recente para a mais antiga.

**Fluxo de execução:**
1. Filtra `reviews` por `diarist_id`.
2. Ordena por `created_at DESC`.
3. Mapeia para DTO.
4. Retorna array.

**Validações:**
- JWT do grupo `/api`.

**Regras de negócio:**
- Retorna apenas reviews ligadas à diarista solicitada.

**Dependências:**
- GORM direto.

**Banco de dados:**
- `SELECT * FROM reviews WHERE diarist_id = ? ORDER BY created_at DESC`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `500`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Não pagina.

---

### 📌 Rota: [POST] /api/subscriptions

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CreateSubscription` delegando para `handlers.CreateCheckoutSession`

**Descrição:**
Cria checkout session Stripe para assinatura recorrente e registra assinatura pendente localmente.

**Fluxo de execução:**
1. Autentica e valida `plan`.
2. Configura Stripe, carrega usuário e bloqueia se já houver assinatura válida.
3. Reutiliza/cria customer Stripe.
4. Cria `CheckoutSession` do tipo `subscription`.
5. Faz upsert de registro local pendente em `subscriptions`.
6. Retorna `session_id`.

**Validações:**
- JWT.
- `plan` em `monthly|quarterly|yearly`.
- Stripe configurado.

**Regras de negócio:**
- Plano válido vira storage plan `premium`.
- Usuário com assinatura válida não abre novo checkout.

**Dependências:**
- Stripe SDK.
- `createOrUpdatePendingSubscription`.

**Banco de dados:**
- `SELECT` em `users` e `subscriptions`.
- `INSERT/UPDATE` em `subscriptions`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `400`, `409`, `502`, `500`.

**Efeitos colaterais:**
- Criação de customer/session no Stripe e logs.

**Observações:**
- `URL` é retornada vazia no DTO.

---

### 📌 Rota: [POST] /api/subscriptions/checkout-session

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CreateCheckoutSession`

**Descrição:**
Mesmo fluxo de criação de checkout session descrito acima; é a rota mais explícita para o frontend.

**Fluxo de execução:**
1. Executa o fluxo completo de `CreateCheckoutSession`.

**Validações:**
- Mesmas de `/api/subscriptions`.

**Regras de negócio:**
- Mesmas de `/api/subscriptions`.

**Dependências:**
- `handlers.CreateCheckoutSession`.

**Banco de dados:**
- Mesmas operações em `subscriptions`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- Igual ao endpoint anterior.

**Efeitos colaterais:**
- Criação de customer/session no Stripe.

**Observações:**
- Duplica responsabilidade de `/api/subscriptions`.

---

### 📌 Rota: [GET] /api/subscriptions

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetSubscriptions`

**Descrição:**
Lista registros de assinatura do usuário autenticado.

**Fluxo de execução:**
1. Autentica.
2. Busca `subscriptions` por `user_id`.
3. Mapeia para DTO e retorna array.

**Validações:**
- JWT.

**Regras de negócio:**
- Escopo apenas do próprio usuário.

**Dependências:**
- `toSubscriptionResponseDTO`.

**Banco de dados:**
- `SELECT * FROM subscriptions WHERE user_id = ?`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- Não trata erro do `Find`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Como `user_id` é único, tende a retornar 0 ou 1 item.

---

### 📌 Rota: [GET] /api/subscriptions/current

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetCurrentSubscription`

**Descrição:**
Retorna a assinatura atual do usuário autenticado.

**Fluxo de execução:**
1. Autentica.
2. Busca assinatura atual por `user_id`.
3. Retorna DTO.

**Validações:**
- JWT.

**Regras de negócio:**
- Expõe o registro único da assinatura do usuário.

**Dependências:**
- `GetCurrentSubscriptionForUser`.

**Banco de dados:**
- `SELECT * FROM subscriptions WHERE user_id = ? LIMIT 1`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `404`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- É o endpoint mais adequado para leitura de estado atual.

---

### 📌 Rota: [GET] /api/subscriptions/access-status

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetSubscriptionAccessStatus`

**Descrição:**
Retorna se o usuário tem acesso premium, considerando assinatura válida ou `is_test_user`.

**Fluxo de execução:**
1. Autentica.
2. Lê `is_test_user`.
3. Busca assinatura atual.
4. Combina `testUser || subscriptionStatusAllowsAccess(sub.Status)`.
5. Retorna status agregado e a assinatura, se existir.

**Validações:**
- JWT.

**Regras de negócio:**
- Usuários de teste têm acesso mesmo sem assinatura.

**Dependências:**
- `isTestUser`, `subscriptionStatusAllowsAccess`.

**Banco de dados:**
- `SELECT` em `users` e `subscriptions`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `500` ao falhar em `users`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Centraliza a regra real usada pelos middlewares premium.

---

### 📌 Rota: [POST] /api/subscriptions/cancel

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CancelCurrentSubscription`

**Descrição:**
Cancela imediatamente a assinatura atual no Stripe e persiste o cancelamento local.

**Fluxo de execução:**
1. Autentica e configura Stripe.
2. Carrega assinatura atual e exige `StripeSubscriptionID`.
3. Cancela no Stripe.
4. Atualiza status e timestamps locais.
5. Salva em `subscriptions`.
6. Retorna assinatura atualizada.

**Validações:**
- JWT.
- Stripe configurado.
- Assinatura atual provisionada no Stripe.

**Regras de negócio:**
- Cancelamento é imediato, sem esperar fim do ciclo.

**Dependências:**
- Stripe SDK `sub.Cancel`.

**Banco de dados:**
- `SELECT` e `UPDATE` em `subscriptions`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `404`, `400`, `502`, `500`.

**Efeitos colaterais:**
- Chamada externa ao Stripe e revogação do acesso premium.

**Observações:**
- Não há grace period.

---

### 📌 Rota: [GET] /api/subscriptions/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetSubscription`

**Descrição:**
Busca uma assinatura do próprio usuário por id.

**Fluxo de execução:**
1. Autentica.
2. Busca assinatura filtrando por `user_id`.
3. Retorna DTO.

**Validações:**
- JWT.
- Escopo por proprietário.

**Regras de negócio:**
- O `:id` é pouco útil porque `user_id` é único.

**Dependências:**
- `findOwnedSubscription`.

**Banco de dados:**
- `SELECT * FROM subscriptions WHERE user_id = ? AND id = ?`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `404`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Redundante com `/current`.

---

### 📌 Rota: [PUT] /api/subscriptions/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.UpdateSubscription`

**Descrição:**
Rota desabilitada; informa que atualização manual não é suportada.

**Fluxo de execução:**
1. Autentica pelo grupo `/api`.
2. Retorna `405` com mensagem fixa.

**Validações:**
- JWT.

**Regras de negócio:**
- Assinaturas só podem ser alteradas via Stripe/webhook.

**Dependências:**
- Fiber.

**Banco de dados:**
- Nenhuma operação.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- Resposta fixa `405`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- A rota poderia nem existir.

---

### 📌 Rota: [DELETE] /api/subscriptions/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CancelSubscription` delegando para `handlers.CancelCurrentSubscription`

**Descrição:**
Alias de cancelamento da assinatura atual; ignora na prática o `:id`.

**Fluxo de execução:**
1. Encaminha para `CancelCurrentSubscription`.

**Validações:**
- Mesmas de `/api/subscriptions/cancel`.

**Regras de negócio:**
- Cancela a assinatura atual do usuário, não necessariamente o `:id` informado.

**Dependências:**
- `CancelCurrentSubscription`.

**Banco de dados:**
- Mesmas operações em `subscriptions`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- Igual ao cancelamento.

**Efeitos colaterais:**
- Chamada ao Stripe.

**Observações:**
- O parâmetro `:id` é ignorado; isso é bug semântico de API.

---

### 📌 Rota: [POST] /api/offers/

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CreateOffer`

**Descrição:**
Cria uma oferta no mural para negociação/aceite por diaristas.

**Fluxo de execução:**
1. Autentica, exige assinatura premium e papel `cliente`.
2. Decodifica payload estrito e valida endereço, serviço, data, duração, valor e observações.
3. Confirma propriedade do endereço.
4. Cria `models.Offer` com status `aberta`.
5. Recarrega `Client` e `Address`, publica `offer.created` e retorna DTO.

**Validações:**
- `address_id` obrigatório e próprio.
- `service_type` obrigatório.
- `scheduled_at` futuro.
- `duration_hours > 0`.
- `initial_value >= 0`.

**Regras de negócio:**
- Oferta nasce com `current_value = initial_value`.
- Só clientes podem publicar.

**Dependências:**
- `RequireValidSubscriptionMiddleware`, `realtime.PublishOfferCreated`.

**Banco de dados:**
- `SELECT` em `addresses`.
- `INSERT` e `SELECT` em `offers`.

**Autenticação/Autorização:**
- JWT, assinatura premium, papel `cliente`.

**Tratamento de erros:**
- `400`, `403`, `404`, `500`.

**Efeitos colaterais:**
- Broadcast realtime para diaristas online.

**Observações:**
- Sem transação porque a criação é simples.

---

### 📌 Rota: [GET] /api/offers/

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetOpenOffers`

**Descrição:**
Lista ofertas abertas/em negociação para diaristas, com distância e flag de negociação pendente.

**Fluxo de execução:**
1. Autentica, exige assinatura e papel `diarista`.
2. Carrega a diarista com endereço.
3. Conta ofertas elegíveis.
4. Busca página com joins em `users`/`addresses` e subquery `EXISTS`.
5. Calcula distância via Haversine e resolve foto do cliente.
6. Retorna itens paginados.

**Validações:**
- JWT, assinatura premium, papel `diarista`.

**Regras de negócio:**
- Só entram ofertas `aberta`/`negociacao`.

**Dependências:**
- SQL manual via GORM.
- `CalculateDistance`.
- `utils.ResolveStoredPhotoURL`.

**Banco de dados:**
- `SELECT` em `users`, `offers`, `addresses`.

**Autenticação/Autorização:**
- JWT, assinatura premium, papel `diarista`.

**Tratamento de erros:**
- `403`, `500`.

**Efeitos colaterais:**
- Signed URLs.

**Observações:**
- Usa apenas o primeiro endereço geolocalizado da diarista.

---

### 📌 Rota: [GET] /api/offers/my

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetMyOffers`

**Descrição:**
Lista ofertas do cliente autenticado, incluindo negociações e status do serviço derivado.

**Fluxo de execução:**
1. Autentica, exige assinatura e papel `cliente`.
2. Monta query com preloads profundos.
3. Filtra por `status_group`.
4. Conta, pagina e busca ofertas.
5. Resolve fotos, calcula distância/rating por negociação.
6. Busca status dos serviços vinculados.
7. Retorna itens paginados.

**Validações:**
- JWT, assinatura premium, papel `cliente`.

**Regras de negócio:**
- `accepted` força `page_size = 4`.
- Default inclui `aberta`, `negociacao`, `pendente`.

**Dependências:**
- `resolveOfferPhotos`, `getDiaristWeightedRating`, `loadServiceStatusesByOfferIDs`.

**Banco de dados:**
- `COUNT/SELECT` em `offers`.
- `SELECT` em `services`.
- `COUNT/SUM` em `reviews`.

**Autenticação/Autorização:**
- JWT, assinatura premium, papel `cliente`.

**Tratamento de erros:**
- `403`, `500`.

**Efeitos colaterais:**
- Signed URLs.

**Observações:**
- Usa status `pendente`, que não existe na enum declarada de `Offer.Status`.

---

### 📌 Rota: [GET] /api/offers/:id

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetOfferByID`

**Descrição:**
Retorna detalhes de uma oferta com ACL distinta para cliente dono e diaristas elegíveis.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Carrega usuário atual.
3. `findAccessibleOfferForRead` aplica regra de visibilidade.
4. Resolve fotos.
5. Busca `service_status` em `services`.
6. Retorna DTO.

**Validações:**
- JWT e assinatura premium.

**Regras de negócio:**
- Cliente só vê a própria oferta.
- Diarista vê abertas/em negociação, aceitas por ela ou negociadas por ela.

**Dependências:**
- `loadUserByID`, `findAccessibleOfferForRead`, `loadServiceStatusByOfferID`.

**Banco de dados:**
- `SELECT` em `users`, `offers` e `services`.

**Autenticação/Autorização:**
- JWT, assinatura premium, ACL customizada por papel.

**Tratamento de erros:**
- `401`, `404`, `500`.

**Efeitos colaterais:**
- Signed URLs.

**Observações:**
- Uma das melhores ACLs do projeto.

---

### 📌 Rota: [PUT] /api/offers/:id/cancel

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CancelOffer`

**Descrição:**
Cancela uma oferta da cliente e recusa negociações pendentes.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Executa `cancelOfferTx`.
3. O fluxo exige papel `cliente`, propriedade da oferta e bloqueia a linha.
4. Impede cancelamento de oferta aceita.
5. Atualiza oferta para `cancelada` e recusa negociações pendentes.
6. Publica `offer.updated` e retorna DTO.

**Validações:**
- JWT, assinatura premium, papel `cliente`.

**Regras de negócio:**
- Cancelamento é idempotente se já cancelada.

**Dependências:**
- `cancelOfferTx`, `realtime.PublishOfferUpdated`.

**Banco de dados:**
- `SELECT ... FOR UPDATE` em `offers`.
- `UPDATE offers` e `offer_negotiations`.

**Autenticação/Autorização:**
- JWT, assinatura premium, cliente proprietário.

**Tratamento de erros:**
- `404`, `403`, `409`, `500`.

**Efeitos colaterais:**
- Broadcast realtime.

**Observações:**
- Notifica também diaristas por role.

---

### 📌 Rota: [POST] /api/offers/:id/accept

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.AcceptOffer`

**Descrição:**
Permite que uma diarista aceite uma oferta aberta e cria o serviço correspondente.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Executa `acceptOfferTx`.
3. O fluxo exige papel `diarista`, bloqueia oferta/usuário e checa conflito de agenda.
4. Atualiza oferta para `aceita`, cria `services`, recusa negociações pendentes.
5. Publica `offer.updated` e `service.updated`.
6. Retorna DTO da oferta.

**Validações:**
- JWT, assinatura premium, papel `diarista`.
- Oferta precisa estar disponível.
- Não pode haver conflito de agenda.

**Regras de negócio:**
- Apenas uma diarista vence.
- Há tratamento idempotente para aceite prévio da mesma diarista.

**Dependências:**
- `acceptOfferTx`, `hasScheduleConflict`.

**Banco de dados:**
- `SELECT ... FOR UPDATE`, `UPDATE` em `offers`.
- `INSERT` em `services`.
- `UPDATE` em `offer_negotiations`.

**Autenticação/Autorização:**
- JWT, assinatura premium, papel `diarista`.

**Tratamento de erros:**
- `404`, `409`, `403`, `500`.

**Efeitos colaterais:**
- Criação de serviço e eventos realtime.

**Observações:**
- Fluxo transacional é um dos pontos fortes do backend.

---

### 📌 Rota: [POST] /api/offers/:id/negotiate

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.SendCounterOffer`

**Descrição:**
Envia ou atualiza contraproposta de uma diarista para uma oferta.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Decodifica e valida valor, duração e mensagem.
3. Executa `sendCounterOfferTx`.
4. O fluxo exige papel `diarista`, bloqueia oferta e faz upsert da negociação pendente.
5. Se necessário, muda oferta para `negociacao`.
6. Resolve foto, publica `negotiation.created` e retorna DTO.

**Validações:**
- `counter_value > 0`, `counter_duration_hours > 0`.
- Mensagem até 1000 chars.

**Regras de negócio:**
- Valor não pode exceder 2x o valor inicial.
- Uma diarista mantém no máximo uma negociação pendente por oferta.

**Dependências:**
- `sendCounterOfferTx`, `resolveUserPhoto`.

**Banco de dados:**
- `SELECT ... FOR UPDATE` em `offers`.
- `SELECT/INSERT/UPDATE` em `offer_negotiations`.

**Autenticação/Autorização:**
- JWT, assinatura premium, papel `diarista`.

**Tratamento de erros:**
- `400`, `404`, `409`, `500`.

**Efeitos colaterais:**
- Broadcast realtime.

**Observações:**
- Sem rate limiting.

---

### 📌 Rota: [PUT] /api/offers/:id/negotiate/:negotiationId/accept

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.AcceptNegotiation`

**Descrição:**
Aceita uma contraproposta e converte a oferta em serviço aceito.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Executa `acceptNegotiationTx`.
3. O fluxo exige papel `cliente`, bloqueia oferta/negociação, checa coerência e conflito de agenda.
4. Marca negociação aceita, recusa demais, atualiza oferta e cria serviço.
5. Publica eventos de negociação e serviço.
6. Retorna DTO.

**Validações:**
- JWT, assinatura premium, papel `cliente`.

**Regras de negócio:**
- Uma contraproposta aceita derruba as outras.
- Serviço herda valor e duração negociados.

**Dependências:**
- `acceptNegotiationTx`.

**Banco de dados:**
- `SELECT ... FOR UPDATE`, `UPDATE` em `offers` e `offer_negotiations`.
- `INSERT` em `services`.

**Autenticação/Autorização:**
- JWT, assinatura premium, cliente proprietário.

**Tratamento de erros:**
- `404`, `403`, `409`, `400`, `500`.

**Efeitos colaterais:**
- Criação de serviço e eventos realtime.

**Observações:**
- Fluxo consistente com `AcceptOffer`.

---

### 📌 Rota: [PUT] /api/offers/:id/negotiate/:negotiationId/reject

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.RejectNegotiation`

**Descrição:**
Recusa uma contraproposta de diarista.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Executa `rejectNegotiationTx`.
3. O fluxo exige papel `cliente`, valida coerência oferta/negociação e marca status `recusada`.
4. Publica `negotiation.updated`.
5. Retorna DTO.

**Validações:**
- JWT, assinatura premium, papel `cliente`.

**Regras de negócio:**
- Contraproposta aceita não pode ser recusada.

**Dependências:**
- `rejectNegotiationTx`.

**Banco de dados:**
- `SELECT ... FOR UPDATE` e `UPDATE` em `offer_negotiations`.

**Autenticação/Autorização:**
- JWT, assinatura premium, cliente proprietário.

**Tratamento de erros:**
- `404`, `403`, `409`, `500`.

**Efeitos colaterais:**
- Evento realtime.

**Observações:**
- A oferta permanece em `negociacao`.

---

### 📌 Rota: [GET] /api/negotiations/my

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetDiaristNegotiations`

**Descrição:**
Lista contrapropostas pendentes da diarista autenticada com dados da cliente e distância.

**Fluxo de execução:**
1. Autentica, exige assinatura e papel `diarista`.
2. Conta negociações pendentes com joins em `offers`, `users`, `addresses`.
3. Busca página projetada.
4. Calcula distância, resolve fotos e retorna itens paginados.

**Validações:**
- JWT, assinatura premium, papel `diarista`.

**Regras de negócio:**
- Só negociações `pendente`.

**Dependências:**
- SQL manual, `CalculateDistance`, `utils.ResolveStoredPhotoURL`.

**Banco de dados:**
- `COUNT/SELECT` em `offer_negotiations` com joins.

**Autenticação/Autorização:**
- JWT, assinatura premium, papel `diarista`.

**Tratamento de erros:**
- `403`, `500`.

**Efeitos colaterais:**
- Signed URLs.

**Observações:**
- Útil como inbox da diarista.

---

### 📌 Rota: [GET] /api/realtime/online-users

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.GetOnlineUsers`

**Descrição:**
Retorna IDs de usuários online no hub de ofertas para um papel específico.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Exige query `role`.
3. Consulta `OfferHub.OnlineUserIDsByRole(role)`.
4. Retorna `{ role, user_ids }`.

**Validações:**
- JWT, assinatura premium.
- `role` obrigatório.

**Regras de negócio:**
- Online é derivado das conexões WebSocket ativas.

**Dependências:**
- `realtime.OfferHub`.

**Banco de dados:**
- Nenhuma operação.

**Autenticação/Autorização:**
- JWT, assinatura premium.

**Tratamento de erros:**
- `400`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Exposição de IDs online pode ter implicação de privacidade.

---

### 📌 Rota: [GET] /api/messages/

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.ChatMessagesHandler`

**Descrição:**
Lista mensagens do chat de um serviço com paginação.

**Fluxo de execução:**
1. Garante runtime do chat.
2. Autentica, valida assinatura e lê `service_id`.
3. Cria contexto com timeout.
4. `MessageService.GetMessages` valida acesso ao serviço, busca mensagens e inverte para ordem cronológica.
5. Retorna `items` e `pagination`.

**Validações:**
- JWT, assinatura premium, `service_id` obrigatório.

**Regras de negócio:**
- Chat não existe para serviços cancelados/concluídos.

**Dependências:**
- `MessageService`, `ServiceAccessService`.

**Banco de dados:**
- `SELECT` em `services`.
- `COUNT/SELECT` em `chat_messages`.

**Autenticação/Autorização:**
- JWT, assinatura premium, participação no serviço.

**Tratamento de erros:**
- `400`, `404`, `409`, `500`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Leitura não marca mensagens como lidas.

---

### 📌 Rota: [GET] /api/locations/

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.ChatLocationsHandler`

**Descrição:**
Lista a última localização conhecida por usuário para um serviço.

**Fluxo de execução:**
1. Garante runtime do chat.
2. Autentica, valida assinatura e lê `service_id`.
3. `LocationService.ListLocations` valida acesso ao serviço.
4. Busca `chat_locations` por serviço e retorna `items`.

**Validações:**
- JWT, assinatura premium, `service_id` obrigatório.

**Regras de negócio:**
- Há uma localização por usuário/serviço, atualizada por upsert.

**Dependências:**
- `LocationService`, `LocationRepository`.

**Banco de dados:**
- `SELECT` em `services`.
- `SELECT` em `chat_locations`.

**Autenticação/Autorização:**
- JWT, assinatura premium, participação no serviço.

**Tratamento de erros:**
- `400`, `404`, `409`, `500`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Atualização de localização ocorre apenas no WebSocket.

---

### 📌 Rota: [POST] /api/userprofile

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.CreateUserProfile`

**Descrição:**
Cria ou atualiza o perfil de preferências do cliente autenticado.

**Fluxo de execução:**
1. Autentica.
2. Decodifica DTO e valida enums.
3. Faz upsert por `user_id`.
4. Retorna DTO.

**Validações:**
- `residence_type` e `desired_frequency` válidos.

**Regras de negócio:**
- Age como upsert.

**Dependências:**
- `buildUserProfileFromDTO`.

**Banco de dados:**
- `SELECT/INSERT/UPDATE` em `user_profiles`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `400`, `500`.

**Efeitos colaterais:**
- Nenhum.

**Observações:**
- Não verifica se o usuário é cliente.

---

### 📌 Rota: [POST] /api/upload-photo

**Arquivo:** src/routes/routes.go  
**Handler:** `controllers.UploadPhotoHandler`

**Descrição:**
Faz upload da foto do usuário autenticado para Supabase Storage e persiste o caminho em `users.photo`.

**Fluxo de execução:**
1. Lê arquivo multipart `photo`.
2. Valida tipo imagem, tamanho máximo e extensão.
3. Gera caminho estável `users/<id>/profile.<ext>`.
4. Faz upload para Supabase.
5. Resolve signed URL.
6. Atualiza `users.photo`.
7. Retorna `url` e `path`.

**Validações:**
- Apenas imagens.
- Máximo de 10 MB.
- Extensão suportada.

**Regras de negócio:**
- Sempre sobrescreve a foto anterior do mesmo usuário.

**Dependências:**
- `utils.UploadFileToSupabase`, `ResolveStoredPhotoURL`.

**Banco de dados:**
- `UPDATE users SET photo = ?`.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `400` e `500`.

**Efeitos colaterais:**
- Upload externo para Supabase.

**Observações:**
- Usa cast direto de `Locals`; sem middleware pode panic.

---

### 📌 Rota: [POST] /api/upload-document

**Arquivo:** src/routes/routes.go  
**Handler:** `handlers.UploadDocuments`

**Descrição:**
Recebe documentos multipart e envia tudo por email para um destinatário configurado.

**Fluxo de execução:**
1. Define campos esperados.
2. Lê credenciais SMTP e dados do usuário de `Locals`.
3. Monta email texto.
4. Tenta anexar cada arquivo disponível.
5. Se nenhum anexar, responde `400`.
6. Envia via SMTP KingHost.
7. Retorna quantidade de anexos e erros parciais.

**Validações:**
- Pelo menos um arquivo precisa ser anexado com sucesso.
- Não há validação de tipo/tamanho.

**Regras de negócio:**
- Campos ausentes geram erro parcial, não abortam.

**Dependências:**
- `gomail.v2`, SMTP `smtp.kinghost.net`.

**Banco de dados:**
- Nenhuma operação.

**Autenticação/Autorização:**
- JWT.

**Tratamento de erros:**
- `400`, `500`.

**Efeitos colaterais:**
- Envio de email com anexos sensíveis.

**Observações:**
- Alto risco de segurança e compliance.

---

### 📌 Rota: [GET] /api/diarists-nearby

**Arquivo:** src/routes/routes.go  
**Handler:** função anônima chamando `handlers.GetNearbyDiarists`

**Descrição:**
Lista diaristas próximas a partir de latitude/longitude informadas.

**Fluxo de execução:**
1. Autentica e valida assinatura.
2. Lê e converte `latitude`/`longitude`.
3. Busca todos os usuários diaristas com endereço e perfil.
4. Resolve foto, calcula distância com `haversine`.
5. Para cada diarista, calcula rating ponderado por queries em `reviews`.
6. Retorna array.

**Validações:**
- Coordenadas válidas.

**Regras de negócio:**
- Considera apenas o primeiro endereço da diarista.
- Se não houver reviews, rating fica `0`.

**Dependências:**
- `github.com/umahmood/haversine`, `utils.ResolveStoredPhotoURL`.

**Banco de dados:**
- `SELECT` em `users`.
- N+1 queries em `reviews`.

**Autenticação/Autorização:**
- JWT e assinatura premium.

**Tratamento de erros:**
- `400`, `500`.

**Efeitos colaterais:**
- Signed URLs.

**Observações:**
- Não filtra disponibilidade nem raio máximo.

## Resumo geral da arquitetura do backend

- O backend usa Fiber com registrador central em `src/routes/routes.go`, mas convive com arquivos de rotas legados não utilizados.
- A maior parte dos handlers acessa GORM diretamente; só o módulo de chat segue camadas claras `handler -> service -> repository`.
- Regras críticas de ofertas e serviços foram extraídas para `src/handlers/transactional_flows.go`, com transações e `SELECT ... FOR UPDATE`.
- Autenticação usa JWT HS256 via Bearer token ou cookie `auth_token`.
- Controle de acesso premium depende de `subscriptions.status` ou `users.is_test_user`.
- Há dois subsistemas realtime: `src/realtime/*` para mural/presença e `src/chat/*` para chat/mensagens/localização.
- Upload de foto usa Supabase Storage; assinaturas usam Stripe com sincronização local relativamente robusta.

## Lista de problemas encontrados

- Código de rotas duplicado/legado em vários arquivos não usados.
- `LoginHandler` usa `jwtSecret` global potencialmente inicializado antes do `.env`.
- `UpdateUser` permite alterar `is_test_user`.
- Vários handlers fazem cast direto de `Locals(...).(uint|string)` sem proteção contra panic.
- Diversos handlers ignoram erro de `Find`, `Save` ou `Delete`.
- `CreateAddress` e `UpdateAddress` não usam transação.
- `DELETE /api/subscriptions/:id` ignora o `:id`.
- `GET /api/users` e `GET /api/users/:id` têm semântica confusa.
- `GET /api/offers/my` usa status `pendente`, não declarado na model.
- `UpdateService` com ação `start` parece fluxo legado/incompleto.
- `GetNearbyDiarists` faz N+1 queries e não filtra disponibilidade.
- Upload de documentos por email é frágil em segurança/compliance.
- `GET /reviews` é público enquanto o restante exige autenticação.

## Sugestões de melhoria (nível sênior)

- Consolidar rotas e remover arquivos legados.
- Extrair camadas service/repository para usuários, ofertas, pagamentos e reviews.
- Corrigir urgentemente a possibilidade de promoção a `is_test_user`.
- Padronizar validação com `decodeStrictJSON` em todos os endpoints públicos.
- Aplicar transações a operações multi-step de endereço e outros fluxos com múltiplas escritas.
- Revisar os contratos de assinatura para eliminar aliases redundantes e parâmetros ignorados.
- Unificar enums/status em constantes compartilhadas e validar coerência entre model, banco e handlers.
- Reforçar observabilidade com logs estruturados consistentes, métricas e tracing.
- Tratar documentos sensíveis com storage seguro, scanning e trilha de auditoria.
- Expandir testes de integração de rotas críticas.

## Avaliação geral do backend

- **Nota:** 6.5/10
- **Justificativa:** o backend cobre bastante domínio real e tem pontos maduros, sobretudo em assinatura Stripe, transações de ofertas/serviços e no módulo de chat. Ao mesmo tempo, ainda sofre com inconsistências de contrato, rotas duplicadas, validações heterogêneas, mistura de camadas, permissões perigosas e lacunas de segurança/robustez operacional. É um sistema funcional, mas pedindo uma rodada forte de consolidação arquitetural.
