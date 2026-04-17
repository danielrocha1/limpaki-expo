package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
	"github.com/stripe/stripe-go"
	checkoutsession "github.com/stripe/stripe-go/checkout/session"
	"github.com/stripe/stripe-go/customer"
	"github.com/stripe/stripe-go/invoice"
	stripesub "github.com/stripe/stripe-go/sub"
	"github.com/stripe/stripe-go/webhook"
	"gorm.io/gorm"
)

const (
	subscriptionPlanMonthly   = "monthly"
	subscriptionPlanQuarterly = "quarterly"
	subscriptionPlanYearly    = "yearly"

	defaultMonthlyPriceID   = "price_1T4rg0GfDcV7LUFtVWKLRQM5"
	defaultQuarterlyPriceID = "price_1T4rhfGfDcV7LUFtEJi3xOlp"
	defaultYearlyPriceID    = "price_1T4riYGfDcV7LUFto9iFzoLj"

	defaultSubscriptionSuccessURL = "https://limpae.vercel.app/assinatura/success"
	defaultSubscriptionCancelURL  = "https://limpae.vercel.app/assinatura/denied"
)

type subscriptionPlanConfig struct {
	Plan        string
	StoragePlan string
	PriceID     string
	Price       float64
}

var (
	stripeCreateCustomerFunc = func(params *stripe.CustomerParams) (*stripe.Customer, error) {
		return customer.New(params)
	}
	stripeCreateCheckoutSessionFunc = func(params *stripe.CheckoutSessionParams) (*stripe.CheckoutSession, error) {
		return checkoutsession.New(params)
	}
	stripeCancelSubscriptionFunc = func(subscriptionID string, params *stripe.SubscriptionCancelParams) (*stripe.Subscription, error) {
		return stripesub.Cancel(subscriptionID, params)
	}
	stripeGetSubscriptionFunc = func(subscriptionID string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
		return stripesub.Get(subscriptionID, params)
	}
	stripeGetInvoiceFunc = func(invoiceID string, params *stripe.InvoiceParams) (*stripe.Invoice, error) {
		return invoice.Get(invoiceID, params)
	}
	constructStripeEventFunc = func(payload []byte, header string, secret string) (stripe.Event, error) {
		return webhook.ConstructEvent(payload, header, secret)
	}
)

func subscriptionPriceForPlan(plan string) (float64, bool) {
	config, ok := subscriptionPlanByName(plan)
	if !ok {
		return 0, false
	}
	return config.Price, true
}

func subscriptionPlanByName(plan string) (subscriptionPlanConfig, bool) {
	switch strings.ToLower(strings.TrimSpace(plan)) {
	case subscriptionPlanMonthly:
		return subscriptionPlanConfig{
			Plan:        subscriptionPlanMonthly,
			StoragePlan: "premium",
			PriceID:     strings.TrimSpace(getSubscriptionEnvOrDefault("STRIPE_PRICE_MONTHLY", defaultMonthlyPriceID)),
			Price:       15.00,
		}, true
	case subscriptionPlanQuarterly:
		return subscriptionPlanConfig{
			Plan:        subscriptionPlanQuarterly,
			StoragePlan: "premium",
			PriceID:     strings.TrimSpace(getSubscriptionEnvOrDefault("STRIPE_PRICE_QUARTERLY", defaultQuarterlyPriceID)),
			Price:       37.00,
		}, true
	case subscriptionPlanYearly:
		return subscriptionPlanConfig{
			Plan:        subscriptionPlanYearly,
			StoragePlan: "premium",
			PriceID:     strings.TrimSpace(getSubscriptionEnvOrDefault("STRIPE_PRICE_YEARLY", defaultYearlyPriceID)),
			Price:       150.00,
		}, true
	default:
		return subscriptionPlanConfig{}, false
	}
}

func subscriptionPlanByPriceID(priceID string) (subscriptionPlanConfig, bool) {
	for _, plan := range []string{subscriptionPlanMonthly, subscriptionPlanQuarterly, subscriptionPlanYearly} {
		config, ok := subscriptionPlanByName(plan)
		if ok && config.PriceID == strings.TrimSpace(priceID) {
			return config, true
		}
	}
	return subscriptionPlanConfig{}, false
}

func normalizeSubscriptionPlan(plan string) string {
	switch strings.ToLower(strings.TrimSpace(plan)) {
	case "free", "basic", "premium":
		return strings.ToLower(strings.TrimSpace(plan))
	case "mensal":
		return subscriptionPlanMonthly
	case "trimestral":
		return subscriptionPlanQuarterly
	case "anual":
		return subscriptionPlanYearly
	default:
		return strings.ToLower(strings.TrimSpace(plan))
	}
}

