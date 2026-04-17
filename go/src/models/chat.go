package models

import "time"

type ChatRoom struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Fingerprint *string   `gorm:"size:255;uniqueIndex" json:"-"`
	CreatedAt   time.Time `json:"created_at"`
	Users       []User    `gorm:"many2many:chat_room_users;joinForeignKey:RoomID;joinReferences:UserID" json:"users,omitempty"`
}

type ChatRoomUser struct {
	RoomID    uint      `gorm:"primaryKey;index:idx_chat_room_user,priority:1" json:"room_id"`
	UserID    uint      `gorm:"primaryKey;index:idx_chat_room_user,priority:2" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

type ChatMessage struct {
	ID        uint              `gorm:"primaryKey" json:"id"`
	RoomID    uint              `gorm:"not null;index" json:"room_id"`
	ServiceID uint              `gorm:"not null;index:idx_chat_messages_service_created,priority:1" json:"service_id"`
	SenderID  uint              `gorm:"not null;index" json:"sender_id"`
	Content   string            `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time         `gorm:"index:idx_chat_messages_service_created,priority:2,sort:desc" json:"created_at"`
	Read      bool              `gorm:"default:false;index" json:"read"`
	Room      ChatRoom          `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	Sender    User              `gorm:"foreignKey:SenderID" json:"sender,omitempty"`
	Reads     []ChatMessageRead `gorm:"foreignKey:MessageID" json:"-"`
}

type ChatMessageRead struct {
	ID        uint      `gorm:"primaryKey"`
	MessageID uint      `gorm:"not null;uniqueIndex:idx_chat_message_user_read,priority:1"`
	UserID    uint      `gorm:"not null;uniqueIndex:idx_chat_message_user_read,priority:2"`
	ReadAt    time.Time `gorm:"not null"`
}

type ChatLocation struct {
	UserID    uint      `gorm:"primaryKey;uniqueIndex:idx_chat_location_user_service,priority:1" json:"user_id"`
	RoomID    uint      `gorm:"not null;index" json:"room_id"`
	ServiceID uint      `gorm:"primaryKey;uniqueIndex:idx_chat_location_user_service,priority:2;not null;index:idx_chat_locations_service_updated,priority:1" json:"service_id"`
	Latitude  float64   `gorm:"not null" json:"latitude"`
	Longitude float64   `gorm:"not null" json:"longitude"`
	UpdatedAt time.Time `gorm:"index:idx_chat_locations_service_updated,priority:2,sort:desc" json:"updated_at"`
	Room      ChatRoom  `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	User      User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
