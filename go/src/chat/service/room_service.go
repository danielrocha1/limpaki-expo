package service

import (
	"context"
	"slices"

	"limpae/go/src/chat/repository"
	"limpae/go/src/config"
	"limpae/go/src/models"
)

type RoomService struct {
	roomRepo repository.RoomRepository
	userRepo repository.UserRepository
}

func NewRoomService(roomRepo repository.RoomRepository, userRepo repository.UserRepository) *RoomService {
	return &RoomService{roomRepo: roomRepo, userRepo: userRepo}
}

func (s *RoomService) ListRooms(ctx context.Context, userID uint) ([]models.ChatRoom, error) {
	return s.roomRepo.ListByUser(ctx, userID)
}

func (s *RoomService) CreateRoom(ctx context.Context, requesterID uint, userIDs []uint) (models.ChatRoom, error) {
	normalized := uniqueUserIDs(append(userIDs, requesterID))
	if len(normalized) == 0 {
		return models.ChatRoom{}, ErrInvalidInput
	}

	count, err := s.userRepo.CountByIDs(ctx, normalized)
	if err != nil {
		return models.ChatRoom{}, err
	}
	if int(count) != len(normalized) {
		return models.ChatRoom{}, ErrInvalidInput
	}

	var room models.ChatRoom
	err = config.WithTransaction(ctx, config.DB, func(txCtx context.Context) error {
		existingRoom, found, err := s.roomRepo.FindByExactUsers(txCtx, normalized)
		if err != nil {
			return err
		}
		if found {
			room = existingRoom
			return nil
		}

		room, err = s.roomRepo.Create(txCtx, normalized)
		return err
	})
	if err != nil {
		return models.ChatRoom{}, err
	}
	return room, nil
}

func (s *RoomService) EnsureMembership(ctx context.Context, userID uint, roomID uint) error {
	allowed, err := s.roomRepo.UserBelongsToRoom(ctx, userID, roomID)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}
	return nil
}

func (s *RoomService) FilterAllowedRooms(ctx context.Context, userID uint, roomIDs []uint) ([]uint, error) {
	if len(roomIDs) == 0 {
		return nil, ErrNoRoomsSelected
	}

	membership, err := s.roomRepo.UserBelongsToRooms(ctx, userID, roomIDs)
	if err != nil {
		return nil, err
	}

	filtered := make([]uint, 0, len(roomIDs))
	for _, roomID := range roomIDs {
		if membership[roomID] {
			filtered = append(filtered, roomID)
		}
	}

	if len(filtered) == 0 {
		return nil, ErrForbidden
	}

	slices.Sort(filtered)
	return filtered, nil
}

func uniqueUserIDs(userIDs []uint) []uint {
	seen := make(map[uint]struct{}, len(userIDs))
	out := make([]uint, 0, len(userIDs))
	for _, id := range userIDs {
		if id == 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}
