package websocket

import (
	"encoding/json"
	"log/slog"
	"slices"
	"time"
)

type serviceBroadcast struct {
	serviceID uint
	payload   []byte
}

type Hub struct {
	logger            *slog.Logger
	register          chan *Client
	unregister        chan *Client
	broadcast         chan serviceBroadcast
	clients           map[*Client]struct{}
	services          map[uint]map[*Client]struct{}
	serviceUserCounts map[uint]map[uint]int
}

func NewHub(logger *slog.Logger) *Hub {
	return &Hub{
		logger:            logger,
		register:          make(chan *Client),
		unregister:        make(chan *Client),
		broadcast:         make(chan serviceBroadcast, 256),
		clients:           make(map[*Client]struct{}),
		services:          make(map[uint]map[*Client]struct{}),
		serviceUserCounts: make(map[uint]map[uint]int),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.handleRegister(client)
		case client := <-h.unregister:
			h.handleUnregister(client)
		case message := <-h.broadcast:
			h.handleBroadcast(message)
		}
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) BroadcastToService(serviceID uint, event OutboundEvent) {
	payload, err := json.Marshal(event)
	if err != nil {
		h.logger.Error("failed to marshal service event", "service_id", serviceID, "error", err)
		return
	}
	h.broadcast <- serviceBroadcast{serviceID: serviceID, payload: payload}
}

func (h *Hub) handleRegister(client *Client) {
	h.clients[client] = struct{}{}
	for serviceID := range client.ServiceIDs {
		if _, exists := h.services[serviceID]; !exists {
			h.services[serviceID] = make(map[*Client]struct{})
		}
		h.services[serviceID][client] = struct{}{}

		if _, exists := h.serviceUserCounts[serviceID]; !exists {
			h.serviceUserCounts[serviceID] = make(map[uint]int)
		}

		h.serviceUserCounts[serviceID][client.UserID]++
		if h.serviceUserCounts[serviceID][client.UserID] == 1 {
			now := time.Now().UTC()
			h.BroadcastToService(serviceID, OutboundEvent{
				Type:      EventTypeUserJoined,
				ServiceID: serviceID,
				UserID:    client.UserID,
				UpdatedAt: &now,
			})
		}

		client.Enqueue(OutboundEvent{
			Type:      EventTypePresence,
			ServiceID: serviceID,
			UserIDs:   h.snapshotServiceUsers(serviceID),
		})
	}
}

func (h *Hub) handleUnregister(client *Client) {
	h.removeClient(client)
}

func (h *Hub) handleBroadcast(message serviceBroadcast) {
	serviceClients, exists := h.services[message.serviceID]
	if !exists {
		return
	}

	for client := range serviceClients {
		select {
		case client.Send <- message.payload:
		default:
			h.logger.Warn("dropping slow websocket client", "user_id", client.UserID, "service_id", message.serviceID)
			h.removeClient(client)
		}
	}
}

func (h *Hub) removeClient(client *Client) {
	if _, exists := h.clients[client]; !exists {
		return
	}
	delete(h.clients, client)

	for serviceID := range client.ServiceIDs {
		if serviceClients, exists := h.services[serviceID]; exists {
			delete(serviceClients, client)
			if len(serviceClients) == 0 {
				delete(h.services, serviceID)
			}
		}

		if users, exists := h.serviceUserCounts[serviceID]; exists {
			users[client.UserID]--
			if users[client.UserID] <= 0 {
				delete(users, client.UserID)
				now := time.Now().UTC()
				h.BroadcastToService(serviceID, OutboundEvent{
					Type:      EventTypeUserLeft,
					ServiceID: serviceID,
					UserID:    client.UserID,
					UpdatedAt: &now,
				})
			}
			if len(users) == 0 {
				delete(h.serviceUserCounts, serviceID)
			}
		}
	}

	close(client.Send)
}

func (h *Hub) snapshotServiceUsers(serviceID uint) []uint {
	users := h.serviceUserCounts[serviceID]
	if len(users) == 0 {
		return nil
	}

	userIDs := make([]uint, 0, len(users))
	for userID := range users {
		userIDs = append(userIDs, userID)
	}
	slices.Sort(userIDs)
	return userIDs
}