func stripeStatusBlocksImmediately(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "canceled", "unpaid", "incomplete_expired", "incomplete", "past_due":
		return true
	default:
		return false
	}
}

func normalizeSubscriptionStorageStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "active":
		return "active"
	case "trialing":
		// Schema legado tende a aceitar apenas active/inactive/canceled.
		return "active"
	case "canceled":
		return "canceled"
	case "unpaid", "incomplete_expired", "incomplete", "past_due", "inactive":
		return "inactive"
	default:
		return "inactive"
	}
}

func getStripeSecretKey() string {
	return strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY"))
}

func getStripeWebhookSecret() string {
	return strings.TrimSpace(os.Getenv("STRIPE_WEBHOOK_SECRET"))
}

func getSubscriptionEnvOrDefault(key string, defaultValue string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue
	}
	return value
}

func getSubscriptionSuccessURL() string {
	return strings.TrimSpace(getSubscriptionEnvOrDefault("STRIPE_CHECKOUT_SUCCESS_URL", defaultSubscriptionSuccessURL))
}

func getSubscriptionCancelURL() string {
	return strings.TrimSpace(getSubscriptionEnvOrDefault("STRIPE_CHECKOUT_CANCEL_URL", defaultSubscriptionCancelURL))
}

func stripeClientConfigured() bool {
	return getStripeSecretKey() != "" && getStripeWebhookSecret() != ""
}

func configureStripeClient() error {
	secretKey := getStripeSecretKey()
	if secretKey == "" {
		return errors.New("STRIPE_SECRET_KEY nao configurada")
	}
	stripe.Key = secretKey
	return nil
}

func parseStripeTime(unixSeconds int64) *time.Time {
	if unixSeconds <= 0 {
		return nil
	}
	timestamp := time.Unix(unixSeconds, 0).UTC()
	return &timestamp
}

func deriveSubscriptionExpiry(status string, currentPeriodEnd *time.Time, canceledAt *time.Time, endedAt *time.Time) time.Time {
	if currentPeriodEnd != nil && !currentPeriodEnd.IsZero() {
		return currentPeriodEnd.UTC()
	}
	if endedAt != nil && !endedAt.IsZero() {
		return endedAt.UTC()
	}
	if canceledAt != nil && !canceledAt.IsZero() {
		return canceledAt.UTC()
	}

	switch strings.ToLower(strings.TrimSpace(status)) {
	case "incomplete", "incomplete_expired":
		return time.Now().UTC().Add(30 * time.Minute)
	default:
		return time.Now().UTC()
	}
}

func parseUserIDFromMetadata(metadata map[string]string) uint {
	rawUserID := strings.TrimSpace(metadata["user_id"])
	if rawUserID == "" {
		return 0
	}

	parsed, err := strconv.ParseUint(rawUserID, 10, 64)
	if err != nil {
		return 0
	}
	return uint(parsed)
}

