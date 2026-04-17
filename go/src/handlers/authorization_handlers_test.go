package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"
	"time"

	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
)

func testAppWithUser(userID uint, register func(app *fiber.App)) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	register(app)
	return app
}

func TestGetOfferByIDAllowsOwnerAndHidesOtherClient(t *testing.T) {
	db := setupFlowTestDB(t)
	client, _, _, offer := seedOffer(t, db)
	otherClient := seedUser(t, db, t.Name()+"-other-client", "cliente")

	ownerApp := testAppWithUser(client.ID, func(app *fiber.App) {
		app.Get("/offers/:id", GetOfferByID)
	})
	ownerReq := httptest.NewRequest("GET", fmt.Sprintf("/offers/%d", offer.ID), nil)
	ownerResp, err := ownerApp.Test(ownerReq)
	if err != nil {
		t.Fatalf("owner request: %v", err)
	}
	if ownerResp.StatusCode != fiber.StatusOK {
		t.Fatalf("owner status = %d, want 200", ownerResp.StatusCode)
	}

	otherApp := testAppWithUser(otherClient.ID, func(app *fiber.App) {
		app.Get("/offers/:id", GetOfferByID)
	})
	otherReq := httptest.NewRequest("GET", fmt.Sprintf("/offers/%d", offer.ID), nil)
	otherResp, err := otherApp.Test(otherReq)
	if err != nil {
		t.Fatalf("other request: %v", err)
	}
	if otherResp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("other client status = %d, want 404", otherResp.StatusCode)
	}

	var refreshed models.Offer
	if err := db.First(&refreshed, offer.ID).Error; err != nil {
		t.Fatalf("reload offer: %v", err)
	}
}

func TestUpdateServiceRejectsNonParticipant(t *testing.T) {
	db := setupFlowTestDB(t)
	client, diarist, address, _ := seedOffer(t, db)
	outsider := seedUser(t, db, t.Name()+"-outsider", "cliente")

	serviceModel := models.Service{
		ClientID:      client.ID,
		DiaristID:     diarist.ID,
		AddressID:     &address.ID,
		Status:        "pendente",
		TotalPrice:    100,
		DurationHours: 4,
		ScheduledAt:   time.Now().UTC().Add(24 * time.Hour),
		ServiceType:   "limpeza",
	}
	if err := db.Create(&serviceModel).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	app := testAppWithUser(outsider.ID, func(app *fiber.App) {
		app.Put("/services/:id/:action", UpdateService)
	})

	req := httptest.NewRequest("PUT", fmt.Sprintf("/services/%d/cancel", serviceModel.ID), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("status = %d, want 403", resp.StatusCode)
	}
}

func TestGetPaymentRejectsThirdParty(t *testing.T) {
	db := setupFlowTestDB(t)
	client, diarist, address, _ := seedOffer(t, db)
	outsider := seedUser(t, db, t.Name()+"-outsider-payment", "cliente")

	serviceModel := models.Service{
		ClientID:      client.ID,
		DiaristID:     diarist.ID,
		AddressID:     &address.ID,
		Status:        "aceito",
		TotalPrice:    150,
		DurationHours: 4,
		ScheduledAt:   time.Now().UTC().Add(24 * time.Hour),
		ServiceType:   "limpeza",
	}
	if err := db.Create(&serviceModel).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	payment := models.Payment{
		ServiceID: serviceModel.ID,
		ClientID:  client.ID,
		DiaristID: diarist.ID,
		Amount:    150,
		Status:    "pendente",
	}
	if err := db.Create(&payment).Error; err != nil {
		t.Fatalf("create payment: %v", err)
	}

	app := testAppWithUser(outsider.ID, func(app *fiber.App) {
		app.Get("/payments/:id", GetPayment)
	})

	req := httptest.NewRequest("GET", fmt.Sprintf("/payments/%d", payment.ID), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
}

func TestCreateReviewRejectsNonParticipant(t *testing.T) {
	db := setupFlowTestDB(t)
	client, diarist, address, _ := seedOffer(t, db)
	outsider := seedUser(t, db, t.Name()+"-outsider-review", "cliente")

	serviceModel := models.Service{
		ClientID:      client.ID,
		DiaristID:     diarist.ID,
		AddressID:     &address.ID,
		Status:        "concluído",
		TotalPrice:    180,
		DurationHours: 5,
		ScheduledAt:   time.Now().UTC().Add(-24 * time.Hour),
		ServiceType:   "limpeza",
	}
	if err := db.Create(&serviceModel).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"service_id":      serviceModel.ID,
		"client_comment":  "ok",
		"client_rating":   5,
		"diarist_comment": "",
	})

	app := testAppWithUser(outsider.ID, func(app *fiber.App) {
		app.Post("/reviews", CreateReview)
	})

	req := httptest.NewRequest("POST", "/reviews", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
}

func TestGetServicesByClientIDIncludesStartPINForClient(t *testing.T) {
	db := setupFlowTestDB(t)
	client, diarist, address, _ := seedOffer(t, db)

	serviceModel := models.Service{
		ClientID:      client.ID,
		DiaristID:     diarist.ID,
		AddressID:     &address.ID,
		Status:        "aceito",
		TotalPrice:    100,
		DurationHours: 4,
		ScheduledAt:   time.Now().UTC().Add(24 * time.Hour),
		ServiceType:   "limpeza",
	}
	if err := db.Create(&serviceModel).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	app := testAppWithUser(client.ID, func(app *fiber.App) {
		app.Get("/services/my", GetServicesByClientID)
	})

	req := httptest.NewRequest("GET", "/services/my?status_group=active", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var payload struct {
		Items []ServiceResponseDTO `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("items len = %d, want 1", len(payload.Items))
	}

	phone := fmt.Sprintf("%d", client.Phone)
	wantPIN := phone[len(phone)-4:]
	if payload.Items[0].StartPIN != wantPIN {
		t.Fatalf("start_pin = %q, want %q", payload.Items[0].StartPIN, wantPIN)
	}
}

func TestGetServicesByClientIDOmitsStartPINForDiarist(t *testing.T) {
	db := setupFlowTestDB(t)
	client, diarist, address, _ := seedOffer(t, db)

	serviceModel := models.Service{
		ClientID:      client.ID,
		DiaristID:     diarist.ID,
		AddressID:     &address.ID,
		Status:        "aceito",
		TotalPrice:    100,
		DurationHours: 4,
		ScheduledAt:   time.Now().UTC().Add(24 * time.Hour),
		ServiceType:   "limpeza",
	}
	if err := db.Create(&serviceModel).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	app := testAppWithUser(diarist.ID, func(app *fiber.App) {
		app.Get("/services/my", GetServicesByClientID)
	})

	req := httptest.NewRequest("GET", "/services/my?status_group=active", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var payload struct {
		Items []ServiceResponseDTO `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("items len = %d, want 1", len(payload.Items))
	}
	if payload.Items[0].StartPIN != "" {
		t.Fatalf("start_pin = %q, want empty", payload.Items[0].StartPIN)
	}
}
