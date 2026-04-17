package handlers

import (
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"limpae/go/src/config"
	"limpae/go/src/constants"
	"limpae/go/src/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupFlowTestDB(t *testing.T) *gorm.DB {
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
		&models.AddressRoom{},
		&models.Diarists{},
		&models.UserProfile{},
		&models.Offer{},
		&models.OfferNegotiation{},
		&models.Service{},
		&models.Payment{},
		&models.Subscription{},
		&models.StripeWebhookEvent{},
		&models.Review{},
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

func seedUser(t *testing.T, db *gorm.DB, suffix string, role string) models.User {
	t.Helper()

	user := models.User{
		Name:         "User " + suffix,
		Photo:        "photo-" + suffix,
		Email:        fmt.Sprintf("%s@example.com", suffix),
		Phone:        5500000000 + int64(len(suffix))*10 + int64(time.Now().Nanosecond()%9),
		Cpf:          fmt.Sprintf("cpf-%s", suffix),
		PasswordHash: "hash",
		Role:         role,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	return user
}

func seedOffer(t *testing.T, db *gorm.DB) (models.User, models.User, models.Address, models.Offer) {
	t.Helper()

	client := seedUser(t, db, t.Name()+"-client", "cliente")
	diarist := seedUser(t, db, t.Name()+"-diarist", "diarista")
	address := models.Address{
		UserID:    client.ID,
		Street:    "Rua A",
		Number:    "1",
		City:      "Cidade",
		State:     "SP",
		Zipcode:   "00000-000",
		Latitude:  -23.5,
		Longitude: -46.6,
	}
	if err := db.Create(&address).Error; err != nil {
		t.Fatalf("create address: %v", err)
	}

	offer := models.Offer{
		ClientID:      client.ID,
		AddressID:     &address.ID,
		ServiceType:   "limpeza",
		ScheduledAt:   time.Now().UTC().Add(24 * time.Hour),
		DurationHours: 4,
		InitialValue:  120,
		CurrentValue:  120,
		Status:        "aberta",
		Observations:  "obs",
	}
	if err := db.Create(&offer).Error; err != nil {
		t.Fatalf("create offer: %v", err)
	}

	return client, diarist, address, offer
}

func TestAcceptOfferTxCreatesServiceAndLinksOffer(t *testing.T) {
	db := setupFlowTestDB(t)
	_, diarist, _, offer := seedOffer(t, db)

	var acceptedOffer models.Offer
	var createdService models.Service
	if err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		acceptedOffer, createdService, err = acceptOfferTx(tx, offer.ID, diarist.ID)
		return err
	}); err != nil {
		t.Fatalf("accept offer tx: %v", err)
	}

	if acceptedOffer.Status != "aceita" {
		t.Fatalf("offer status = %q, want aceita", acceptedOffer.Status)
	}
	if acceptedOffer.AcceptedByDiaristID == nil || *acceptedOffer.AcceptedByDiaristID != diarist.ID {
		t.Fatalf("accepted_by_diarist_id = %v, want %d", acceptedOffer.AcceptedByDiaristID, diarist.ID)
	}
	if createdService.OfferID == nil || *createdService.OfferID != offer.ID {
		t.Fatalf("service offer_id = %v, want %d", createdService.OfferID, offer.ID)
	}
	if createdService.Status != constants.StatusAccepted {
		t.Fatalf("service status = %q, want %q", createdService.Status, constants.StatusAccepted)
	}
}

