package models

import "time"


type Review struct {
    ID             uint      `gorm:"primaryKey"`
    ServiceID      uint      `gorm:"not null;unique;constraint:OnDelete:CASCADE" json:"service_id"`
    ClientID       uint      `gorm:"not null;index;foreignKey:UserID;constraint:OnDelete:CASCADE" json:"client_id"`
    DiaristID      uint      `gorm:"not null;index;foreignKey:UserID;constraint:OnDelete:CASCADE" json:"diarist_id"`
    ClientComment  string
    DiaristComment string
    ClientRating   int
    DiaristRating  int
    CreatedAt      time.Time `gorm:"default:current_timestamp"`
}
