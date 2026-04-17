package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"limpae/go/src/chat/repository"
	"limpae/go/src/config"
	"limpae/go/src/models"
)

type LocationService struct {
	access        *ServiceAccessService
	locationRepo  repository.LocationRepository
	roomRepo      repository.RoomRepository
	minInterval   time.Duration
	mu            sync.Mutex
	lastPublished map[string]time.Time
}

func NewLocationService(
	access *ServiceAccessService,
	locationRepo repository.LocationRepository,
	roomRepo repository.RoomRepository,
	minInterval time.Duration,
) *LocationService {
	return &LocationService{
		access:        access,
		locationRepo:  locationRepo,
		roomRepo:      roomRepo,
		minInterval:   minInterval,
		lastPublished: make(map[string]time.Time),
	}
}

func (s *LocationService) UpdateLocation(ctx context.Context, userID uint, serviceID uint, latitude float64, longitude float64) (models.ChatLocation, error) {
	if serviceID == 0 {
		return models.ChatLocation{}, ErrInvalidInput
	}

	if !s.allowLocationUpdate(userID, serviceID) {
		return models.ChatLocation{}, ErrRateLimited
	}

	var location models.ChatLocation
	err := config.WithTransaction(ctx, config.DB, func(txCtx context.Context) error {
		serviceModel, err := s.access.GetAccessibleService(txCtx, userID, serviceID)
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

		location = models.ChatLocation{
			UserID:    userID,
			RoomID:    room.ID,
			ServiceID: serviceID,
			Latitude:  latitude,
			Longitude: longitude,
			UpdatedAt: time.Now().UTC(),
		}
		return s.locationRepo.Upsert(txCtx, &location)
	})
	if err != nil {
		return models.ChatLocation{}, err
	}
	return location, nil
}

func (s *LocationService) ListLocations(ctx context.Context, userID uint, serviceID uint) ([]models.ChatLocation, error) {
	if _, err := s.access.GetAccessibleService(ctx, userID, serviceID); err != nil {
		return nil, err
	}
	return s.locationRepo.ListByService(ctx, serviceID)
}

func (s *LocationService) allowLocationUpdate(userID uint, serviceID uint) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := fmt.Sprintf("%d:%d", userID, serviceID)
	now := time.Now()
	last, exists := s.lastPublished[key]
	if exists && now.Sub(last) < s.minInterval {
		return false
	}

	s.lastPublished[key] = now
	return true
}
