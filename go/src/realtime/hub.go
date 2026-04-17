package realtime

import (
	"encoding/json"
	"log"
	"sync"
	"time"
)

const OfferPresenceEventType = "presence_state"

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4 * 1024
	sendBufferSize = 32
)

type OutboundEvent struct {
	Type      string      `json:"type"`
	Timestamp time.Time   `json:"timestamp"`
	Payload   interface{} `json:"payload,omitempty"`
}

type DispatchOptions struct {
	UserIDs        []uint
	Roles          []string
	ExcludeUserIDs []uint
}

type dispatchRequest struct {
	message []byte
	options DispatchOptions
}

type roleSnapshotRequest struct {
	role     string
	response chan []uint
}

type presenceSnapshotPayload struct {
	Role    string `json:"role"`
	UserIDs []uint `json:"user_ids"`
}

type inboundMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type Client struct {
	hub       *Hub
	conn      *WSConn
	userID    uint
	userRole  string
	send      chan []byte
	closeOnce sync.Once
}

type Hub struct {
	register      chan *Client
	unregister    chan *Client
	dispatch      chan dispatchRequest
	roleSnapshot  chan roleSnapshotRequest
	clients       map[*Client]struct{}
	clientsByUser map[uint]map[*Client]struct{}
	clientsByRole map[string]map[*Client]struct{}
}

func NewHub() *Hub {
	return &Hub{
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		dispatch:      make(chan dispatchRequest, 128),
		roleSnapshot:  make(chan roleSnapshotRequest),
		clients:       make(map[*Client]struct{}),
		clientsByUser: make(map[uint]map[*Client]struct{}),
		clientsByRole: make(map[string]map[*Client]struct{}),
	}
}

var OfferHub = NewHub()

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = struct{}{}
			if _, exists := h.clientsByUser[client.userID]; !exists {
				h.clientsByUser[client.userID] = make(map[*Client]struct{})
			}
			h.clientsByUser[client.userID][client] = struct{}{}

			if _, exists := h.clientsByRole[client.userRole]; !exists {
				h.clientsByRole[client.userRole] = make(map[*Client]struct{})
			}
			h.clientsByRole[client.userRole][client] = struct{}{}

			log.Printf("[ws] cliente registrado user_id=%d role=%s conexoes=%d", client.userID, client.userRole, len(h.clients))
			h.publishPresenceSnapshot(client.userRole)

		case client := <-h.unregister:
			h.removeClient(client)

		case request := <-h.dispatch:
			h.dispatchMessage(request)

		case request := <-h.roleSnapshot:
			request.response <- h.onlineUserIDsByRole(request.role)
		}
	}
}

func (h *Hub) removeClient(client *Client) {
	if _, exists := h.clients[client]; !exists {
		return
	}

	delete(h.clients, client)

	if clientsForUser, exists := h.clientsByUser[client.userID]; exists {
		delete(clientsForUser, client)
		if len(clientsForUser) == 0 {
			delete(h.clientsByUser, client.userID)
		}
	}

	if clientsForRole, exists := h.clientsByRole[client.userRole]; exists {
		delete(clientsForRole, client)
		if len(clientsForRole) == 0 {
			delete(h.clientsByRole, client.userRole)
		}
	}

	client.closeSendChannel()
	log.Printf("[ws] cliente removido user_id=%d role=%s conexoes=%d", client.userID, client.userRole, len(h.clients))
	h.publishPresenceSnapshot(client.userRole)
}

func (h *Hub) dispatchMessage(request dispatchRequest) {
	recipients := make(map[*Client]struct{})
	excludedUsers := make(map[uint]struct{}, len(request.options.ExcludeUserIDs))

	for _, userID := range request.options.ExcludeUserIDs {
		excludedUsers[userID] = struct{}{}
	}

	for _, userID := range request.options.UserIDs {
		if _, excluded := excludedUsers[userID]; excluded {
			continue
		}

		for client := range h.clientsByUser[userID] {
			recipients[client] = struct{}{}
		}
	}

	for _, role := range request.options.Roles {
		for client := range h.clientsByRole[role] {
			if _, excluded := excludedUsers[client.userID]; excluded {
				continue
			}

			recipients[client] = struct{}{}
		}
	}

	if len(request.options.UserIDs) == 0 && len(request.options.Roles) == 0 {
		for client := range h.clients {
			if _, excluded := excludedUsers[client.userID]; excluded {
				continue
			}
			recipients[client] = struct{}{}
		}
	}

	for client := range recipients {
		select {
		case client.send <- request.message:
		default:
			log.Printf("[ws] buffer cheio; encerrando cliente user_id=%d role=%s", client.userID, client.userRole)
			h.removeClient(client)
		}
	}
}