func normalizeNullableString(value string) interface{} {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func resolveSubscriptionOwner(tx *gorm.DB, stripeSub *stripe.Subscription) (uint, string, error) {
	if stripeSub != nil {
		if userID := parseUserIDFromMetadata(stripeSub.Metadata); userID != 0 {
			role := strings.TrimSpace(stripeSub.Metadata["role"])
			if role == "" {
				user, err := loadUserByID(userID)
				if err != nil {
					return 0, "", err
				}
				role = user.Role
			}
			return userID, role, nil
		}

		if stripeSub.ID != "" {
			var existing models.Subscription
			if err := tx.Where("stripe_subscription_id = ?", stripeSub.ID).First(&existing).Error; err == nil {
				return existing.UserID, existing.Role, nil
			}
		}

		if stripeSub.Customer != nil && stripeSub.Customer.ID != "" {
			var existing models.Subscription
			if err := tx.Where("stripe_customer_id = ?", stripeSub.Customer.ID).First(&existing).Error; err == nil {
				return existing.UserID, existing.Role, nil
			}
		}
	}

	return 0, "", errors.New("nao foi possivel determinar o usuario dono da assinatura")
}

func upsertSubscriptionRecord(tx *gorm.DB, sub models.Subscription) (models.Subscription, error) {
	var existing models.Subscription
	err := tx.Where("user_id = ?", sub.UserID).First(&existing).Error
	switch {
	case err == nil:
		log.Printf("[subscription] upsert update start user_id=%d existing_id=%d status=%s plan=%s stripe_customer_id=%s stripe_subscription_id=%s stripe_session_id=%s",
			sub.UserID, existing.ID, sub.Status, sub.Plan, sub.StripeCustomerID, sub.StripeSubscriptionID, sub.StripeCheckoutSessionID)
		sub.ID = existing.ID
		if sub.StripeCustomerID == "" {
			sub.StripeCustomerID = existing.StripeCustomerID
		}
		if sub.StripeSubscriptionID == "" {
			sub.StripeSubscriptionID = existing.StripeSubscriptionID
		}
		if sub.StripeCheckoutSessionID == "" {
			sub.StripeCheckoutSessionID = existing.StripeCheckoutSessionID
		}
		if sub.ExpiresAt.IsZero() {
			sub.ExpiresAt = existing.ExpiresAt
		}
		updateValues := map[string]interface{}{
			"user_id":                    sub.UserID,
			"role":                       sub.Role,
			"plan":                       sub.Plan,
			"price":                      sub.Price,
			"stripe_customer_id":         normalizeNullableString(sub.StripeCustomerID),
			"stripe_subscription_id":     normalizeNullableString(sub.StripeSubscriptionID),
			"stripe_price_id":            normalizeNullableString(sub.StripePriceID),
			"stripe_checkout_session_id": normalizeNullableString(sub.StripeCheckoutSessionID),
			"status":                     sub.Status,
			"expires_at":                 sub.ExpiresAt,
			"current_period_start":       sub.CurrentPeriodStart,
			"current_period_end":         sub.CurrentPeriodEnd,
			"cancel_at":                  sub.CancelAt,
			"canceled_at":                sub.CanceledAt,
			"ended_at":                   sub.EndedAt,
			"last_webhook_event_id":      sub.LastWebhookEventID,
			"last_webhook_event_created": sub.LastWebhookEventCreated,
			"updated_at":                 time.Now().UTC(),
		}
		if err := tx.Model(&models.Subscription{}).Where("id = ?", sub.ID).Updates(updateValues).Error; err != nil {
			log.Printf("[subscription] upsert update failed user_id=%d subscription_id=%d error=%v", sub.UserID, sub.ID, err)
			return models.Subscription{}, err
		}
		if err := tx.First(&sub, sub.ID).Error; err != nil {
			log.Printf("[subscription] upsert reload failed user_id=%d subscription_id=%d error=%v", sub.UserID, sub.ID, err)
			return models.Subscription{}, err
		}
		log.Printf("[subscription] upsert update success user_id=%d subscription_id=%d status=%s plan=%s stripe_customer_id=%s stripe_subscription_id=%s stripe_session_id=%s",
			sub.UserID, sub.ID, sub.Status, sub.Plan, sub.StripeCustomerID, sub.StripeSubscriptionID, sub.StripeCheckoutSessionID)
		return sub, nil
	case errors.Is(err, gorm.ErrRecordNotFound):
		log.Printf("[subscription] upsert create start user_id=%d status=%s plan=%s stripe_customer_id=%s stripe_subscription_id=%s stripe_session_id=%s",
			sub.UserID, sub.Status, sub.Plan, sub.StripeCustomerID, sub.StripeSubscriptionID, sub.StripeCheckoutSessionID)
		createValues := map[string]interface{}{
			"user_id":                    sub.UserID,
			"role":                       sub.Role,
			"plan":                       sub.Plan,
			"price":                      sub.Price,
			"stripe_customer_id":         normalizeNullableString(sub.StripeCustomerID),
			"stripe_subscription_id":     normalizeNullableString(sub.StripeSubscriptionID),
			"stripe_price_id":            normalizeNullableString(sub.StripePriceID),
			"stripe_checkout_session_id": normalizeNullableString(sub.StripeCheckoutSessionID),
			"status":                     sub.Status,
			"expires_at":                 sub.ExpiresAt,
			"current_period_start":       sub.CurrentPeriodStart,
			"current_period_end":         sub.CurrentPeriodEnd,
			"cancel_at":                  sub.CancelAt,
			"canceled_at":                sub.CanceledAt,
			"ended_at":                   sub.EndedAt,
			"last_webhook_event_id":      sub.LastWebhookEventID,
			"last_webhook_event_created": sub.LastWebhookEventCreated,
			"created_at":                 time.Now().UTC(),
			"updated_at":                 time.Now().UTC(),
		}
		if err := tx.Model(&models.Subscription{}).Create(createValues).Error; err != nil {
			log.Printf("[subscription] upsert create failed user_id=%d error=%v", sub.UserID, err)
			return models.Subscription{}, err
		}
		if err := tx.Where("user_id = ?", sub.UserID).First(&sub).Error; err != nil {
			log.Printf("[subscription] upsert load created failed user_id=%d error=%v", sub.UserID, err)
			return models.Subscription{}, err
		}
		log.Printf("[subscription] upsert create success user_id=%d subscription_id=%d status=%s plan=%s stripe_customer_id=%s stripe_subscription_id=%s stripe_session_id=%s",
			sub.UserID, sub.ID, sub.Status, sub.Plan, sub.StripeCustomerID, sub.StripeSubscriptionID, sub.StripeCheckoutSessionID)
		return sub, nil
	default:
		log.Printf("[subscription] upsert query existing failed user_id=%d error=%v", sub.UserID, err)
		return models.Subscription{}, err
	}
}

func syncSubscriptionFromStripe(tx *gorm.DB, stripeSub *stripe.Subscription, checkoutSessionID string, event stripe.Event) (models.Subscription, bool, error) {
	if stripeSub == nil {
		log.Printf("[subscription] sync skipped reason=nil_subscription checkout_session_id=%s event_id=%s event_type=%s", checkoutSessionID, event.ID, event.Type)
		return models.Subscription{}, false, errors.New("assinatura do Stripe ausente")
	}
	log.Printf("[subscription] sync start stripe_subscription_id=%s checkout_session_id=%s event_id=%s event_type=%s stripe_status=%s",
		stripeSub.ID, checkoutSessionID, event.ID, event.Type, stripeSub.Status)

	userID, role, err := resolveSubscriptionOwner(tx, stripeSub)
	if err != nil {
		log.Printf("[subscription] sync resolve owner failed stripe_subscription_id=%s event_id=%s error=%v", stripeSub.ID, event.ID, err)
		return models.Subscription{}, false, err
	}

	var existing models.Subscription
	err = tx.Where("user_id = ?", userID).First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		log.Printf("[subscription] sync load existing failed user_id=%d stripe_subscription_id=%s error=%v", userID, stripeSub.ID, err)
		return models.Subscription{}, false, err
	}

	if existing.ID != 0 && existing.LastWebhookEventCreated > event.Created {
		log.Printf("[subscription] sync ignored stale event user_id=%d subscription_id=%d incoming_event_created=%d stored_event_created=%d",
			userID, existing.ID, event.Created, existing.LastWebhookEventCreated)
		return existing, false, nil
	}

	priceID := ""
	if stripeSub.Plan != nil {
		priceID = stripeSub.Plan.ID
	}
	if priceID == "" && stripeSub.Items != nil && len(stripeSub.Items.Data) > 0 && stripeSub.Items.Data[0].Plan != nil {
		priceID = stripeSub.Items.Data[0].Plan.ID
	}

	plan := normalizeSubscriptionPlan(stripeSub.Metadata["plan"])
	planConfig, hasPlanConfig := subscriptionPlanByPriceID(priceID)
	if plan == "" && hasPlanConfig {
		plan = planConfig.Plan
	}
	if plan == "" && existing.Plan != "" {
		plan = normalizeSubscriptionPlan(existing.Plan)
	}

	price, _ := subscriptionPriceForPlan(plan)
	status := normalizeSubscriptionStorageStatus(string(stripeSub.Status))

	record := models.Subscription{
		ID:                      existing.ID,
		UserID:                  userID,
		Role:                    role,
		Plan:                    plan,
		Price:                   price,
		StripeCustomerID:        existing.StripeCustomerID,
		StripeSubscriptionID:    stripeSub.ID,
		StripePriceID:           priceID,
		StripeCheckoutSessionID: checkoutSessionID,
		Status:                  status,
		ExpiresAt:               deriveSubscriptionExpiry(status, parseStripeTime(stripeSub.CurrentPeriodEnd), parseStripeTime(stripeSub.CanceledAt), parseStripeTime(stripeSub.EndedAt)),
		CurrentPeriodStart:      parseStripeTime(stripeSub.CurrentPeriodStart),
		CurrentPeriodEnd:        parseStripeTime(stripeSub.CurrentPeriodEnd),
		CancelAt:                parseStripeTime(stripeSub.CancelAt),
		CanceledAt:              parseStripeTime(stripeSub.CanceledAt),
		EndedAt:                 parseStripeTime(stripeSub.EndedAt),
		LastWebhookEventID:      event.ID,
		LastWebhookEventCreated: event.Created,
	}
	if hasPlanConfig {
		record.Plan = planConfig.StoragePlan
	}
	if stripeSub.Customer != nil && stripeSub.Customer.ID != "" {
		record.StripeCustomerID = stripeSub.Customer.ID
	}

	if record.StripeCheckoutSessionID == "" {
		record.StripeCheckoutSessionID = existing.StripeCheckoutSessionID
	}
	log.Printf("[subscription] sync prepared record user_id=%d role=%s subscription_id=%d status=%s plan=%s stripe_customer_id=%s stripe_subscription_id=%s stripe_price_id=%s stripe_session_id=%s",
		record.UserID, record.Role, record.ID, record.Status, record.Plan, record.StripeCustomerID, record.StripeSubscriptionID, record.StripePriceID, record.StripeCheckoutSessionID)

	updatedRecord, saveErr := upsertSubscriptionRecord(tx, record)
	if saveErr != nil {
		log.Printf("[subscription] sync save failed user_id=%d stripe_subscription_id=%s error=%v", record.UserID, stripeSub.ID, saveErr)
		return models.Subscription{}, false, saveErr
	}
	log.Printf("[subscription] sync success user_id=%d subscription_id=%d status=%s plan=%s stripe_customer_id=%s stripe_subscription_id=%s stripe_session_id=%s",
		updatedRecord.UserID, updatedRecord.ID, updatedRecord.Status, updatedRecord.Plan, updatedRecord.StripeCustomerID, updatedRecord.StripeSubscriptionID, updatedRecord.StripeCheckoutSessionID)

	return updatedRecord, true, nil
}

