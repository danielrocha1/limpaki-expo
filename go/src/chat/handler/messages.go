package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"limpae/go/src/chat/middleware"
	"limpae/go/src/chat/service"
)

type MessageHandler struct {
	logger         *slog.Logger
	messageService *service.MessageService
}

func NewMessageHandler(logger *slog.Logger, messageService *service.MessageService) *MessageHandler {
	return &MessageHandler{logger: logger, messageService: messageService}
}

func (h *MessageHandler) HandleMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	roomID, err := parseUintQuery(r, "room_id")
	if err != nil || roomID == 0 {
		respondError(w, http.StatusBadRequest, "room_id is required")
		return
	}

	page := parseIntWithDefault(r.URL.Query().Get("page"), 1)
	pageSize := parseIntWithDefault(r.URL.Query().Get("page_size"), 20)

	ctx, cancel := contextWithTimeout(r.Context())
	defer cancel()

	messages, total, err := h.messageService.GetMessages(ctx, userID, roomID, page, pageSize)
	if err != nil {
		if errors.Is(err, service.ErrForbidden) {
			respondError(w, http.StatusForbidden, "access denied")
			return
		}
		h.logger.Error("failed to list messages", "user_id", userID, "room_id", roomID, "error", err)
		respondError(w, http.StatusInternalServerError, "failed to list messages")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"items": messages,
		"pagination": map[string]int64{
			"page":        int64(page),
			"page_size":   int64(pageSize),
			"total_items": total,
		},
	})
}
