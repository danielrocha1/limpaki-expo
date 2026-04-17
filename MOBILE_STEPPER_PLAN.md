# Plano de Redesign do Formulário de Contratação (Mobile First)

O objetivo é transformar o formulário atual de um layout de página única para um sistema de **passo a passo (stepper)**, focado em dispositivos móveis, com uma interface Limpaê, botões grandes e feedback visual claro.

## Estrutura do Stepper

### Passo 1: Tipo de Serviço
- **Pergunta:** Que tipo de serviço você precisa?
- **Opções:** 
  - "Por Hora" (com ícone de relógio)
  - "Diária" (com ícone de calendário)
- **Ação:** Ao selecionar, avança automaticamente ou exibe o botão "Próximo".

### Passo 2: Data
- **Pergunta:** Para quando você deseja o serviço?
- **Componente:** Calendário (otimizado para mobile).
- **Ação:** Botão "Próximo" habilitado após seleção.

### Passo 3: Horário e Duração
- **Se "Por Hora":**
  - Seleção de Horário (Hora e Minuto).
  - Quantidade de Horas (Stepper +/- em vez de input numérico).
- **Se "Diária":**
  - Seleção de Início (8h ou 9h).
  - Info: Duração fixa de 6h + 1h almoço.

### Passo 4: Detalhes do Serviço
- **Pergunta:** Descreva o que precisa ser feito.
- **Componente:** Textarea com placeholders sugestivos.
- **Info:** Exibição do endereço selecionado (contexto).

### Passo 5: Revisão e Confirmação
- **Resumo:** Data, Hora, Tipo, Duração e Preço Total.
- **Ação:** Botão "Confirmar Contratação" em destaque.

## Melhorias de UI/UX Mobile
- **Progress Bar:** Indicador visual no topo para mostrar o progresso.
- **Navegação:** Botões "Voltar" e "Próximo" fixos ou de fácil acesso.
- **Feedback Visual:** Estados de "active" claros para as seleções.
- **Animações:** Transições suaves entre os passos.