func createOrUpdatePendingSubscription(user models.User, plan subscriptionPlanConfig, customerID string, checkoutSessionID string) (models.Subscription, error) {
	log.Printf("[subscription] pending record start user_id=%d role=%s plan=%s price_id=%s customer_id=%s checkout_session_id=%s",
		user.ID, user.Role, plan.Plan, plan.PriceID, customerID, checkoutSessionID)
	record := models.Subscription{
		UserID:                  user.ID,
		Role:                    user.Role,
		Plan:                    plan.StoragePlan,
		Price:                   plan.Price,
		StripeCustomerID:        customerID,
		StripePriceID:           plan.PriceID,
		StripeCheckoutSessionID: checkoutSessionID,
		Status:                  normalizeSubscriptionStorageStatus("incomplete"),
		ExpiresAt:               time.Now().UTC().Add(30 * time.Minute),
	}

	created, err := upsertSubscriptionRecord(config.DB, record)
	if err != nil {
		log.Printf("[subscription] pending record failed user_id=%d customer_id=%s checkout_session_id=%s error=%v", user.ID, customerID, checkoutSessionID, err)
		return models.Subscription{}, err
	}
	log.Printf("[subscription] pending record success user_id=%d subscription_id=%d status=%s plan=%s customer_id=%s checkout_session_id=%s",
		created.UserID, created.ID, created.Status, created.Plan, created.StripeCustomerID, created.StripeCheckoutSessionID)
	return created, nil
}

