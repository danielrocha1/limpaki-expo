package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
	"github.com/stripe/stripe-go"
)

func restoreStripeTestFuncs() func() {
	originalCreateCustomer := stripeCreateCustomerFunc
	originalCreateSession := stripeCreateCheckoutSessionFunc
	originalCancelSubscription := stripeCancelSubscriptionFunc
	originalGetSubscription := stripeGetSubscriptionFunc
	originalConstructEvent := constructStripeEventFunc

	return func() {
		stripeCreateCustomerFunc = originalCreateCustomer
		stripeCreateCheckoutSessionFunc = originalCreateSession
		stripeCancelSubscriptionFunc = originalCancelSubscription
		stripeGetSubscriptionFunc = originalGetSubscription
		constructStripeEventFunc = originalConstructEvent
	}
}

func TestCreateCheckoutSessionWithValidPlan(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-checkout", "cliente")
	t.Setenv("STRIPE_SECRET_KEY", "sk_test_checkout")

	restore := restoreStripeTestFuncs()
	defer restore()

	stripeCreateCustomerFunc = func(params *stripe.CustomerParams) (*stripe.Customer, error) {
		return &stripe.Customer{ID: "cus_checkout"}, nil
	}
	stripeCreateCheckoutSessionFunc = func(params *stripe.CheckoutSessionParams) (*stripe.CheckoutSession, error) {
		if params.SubscriptionData == nil || len(params.SubscriptionData.Items) != 1 {
			t.Fatalf("expected subscription items to be configured")
		}
		if got := stripe.StringValue(params.SubscriptionData.Items[0].Plan); got == "" {
			t.Fatalf("expected plan/price id in checkout session")
		}
		return &stripe.CheckoutSession{ID: "cs_test_checkout"}, nil
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
	if created.Status != "inactive" {
		t.Fatalf("status = %q, want inactive", created.Status)
	}
	if created.StripeCheckoutSessionID != "cs_test_checkout" {
		t.Fatalf("checkout session id = %q", created.StripeCheckoutSessionID)
	}
}

func TestCreateCheckoutSessionAllowsPendingRecordWithoutStripeSubscriptionID(t *testing.T) {
	db := setupFlowTestDB(t)
	seedUser(t, db, t.Name()+"-existing", "cliente")
	user := seedUser(t, db, t.Name()+"-checkout-second", "cliente")
	t.Setenv("STRIPE_SECRET_KEY", "sk_test_checkout_pending")

	// Simula um legado com string vazia em coluna unica para garantir que o novo registro
	// pendente nao tente persistir outra string vazia e que use NULL no banco.
	if err := db.Exec(`INSERT INTO subscriptions (
		user_id, role, plan, price, stripe_customer_id, stripe_subscription_id, stripe_price_id,
		stripe_checkout_session_id, status, expires_at, last_webhook_event_id, last_webhook_event_created,
		created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		9999, "cliente", "premium", 15.0, "cus_legacy", "", "price_legacy", "cs_legacy",
		"inactive", time.Now().UTC().Add(30*time.Minute), "", 0, time.Now().UTC(), time.Now().UTC(),
	).Error; err != nil {
		t.Fatalf("seed legacy empty stripe subscription id: %v", err)
	}

	restore := restoreStripeTestFuncs()
	defer restore()

	stripeCreateCustomerFunc = func(params *stripe.CustomerParams) (*stripe.Customer, error) {
		return &stripe.Customer{ID: "cus_checkout_pending"}, nil
	}
	stripeCreateCheckoutSessionFunc = func(params *stripe.CheckoutSessionParams) (*stripe.CheckoutSession, error) {
		return &stripe.CheckoutSession{ID: "cs_test_checkout_pending"}, nil
	}

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Post("/subscriptions/checkout-session", CreateCheckoutSession)
	})

	req := httptest.NewRequest("POST", "/subscriptions/checkout-session", bytes.NewBufferString(`{"plan":"quarterly"}`))
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
	if created.StripeSubscriptionID != "" {
		t.Fatalf("stripe subscription id = %q, want empty in model after NULL persistence", created.StripeSubscriptionID)
	}
}

func TestCreateCheckoutSessionRejectsInvalidPlan(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-invalid-plan", "diarista")

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Post("/subscriptions/checkout-session", CreateCheckoutSession)
	})

	req := httptest.NewRequest("POST", "/subscriptions/checkout-session", bytes.NewBufferString(`{"plan":"enterprise"}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestCancelSubscriptionImmediately(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-cancel", "cliente")
	t.Setenv("STRIPE_SECRET_KEY", "sk_test_cancel")

	existing := models.Subscription{
		UserID:               user.ID,
		Role:                 user.Role,
		Plan:                 "monthly",
		Price:                12.9,
		StripeCustomerID:     "cus_cancel",
		StripeSubscriptionID: "sub_cancel",
		Status:               "active",
	}
	if err := db.Create(&existing).Error; err != nil {
		t.Fatalf("create subscription: %v", err)
	}

	restore := restoreStripeTestFuncs()
	defer restore()

	stripeCancelSubscriptionFunc = func(subscriptionID string, params *stripe.SubscriptionCancelParams) (*stripe.Subscription, error) {
		return &stripe.Subscription{
			ID:       subscriptionID,
			Status:   stripe.SubscriptionStatusCanceled,
			CanceledAt: time.Now().UTC().Unix(),
			EndedAt:    time.Now().UTC().Unix(),
		}, nil
	}

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Post("/subscriptions/cancel", CancelCurrentSubscription)
	})

	req := httptest.NewRequest("POST", "/subscriptions/cancel", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var canceled models.Subscription
	if err := db.Where("user_id = ?", user.ID).First(&canceled).Error; err != nil {
		t.Fatalf("load canceled subscription: %v", err)
	}
	if canceled.Status != "canceled" {
		t.Fatalf("status = %q, want canceled", canceled.Status)
	}
}

func TestStripeWebhookUpdatesSubscriptionAndIsIdempotent(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-webhook", "diarista")
	t.Setenv("STRIPE_SECRET_KEY", "sk_test_webhook")
	t.Setenv("STRIPE_WEBHOOK_SECRET", "whsec_test_webhook")

	restore := restoreStripeTestFuncs()
	defer restore()

	stripeSub := &stripe.Subscription{
		ID:                 "sub_webhook",
		Status:             stripe.SubscriptionStatusActive,
		Customer:           &stripe.Customer{ID: "cus_webhook"},
		Plan:               &stripe.Plan{ID: defaultMonthlyPriceID},
		Metadata:           map[string]string{"user_id": "1", "role": "diarista", "plan": "monthly"},
		CurrentPeriodStart: time.Now().UTC().Unix(),
		CurrentPeriodEnd:   time.Now().UTC().Add(30 * 24 * time.Hour).Unix(),
	}
	stripeCreateCustomerFunc = func(params *stripe.CustomerParams) (*stripe.Customer, error) {
		return &stripe.Customer{ID: "cus_webhook"}, nil
	}
	stripeGetSubscriptionFunc = func(subscriptionID string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
		stripeSub.Metadata["user_id"] = strconv.FormatUint(uint64(user.ID), 10)
		stripeSub.Metadata["role"] = user.Role
		return stripeSub, nil
	}

	event := stripe.Event{
		ID:      "evt_checkout_completed",
		Type:    "checkout.session.completed",
		Created: time.Now().UTC().Unix(),
		Data:    &stripe.EventData{},
	}
	event.Data.Raw, _ = json.Marshal(stripe.CheckoutSession{
		ID:           "cs_webhook",
		Subscription: &stripe.Subscription{ID: "sub_webhook"},
	})
	constructStripeEventFunc = func(payload []byte, header string, secret string) (stripe.Event, error) {
		return event, nil
	}

	app := fiber.New()
	app.Post("/stripe/webhook", StripeWebhookHandler)

	req := httptest.NewRequest("POST", "/stripe/webhook", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Stripe-Signature", "test-signature")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var subscription models.Subscription
	if err := db.Where("user_id = ?", user.ID).First(&subscription).Error; err != nil {
		t.Fatalf("load synced subscription: %v", err)
	}
	if subscription.Status != "active" {
		t.Fatalf("status = %q, want active", subscription.Status)
	}

	repeatReq := httptest.NewRequest("POST", "/stripe/webhook", bytes.NewReader([]byte(`{}`)))
	repeatReq.Header.Set("Stripe-Signature", "test-signature")
	repeatResp, err := app.Test(repeatReq)
	if err != nil {
		t.Fatalf("repeat request: %v", err)
	}
	if repeatResp.StatusCode != fiber.StatusOK {
		t.Fatalf("repeat status = %d, want 200", repeatResp.StatusCode)
	}

	var eventsCount int64
	if err := db.Model(&models.StripeWebhookEvent{}).Count(&eventsCount).Error; err != nil {
		t.Fatalf("count webhook events: %v", err)
	}
	if eventsCount != 1 {
		t.Fatalf("events count = %d, want 1", eventsCount)
	}
}

func TestInvoicePaymentFailedBlocksAccessImmediately(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-payment-failed", "cliente")
	t.Setenv("STRIPE_SECRET_KEY", "sk_test_payment_failed")
	t.Setenv("STRIPE_WEBHOOK_SECRET", "whsec_test_payment_failed")

	existing := models.Subscription{
		UserID:               user.ID,
		Role:                 user.Role,
		Plan:                 "monthly",
		Price:                12.9,
		StripeCustomerID:     "cus_payment_failed",
		StripeSubscriptionID: "sub_payment_failed",
		StripePriceID:        defaultMonthlyPriceID,
		Status:               "active",
	}
	if err := db.Create(&existing).Error; err != nil {
		t.Fatalf("create active subscription: %v", err)
	}

	restore := restoreStripeTestFuncs()
	defer restore()

	stripeGetSubscriptionFunc = func(subscriptionID string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
		return &stripe.Subscription{
			ID:                 subscriptionID,
			Status:             stripe.SubscriptionStatusPastDue,
			Customer:           &stripe.Customer{ID: "cus_payment_failed"},
			Plan:               &stripe.Plan{ID: defaultMonthlyPriceID},
			Metadata:           map[string]string{"user_id": strconv.FormatUint(uint64(user.ID), 10), "role": user.Role, "plan": "monthly"},
			CurrentPeriodStart: time.Now().UTC().Unix(),
			CurrentPeriodEnd:   time.Now().UTC().Add(30 * 24 * time.Hour).Unix(),
		}, nil
	}

	event := stripe.Event{
		ID:      "evt_invoice_failed",
		Type:    "invoice.payment_failed",
		Created: time.Now().UTC().Unix(),
		Data:    &stripe.EventData{},
	}
	event.Data.Raw, _ = json.Marshal(stripe.Invoice{
		ID:           "in_failed",
		Subscription: &stripe.Subscription{ID: "sub_payment_failed"},
	})
	constructStripeEventFunc = func(payload []byte, header string, secret string) (stripe.Event, error) {
		return event, nil
	}

	app := fiber.New()
	app.Post("/stripe/webhook", StripeWebhookHandler)

	req := httptest.NewRequest("POST", "/stripe/webhook", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Stripe-Signature", "test-signature")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	hasAccess, err := HasValidSubscription(user.ID)
	if err != nil {
		t.Fatalf("HasValidSubscription: %v", err)
	}
	if hasAccess {
		t.Fatal("expected subscription access to be blocked after payment failure")
	}
}

func TestCustomerSubscriptionUpdatedReflectsStatusCorrectly(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-updated", "diarista")
	t.Setenv("STRIPE_SECRET_KEY", "sk_test_updated")
	t.Setenv("STRIPE_WEBHOOK_SECRET", "whsec_test_updated")

	restore := restoreStripeTestFuncs()
	defer restore()

	event := stripe.Event{
		ID:      "evt_sub_updated",
		Type:    "customer.subscription.updated",
		Created: time.Now().UTC().Unix(),
		Data:    &stripe.EventData{},
	}
	event.Data.Raw, _ = json.Marshal(stripe.Subscription{
		ID:                 "sub_updated",
		Status:             stripe.SubscriptionStatusTrialing,
		Customer:           &stripe.Customer{ID: "cus_updated"},
		Plan:               &stripe.Plan{ID: defaultQuarterlyPriceID},
		Metadata:           map[string]string{"user_id": strconv.FormatUint(uint64(user.ID), 10), "role": user.Role, "plan": "quarterly"},
		CurrentPeriodStart: time.Now().UTC().Unix(),
		CurrentPeriodEnd:   time.Now().UTC().Add(90 * 24 * time.Hour).Unix(),
	})
	constructStripeEventFunc = func(payload []byte, header string, secret string) (stripe.Event, error) {
		return event, nil
	}

	app := fiber.New()
	app.Post("/stripe/webhook", StripeWebhookHandler)

	req := httptest.NewRequest("POST", "/stripe/webhook", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Stripe-Signature", "test-signature")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	subscription, err := GetCurrentSubscriptionForUser(user.ID)
	if err != nil {
		t.Fatalf("current subscription: %v", err)
	}
	if subscription.Status != "active" {
		t.Fatalf("status = %q, want active", subscription.Status)
	}
}

func TestRequireValidSubscriptionMiddlewareBlocksWithoutValidSubscription(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-blocked", "cliente")

	if err := db.Create(&models.Subscription{
		UserID: user.ID,
		Role:   user.Role,
		Plan:   "monthly",
		Price:  12.9,
		Status: "past_due",
	}).Error; err != nil {
		t.Fatalf("create blocked subscription: %v", err)
	}

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Use(RequireValidSubscriptionMiddleware)
		app.Get("/premium", func(c *fiber.Ctx) error {
			return c.SendStatus(fiber.StatusOK)
		})
	})

	req := httptest.NewRequest("GET", "/premium", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusPaymentRequired {
		t.Fatalf("status = %d, want 402", resp.StatusCode)
	}
}

func TestRequireValidSubscriptionMiddlewareAllowsTestUserWithoutSubscription(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-test-user", "cliente")

	if err := db.Model(&models.User{}).Where("id = ?", user.ID).Update("is_test_user", true).Error; err != nil {
		t.Fatalf("mark test user: %v", err)
	}

	app := testAppWithUser(user.ID, func(app *fiber.App) {
		app.Use(RequireValidSubscriptionMiddleware)
		app.Get("/premium", func(c *fiber.Ctx) error {
			return c.SendStatus(fiber.StatusOK)
		})
	})

	req := httptest.NewRequest("GET", "/premium", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
}

func TestHasValidSubscriptionReturnsTrueForActiveSubscription(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-active", "cliente")

	if err := db.Create(&models.Subscription{
		UserID: user.ID,
		Role:   user.Role,
		Plan:   "yearly",
		Price:  98.9,
		Status: "active",
	}).Error; err != nil {
		t.Fatalf("create active subscription: %v", err)
	}

	hasAccess, err := HasValidSubscription(user.ID)
	if err != nil {
		t.Fatalf("HasValidSubscription: %v", err)
	}
	if !hasAccess {
		t.Fatal("expected active subscription to have access")
	}
}

func TestHasValidSubscriptionReturnsTrueForTestUserWithoutSubscription(t *testing.T) {
	db := setupFlowTestDB(t)
	user := seedUser(t, db, t.Name()+"-test-access", "cliente")

	if err := db.Model(&models.User{}).Where("id = ?", user.ID).Update("is_test_user", true).Error; err != nil {
		t.Fatalf("mark test user: %v", err)
	}

	hasAccess, err := HasValidSubscription(user.ID)
	if err != nil {
		t.Fatalf("HasValidSubscription: %v", err)
	}
	if !hasAccess {
		t.Fatal("expected test user to bypass subscription gate")
	}
}
