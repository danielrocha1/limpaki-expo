package handler

import (
	"context"
	"log/slog"
	"strconv"
	"strings"

	"limpae/go/src/chat/service"
	chatws "limpae/go/src/chat/websocket"
	"limpae/go/src/realtime"
)

type WebSocketHandler struct {
	logger          *slog.Logger
	serviceAccess   *service.ServiceAccessService
	messageService  *service.MessageService
	locationService *service.LocationService
	hub             *chatws.Hub
}

func NewWebSocketHandler(
	logger *slog.Logger,
	serviceAccess *service.ServiceAccessService,
	messageService *service.MessageService,
	locationService *service.LocationService,
	hub *chatws.Hub,
) *WebSocketHandler {
	return &WebSocketHandler{
		logger:          logger,
		serviceAccess:   serviceAccess,
		messageService:  messageService,
		locationService: locationService,
		hub:             hub,
	}
}

func (h *WebSocketHandler) ValidateConnection(ctx context.Context, userID uint, serviceID uint) error {
	_, err := h.serviceAccess.GetAccessibleService(ctx, userID, serviceID)
	return err
}

func (h *WebSocketHandler) ServeConn(userID uint, serviceID uint, conn *realtime.WSConn) {
	client := chatws.NewClient(userID, conn, []uint{serviceID}, h.hub, h.logger, h.processEvent)
	h.hub.Register(client)

	go client.WritePump()
	client.ReadPump()
}

func (h *WebSocketHandler) processEvent(ctx context.Context, client *chatws.Client, event chatws.InboundEvent) error {
	if _, ok := client.ServiceIDs[event.ServiceID]; !ok {
		return service.ErrForbidden
	}

	switch event.Type {
	case chatws.EventTypeMessage:
		message, err := h.messageService.CreateMessage(ctx, client.UserID, event.ServiceID, event.Content)
		if err != nil {
			return err
		}

		read := message.Read
		h.hub.BroadcastToService(event.ServiceID, chatws.OutboundEvent{
			Type:      chatws.EventTypeMessage,
			ID:        message.ID,
			ServiceID: message.ServiceID,
			SenderID:  message.SenderID,
			Content:   message.Content,
			Read:      &read,
			CreatedAt: &message.CreatedAt,
		})
		return nil

	case chatws.EventTypeRead:
		messageIDs, err := h.messageService.MarkServiceMessagesRead(ctx, client.UserID, event.ServiceID)
		if err != nil {
			return err
		}
		if len(messageIDs) == 0 {
			return nil
		}

		h.hub.BroadcastToService(event.ServiceID, chatws.OutboundEvent{
			Type:       chatws.EventTypeRead,
			ServiceID:  event.ServiceID,
			UserID:     client.UserID,
			MessageIDs: messageIDs,
		})
		return nil

	case chatws.EventTypeLocation:
		location, err := h.locationService.UpdateLocation(ctx, client.UserID, event.ServiceID, event.Latitude, event.Longitude)
		if err != nil {
			return err
		}

		h.hub.BroadcastToService(event.ServiceID, chatws.OutboundEvent{
			Type:      chatws.EventTypeLocation,
			ServiceID: location.ServiceID,
			UserID:    location.UserID,
			Latitude:  location.Latitude,
			Longitude: location.Longitude,
			UpdatedAt: &location.UpdatedAt,
		})
		return nil

	default:
		return service.ErrInvalidInput
	}
}

func ParseServiceID(raw string) (uint, error) {
	value, err := strconv.ParseUint(strings.TrimSpace(raw), 10, 64)
	return uint(value), err
}