func getOrCreateStripeCustomer(user models.User, existing models.Subscription) (string, error) {
	if strings.TrimSpace(existing.StripeCustomerID) != "" {
		log.Printf("[subscription] reusing stripe customer user_id=%d customer_id=%s", user.ID, existing.StripeCustomerID)
		return existing.StripeCustomerID, nil
	}

	customerParams := &stripe.CustomerParams{
		Email: stripe.String(user.Email),
		Name:  stripe.String(user.Name),
	}
	customerParams.AddMetadata("user_id", strconv.FormatUint(uint64(user.ID), 10))
	customerParams.AddMetadata("role", user.Role)

	createdCustomer, err := stripeCreateCustomerFunc(customerParams)
	if err != nil {
		log.Printf("[subscription] stripe customer create failed user_id=%d email=%s error=%v", user.ID, user.Email, err)
		return "", err
	}
	log.Printf("[subscription] stripe customer created user_id=%d customer_id=%s", user.ID, createdCustomer.ID)
	return createdCustomer.ID, nil
}

func CreateSubscription(c *fiber.Ctx) error {
	return CreateCheckoutSession(c)
}

func CreateCheckoutSession(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var request SubscriptionCreateRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	validator := &validationCollector{}
	planName := validateEnum(validator, "plan", request.Plan, subscriptionPlanMonthly, subscriptionPlanQuarterly, subscriptionPlanYearly)
	if validator.HasErrors() {
		return writeValidationError(c, validator.errors)
	}

	planConfig, ok := subscriptionPlanByName(planName)
	if !ok {
		return writeValidationError(c, []ValidationFieldError{{Field: "plan", Reason: "has an invalid value"}})
	}
	log.Printf("[subscription] checkout request received user_id=%d requested_plan=%s resolved_plan=%s price_id=%s", userID, request.Plan, planConfig.Plan, planConfig.PriceID)
	if err := configureStripeClient(); err != nil {
		log.Printf("[subscription] checkout stripe config failed user_id=%d error=%v", userID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	user, err := loadUserByID(userID)
	if err != nil {
		log.Printf("[subscription] checkout load user failed user_id=%d error=%v", userID, err)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Usuario nao encontrado"})
	}

	existing, _ := GetCurrentSubscriptionForUser(userID)
	if subscriptionStatusAllowsAccess(existing.Status) {
		log.Printf("[subscription] checkout aborted existing valid subscription user_id=%d subscription_id=%d status=%s", userID, existing.ID, existing.Status)
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Usuario ja possui assinatura valida"})
	}

	customerID, err := getOrCreateStripeCustomer(user, existing)
	if err != nil {
		log.Printf("[subscription] checkout stripe customer failed user_id=%d error=%v", userID, err)
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "Erro ao criar cliente no Stripe"})
	}

	successURL := getSubscriptionSuccessURL()
	cancelURL := getSubscriptionCancelURL()

	sessionParams := &stripe.CheckoutSessionParams{
		Mode:                 stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		Customer:   stripe.String(customerID),
		ClientReferenceID: stripe.String(strconv.FormatUint(uint64(user.ID), 10)),
		PaymentMethodTypes: []*string{stripe.String("card")},
		SubscriptionData: &stripe.CheckoutSessionSubscriptionDataParams{
			Items: []*stripe.CheckoutSessionSubscriptionDataItemsParams{
				{
					Plan:     stripe.String(planConfig.PriceID),
					Quantity: stripe.Int64(1),
				},
			},
		},
	}
	sessionParams.AddMetadata("user_id", strconv.FormatUint(uint64(user.ID), 10))
	sessionParams.AddMetadata("role", user.Role)
	sessionParams.AddMetadata("plan", planConfig.Plan)
	sessionParams.SubscriptionData.AddMetadata("user_id", strconv.FormatUint(uint64(user.ID), 10))
	sessionParams.SubscriptionData.AddMetadata("role", user.Role)
	sessionParams.SubscriptionData.AddMetadata("plan", planConfig.Plan)
	log.Printf("[subscription] checkout session create start user_id=%d customer_id=%s plan=%s price_id=%s success_url=%s cancel_url=%s",
		userID, customerID, planConfig.Plan, planConfig.PriceID, successURL, cancelURL)

	stripeSession, err := stripeCreateCheckoutSessionFunc(sessionParams)
	if err != nil {
		log.Printf("[subscription] checkout session create failed user_id=%d customer_id=%s plan=%s error=%v", userID, customerID, planConfig.Plan, err)
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "Erro ao criar checkout session no Stripe"})
	}
	log.Printf("[subscription] checkout session created user_id=%d customer_id=%s session_id=%s plan=%s", userID, customerID, stripeSession.ID, planConfig.Plan)

	record, err := createOrUpdatePendingSubscription(user, planConfig, customerID, stripeSession.ID)
	if err != nil {
		log.Printf("[subscription] checkout persist pending failed user_id=%d session_id=%s error=%v", userID, stripeSession.ID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao persistir assinatura pendente"})
	}
	log.Printf("[subscription] checkout flow success user_id=%d subscription_id=%d session_id=%s customer_id=%s status=%s",
		userID, record.ID, stripeSession.ID, customerID, record.Status)

	return c.Status(fiber.StatusCreated).JSON(SubscriptionCheckoutSessionResponseDTO{
		SessionID: stripeSession.ID,
		URL:       "",
	})
}

