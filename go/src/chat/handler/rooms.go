package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"limpae/go/src/chat/middleware"
	"limpae/go/src/chat/service"
)

type RoomHandler struct {
	logger      *slog.Logger
	roomService *service.RoomService
}

func NewRoomHandler(logger *slog.Logger, roomService *service.RoomService) *RoomHandler {
	return &RoomHandler{logger: logger, roomService: roomService}
}

func (h *RoomHandler) HandleRooms(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.listRooms(w, r, userID)
	case http.MethodPost:
		h.createRoom(w, r, userID)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (h *RoomHandler) listRooms(w http.ResponseWriter, r *http.Request, userID uint) {
	ctx, cancel := contextWithTimeout(r.Context())
	defer cancel()

	rooms, err := h.roomService.ListRooms(ctx, userID)
	if err != nil {
		h.logger.Error("failed to list rooms", "user_id", userID, "error", err)
		respondError(w, http.StatusInternalServerError, "failed to list rooms")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"items": rooms})
}

func (h *RoomHandler) createRoom(w http.ResponseWriter, r *http.Request, userID uint) {
	ctx, cancel := contextWithTimeout(r.Context())
	defer cancel()

	var request struct {
		UserIDs []uint `json:"user_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	room, err := h.roomService.CreateRoom(ctx, userID, request.UserIDs)
	if err != nil {
		if errors.Is(err, service.ErrInvalidInput) {
			respondError(w, http.StatusBadRequest, "invalid room users")
			return
		}
		h.logger.Error("failed to create room", "user_id", userID, "error", err)
		respondError(w, http.StatusInternalServerError, "failed to create room")
		return
	}

	respondJSON(w, http.StatusCreated, room)
}
