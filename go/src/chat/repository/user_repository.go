package repository

import (
	"context"

	"limpae/go/src/models"

	"gorm.io/gorm"
)

type UserRepository interface {
	CountByIDs(ctx context.Context, ids []uint) (int64, error)
}

type GormUserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *GormUserRepository {
	return &GormUserRepository{db: db}
}

func (r *GormUserRepository) CountByIDs(ctx context.Context, ids []uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.User{}).Where("id IN ?", ids).Count(&count).Error
	return count, err
}