func GetSubscriptions(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var subs []models.Subscription
	config.DB.Where("user_id = ?", userID).Find(&subs)

	response := make([]SubscriptionResponseDTO, 0, len(subs))
	for _, sub := range subs {
		response = append(response, toSubscriptionResponseDTO(sub))
	}
	return c.JSON(response)
}

func GetCurrentSubscription(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	sub, err := GetCurrentSubscriptionForUser(userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Assinatura nao encontrada"})
	}

	return c.JSON(toSubscriptionResponseDTO(sub))
}

func GetSubscriptionAccessStatus(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	testUser, testErr := isTestUser(userID)
	if testErr != nil && !errors.Is(testErr, gorm.ErrRecordNotFound) {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao carregar status da assinatura"})
	}

	sub, subErr := GetCurrentSubscriptionForUser(userID)
	if subErr != nil {
		return c.JSON(fiber.Map{
			"has_valid_subscription": testUser,
			"subscription":           nil,
			"is_test_user":           testUser,
		})
	}

	return c.JSON(fiber.Map{
		"has_valid_subscription": testUser || subscriptionStatusAllowsAccess(sub.Status),
		"subscription":           toSubscriptionResponseDTO(sub),
		"is_test_user":           testUser,
	})
}

func GetSubscription(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	sub, err := findOwnedSubscription(userID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Assinatura nao encontrada"})
	}

	return c.JSON(toSubscriptionResponseDTO(sub))
}

