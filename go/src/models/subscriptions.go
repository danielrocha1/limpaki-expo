package models

import "time"

// Subscription representa o estado da assinatura apos checkout Mercado Pago (Checkout Pro / preferencia).
// Colunas mp_* no Postgres (renomeacao legada aplicada em renameLegacyStripeSchemaToMercadoPago).
type Subscription struct {
	ID                      uint       `json:"id" gorm:"primaryKey"`
	UserID                  uint       `json:"user_id" gorm:"not null;uniqueIndex"`
	Role                    string     `json:"role" gorm:"type:varchar(20);not null"`
	Plan                    string     `json:"plan" gorm:"type:varchar(20);not null;index"`
	Price                   float64    `json:"price" gorm:"not null"`
	PayerID                 string     `json:"payer_id" gorm:"column:mp_payer_id;type:varchar(255);index"`
	PaymentID               string     `json:"payment_id" gorm:"column:mp_external_id;type:varchar(255);uniqueIndex"`
	PlanRef                 string     `json:"plan_ref" gorm:"column:mp_plan_key;type:varchar(255)"`
	PreferenceID            string     `json:"preference_id" gorm:"column:mp_preference_id;type:varchar(255)"`
	Status                  string     `json:"status" gorm:"type:varchar(40);not null;default:'inactive';index"`
	ExpiresAt               time.Time  `json:"expires_at" gorm:"not null"`
	CurrentPeriodStart      *time.Time `json:"current_period_start,omitempty"`
	CurrentPeriodEnd        *time.Time `json:"current_period_end,omitempty"`
	CancelAt                *time.Time `json:"cancel_at,omitempty"`
	CanceledAt              *time.Time `json:"canceled_at,omitempty"`
	EndedAt                 *time.Time `json:"ended_at,omitempty"`
	LastWebhookEventID      string     `json:"last_webhook_event_id" gorm:"type:varchar(255)"`
	LastWebhookEventCreated int64      `json:"last_webhook_event_created"`
	CreatedAt               time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt               time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
}

// WebhookEventDedupe registra notificacoes processadas (idempotencia).
type WebhookEventDedupe struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	EventID   string    `json:"event_id" gorm:"type:varchar(255);uniqueIndex;not null"`
	EventType string    `json:"event_type" gorm:"type:varchar(100);not null"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
}

func (WebhookEventDedupe) TableName() string {
	return "mp_webhook_events"
}
