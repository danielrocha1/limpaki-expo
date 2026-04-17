package repository

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"gorm.io/gorm"
)

type RoomRepository interface {
	ListByUser(ctx context.Context, userID uint) ([]models.ChatRoom, error)
	Create(ctx context.Context, userIDs []uint) (models.ChatRoom, error)
	FindByExactUsers(ctx context.Context, userIDs []uint) (models.ChatRoom, bool, error)
	UserBelongsToRoom(ctx context.Context, userID uint, roomID uint) (bool, error)
	UserBelongsToRooms(ctx context.Context, userID uint, roomIDs []uint) (map[uint]bool, error)
	CountUsersByRoom(ctx context.Context, roomID uint) (int64, error)
}

type GormRoomRepository struct {
	db *gorm.DB
}

func NewRoomRepository(db *gorm.DB) *GormRoomRepository {
	return &GormRoomRepository{db: db}
}

func (r *GormRoomRepository) ListByUser(ctx context.Context, userID uint) ([]models.ChatRoom, error) {
	var rooms []models.ChatRoom
	err := config.DBFromContext(ctx, r.db).WithContext(ctx).
		Model(&models.ChatRoom{}).
		Joins("JOIN chat_room_users ON chat_room_users.room_id = chat_rooms.id").
		Where("chat_room_users.user_id = ?", userID).
		Order("chat_rooms.created_at DESC").
		Find(&rooms).Error
	if err != nil {
		return nil, err
	}

	for index := range rooms {
		if err := r.loadRoomUsers(ctx, &rooms[index]); err != nil {
			return nil, err
		}
	}

	return rooms, nil
}

func (r *GormRoomRepository) Create(ctx context.Context, userIDs []uint) (models.ChatRoom, error) {
	room := models.ChatRoom{}
	if len(userIDs) == 0 {
		return room, errors.New("room must contain at least one user")
	}

	fingerprint := roomFingerprint(userIDs)
	db := config.DBFromContext(ctx, r.db).WithContext(ctx)

	for attempt := 0; attempt < 5; attempt++ {
		existing, found, err := r.findByFingerprint(ctx, fingerprint)
		if err != nil {
			return room, err
		}
		if found {
			return existing, nil
		}

		fingerprintCopy := fingerprint
		room = models.ChatRoom{Fingerprint: &fingerprintCopy}
		if err := db.Create(&room).Error; err != nil {
			existing, found, findErr := r.waitForRoomByFingerprint(ctx, fingerprint)
			if findErr == nil && found {
				return existing, nil
			}
			if isRetryableRoomError(err) {
				time.Sleep(10 * time.Millisecond)
				continue
			}
			return models.ChatRoom{}, err
		}

		roomUsers := make([]models.ChatRoomUser, 0, len(userIDs))
		for _, userID := range userIDs {
			roomUsers = append(roomUsers, models.ChatRoomUser{
				RoomID: room.ID,
				UserID: userID,
			})
		}

		if err := db.Create(&roomUsers).Error; err != nil {
			if isRetryableRoomError(err) {
				time.Sleep(10 * time.Millisecond)
				continue
			}
			return models.ChatRoom{}, err
		}

		if err := db.First(&room, room.ID).Error; err != nil {
			if isRetryableRoomError(err) {
				time.Sleep(10 * time.Millisecond)
				continue
			}
			return models.ChatRoom{}, err
		}
		if err := r.loadRoomUsersWithDB(ctx, db, &room); err != nil {
			if isRetryableRoomError(err) {
				time.Sleep(10 * time.Millisecond)
				continue
			}
			return models.ChatRoom{}, err
		}
		return room, nil
	}

	return models.ChatRoom{}, errors.New("failed to create room after retries")
}