func TestAcceptOfferTxRollsBackWhenServiceCreateFails(t *testing.T) {
	db := setupFlowTestDB(t)
	_, diarist, _, offer := seedOffer(t, db)

	callbackName := "fail_service_create_for_tx_test"
	if err := db.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Schema != nil && tx.Statement.Schema.Table == "services" {
			tx.AddError(errors.New("boom"))
		}
	}); err != nil {
		t.Fatalf("register callback: %v", err)
	}
	defer db.Callback().Create().Remove(callbackName)

	err := db.Transaction(func(tx *gorm.DB) error {
		_, _, flowErr := acceptOfferTx(tx, offer.ID, diarist.ID)
		return flowErr
	})
	if err == nil {
		t.Fatal("expected transaction error")
	}

	var persistedOffer models.Offer
	if err := db.First(&persistedOffer, offer.ID).Error; err != nil {
		t.Fatalf("reload offer: %v", err)
	}
	if persistedOffer.Status != "aberta" {
		t.Fatalf("offer status after rollback = %q, want aberta", persistedOffer.Status)
	}

	var serviceCount int64
	if err := db.Model(&models.Service{}).Count(&serviceCount).Error; err != nil {
		t.Fatalf("count services: %v", err)
	}
	if serviceCount != 0 {
		t.Fatalf("service count after rollback = %d, want 0", serviceCount)
	}
}

func TestAcceptOfferTxConcurrentSingleWinner(t *testing.T) {
	db := setupFlowTestDB(t)
	_, diaristA, _, offer := seedOffer(t, db)
	diaristB := seedUser(t, db, t.Name()+"-other", "diarista")

	start := make(chan struct{})
	errs := make([]error, 2)
	diarists := []models.User{diaristA, diaristB}

	var wg sync.WaitGroup
	for index := range diarists {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			errs[i] = db.Transaction(func(tx *gorm.DB) error {
				_, _, flowErr := acceptOfferTx(tx, offer.ID, diarists[i].ID)
				return flowErr
			})
		}(index)
	}

	close(start)
	wg.Wait()

	successes := 0
	for _, err := range errs {
		if err == nil {
			successes++
		}
	}
	if successes != 1 {
		t.Fatalf("successes = %d, want 1 (errs=%v)", successes, errs)
	}

	var serviceCount int64
	if err := db.Model(&models.Service{}).Count(&serviceCount).Error; err != nil {
		t.Fatalf("count services: %v", err)
	}
	if serviceCount != 1 {
		t.Fatalf("service count = %d, want 1", serviceCount)
	}
}

func TestAcceptNegotiationTxRejectsOtherPendingNegotiations(t *testing.T) {
	db := setupFlowTestDB(t)
	client, diaristA, address, offer := seedOffer(t, db)
	diaristB := seedUser(t, db, t.Name()+"-b", "diarista")

	offer.AddressID = &address.ID
	if err := db.Save(&offer).Error; err != nil {
		t.Fatalf("save offer: %v", err)
	}

	negA := models.OfferNegotiation{OfferID: offer.ID, DiaristID: diaristA.ID, CounterValue: 130, CounterDurationHours: 4, Status: "pendente"}
	negB := models.OfferNegotiation{OfferID: offer.ID, DiaristID: diaristB.ID, CounterValue: 140, CounterDurationHours: 5, Status: "pendente"}
	if err := db.Create(&negA).Error; err != nil {
		t.Fatalf("create negA: %v", err)
	}
	if err := db.Create(&negB).Error; err != nil {
		t.Fatalf("create negB: %v", err)
	}

	var acceptedOffer models.Offer
	var acceptedNegotiation models.OfferNegotiation
	var createdService models.Service
	if err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		acceptedOffer, acceptedNegotiation, createdService, err = acceptNegotiationTx(tx, offer.ID, negA.ID, client.ID)
		return err
	}); err != nil {
		t.Fatalf("accept negotiation: %v", err)
	}

	if acceptedOffer.Status != "aceita" || acceptedNegotiation.Status != "aceita" {
		t.Fatalf("unexpected accepted states: offer=%q negotiation=%q", acceptedOffer.Status, acceptedNegotiation.Status)
	}
	if createdService.OfferID == nil || *createdService.OfferID != offer.ID {
		t.Fatalf("service offer_id = %v, want %d", createdService.OfferID, offer.ID)
	}

	var refreshedNegB models.OfferNegotiation
	if err := db.First(&refreshedNegB, negB.ID).Error; err != nil {
		t.Fatalf("reload negB: %v", err)
	}
	if refreshedNegB.Status != "recusada" {
		t.Fatalf("negB status = %q, want recusada", refreshedNegB.Status)
	}
}

