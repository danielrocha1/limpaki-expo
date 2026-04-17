package models

import (
	"time"
)

// Offer representa uma oferta publicada no mural
type Offer struct {
	ID                  uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientID            uint      `gorm:"not null;index;foreignKey:UserID;constraint:OnDelete:CASCADE" json:"client_id"`
	AddressID           *uint     `gorm:"index;constraint:OnDelete:SET NULL" json:"address_id"`
	ServiceType         string    `gorm:"type:varchar(500)" json:"service_type"`
	ScheduledAt         time.Time `gorm:"not null" json:"scheduled_at"`
	DurationHours       float64   `gorm:"type:decimal(4,2);check:duration_hours > 0" json:"duration_hours"`
	InitialValue        float64   `gorm:"type:decimal(10,2);check:initial_value >= 0" json:"initial_value"`
	CurrentValue        float64   `gorm:"type:decimal(10,2);check:current_value >= 0" json:"current_value"`
	Status              string    `gorm:"type:varchar(20);check:status IN ('aberta', 'negociacao', 'aceita', 'cancelada');default:'aberta'" json:"status"`
	Observations        string    `gorm:"type:text" json:"observations"`
	CancelReason        string    `gorm:"type:text" json:"cancel_reason"`
	AcceptedByDiaristID *uint     `gorm:"index;foreignKey:UserID;constraint:OnDelete:SET NULL" json:"accepted_by_diarist_id"`
	CreatedAt           time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt           time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relacoes
	Client            User               `gorm:"foreignKey:ClientID" json:"client"`
	Address           Address            `gorm:"foreignKey:AddressID" json:"address"`
	AcceptedByDiarist User               `gorm:"foreignKey:AcceptedByDiaristID" json:"accepted_by_diarist"`
	Negotiations      []OfferNegotiation `gorm:"foreignKey:OfferID;constraint:OnDelete:CASCADE" json:"negotiations"`
}

// OfferNegotiation representa uma contraproposta de uma diarista
type OfferNegotiation struct {
	ID                   uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	OfferID              uint      `gorm:"not null;index;foreignKey:OfferID;constraint:OnDelete:CASCADE" json:"offer_id"`
	DiaristID            uint      `gorm:"not null;index;foreignKey:UserID;constraint:OnDelete:CASCADE" json:"diarist_id"`
	CounterValue         float64   `gorm:"type:decimal(10,2);check:counter_value >= 0" json:"counter_value"`
	CounterDurationHours float64   `gorm:"type:decimal(4,2);check:counter_duration_hours > 0" json:"counter_duration_hours"`
	Status               string    `gorm:"type:varchar(20);check:status IN ('pendente', 'aceita', 'recusada');default:'pendente'" json:"status"`
	Message              string    `gorm:"type:text" json:"message"`
	RejectionReason      string    `gorm:"type:text" json:"rejection_reason"`
	CreatedAt            time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt            time.Time `gorm:"autoUpdateTime" json:"updated_at"`
	DiaristDistance      *float64  `gorm:"-" json:"diarist_distance,omitempty"`
	DiaristRating        float64   `gorm:"-" json:"diarist_rating"`

	// Relacoes
	Offer   Offer `gorm:"foreignKey:OfferID" json:"offer"`
	Diarist User  `gorm:"foreignKey:DiaristID" json:"diarist"`
}
