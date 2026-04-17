package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"limpae/go/src/chat/middleware"
	"limpae/go/src/chat/service"
)

type LocationHandler struct {
	logger          *slog.Logger
	locationService *service.LocationService
}

func NewLocationHandler(logger *slog.Logger, locationService *service.LocationService) *LocationHandler {
	return &LocationHandler{logger: logger, locationService: locationService}
}

func (h *LocationHandler) HandleLocations(w http.ResponseWriter, r *http.Request) {
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

	ctx, cancel := contextWithTimeout(r.Context())
	defer cancel()

	locations, err := h.locationService.ListLocations(ctx, userID, roomID)
	if err != nil {
		if errors.Is(err, service.ErrForbidden) {
			respondError(w, http.StatusForbidden, "access denied")
			return
		}
		h.logger.Error("failed to list locations", "user_id", userID, "room_id", roomID, "error", err)
		respondError(w, http.StatusInternalServerError, "failed to list locations")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"items": locations})
}
