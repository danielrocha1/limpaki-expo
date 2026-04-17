# Arquitetura do Mural de Ofertas - LimpaE

Este documento descreve a implementação do Mural de Ofertas, um marketplace de serviços de limpeza onde clientes publicam ofertas e diaristas podem aceitar ou negociar valores.

## 1. Modelo de Dados (Backend - Go)

### Novo Modelo: `Offer`
Representa uma oferta publicada no mural.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | `uint` | Chave primária |
| `ClientID` | `uint` | ID do cliente que criou a oferta |
| `AddressID` | `uint` | ID do endereço do serviço |
| `ServiceType` | `string` | Tipo de limpeza (Padrão, Pesada, etc) |
| `ScheduledAt` | `time.Time` | Data e hora do serviço |
| `DurationHours`| `float64` | Quantidade de horas estimadas |
| `InitialValue` | `float64` | Valor inicial proposto pelo cliente |
| `CurrentValue` | `float64` | Valor atual (após negociações) |
| `Status` | `string` | `aberta`, `negociacao`, `aceita`, `cancelada` |
| `Observations` | `string` | Detalhes adicionais |

### Novo Modelo: `OfferNegotiation`
Representa o histórico de contrapropostas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | `uint` | Chave primária |
| `OfferID` | `uint` | ID da oferta vinculada |
| `DiaristID` | `uint` | ID da diarista que fez a contraproposta |
| `CounterValue` | `float64` | Valor proposto pela diarista |
| `Status` | `string` | `pendente`, `aceita`, `recusada` |
| `Message` | `string` | Mensagem opcional da diarista |

## 2. Endpoints da API

### Ofertas (`/api/offers`)
- `POST /api/offers`: Criar nova oferta (Cliente)
- `GET /api/offers`: Listar ofertas abertas (Diarista)
- `GET /api/offers/my`: Listar minhas ofertas (Cliente/Diarista)
- `GET /api/offers/:id`: Detalhes de uma oferta
- `PUT /api/offers/:id/cancel`: Cancelar oferta (Cliente)

### Negociações (`/api/offers/:id/negotiate`)
- `POST /api/offers/:id/negotiate`: Enviar contraproposta (Diarista)
- `POST /api/offers/:id/accept`: Aceitar oferta original (Diarista)
- `PUT /api/offers/:id/negotiate/:negId/accept`: Aceitar contraproposta (Cliente)
- `PUT /api/offers/:id/negotiate/:negId/reject`: Recusar contraproposta (Cliente)

## 3. Fluxo de Frontend (React)

### Para Clientes:
1. **Criação**: Formulário para definir data, hora, duração e valor.
2. **Gestão**: Visualizar ofertas ativas e notificações de contrapropostas.
3. **Decisão**: Aceitar ou recusar lances de diaristas.

### Para Diaristas:
1. **Mural**: Lista de ofertas disponíveis com filtros por região/valor.
2. **Ação**: Botão "Aceitar" (valor original) ou "Fazer Contraproposta".
3. **Acompanhamento**: Status das negociações enviadas.

## 4. Integração com Serviços Existentes
Quando uma oferta é **aceita** (seja o valor original ou contraproposta), o sistema deve:
1. Criar um registro na tabela `services` com status `pendente`.
2. Vincular o `DiaristID` e o `FinalValue`.
3. Marcar a `Offer` como `aceita`.
