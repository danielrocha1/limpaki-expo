# Mobile System Design

## Objetivo
Organizar a camada mobile por responsabilidade para facilitar manutencao, onboard e evolucao de features sem acoplamento excessivo.

## Estrutura
```text
src/mobile
|-- app/
|   `-- MobileApp.js                # Entry point mobile, sessao e bootstrap
|-- layout/
|   `-- AppHeader.js                # Header global
|-- shell/
|   `-- AppShell.js                 # Navegacao principal e telas autenticadas
|-- features/
|   |-- auth/
|   |   `-- RegisterFlow.js         # Fluxo de cadastro
|   `-- map/
|       |-- MapConfirmModal.js      # Entry cross-platform
|       |-- MapConfirmModal.native.js
|       `-- MapConfirmModal.web.js
|-- App.js                          # Wrapper de compatibilidade
|-- AppHeader.js                    # Wrapper de compatibilidade
|-- AppShell.js                     # Wrapper de compatibilidade
|-- RegisterFlow.js                 # Wrapper de compatibilidade
|-- MapConfirmModal*.js             # Wrappers de compatibilidade
```

## Camadas e responsabilidades
1. `app`: orquestracao do ciclo de vida (safe areas, sessao, auth mode).
2. `layout`: componentes globais de layout compartilhado.
3. `shell`: estrutura de navegacao e composicao das telas de dominio.
4. `features`: regras e UI por contexto funcional (auth, map, etc).

## Fluxo arquitetural
1. `MobileApp` restaura token e monta contexto de sessao.
2. `AppHeader` renderiza estado de sessao e acoes globais.
3. `AppShell` escolhe rota e monta tela corrente.
4. Features encapsulam chamadas de API e estados locais.

## Regras de organizacao
1. Cada nova feature deve nascer dentro de `features/<dominio>`.
2. Evitar imports cruzados entre features; compartilhar via `layout` ou `shared` (quando criado).
3. Manter wrappers na raiz enquanto houver referencias legadas.
4. Qualquer componente global de chrome (header, bottom nav, banners de sessao) fica em `layout` ou `shell`.

## Proxima fase recomendada
1. Extrair componentes grandes de `AppShell` por rota (`screens/map`, `screens/offers`, `screens/services`).
2. Introduzir `mobile/shared/` para tema, helpers e componentes reutilizaveis.
3. Centralizar tipos/contratos de API por feature para reduzir regressao.

