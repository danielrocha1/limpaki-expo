export const HELP_SUPPORT_EMAIL = "suporte@limpae.app";

export function getHelpSupportWhatsApp() {
  const raw = String(process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP || "").trim();
  return raw.replace(/\D/g, "");
}

export const HELP_QUICK_REPLIES = [
  "Problema com uma oferta",
  "Dúvida sobre pagamento",
  "Não consigo confirmar o e-mail",
  "Outro assunto",
];

const sharedTopics = [
  {
    id: "account",
    label: "Conta e acesso",
    icon: "user",
    items: [
      {
        question: "Como confirmo meu e-mail?",
        answer:
          "Abra o link enviado para sua caixa de entrada após o cadastro. Se não encontrar, verifique o spam e use Reenviar e-mail no perfil ou na tela de confirmação.",
      },
      {
        question: "Esqueci minha senha. O que faço?",
        answer:
          "Na tela de login, toque em Esqueceu a senha, informe seu e-mail e siga as instruções recebidas para criar uma nova senha.",
      },
      {
        question: "Como atualizo meus dados pessoais?",
        answer:
          "Vá em Meu perfil, toque em Editar perfil, altere nome, telefone ou foto e salve as alterações.",
      },
    ],
  },
  {
    id: "subscription",
    label: "Assinatura",
    icon: "credit-card",
    items: [
      {
        question: "Por que preciso de assinatura?",
        answer:
          "A assinatura libera o uso completo do app para contratar, publicar ofertas e acompanhar serviços com segurança.",
      },
      {
        question: "Como cancelo minha assinatura?",
        answer:
          "Em Perfil > Assinatura, use a opção de cancelamento. O acesso permanece até o fim do período já pago.",
      },
      {
        question: "Paguei e o acesso não foi liberado",
        answer:
          "Aguarde alguns minutos e reabra o app. Pagamentos no Mercado Pago podem levar um instante para confirmar. Se persistir, fale com o suporte.",
      },
    ],
  },
  {
    id: "safety",
    label: "Segurança",
    icon: "shield",
    items: [
      {
        question: "Meus dados estão protegidos?",
        answer:
          "Usamos autenticação segura e armazenamos apenas o necessário para operar o serviço. Nunca compartilhe sua senha.",
      },
      {
        question: "Como denuncio um comportamento inadequado?",
        answer:
          "Registre o máximo de detalhes do serviço e envie um e-mail para o suporte com prints e data/horário do ocorrido.",
      },
    ],
  },
];

const clientTopics = [
  {
    id: "diarists",
    label: "Diaristas",
    icon: "users",
    items: [
      {
        question: "Como encontro diaristas perto de mim?",
        answer:
          "Cadastre um endereço ativo no topo do app. Na aba Diaristas, você verá profissionais próximos com avaliação e valores.",
      },
      {
        question: "Como contrato uma diarista?",
        answer:
          "Na lista de diaristas, toque em Contratar, escolha data, horário e duração e confirme o pedido.",
      },
    ],
  },
  {
    id: "offers",
    label: "Ofertas",
    icon: "tag",
    items: [
      {
        question: "Como publico uma oferta?",
        answer:
          "Na aba Ofertas, toque em Nova oferta e siga os passos: tipo de serviço, data, horário, valor e observações.",
      },
      {
        question: "Posso editar ou cancelar uma oferta?",
        answer:
          "Ofertas ainda sem aceite podem ser ajustadas na lista. Depois de aceitas, o acompanhamento passa para Serviços.",
      },
    ],
  },
  {
    id: "payments",
    label: "Pagamentos",
    icon: "dollar-sign",
    items: [
      {
        question: "Quando pago pela limpeza?",
        answer:
          "O pagamento do serviço é combinado diretamente com a diarista após a conclusão, salvo combinação diferente no chat.",
      },
    ],
  },
];

const diaristTopics = [
  {
    id: "offers",
    label: "Ofertas",
    icon: "tag",
    items: [
      {
        question: "Como vejo ofertas disponíveis?",
        answer:
          "Mantenha seu endereço cadastrado e acesse a aba Ofertas. Lá aparecem oportunidades abertas na sua região.",
      },
      {
        question: "Como envio uma contraproposta?",
        answer:
          "Abra a oferta, informe valor e observações sugeridos e aguarde a resposta da cliente.",
      },
    ],
  },
  {
    id: "services",
    label: "Serviços",
    icon: "briefcase",
    items: [
      {
        question: "Onde acompanho serviços aceitos?",
        answer:
          "Na aba Serviços você acompanha status, chat e detalhes de cada atendimento.",
      },
      {
        question: "A cliente não responde no chat",
        answer:
          "Envie uma mensagem clara com data e horário. Se não houver retorno, registre no suporte para orientação.",
      },
    ],
  },
  {
    id: "profile",
    label: "Meu perfil profissional",
    icon: "star",
    items: [
      {
        question: "Como melhoro minha visibilidade?",
        answer:
          "Complete foto, bio, especialidades e valores. Perfis completos e bem avaliados aparecem com mais destaque.",
      },
      {
        question: "Como atualizo disponibilidade e preços?",
        answer:
          "Em Perfil > Informações, edite disponibilidade, valor por hora e por dia e salve.",
      },
    ],
  },
];

export function getHelpTopics(role = "cliente") {
  const roleTopics = role === "diarista" ? diaristTopics : clientTopics;
  return [...roleTopics, ...sharedTopics];
}

export function flattenHelpItems(topics) {
  return topics.flatMap((topic) =>
    topic.items.map((item) => ({
      ...item,
      topicId: topic.id,
      topicLabel: topic.label,
      topicIcon: topic.icon,
    })),
  );
}
