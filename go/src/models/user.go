package models

import "time"

type User struct {
	ID              uint   `gorm:"primaryKey"`
	Name            string `gorm:"size:100;not null"`
	Photo           string `gorm:"size:255;not null"`
	Email           string `gorm:"size:100;unique;not null"`
	EmailVerified   bool   `gorm:"not null;default:false;index"`
	EmailVerifiedAt *time.Time
	Phone           int64     `gorm:"unique;not null"`
	Cpf             string    `gorm:"size:20;unique;not null"`
	PasswordHash    string    `gorm:"not null"`
	Role            string    `gorm:"size:10;not null;check:role IN ('cliente', 'diarista')"`
	IsTestUser      bool      `gorm:"not null;default:false;index"`
	CreatedAt       time.Time `gorm:"default:current_timestamp"`

	// Relações 1:1 para perfis
	UserProfile    UserProfile `gorm:"foreignKey:UserID"`
	DiaristProfile Diarists    `gorm:"foreignKey:UserID"` // Corrigido para 1:1

	// Relação 1:N para endereços
	Address []Address `gorm:"foreignKey:UserID"`
}
