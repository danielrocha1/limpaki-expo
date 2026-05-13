package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
)

func restoreMercadoPagoFuncs() func() {
	origPref := createMercadoPagoPreferenceFunc
	origPay := getMercadoPagoPaymentFunc
	return func() {
		createMercadoPagoPreferenceFunc = origPref
		getMercadoPagoPaymentFunc = origPay
	}
}

func TestCreateCheckoutSessionWithValidPlan(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-checkout", "cliente")
	t.Setenv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-TOKEN")

	restore := restoreMercadoPagoFuncs()
	defer restore()

	createMercadoPagoPreferenceFunc = func(accessToken string, body mpPreferenceRequest) (*mpPreferenceResponse, error) {
		return &mpPreferenceResponse{
			ID:               "pref_test",
			InitPoint:        "https://www.mercadopago.com/mlb/checkout/v1/redirect?pref_id=pref_test",
			SandboxInitPoint: "https://sandbox.mercadopago.com/mlb/checkout/v1/redirect?pref_id=pref_test",
		}, nil
	}

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Post("/subscriptions/checkout-session", CreateCheckoutSession)
	})

	req := httptest.NewRequest("POST", "/subscriptions/checkout-session", bytes.NewBufferString(`{"plan":"monthly"}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("status = %d, want 201", resp.StatusCode)
	}

	var created models.Subscription
	if err := db.Where("user_id = ?", user.ID).First(&created).Error; err != nil {
		t.Fatalf("load subscription: %v", err)
	}
	if created.PreferenceID != "pref_test" {
		t.Fatalf("preference id = %q, want pref_test", created.PreferenceID)
	}
	if created.PaymentID != "pending:pref_test" {
		t.Fatalf("payment id placeholder = %q, want pending:pref_test", created.PaymentID)
	}
}

func TestCreateCheckoutSessionClientDeepLinksOverrideEnv(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-deeplink", "cliente")
	t.Setenv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-TOKEN")
	t.Setenv("MERCADO_PAGO_SUCCESS_URL", "https://limpae.vercel.app/assinatura/success")
	t.Setenv("MERCADO_PAGO_FAILURE_URL", "https://limpae.vercel.app/assinatura/failure")
	t.Setenv("MERCADO_PAGO_PENDING_URL", "https://limpae.vercel.app/assinatura/pending")

	var captured mpPreferenceRequest
	restore := restoreMercadoPagoFuncs()
	defer restore()

	createMercadoPagoPreferenceFunc = func(accessToken string, body mpPreferenceRequest) (*mpPreferenceResponse, error) {
		captured = body
		return &mpPreferenceResponse{
			ID:               "pref_dl",
			InitPoint:        "https://www.mercadopago.com/mlb/checkout/v1/redirect?pref_id=pref_dl",
			SandboxInitPoint: "https://sandbox.mercadopago.com/mlb/checkout/v1/redirect?pref_id=pref_dl",
		}, nil
	}

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Post("/subscriptions/checkout-session", CreateCheckoutSession)
	})

	payload := `{"plan":"monthly","mp_success_url":"limpae://subscription/success","mp_failure_url":"limpae://subscription/failure","mp_pending_url":"limpae://subscription/pending"}`
	req := httptest.NewRequest("POST", "/subscriptions/checkout-session", bytes.NewBufferString(payload))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("status = %d, want 201", resp.StatusCode)
	}
	if captured.BackURLs.Success != "limpae://subscription/success" {
		t.Fatalf("back_urls.success = %q, want limpae://subscription/success", captured.BackURLs.Success)
	}
	if captured.BackURLs.Failure != "limpae://subscription/failure" {
		t.Fatalf("back_urls.failure = %q", captured.BackURLs.Failure)
	}
	if captured.BackURLs.Pending != "limpae://subscription/pending" {
		t.Fatalf("back_urls.pending = %q", captured.BackURLs.Pending)
	}
}

func TestCreateCheckoutSessionInvalidDeepLinkUsesEnv(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-badlink", "cliente")
	t.Setenv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-TOKEN")
	wantSuccess := "https://limpae.vercel.app/assinatura/success"
	t.Setenv("MERCADO_PAGO_SUCCESS_URL", wantSuccess)

	var captured mpPreferenceRequest
	restore := restoreMercadoPagoFuncs()
	defer restore()

	createMercadoPagoPreferenceFunc = func(accessToken string, body mpPreferenceRequest) (*mpPreferenceResponse, error) {
		captured = body
		return &mpPreferenceResponse{
			ID:               "pref_x",
			InitPoint:        "https://www.mercadopago.com/mlb/checkout/v1/redirect?pref_id=pref_x",
			SandboxInitPoint: "https://sandbox.mercadopago.com/mlb/checkout/v1/redirect?pref_id=pref_x",
		}, nil
	}

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Post("/subscriptions/checkout-session", CreateCheckoutSession)
	})

	payload := `{"plan":"monthly","mp_success_url":"limpae://phishing/subscription/success"}`
	req := httptest.NewRequest("POST", "/subscriptions/checkout-session", bytes.NewBufferString(payload))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("status = %d, want 201", resp.StatusCode)
	}
	if captured.BackURLs.Success != wantSuccess {
		t.Fatalf("back_urls.success = %q, want %q", captured.BackURLs.Success, wantSuccess)
	}
}

func TestConfirmMercadoPagoPaymentUsesPreferenceWhenExternalRefEmpty(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-confmp", "cliente")
	t.Setenv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-TOKEN")

	restore := restoreMercadoPagoFuncs()
	defer restore()

	getMercadoPagoPaymentFunc = func(accessToken string, paymentID string) (*mpPaymentResponse, error) {
		rawID, _ := json.Marshal(777001)
		return &mpPaymentResponse{
			ID:                rawID,
			Status:            "approved",
			ExternalReference: "",
			PreferenceID:      "pref_confirm_pref",
			TransactionAmount: 15,
			CurrencyID:        "BRL",
		}, nil
	}

	_, err := createOrUpdatePendingSubscription(user, subscriptionPlanConfig{
		Plan:        subscriptionPlanMonthly,
		StoragePlan: "premium",
		Price:       15,
	}, "pref_confirm_pref")
	if err != nil {
		t.Fatalf("pending: %v", err)
	}

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Post("/subscriptions/confirm-mp-payment", ConfirmMercadoPagoPayment)
	})

	req := httptest.NewRequest("POST", "/subscriptions/confirm-mp-payment", bytes.NewBufferString(`{"payment_id":"777001"}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var sub models.Subscription
	if err := db.Where("user_id = ?", user.ID).First(&sub).Error; err != nil {
		t.Fatalf("load subscription: %v", err)
	}
	if sub.Status != "active" {
		t.Fatalf("status = %q, want active", sub.Status)
	}
	if sub.PaymentID != "777001" {
		t.Fatalf("payment id = %q, want 777001", sub.PaymentID)
	}
}

func TestMercadoPagoWebhookApprovesSubscription(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-wh", "cliente")
	t.Setenv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-TOKEN")

	extRef := buildExternalReference(user.ID, subscriptionPlanMonthly, user.Role)
	_, err := createOrUpdatePendingSubscription(user, subscriptionPlanConfig{
		Plan:        subscriptionPlanMonthly,
		StoragePlan: "premium",
		Price:       15,
	}, "pref_wh")
	if err != nil {
		t.Fatalf("pending: %v", err)
	}

	restore := restoreMercadoPagoFuncs()
	defer restore()

	getMercadoPagoPaymentFunc = func(accessToken string, paymentID string) (*mpPaymentResponse, error) {
		rawID, _ := json.Marshal(555001)
		return &mpPaymentResponse{
			ID:                rawID,
			Status:            "approved",
			ExternalReference: extRef,
			TransactionAmount: 15,
			CurrencyID:        "BRL",
		}, nil
	}

	app := fiber.New()
	app.Post("/mercadopago/webhook", MercadoPagoWebhookHandler)

	body := []byte(`{"id":99001,"type":"payment","action":"payment.updated","data":{"id":"555001"}}`)
	req := httptest.NewRequest("POST", "/mercadopago/webhook", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d", resp.StatusCode)
	}

	var sub models.Subscription
	if err := db.Where("user_id = ?", user.ID).First(&sub).Error; err != nil {
		t.Fatalf("load subscription: %v", err)
	}
	if sub.Status != "active" {
		t.Fatalf("status = %q, want active", sub.Status)
	}
	if sub.PaymentID == "" {
		t.Fatalf("expected payment id")
	}
}

func TestMercadoPagoWebhookIsIdempotent(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-idem", "cliente")
	t.Setenv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-TOKEN")

	extRef := buildExternalReference(user.ID, subscriptionPlanQuarterly, user.Role)
	_, _ = createOrUpdatePendingSubscription(user, subscriptionPlanConfig{
		Plan:        subscriptionPlanQuarterly,
		StoragePlan: "premium",
		Price:       37,
	}, "pref_idem")

	restore := restoreMercadoPagoFuncs()
	defer restore()

	getMercadoPagoPaymentFunc = func(accessToken string, paymentID string) (*mpPaymentResponse, error) {
		rawID, _ := json.Marshal(777002)
		return &mpPaymentResponse{
			ID:                rawID,
			Status:            "approved",
			ExternalReference: extRef,
			TransactionAmount: 37,
			CurrencyID:        "BRL",
		}, nil
	}

	app := fiber.New()
	app.Post("/mercadopago/webhook", MercadoPagoWebhookHandler)

	payload := []byte(`{"id":88002,"type":"payment","action":"payment.updated","data":{"id":"777002"}}`)
	req1 := httptest.NewRequest("POST", "/mercadopago/webhook", bytes.NewReader(payload))
	req1.Header.Set("Content-Type", "application/json")
	resp1, _ := app.Test(req1)
	if resp1.StatusCode != 200 {
		t.Fatalf("first status %d", resp1.StatusCode)
	}

	req2 := httptest.NewRequest("POST", "/mercadopago/webhook", bytes.NewReader(payload))
	req2.Header.Set("Content-Type", "application/json")
	resp2, _ := app.Test(req2)
	if resp2.StatusCode != 200 {
		t.Fatalf("second status %d", resp2.StatusCode)
	}

	var count int64
	if err := db.Model(&models.WebhookEventDedupe{}).Where("event_id = ?", "88002").Count(&count).Error; err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Fatalf("dedupe rows = %d, want 1", count)
	}
}