func (h *Hub) Publish(eventType string, payload interface{}, options DispatchOptions) {
	message, err := json.Marshal(OutboundEvent{
		Type:      eventType,
		Timestamp: time.Now().UTC(),
		Payload:   payload,
	})
	if err != nil {
		log.Printf("[ws] falha ao serializar evento %s: %v", eventType, err)
		return
	}

	select {
	case h.dispatch <- dispatchRequest{
		message: message,
		options: options,
	}:
	default:
		log.Printf("[ws] fila de dispatch cheia; descartando evento %s", eventType)
	}
}

func (h *Hub) onlineUserIDsByRole(role string) []uint {
	userIDs := make([]uint, 0)
	seen := make(map[uint]struct{})

	for client := range h.clientsByRole[role] {
		if _, exists := seen[client.userID]; exists {
			continue
		}

		seen[client.userID] = struct{}{}
		userIDs = append(userIDs, client.userID)
	}

	return userIDs
}

func (h *Hub) OnlineUserIDsByRole(role string) []uint {
	response := make(chan []uint, 1)
	h.roleSnapshot <- roleSnapshotRequest{
		role:     role,
		response: response,
	}

	return <-response
}

func (h *Hub) publishPresenceSnapshot(role string) {
	if role == "" {
		return
	}

	h.Publish(OfferPresenceEventType, presenceSnapshotPayload{
		Role:    role,
		UserIDs: h.onlineUserIDsByRole(role),
	}, DispatchOptions{})
}

func (h *Hub) RegisterConnection(conn *WSConn, userID uint, userRole string) {
	client := &Client{
		hub:      h,
		conn:     conn,
		userID:   userID,
		userRole: userRole,
		send:     make(chan []byte, sendBufferSize),
	}

	h.register <- client

	go client.writePump()
	client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		_ = c.conn.Close()
	}()

	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))

	for {
		message, err := c.conn.ReadMessage()
		if err != nil {
			log.Printf("[ws] erro de leitura user_id=%d: %v", c.userID, err)
			return
		}
		if len(message) == 0 {
			continue
		}

		var inbound inboundMessage
		if err := json.Unmarshal(message, &inbound); err != nil {
			c.sendSystemEvent("system.error", map[string]interface{}{
				"message": "payload invalido; envie JSON valido",
			})
			continue
		}

		switch inbound.Type {
		case "client.ping":
			c.sendSystemEvent("system.pong", map[string]interface{}{
				"user_id": c.userID,
			})
		default:
			c.sendSystemEvent("system.error", map[string]interface{}{
				"message": "tipo de mensagem nao suportado",
				"type":    inbound.Type,
			})
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteControl(opcodeClose, nil)
				return
			}

			if err := c.conn.WriteText(message); err != nil {
				log.Printf("[ws] erro de escrita user_id=%d: %v", c.userID, err)
				return
			}

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteControl(opcodePing, nil); err != nil {
				log.Printf("[ws] erro ao enviar ping user_id=%d: %v", c.userID, err)
				return
			}
		}
	}
}

func (c *Client) sendSystemEvent(eventType string, payload interface{}) {
	message, err := json.Marshal(OutboundEvent{
		Type:      eventType,
		Timestamp: time.Now().UTC(),
		Payload:   payload,
	})
	if err != nil {
		log.Printf("[ws] falha ao serializar evento interno %s: %v", eventType, err)
		return
	}

	select {
	case c.send <- message:
	default:
		log.Printf("[ws] buffer cheio durante evento interno user_id=%d", c.userID)
	}
}

func (c *Client) closeSendChannel() {
	c.closeOnce.Do(func() {
		close(c.send)
	})
}
