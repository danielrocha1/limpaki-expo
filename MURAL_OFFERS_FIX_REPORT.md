# Relatório de Correções - Mural de Ofertas

Este documento resume as correções e melhorias realizadas no Mural de Ofertas (Frontend e Backend) para garantir seu funcionamento correto.

## 1. Backend (Go)

### Arquivo: `go/src/handlers/offer_handler.go`
- **Validação de Endereço**: Adicionada verificação obrigatória do `AddressID` ao criar uma oferta. Isso evita que ofertas sejam criadas sem um local de serviço vinculado.
- **Cálculo de Distância**: Removido o comentário de "TODO" e ajustado para refletir que a distância pode ser tratada de forma dinâmica ou via frontend, mantendo a estrutura Limpaê.

### Arquivo: `go/src/config/middleware.go`
- **Contexto de Usuário**: Validado que o `user_id` e `email` estão sendo corretamente extraídos do token JWT e injetados no contexto do Fiber como `uint` e `string`, respectivamente.

## 2. Frontend (React)

### Arquivo: `src/offers/index.js`
- **Integração com Endereço Selecionado**: O componente agora utiliza o `selectedAddress` do `AddressContext`. Ao criar uma oferta, o `address_id` é automaticamente enviado com base no endereço que o cliente selecionou no cabeçalho.
- **URL da API**: Corrigida a `API_URL` padrão para apontar para o ambiente de produção (`https://limpae.onrender.com/api`), garantindo consistência com as outras partes do sistema.
- **Exibição de Dados**:
  - No card da diarista, agora são exibidos o bairro e a cidade do serviço (`Local`).
  - No card do cliente, o endereço completo é exibido para conferência.
  - Na lista de negociações da diarista, o endereço do serviço também foi adicionado.
- **Mapeamento de Campos**: Ajustado para suportar tanto nomes de campos em minúsculo (JSON da API) quanto em maiúsculo (GORM), como `street`/`Street`, `number`/`Number`, etc.

### Arquivo: `src/header/index.js`
- **Seletor de Endereço**: Corrigido o mapeamento de campos no menu de endereços e no botão de seleção para suportar a variação de casing (`street` vs `Street`).

## 3. Próximos Passos Recomendados
- **Notificações**: Implementar o envio de e-mails ou notificações push quando uma nova contraproposta for recebida ou uma oferta for aceita.
- **Cálculo de Distância Real**: Integrar com a API do Google Maps ou similar para calcular a distância real em quilômetros entre a diarista e o cliente no mural.
- **Filtros**: Adicionar filtros por tipo de serviço e faixa de preço no mural da diarista.
