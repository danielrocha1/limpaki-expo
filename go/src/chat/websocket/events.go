package websocket

import "time"

const (
	EventTypeMessage    = "message"
	EventTypeRead       = "read"
	EventTypeLocation   = "location"
	EventTypeUserJoined = "user_joined"
	EventTypeUserLeft   = "user_left"
	EventTypePresence   = "presence_state"
	EventTypeError      = "error"
)

type InboundEvent struct {
	Type      string  `json:"type"`
	ServiceID uint    `json:"service_id"`
	Content   string  `json:"content,omitempty"`
	Latitude  float64 `json:"latitude,omitempty"`
	Longitude float64 `json:"longitude,omitempty"`
}

type OutboundEvent struct {
	Type      string     `json:"type"`
	ID        uint       `json:"id,omitempty"`
	ServiceID uint       `json:"service_id,omitempty"`
	SenderID  uint       `json:"sender_id,omitempty"`
	UserID    uint       `json:"user_id,omitempty"`
	Content   string     `json:"content,omitempty"`
	Read      *bool      `json:"read,omitempty"`
	Latitude  float64    `json:"latitude,omitempty"`
	Longitude float64    `json:"longitude,omitempty"`
	MessageIDs []uint    `json:"message_ids,omitempty"`
	UserIDs   []uint     `json:"user_ids,omitempty"`
	CreatedAt *time.Time `json:"created_at,omitempty"`
	UpdatedAt *time.Time `json:"updated_at,omitempty"`
	Error     string     `json:"error,omitempty"`
}