func (r *GormRoomRepository) FindByExactUsers(ctx context.Context, userIDs []uint) (models.ChatRoom, bool, error) {
	if len(userIDs) == 0 {
		return models.ChatRoom{}, false, nil
	}

	if room, found, err := r.findByFingerprint(ctx, roomFingerprint(userIDs)); err != nil || found {
		return room, found, err
	}

	rooms, err := r.ListByUser(ctx, userIDs[0])
	if err != nil {
		return models.ChatRoom{}, false, err
	}

	expectedUsers := append([]uint(nil), userIDs...)
	slices.Sort(expectedUsers)

	for _, room := range rooms {
		if len(room.Users) != len(expectedUsers) {
			continue
		}

		roomUsers := make([]uint, 0, len(room.Users))
		for _, user := range room.Users {
			roomUsers = append(roomUsers, user.ID)
		}
		slices.Sort(roomUsers)

		if slices.Equal(roomUsers, expectedUsers) {
			return room, true, nil
		}
	}

	return models.ChatRoom{}, false, nil
}

func (r *GormRoomRepository) UserBelongsToRoom(ctx context.Context, userID uint, roomID uint) (bool, error) {
	var count int64
	err := config.DBFromContext(ctx, r.db).WithContext(ctx).Model(&models.ChatRoomUser{}).
		Where("room_id = ? AND user_id = ?", roomID, userID).
		Count(&count).Error
	return count > 0, err
}

func (r *GormRoomRepository) UserBelongsToRooms(ctx context.Context, userID uint, roomIDs []uint) (map[uint]bool, error) {
	allowed := make(map[uint]bool, len(roomIDs))
	if len(roomIDs) == 0 {
		return allowed, nil
	}

	var rows []models.ChatRoomUser
	err := config.DBFromContext(ctx, r.db).WithContext(ctx).Model(&models.ChatRoomUser{}).
		Where("user_id = ? AND room_id IN ?", userID, roomIDs).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		allowed[row.RoomID] = true
	}
	return allowed, nil
}

func (r *GormRoomRepository) CountUsersByRoom(ctx context.Context, roomID uint) (int64, error) {
	var count int64
	err := config.DBFromContext(ctx, r.db).WithContext(ctx).Model(&models.ChatRoomUser{}).
		Where("room_id = ?", roomID).
		Count(&count).Error
	return count, err
}

func (r *GormRoomRepository) loadRoomUsers(ctx context.Context, room *models.ChatRoom) error {
	return r.loadRoomUsersWithDB(ctx, config.DBFromContext(ctx, r.db).WithContext(ctx), room)
}

func (r *GormRoomRepository) loadRoomUsersWithDB(ctx context.Context, db *gorm.DB, room *models.ChatRoom) error {
	if room == nil || room.ID == 0 {
		return nil
	}

	var users []models.User
	if err := db.WithContext(ctx).
		Model(&models.User{}).
		Joins("JOIN chat_room_users ON chat_room_users.user_id = users.id").
		Where("chat_room_users.room_id = ?", room.ID).
		Find(&users).Error; err != nil {
		return err
	}

	room.Users = users
	return nil
}

func (r *GormRoomRepository) findByFingerprint(ctx context.Context, fingerprint string) (models.ChatRoom, bool, error) {
	var room models.ChatRoom
	err := config.DBFromContext(ctx, r.db).WithContext(ctx).
		Where("fingerprint = ?", fingerprint).
		First(&room).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.ChatRoom{}, false, nil
	}
	if err != nil {
		return models.ChatRoom{}, false, err
	}

	if err := r.loadRoomUsers(ctx, &room); err != nil {
		return models.ChatRoom{}, false, err
	}
	return room, true, nil
}

func roomFingerprint(userIDs []uint) string {
	normalized := append([]uint(nil), userIDs...)
	slices.Sort(normalized)
	parts := make([]string, 0, len(normalized))
	for _, userID := range normalized {
		parts = append(parts, fmt.Sprintf("%d", userID))
	}
	return strings.Join(parts, ":")
}

func (r *GormRoomRepository) waitForRoomByFingerprint(ctx context.Context, fingerprint string) (models.ChatRoom, bool, error) {
	var lastErr error
	for attempt := 0; attempt < 10; attempt++ {
		room, found, err := r.findByFingerprint(ctx, fingerprint)
		if err == nil || found {
			return room, found, err
		}
		lastErr = err
		time.Sleep(10 * time.Millisecond)
	}
	return models.ChatRoom{}, false, lastErr
}

func isRetryableRoomError(err error) bool {
	if err == nil {
		return false
	}
	normalized := strings.ToLower(err.Error())
	return strings.Contains(normalized, "locked") || strings.Contains(normalized, "deadlocked")
}