func UpdateSubscription(c *fiber.Ctx) error {
	return c.Status(fiber.StatusMethodNotAllowed).JSON(fiber.Map{
		"error": "Atualizacao manual de assinatura nao e suportada; use o checkout do Stripe",
	})
}

func CancelSubscription(c *fiber.Ctx) error {
	return CancelCurrentSubscription(c)
}

func CancelCurrentSubscription(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	if err := configureStripeClient(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	sub, err := GetCurrentSubscriptionForUser(userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Assinatura nao encontrada"})
	}
	if strings.TrimSpace(sub.StripeSubscriptionID) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Assinatura ainda nao foi provisionada no Stripe"})
	}

	canceledSub, err := stripeCancelSubscriptionFunc(sub.StripeSubscriptionID, &stripe.SubscriptionCancelParams{})
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "Erro ao cancelar assinatura no Stripe"})
	}

	now := time.Now().UTC()
	sub.Status = strings.ToLower(string(canceledSub.Status))
	sub.CanceledAt = &now
	sub.EndedAt = &now
	sub.CancelAt = &now
	sub.CurrentPeriodEnd = &now
	if err := config.DB.Save(&sub).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao persistir cancelamento da assinatura"})
	}

	return c.JSON(fiber.Map{
		"message":      "Assinatura cancelada imediatamente",
		"subscription": toSubscriptionResponseDTO(sub),
	})
}

