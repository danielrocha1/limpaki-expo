# Análise do Header Mobile - Limpae

## Problema Identificado

O header está configurado como `position: fixed` com `z-index: 1000`, mas as páginas não possuem padding-top adequado para compensar a altura do header fixo, causando sobreposição de conteúdo.

## Altura do Header

- **Desktop**: Altura padrão com padding de 8px-16px (variável)
- **Mobile (max-width: 768px)**: 56px (definido explicitamente no CSS)
- **Mobile (max-width: 480px)**: Mantém 56px

## Páginas Identificadas

### Páginas Principais (Componentes de Rota)
1. **HomePage** (`App.js`) - Possui `margin-top: 56px` ✓
2. **Dashboard** (`dashboard/dashboard.js`)
3. **Login** (`forms/login.js`)
4. **Register** (`forms/register.js`)
5. **RegisterClient** (`forms/RegisterClient.js`)
6. **RegisterDiarist** (`forms/RegisterDiarist.js`)
7. **AddressForm** (`forms/addressform.js`)
8. **PlanSelection** (`forms/PlanSelection.js`)
9. **DiaristMap** (`diaristmap/index.js`)
10. **Offers** (`offers/index.js`)
11. **Services** (`services/index.js`)
12. **ServiceReview** (`services/review/index.js`)
13. **Profile** (`profile/index.js`)
14. **Order** (`order/index.js`)
15. **UploadDocuments** (`uploadDocumentos/index.js`)

## Solução Proposta

Adicionar padding-top ou margin-top de **60px** (56px do header + 4px de margem) em todas as páginas principais para garantir que o conteúdo fique abaixo do header em dispositivos móveis.

### Estratégia de Implementação

1. Adicionar classe CSS global `.page-container` ou `.main-content` com padding-top adequado
2. Aplicar diretamente nos arquivos CSS de cada página
3. Usar media query para aplicar apenas em mobile (max-width: 768px)
