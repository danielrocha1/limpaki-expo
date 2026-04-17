package service

import (
	"context"
	"strings"
	"time"

	"limpae/go/src/chat/repository"
	"limpae/go/src/config"
	"limpae/go/src/models"
)

type MessageService struct {
	access      *ServiceAccessService
	messageRepo repository.MessageRepository
	roomRepo    repository.RoomRepository
}

func NewMessageService(
	access *ServiceAccessService,
	messageRepo repository.MessageRepository,
	roomRepo repository.RoomRepository,
) *MessageService {
	return &MessageService{
		access:      access,
		messageRepo: messageRepo,
		roomRepo:    roomRepo,
	}
}

func (s *MessageService) CreateMessage(ctx context.Context, senderID uint, serviceID uint, content string) (models.ChatMessage, error) {
	content = strings.TrimSpace(content)
	if serviceID == 0 || content == "" {
		return models.ChatMessage{}, ErrInvalidInput
	}

	var message models.ChatMessage
	err := config.WithTransaction(ctx, config.DB, func(txCtx context.Context) error {
		serviceModel, err := s.access.GetAccessibleService(txCtx, senderID, serviceID)
		if err != nil {
			return err
		}

		room, found, err := s.roomRepo.FindByExactUsers(txCtx, []uint{serviceModel.ClientID, serviceModel.DiaristID})
		if err != nil {
			return err
		}
		if !found {
			room, err = s.roomRepo.Create(txCtx, []uint{serviceModel.ClientID, serviceModel.DiaristID})
			if err != nil {
				return err
			}
		}

		message = models.ChatMessage{
			RoomID:    room.ID,
			ServiceID: serviceID,
			SenderID:  senderID,
			Content:   content,
			CreatedAt: time.Now().UTC(),
		}
		return s.messageRepo.Create(txCtx, &message)
	})
	if err != nil {
		return models.ChatMessage{}, err
	}

	return message, nil
}

func (s *MessageService) GetMessages(ctx context.Context, userID uint, serviceID uint, page int, pageSize int) ([]models.ChatMessage, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	if _, err := s.access.GetAccessibleService(ctx, userID, serviceID); err != nil {
		return nil, 0, err
	}

	messages, total, err := s.messageRepo.ListByService(ctx, serviceID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	for left, right := 0, len(messages)-1; left < right; left, right = left+1, right-1 {
		messages[left], messages[right] = messages[right], messages[left]
	}
	return messages, total, nil
}

func (s *MessageService) MarkServiceMessagesRead(ctx context.Context, userID uint, serviceID uint) ([]uint, error) {
	if serviceID == 0 {
		return nil, ErrInvalidInput
	}

	if _, err := s.access.GetAccessibleService(ctx, userID, serviceID); err != nil {
		return nil, err
	}

	return s.messageRepo.MarkServiceMessagesRead(ctx, serviceID, userID)
}
