package models

import (
	"time"
)

type Service struct {
	ID            uint      `gorm:"primaryKey;autoIncrement"`
	OfferID       *uint     `gorm:"uniqueIndex" json:"offer_id,omitempty"`
	ClientID      uint      `gorm:"not null;index;foreignKey:UserID;constraint:OnDelete:CASCADE" json:"client_id"`
	DiaristID     uint      `gorm:"not null;index;foreignKey:UserID;constraint:OnDelete:CASCADE" json:"diarist_id"`
	AddressID     *uint     `gorm:"index;constraint:OnDelete:SET NULL" json:"address_id"`
	Status        string    `gorm:"type:varchar(20);check:status IN ('pendente', 'aceito', 'em jornada', 'em serviço', 'concluído', 'cancelado');default:'pendente'" json:"status"`
	TotalPrice    float64   `gorm:"type:decimal(10,2);check:total_price >= 0" json:"total_price"`
	DurationHours float64   `gorm:"type:decimal(4,2);check:duration_hours > 0" json:"duration_hours"`
	ScheduledAt   time.Time `gorm:"not null" json:"scheduled_at"`

	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"created_at"`

	// Campos operacionais para a diarista.
	ServiceType   string `gorm:"type:varchar(500)" json:"service_type"`
	HasPets       bool   `gorm:"default:false" json:"has_pets"`
	Observations  string `gorm:"type:text" json:"observations"`
	CancelReason  string `gorm:"type:text" json:"cancel_reason"`
	RejectionReason string `gorm:"type:text" json:"rejection_reason"`
	RoomCount     int    `json:"room_count"`
	BathroomCount int    `json:"bathroom_count"`

	// Relações para preload.
	Client  User    `gorm:"foreignKey:ClientID" json:"client"`
	Diarist User    `gorm:"foreignKey:DiaristID" json:"diarist"`
	Address Address `gorm:"foreignKey:AddressID" json:"address"`
	Offer   Offer   `gorm:"foreignKey:OfferID" json:"offer"`
	Review  Review  `json:"reviews" gorm:"foreignKey:ServiceID"`
}
