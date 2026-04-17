package repository

import (
	"context"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type LocationRepository interface {
	Upsert(ctx context.Context, location *models.ChatLocation) error
	ListByService(ctx context.Context, serviceID uint) ([]models.ChatLocation, error)
}

type GormLocationRepository struct {
	db *gorm.DB
}

func NewLocationRepository(db *gorm.DB) *GormLocationRepository {
	return &GormLocationRepository{db: db}
}

func (r *GormLocationRepository) Upsert(ctx context.Context, location *models.ChatLocation) error {
	return config.DBFromContext(ctx, r.db).WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "service_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"room_id", "service_id", "latitude", "longitude", "updated_at"}),
	}).Create(location).Error
}

func (r *GormLocationRepository) ListByService(ctx context.Context, serviceID uint) ([]models.ChatLocation, error) {
	var locations []models.ChatLocation
	err := config.DBFromContext(ctx, r.db).WithContext(ctx).
		Where("service_id = ?", serviceID).
		Preload("User").
		Order("updated_at DESC").
		Find(&locations).Error
	return locations, err
}
