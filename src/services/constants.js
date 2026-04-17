import { API_BASE_URL } from "../config/api";

export const SERVICE_STATUS = {
  PENDING: "pendente",
  ACCEPTED: "aceito",
  IN_JOURNEY: "em jornada",
  IN_SERVICE: "em serviço",
  COMPLETED: "concluído",
  CANCELLED: "cancelado",
};

export const normalizeServiceStatus = (status) =>
  String(status || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const isCompletedStatus = (status) =>
  normalizeServiceStatus(status) === normalizeServiceStatus(SERVICE_STATUS.COMPLETED);

export const STATUS_ORDER = {
  [SERVICE_STATUS.PENDING]: 1,
  [SERVICE_STATUS.ACCEPTED]: 2,
  [SERVICE_STATUS.IN_JOURNEY]: 3,
  [SERVICE_STATUS.IN_SERVICE]: 4,
  [SERVICE_STATUS.COMPLETED]: 5,
  [SERVICE_STATUS.CANCELLED]: 6,
};

export const SERVICE_ACTIONS = {
  ACCEPT: "accept",
  CANCEL: "cancel",
  START: "start",
  COMPLETE: "complete",
};

export const ACTION_TO_STATUS = {
  [SERVICE_ACTIONS.ACCEPT]: SERVICE_STATUS.ACCEPTED,
  [SERVICE_ACTIONS.CANCEL]: SERVICE_STATUS.CANCELLED,
  [SERVICE_ACTIONS.START]: SERVICE_STATUS.IN_JOURNEY,
  [SERVICE_ACTIONS.COMPLETE]: SERVICE_STATUS.COMPLETED,
};

export const ACTION_LABELS = {
  [SERVICE_ACTIONS.ACCEPT]: "aceitar",
  [SERVICE_ACTIONS.CANCEL]: "cancelar",
  [SERVICE_ACTIONS.START]: "iniciar a jornada de",
  [SERVICE_ACTIONS.COMPLETE]: "concluir",
};

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: {
    SERVICES: "/services/my",
    SERVICE_ACTION: (id, action) => `/services/${id}/${action}`,
    REVIEWS: "/reviews",
  },
};

export const VALIDATION = {
  MIN_COMMENT_LENGTH: 10,
  MAX_COMMENT_LENGTH: 500,
  MIN_RATING: 1,
  MAX_RATING: 5,
};

export const ERROR_MESSAGES = {
  UNAUTHORIZED: "Usuário não autenticado.",
  FETCH_SERVICES: "Erro ao buscar serviços.",
  UPDATE_SERVICE: (action) => `Erro ao ${ACTION_LABELS[action] || action} serviço.`,
  SUBMIT_REVIEW: "Erro ao enviar review.",
  VALIDATION: {
    RATING_REQUIRED: "Por favor, selecione uma avaliação.",
    COMMENT_TOO_SHORT: `O comentário deve ter pelo menos ${VALIDATION.MIN_COMMENT_LENGTH} caracteres.`,
  },
};

export const SUCCESS_MESSAGES = {
  JOURNEY_STARTED: "Jornada iniciada com sucesso!",
  PIN_VERIFIED: "PIN verificado com sucesso! Serviço iniciado.",
  SERVICE_COMPLETED: "Serviço finalizado com sucesso!",
};

export const UI_CONFIG = {
  CONFIRMATION_MESSAGE: (action) =>
    `Tem certeza de que deseja ${ACTION_LABELS[action] || action} este serviço?`,
  SUCCESS_MESSAGES: {
    REVIEW_SUBMITTED: "Review enviada com sucesso!",
  },
};

export const BADGE_COLORS = {
  [SERVICE_STATUS.PENDING]: { bg: "#FFF9E6", color: "#947600" },
  [SERVICE_STATUS.ACCEPTED]: { bg: "#E6F3FF", color: "#0056B3" },
  [SERVICE_STATUS.IN_JOURNEY]: { bg: "#FFF4E5", color: "#B45309" },
  [SERVICE_STATUS.IN_SERVICE]: { bg: "#FFE6E6", color: "#C53030" },
  [SERVICE_STATUS.COMPLETED]: { bg: "#E6F9ED", color: "#007A33" },
  [SERVICE_STATUS.CANCELLED]: { bg: "#FFF0F0", color: "#C53030" },
};
