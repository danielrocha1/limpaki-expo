package repository

import (
	"context"
	"time"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type MessageRepository interface {
	Create(ctx context.Context, message *models.ChatMessage) error
	ListByService(ctx context.Context, serviceID uint, page int, pageSize int) ([]models.ChatMessage, int64, error)
	MarkServiceMessagesRead(ctx context.Context, serviceID uint, userID uint) ([]uint, error)
}

type GormMessageRepository struct {
	db *gorm.DB
}

func NewMessageRepository(db *gorm.DB) *GormMessageRepository {
	return &GormMessageRepository{db: db}
}

func (r *GormMessageRepository) Create(ctx context.Context, message *models.ChatMessage) error {
	return config.DBFromContext(ctx, r.db).WithContext(ctx).Create(message).Error
}

func (r *GormMessageRepository) ListByService(ctx context.Context, serviceID uint, page int, pageSize int) ([]models.ChatMessage, int64, error) {
	var messages []models.ChatMessage
	var total int64

	query := config.DBFromContext(ctx, r.db).WithContext(ctx).Model(&models.ChatMessage{}).Where("service_id = ?", serviceID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err := query.Preload("Sender").
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&messages).Error
	return messages, total, err
}

func (r *GormMessageRepository) MarkServiceMessagesRead(ctx context.Context, serviceID uint, userID uint) ([]uint, error) {
	var messageIDs []uint

	err := config.DBFromContext(ctx, r.db).WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var unread []models.ChatMessage
		if err := tx.Where("service_id = ? AND sender_id <> ? AND read = ?", serviceID, userID, false).
			Find(&unread).Error; err != nil {
			return err
		}
		if len(unread) == 0 {
			return nil
		}

		receipts := make([]models.ChatMessageRead, 0, len(unread))
		messageIDs = make([]uint, 0, len(unread))
		readAt := time.Now().UTC()
		for _, message := range unread {
			messageIDs = append(messageIDs, message.ID)
			receipts = append(receipts, models.ChatMessageRead{
				MessageID: message.ID,
				UserID:    userID,
				ReadAt:    readAt,
			})
		}

		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&receipts).Error; err != nil {
			return err
		}

		return tx.Model(&models.ChatMessage{}).Where("id IN ?", messageIDs).Update("read", true).Error
	})

	return messageIDs, err
}
