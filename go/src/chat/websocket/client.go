package websocket

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"limpae/go/src/realtime"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4 * 1024
)

type ClientProcessor func(ctx context.Context, client *Client, event InboundEvent) error

type Client struct {
	UserID     uint
	Conn       *realtime.WSConn
	Send       chan []byte
	ServiceIDs map[uint]struct{}
	hub        *Hub
	logger     *slog.Logger
	processor  ClientProcessor
}

func NewClient(userID uint, conn *realtime.WSConn, serviceIDs []uint, hub *Hub, logger *slog.Logger, processor ClientProcessor) *Client {
	services := make(map[uint]struct{}, len(serviceIDs))
	for _, serviceID := range serviceIDs {
		services[serviceID] = struct{}{}
	}

	return &Client{
		UserID:     userID,
		Conn:       conn,
		Send:       make(chan []byte, 256),
		ServiceIDs: services,
		hub:        hub,
		logger:     logger,
		processor:  processor,
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		_ = c.Conn.Close()
	}()

	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))

	for {
		var event InboundEvent
		message, err := c.Conn.ReadMessage()
		if err != nil {
			c.logger.Info("websocket read closed", "user_id", c.UserID, "error", err)
			return
		}
		if len(message) == 0 {
			continue
		}
		_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		if err := json.Unmarshal(message, &event); err != nil {
			c.Enqueue(OutboundEvent{Type: EventTypeError, Error: "invalid websocket payload"})
			continue
		}

		if c.processor == nil {
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err = c.processor(ctx, c, event)
		cancel()
		if err != nil {
			c.Enqueue(OutboundEvent{Type: EventTypeError, Error: err.Error()})
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.Conn.Close()
	}()

	for {
		select {
		case payload, ok := <-c.Send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.Conn.WriteControl(0x8, nil)
				return
			}
			if err := c.Conn.WriteText(payload); err != nil {
				c.logger.Warn("websocket write failed", "user_id", c.UserID, "error", err)
				return
			}

		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteControl(0x9, nil); err != nil {
				c.logger.Warn("websocket ping failed", "user_id", c.UserID, "error", err)
				return
			}
		}
	}
}

func (c *Client) Enqueue(event OutboundEvent) {
	payload, err := json.Marshal(event)
	if err != nil {
		c.logger.Error("failed to marshal websocket event", "user_id", c.UserID, "error", err)
		return
	}

	select {
	case c.Send <- payload:
	default:
		c.logger.Warn("websocket send buffer full", "user_id", c.UserID)
	}
}
