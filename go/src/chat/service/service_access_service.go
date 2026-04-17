package service

import (
	"context"
	"errors"
	"strings"

	"limpae/go/src/chat/repository"
	"limpae/go/src/models"

	"gorm.io/gorm"
)

type ServiceAccessService struct {
	serviceRepo repository.ServiceRepository
}

func NewServiceAccessService(serviceRepo repository.ServiceRepository) *ServiceAccessService {
	return &ServiceAccessService{serviceRepo: serviceRepo}
}

func (s *ServiceAccessService) GetAccessibleService(ctx context.Context, userID uint, serviceID uint) (models.Service, error) {
	if serviceID == 0 {
		return models.Service{}, ErrInvalidInput
	}

	serviceModel, err := s.serviceRepo.GetAccessibleByUser(ctx, userID, serviceID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.Service{}, ErrForbidden
		}
		return models.Service{}, err
	}

	if serviceModel.ClientID == 0 || serviceModel.DiaristID == 0 {
		return models.Service{}, ErrForbidden
	}

	if isBlockedChatStatus(serviceModel.Status) {
		return models.Service{}, ErrChatUnavailable
	}

	return serviceModel, nil
}

func isBlockedChatStatus(status string) bool {
	normalized := normalizeServiceStatus(status)
	return normalized == "cancelado" || normalized == "concluido"
}

func normalizeServiceStatus(status string) string {
	replacer := strings.NewReplacer(
		"á", "a",
		"à", "a",
		"ã", "a",
		"â", "a",
		"é", "e",
		"ê", "e",
		"í", "i",
		"ó", "o",
		"ô", "o",
		"õ", "o",
		"ú", "u",
		"ç", "c",
	)

	return strings.TrimSpace(strings.ToLower(replacer.Replace(status)))
}