func TestCancelOfferTxRejectsPendingNegotiations(t *testing.T) {
	db := setupFlowTestDB(t)
	client, diarist, _, offer := seedOffer(t, db)

	neg := models.OfferNegotiation{
		OfferID:              offer.ID,
		DiaristID:            diarist.ID,
		CounterValue:         125,
		CounterDurationHours: 4,
		Status:               "pendente",
	}
	if err := db.Create(&neg).Error; err != nil {
		t.Fatalf("create negotiation: %v", err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		_, err := cancelOfferTx(tx, offer.ID, client.ID, "motivo de teste")
		return err
	}); err != nil {
		t.Fatalf("cancel offer: %v", err)
	}

	var refreshedOffer models.Offer
	if err := db.First(&refreshedOffer, offer.ID).Error; err != nil {
		t.Fatalf("reload offer: %v", err)
	}
	if refreshedOffer.Status != "cancelada" {
		t.Fatalf("offer status = %q, want cancelada", refreshedOffer.Status)
	}

	var refreshedNeg models.OfferNegotiation
	if err := db.First(&refreshedNeg, neg.ID).Error; err != nil {
		t.Fatalf("reload negotiation: %v", err)
	}
	if refreshedNeg.Status != "recusada" {
		t.Fatalf("negotiation status = %q, want recusada", refreshedNeg.Status)
	}
}

func TestStartServiceWithPINTxMovesAcceptedServiceToInJourney(t *testing.T) {
	db := setupFlowTestDB(t)
	client, diarist, _, offer := seedOffer(t, db)

	var createdService models.Service
	if err := db.Transaction(func(tx *gorm.DB) error {
		_, service, err := acceptOfferTx(tx, offer.ID, diarist.ID)
		createdService = service
		return err
	}); err != nil {
		t.Fatalf("accept offer: %v", err)
	}

	phone := fmt.Sprintf("%d", client.Phone)
	pin := phone[len(phone)-4:]

	var updatedService models.Service
	if err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		updatedService, err = startServiceWithPINTx(tx, createdService.ID, diarist.ID, pin)
		return err
	}); err != nil {
		t.Fatalf("start service with pin: %v", err)
	}

	if updatedService.Status != constants.StatusInJourney {
		t.Fatalf("service status = %q, want %q", updatedService.Status, constants.StatusInJourney)
	}
}

func TestUpdateServiceActionTxCompleteAcceptsJourneyStage(t *testing.T) {
	db := setupFlowTestDB(t)
	_, diarist, _, offer := seedOffer(t, db)

	var createdService models.Service
	if err := db.Transaction(func(tx *gorm.DB) error {
		_, service, err := acceptOfferTx(tx, offer.ID, diarist.ID)
		createdService = service
		return err
	}); err != nil {
		t.Fatalf("accept offer: %v", err)
	}

	if err := db.Model(&models.Service{}).Where("id = ?", createdService.ID).Update("status", constants.StatusInJourney).Error; err != nil {
		t.Fatalf("set service status: %v", err)
	}

	var completedService models.Service
	if err := db.Transaction(func(tx *gorm.DB) error {
		var err error
		completedService, err = updateServiceActionTx(tx, createdService.ID, "complete", diarist.ID, "")
		return err
	}); err != nil {
		t.Fatalf("complete service: %v", err)
	}

	if completedService.Status != constants.StatusCompleted {
		t.Fatalf("service status = %q, want %q", completedService.Status, constants.StatusCompleted)
	}
	if completedService.CompletedAt == nil {
		t.Fatal("expected completed_at to be set")
	}
}