func StripeWebhookHandler(c *fiber.Ctx) error {
	webhookSecret := getStripeWebhookSecret()
	if webhookSecret == "" {
		log.Printf("[subscription] webhook rejected reason=missing_secret")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "STRIPE_WEBHOOK_SECRET nao configurada"})
	}
	if err := configureStripeClient(); err != nil {
		log.Printf("[subscription] webhook stripe config failed error=%v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	payload := c.Body()
	signatureHeader := c.Get("Stripe-Signature")
	log.Printf("[subscription] webhook received payload_bytes=%d signature_present=%t", len(payload), signatureHeader != "")
	event, err := constructStripeEventFunc(payload, signatureHeader, webhookSecret)
	if err != nil {
		log.Printf("[subscription] webhook signature validation failed error=%v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Webhook Stripe invalido"})
	}
	log.Printf("[subscription] webhook constructed event_id=%s event_type=%s created=%d", event.ID, event.Type, event.Created)

	if err := processStripeWebhookEvent(event); err != nil {
		log.Printf("[subscription] webhook processing failed event_id=%s event_type=%s error=%v", event.ID, event.Type, err)
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	log.Printf("[subscription] webhook processed event_id=%s event_type=%s", event.ID, event.Type)

	return c.JSON(fiber.Map{"received": true})
}

func processStripeWebhookEvent(event stripe.Event) error {
	log.Printf("[subscription] webhook event dispatch start event_id=%s event_type=%s", event.ID, event.Type)
	return config.DB.Transaction(func(tx *gorm.DB) error {
		alreadyProcessed, err := registerStripeWebhookEvent(tx, event)
		if err != nil {
			log.Printf("[subscription] webhook event register failed event_id=%s event_type=%s error=%v", event.ID, event.Type, err)
			return err
		}
		if alreadyProcessed {
			log.Printf("[subscription] webhook event skipped duplicate event_id=%s event_type=%s", event.ID, event.Type)
			return nil
		}

		switch event.Type {
		case "checkout.session.completed":
			var session stripe.CheckoutSession
			if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
				log.Printf("[subscription] webhook checkout.session.completed decode failed event_id=%s error=%v", event.ID, err)
				return err
			}
			sessionSubscriptionID := ""
			if session.Subscription != nil {
				sessionSubscriptionID = session.Subscription.ID
			}
			log.Printf("[subscription] webhook checkout.session.completed session_id=%s subscription_id=%s", session.ID, sessionSubscriptionID)
			if session.Subscription == nil || session.Subscription.ID == "" {
				log.Printf("[subscription] webhook checkout.session.completed skipped reason=missing_subscription session_id=%s", session.ID)
				return nil
			}
			stripeSub, err := stripeGetSubscriptionFunc(session.Subscription.ID, nil)
			if err != nil {
				log.Printf("[subscription] webhook checkout.session.completed fetch subscription failed session_id=%s subscription_id=%s error=%v", session.ID, session.Subscription.ID, err)
				return err
			}
			_, _, err = syncSubscriptionFromStripe(tx, stripeSub, session.ID, event)
			return err

		case "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted":
			var stripeSub stripe.Subscription
			if err := json.Unmarshal(event.Data.Raw, &stripeSub); err != nil {
				log.Printf("[subscription] webhook %s decode failed event_id=%s error=%v", event.Type, event.ID, err)
				return err
			}
			log.Printf("[subscription] webhook %s subscription_id=%s status=%s", event.Type, stripeSub.ID, stripeSub.Status)
			_, _, err := syncSubscriptionFromStripe(tx, &stripeSub, "", event)
			return err

		case "invoice.paid":
			var stripeInvoice stripe.Invoice
			if err := json.Unmarshal(event.Data.Raw, &stripeInvoice); err != nil {
				log.Printf("[subscription] webhook invoice.paid decode failed event_id=%s error=%v", event.ID, err)
				return err
			}
			invoicePaidSubscriptionID := ""
			if stripeInvoice.Subscription != nil {
				invoicePaidSubscriptionID = stripeInvoice.Subscription.ID
			}
			log.Printf("[subscription] webhook invoice.paid invoice_id=%s subscription_id=%s", stripeInvoice.ID, invoicePaidSubscriptionID)
			if stripeInvoice.Subscription == nil || stripeInvoice.Subscription.ID == "" {
				log.Printf("[subscription] webhook invoice.paid skipped reason=missing_subscription invoice_id=%s", stripeInvoice.ID)
				return nil
			}
			stripeSub, err := stripeGetSubscriptionFunc(stripeInvoice.Subscription.ID, nil)
			if err != nil {
				log.Printf("[subscription] webhook invoice.paid fetch subscription failed invoice_id=%s subscription_id=%s error=%v", stripeInvoice.ID, stripeInvoice.Subscription.ID, err)
				return err
			}
			_, _, err = syncSubscriptionFromStripe(tx, stripeSub, "", event)
			return err

		case "invoice.payment_failed":
			var stripeInvoice stripe.Invoice
			if err := json.Unmarshal(event.Data.Raw, &stripeInvoice); err != nil {
				log.Printf("[subscription] webhook invoice.payment_failed decode failed event_id=%s error=%v", event.ID, err)
				return err
			}
			invoiceFailedSubscriptionID := ""
			if stripeInvoice.Subscription != nil {
				invoiceFailedSubscriptionID = stripeInvoice.Subscription.ID
			}
			log.Printf("[subscription] webhook invoice.payment_failed invoice_id=%s subscription_id=%s", stripeInvoice.ID, invoiceFailedSubscriptionID)
			if stripeInvoice.Subscription == nil || stripeInvoice.Subscription.ID == "" {
				log.Printf("[subscription] webhook invoice.payment_failed skipped reason=missing_subscription invoice_id=%s", stripeInvoice.ID)
				return nil
			}
			stripeSub, err := stripeGetSubscriptionFunc(stripeInvoice.Subscription.ID, nil)
			if err != nil {
				log.Printf("[subscription] webhook invoice.payment_failed fetch subscription failed invoice_id=%s subscription_id=%s error=%v", stripeInvoice.ID, stripeInvoice.Subscription.ID, err)
				return err
			}
			if stripeSub.Status != stripe.SubscriptionStatusPastDue {
				stripeSub.Status = stripe.SubscriptionStatusPastDue
			}
			_, _, err = syncSubscriptionFromStripe(tx, stripeSub, "", event)
			return err

		default:
			log.Printf("[subscription] webhook event ignored event_id=%s event_type=%s", event.ID, event.Type)
			return nil
		}
	})
}

func registerStripeWebhookEvent(tx *gorm.DB, event stripe.Event) (bool, error) {
	var existing models.StripeWebhookEvent
	if err := tx.Where("event_id = ?", event.ID).First(&existing).Error; err == nil {
		log.Printf("[subscription] webhook event already registered event_id=%s event_type=%s", event.ID, event.Type)
		return true, nil
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		log.Printf("[subscription] webhook event lookup failed event_id=%s event_type=%s error=%v", event.ID, event.Type, err)
		return false, err
	}

	record := models.StripeWebhookEvent{
		EventID:   event.ID,
		EventType: event.Type,
	}
	if err := tx.Create(&record).Error; err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			log.Printf("[subscription] webhook event register detected duplicate event_id=%s event_type=%s", event.ID, event.Type)
			return true, nil
		}
		log.Printf("[subscription] webhook event create failed event_id=%s event_type=%s error=%v", event.ID, event.Type, err)
		return false, err
	}
	log.Printf("[subscription] webhook event registered event_id=%s event_type=%s", event.ID, event.Type)

	return false, nil
}

func PaymentStripeWebhookHandler(c *fiber.Ctx) error {
	return StripeWebhookHandler(c)
}
