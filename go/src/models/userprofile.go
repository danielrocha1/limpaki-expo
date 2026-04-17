package models

type UserProfile struct {
	ID               uint   `gorm:"primaryKey"`
	UserID           uint   `gorm:"foreignKey:UserID;not null"`
	ResidenceType    string `gorm:"size:20;default:'apartment'"` // Ex: apartment, house, studio
	HasPets          bool   `gorm:"default:false"`
	DesiredFrequency string `gorm:"size:20;default:'weekly'"` // Ex: weekly, biweekly, monthly, occasional
}
