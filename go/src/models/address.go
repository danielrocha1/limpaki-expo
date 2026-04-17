package models

type AddressRoom struct {
	ID        uint   `gorm:"primaryKey"`
	AddressID uint   `gorm:"not null;index"`
	Name      string `gorm:"size:100;not null"`
	Quantity  int    `gorm:"not null"`
}

type Address struct {
	ID             uint   `gorm:"primaryKey"`
	UserID         uint   `gorm:"foreignKey:UserID;not null"`
	Street         string `gorm:"size:150;not null"`
	Number         string `gorm:"size:10"`
	ResidenceType  string `gorm:"size:20;default:'apartment'"`
	Complement     string `gorm:"size:150"`
	Neighborhood   string `gorm:"size:100"`
	ReferencePoint string `gorm:"size:150"`
	City           string `gorm:"size:50;not null"`
	State          string `gorm:"size:80;not null"`
	Zipcode        string `gorm:"size:10;not null"`
	Latitude       float64 `gorm:"type:decimal(9,6)"`
	Longitude      float64 `gorm:"type:decimal(9,6)"`
	Rooms          []AddressRoom `gorm:"foreignKey:AddressID;constraint:OnDelete:CASCADE"`
}
