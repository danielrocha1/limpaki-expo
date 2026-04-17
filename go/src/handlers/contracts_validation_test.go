package handlers

import (
	"bytes"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
)

func TestUpdateUserRejectsProtectedExtraField(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-user", "cliente")

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Put("/users/:id", UpdateUser)
	})

	payload := `{"name":"Novo Nome","email":"novo@example.com","phone":"11999999999","role":"diarista"}`
	req := httptest.NewRequest("PUT", "/users/"+strconv.Itoa(int(user.ID)), bytes.NewBufferString(payload))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestCreateOfferRejectsProtectedFieldAndValidatesBody(t *testing.T) {
	db := setupFlowTestDB(t)
	client := seedUser(t, db, t.Name()+"-client", "cliente")
	address := models.Address{UserID: client.ID, Street: "Rua A", Number: "1", Neighborhood: "Centro", City: "Sao Paulo", State: "SP", Zipcode: "01001-000"}
	if err := db.Create(&address).Error; err != nil {
		t.Fatalf("create address: %v", err)
	}

	app := testAppWithUser(client.ID, func(app *fiber.App) {
		app.Post("/offers", CreateOffer)
	})

	payload := `{"address_id":` + strconv.Itoa(int(address.ID)) + `,"service_type":"limpeza","scheduled_at":"` + time.Now().Add(2*time.Hour).Format(time.RFC3339) + `","duration_hours":4,"initial_value":120,"client_id":999}`
	req := httptest.NewRequest("POST", "/offers", bytes.NewBufferString(payload))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestCreateSubscriptionRejectsInvalidPlan(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-sub-user", "cliente")

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Post("/subscriptions", CreateSubscription)
	})

	req := httptest.NewRequest("POST", "/subscriptions", bytes.NewBufferString(`{"plan":"enterprise"}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestCreateAddressRequiresMandatoryFields(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-address-user", "cliente")

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Post("/addresses", CreateAddress)
	})

	req := httptest.NewRequest("POST", "/addresses", bytes.NewBufferString(`{"city":"Sao Paulo","state":"SP","zipcode":"01001-000"}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestGetUserResponseDoesNotLeakPasswordHash(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-safe-user", "cliente")

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Get("/users/:id", GetUser)
	})

	req := httptest.NewRequest("GET", "/users/"+strconv.Itoa(int(user.ID)), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var body bytes.Buffer
	if _, err := body.ReadFrom(resp.Body); err != nil {
		t.Fatalf("read body: %v", err)
	}
	if strings.Contains(body.String(), "password_hash") {
		t.Fatalf("response leaked password_hash: %s", body.String())
	}
}
