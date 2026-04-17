package service

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"limpae/go/src/chat/repository"
	"limpae/go/src/config"
	"limpae/go/src/constants"
	"limpae/go/src/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupChatTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared&_fk=1&_busy_timeout=5000", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db handle: %v", err)
	}
	sqlDB.SetMaxOpenConns(10)
	t.Cleanup(func() {
		_ = sqlDB.Close()
	})

	oldDB := config.DB
	config.DB = db
	t.Cleanup(func() {
		config.DB = oldDB
	})

	if err := db.AutoMigrate(
		&models.User{},
		&models.Address{},
		&models.Diarists{},
		&models.UserProfile{},
		&models.Offer{},
		&models.OfferNegotiation{},
		&models.Service{},
		&models.ChatRoom{},
		&models.ChatRoomUser{},
		&models.ChatMessage{},
		&models.ChatMessageRead{},
		&models.ChatLocation{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func seedChatUser(t *testing.T, db *gorm.DB, suffix string, role string) models.User {
	t.Helper()

	user := models.User{
		Name:         suffix,
		Photo:        suffix + ".jpg",
		Email:        suffix + "@example.com",
		Phone:        5511000000 + int64(len(suffix))*10 + int64(time.Now().Nanosecond()%9),
		Cpf:          "cpf-" + suffix,
		PasswordHash: "hash",
		Role:         role,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	return user
}

func seedChatService(t *testing.T, db *gorm.DB) (models.User, models.User, models.Service) {
	t.Helper()

	client := seedChatUser(t, db, t.Name()+"-client", "cliente")
	diarist := seedChatUser(t, db, t.Name()+"-diarist", "diarista")
	serviceModel := models.Service{
		ClientID:      client.ID,
		DiaristID:     diarist.ID,
		Status:        constants.StatusPending,
		TotalPrice:    100,
		DurationHours: 4,
		ScheduledAt:   time.Now().UTC().Add(2 * time.Hour),
		ServiceType:   "limpeza",
	}
	if err := db.Create(&serviceModel).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}
	return client, diarist, serviceModel
}

func TestMessageServiceCreateMessageReusesSingleRoomOnRepeatedSend(t *testing.T) {
	db := setupChatTestDB(t)
	client, _, serviceModel := seedChatService(t, db)

	access := NewServiceAccessService(repository.NewServiceRepository(db))
	messageService := NewMessageService(access, repository.NewMessageRepository(db), repository.NewRoomRepository(db))

	for i := 0; i < 2; i++ {
		if _, err := messageService.CreateMessage(context.Background(), client.ID, serviceModel.ID, fmt.Sprintf("msg-%d", i)); err != nil {
			t.Fatalf("unexpected create message error: %v", err)
		}
	}

	var roomCount int64
	if err := db.Model(&models.ChatRoom{}).Count(&roomCount).Error; err != nil {
		t.Fatalf("count rooms: %v", err)
	}
	if roomCount != 1 {
		t.Fatalf("room count = %d, want 1", roomCount)
	}

	var messageCount int64
	if err := db.Model(&models.ChatMessage{}).Count(&messageCount).Error; err != nil {
		t.Fatalf("count messages: %v", err)
	}
	if messageCount != 2 {
		t.Fatalf("message count = %d, want 2", messageCount)
	}
}

func TestLocationServiceUpdateLocationUpsertsSingleRow(t *testing.T) {
	db := setupChatTestDB(t)
	client, _, serviceModel := seedChatService(t, db)

	access := NewServiceAccessService(repository.NewServiceRepository(db))
	locationService := NewLocationService(access, repository.NewLocationRepository(db), repository.NewRoomRepository(db), 0)

	if _, err := locationService.UpdateLocation(context.Background(), client.ID, serviceModel.ID, -23.5, -46.6); err != nil {
		t.Fatalf("first location update: %v", err)
	}
	if _, err := locationService.UpdateLocation(context.Background(), client.ID, serviceModel.ID, -23.6, -46.7); err != nil {
		t.Fatalf("second location update: %v", err)
	}

	var rows []models.ChatLocation
	if err := db.Find(&rows).Error; err != nil {
		t.Fatalf("load locations: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("location rows = %d, want 1", len(rows))
	}
	if rows[0].Latitude != -23.6 || rows[0].Longitude != -46.7 {
		t.Fatalf("stored location = (%f,%f), want (-23.6,-46.7)", rows[0].Latitude, rows[0].Longitude)
	}
}

func TestMessageServiceGetMessagesAllowsParticipantAndRejectsOutsider(t *testing.T) {
	db := setupChatTestDB(t)
	client, diarist, serviceModel := seedChatService(t, db)
	outsider := seedChatUser(t, db, t.Name()+"-outsider", "cliente")

	access := NewServiceAccessService(repository.NewServiceRepository(db))
	messageService := NewMessageService(access, repository.NewMessageRepository(db), repository.NewRoomRepository(db))

	if _, err := messageService.CreateMessage(context.Background(), client.ID, serviceModel.ID, "hello"); err != nil {
		t.Fatalf("create message: %v", err)
	}

	messages, total, err := messageService.GetMessages(context.Background(), diarist.ID, serviceModel.ID, 1, 20)
	if err != nil {
		t.Fatalf("participant get messages: %v", err)
	}
	if total != 1 || len(messages) != 1 {
		t.Fatalf("messages total=%d len=%d, want 1/1", total, len(messages))
	}

	_, _, err = messageService.GetMessages(context.Background(), outsider.ID, serviceModel.ID, 1, 20)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("outsider error = %v, want ErrForbidden", err)
	}
}

func TestLocationServiceListLocationsAllowsParticipantAndRejectsOutsider(t *testing.T) {
	db := setupChatTestDB(t)
	client, diarist, serviceModel := seedChatService(t, db)
	outsider := seedChatUser(t, db, t.Name()+"-outsider-location", "cliente")

	access := NewServiceAccessService(repository.NewServiceRepository(db))
	locationService := NewLocationService(access, repository.NewLocationRepository(db), repository.NewRoomRepository(db), 0)

	if _, err := locationService.UpdateLocation(context.Background(), client.ID, serviceModel.ID, -23.5, -46.6); err != nil {
		t.Fatalf("update location: %v", err)
	}

	locations, err := locationService.ListLocations(context.Background(), diarist.ID, serviceModel.ID)
	if err != nil {
		t.Fatalf("participant list locations: %v", err)
	}
	if len(locations) != 1 {
		t.Fatalf("locations len = %d, want 1", len(locations))
	}

	_, err = locationService.ListLocations(context.Background(), outsider.ID, serviceModel.ID)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("outsider error = %v, want ErrForbidden", err)
	}
}
