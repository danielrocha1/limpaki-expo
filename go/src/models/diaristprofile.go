package models

type Diarists struct {
	ID              uint           `gorm:"primaryKey"`
	UserID          uint           `gorm:"not null;unique"`
	Bio             string         `gorm:"type:text"`
	ExperienceYears int            `gorm:"check:experience_years >= 0"`
	PricePerHour    float64        `gorm:"not null"`
	PricePerDay     float64        `gorm:"not null"`
	Specialties     string         `gorm:"type:text"` // Alterado de datatypes.JSON para string para simplificar
	Available       bool           `gorm:"default:true"`
}
