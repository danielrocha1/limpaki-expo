package repository

import (
	"context"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"gorm.io/gorm"
)

type ServiceRepository interface {
	GetByID(ctx context.Context, serviceID uint) (models.Service, error)
	GetAccessibleByUser(ctx context.Context, userID uint, serviceID uint) (models.Service, error)
}

type GormServiceRepository struct {
	db *gorm.DB
}

func NewServiceRepository(db *gorm.DB) *GormServiceRepository {
	return &GormServiceRepository{db: db}
}

func (r *GormServiceRepository) GetByID(ctx context.Context, serviceID uint) (models.Service, error) {
	var serviceModel models.Service
	err := config.DBFromContext(ctx, r.db).WithContext(ctx).
		Preload("Client").
		Preload("Diarist").
		First(&serviceModel, serviceID).Error
	return serviceModel, err
}

func (r *GormServiceRepository) GetAccessibleByUser(ctx context.Context, userID uint, serviceID uint) (models.Service, error) {
	var serviceModel models.Service
	err := config.DBFromContext(ctx, r.db).WithContext(ctx).
		Preload("Client").
		Preload("Diarist").
		Where("id = ? AND (client_id = ? OR diarist_id = ?)", serviceID, userID, userID).
		First(&serviceModel).Error
	return serviceModel, err
}
