package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

const (
	subscriptionPlanMonthly   = "monthly"
	subscriptionPlanQuarterly = "quarterly"
	subscriptionPlanYearly    = "yearly"

	// Retorno Checkout Pro no app nativo (deep link). Web / fallback: MERCADO_PAGO_*_URL ou Vercel.
	defaultSubscriptionSuccessURL = "limpae://subscription/success"
	defaultSubscriptionFailureURL = "limpae://subscription/failure"
	defaultSubscriptionPendingURL = "limpae://subscription/pending"
)

var errMercadoPagoPaymentUserMismatch = errors.New("mp_payment_user_mismatch")

type subscriptionPlanConfig struct {
	Plan        string
	StoragePlan string
	Price       float64
}

func subscriptionPriceForPlan(plan string) (float64, bool) {
	config, ok := subscriptionPlanByName(plan)
	if !ok {
		return 0, false
	}
	return config.Price, true
}

// Precos em BRL para Preferencia MP; manter alinhado a src/config/subscriptionPlans.js (UI).
func subscriptionPlanByName(plan string) (subscriptionPlanConfig, bool) {
	switch strings.ToLower(strings.TrimSpace(plan)) {
	case subscriptionPlanMonthly:
		return subscriptionPlanConfig{
			Plan:        subscriptionPlanMonthly,
			StoragePlan: "premium",
			Price:       15.00,
		}, true
	case subscriptionPlanQuarterly:
		return subscriptionPlanConfig{
			Plan:        subscriptionPlanQuarterly,
			StoragePlan: "premium",
			Price:       37.00,
		}, true
	case subscriptionPlanYearly:
		return subscriptionPlanConfig{
			Plan:        subscriptionPlanYearly,
			StoragePlan: "premium",
			Price:       150.00,
		}, true
	default:
		return subscriptionPlanConfig{}, false
	}
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

func getSubscriptionEnvOrDefault(key string, defaultValue string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue
	}
	return value
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

const maxMpClientReturnURLLen = 768

type mpReturnURLKind int

const (
	mpReturnSuccessURL mpReturnURLKind = iota
	mpReturnFailureURL
	mpReturnPendingURL
)

func normalizeLimpaeCheckoutPath(u *url.URL) string {
	if u == nil || !strings.EqualFold(u.Scheme, "limpae") {
		return ""
	}
	host := strings.ToLower(strings.TrimSpace(u.Host))
	path := strings.Trim(strings.ToLower(u.Path), "/")
	if host != "" && path != "" {
		return host + "/" + path
	}
	if host != "" {
		return host
	}
	return path
}

func isAllowedLimpaeCheckoutReturnURL(raw string, kind mpReturnURLKind) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" || len(raw) > maxMpClientReturnURLLen {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil || u == nil {
		return false
	}
	p := normalizeLimpaeCheckoutPath(u)
	switch kind {
	case mpReturnSuccessURL:
		return p == "subscription/success" || p == "assinatura/success"
	case mpReturnFailureURL:
		return p == "subscription/failure" || p == "subscription/denied" ||
			p == "assinatura/failure" || p == "assinatura/denied"
	case mpReturnPendingURL:
		return p == "subscription/pending" || p == "assinatura/pending"
	default:
		return false
	}
}

func pickMpCheckoutReturnURL(client string, server string, kind mpReturnURLKind) string {
	if isAllowedLimpaeCheckoutReturnURL(client, kind) {
		return strings.TrimSpace(client)
	}
	return server
}

func resolveMercadoPagoCheckoutBackURLs(req SubscriptionCreateRequestDTO) mpBackURLs {
	return mpBackURLs{
		Success: pickMpCheckoutReturnURL(req.MpSuccessURL, getSubscriptionSuccessURL(), mpReturnSuccessURL),
		Failure: pickMpCheckoutReturnURL(req.MpFailureURL, getSubscriptionFailureURL(), mpReturnFailureURL),
		Pending: pickMpCheckoutReturnURL(req.MpPendingURL, getSubscriptionPendingURL(), mpReturnPendingURL),
	}
}

func getSubscriptionSuccessURL() string {
	return firstNonEmpty(
		os.Getenv("MERCADO_PAGO_SUCCESS_URL"),
		os.Getenv("SUBSCRIPTION_SUCCESS_URL"),
		getSubscriptionEnvOrDefault("STRIPE_CHECKOUT_SUCCESS_URL", defaultSubscriptionSuccessURL),
	)
}

func getSubscriptionFailureURL() string {
	return firstNonEmpty(
		os.Getenv("MERCADO_PAGO_FAILURE_URL"),
		os.Getenv("SUBSCRIPTION_FAILURE_URL"),
		getSubscriptionEnvOrDefault("STRIPE_CHECKOUT_CANCEL_URL", defaultSubscriptionFailureURL),
	)
}

func getSubscriptionPendingURL() string {
	return firstNonEmpty(
		os.Getenv("MERCADO_PAGO_PENDING_URL"),
		os.Getenv("SUBSCRIPTION_PENDING_URL"),
		getSubscriptionEnvOrDefault("STRIPE_CHECKOUT_PENDING_URL", defaultSubscriptionPendingURL),
		getSubscriptionFailureURL(),
	)
}

func getMercadoPagoWebhookPublicURL() string {
	return firstNonEmpty(
		os.Getenv("MERCADO_PAGO_WEBHOOK_URL"),
		os.Getenv("SUBSCRIPTION_WEBHOOK_URL"),
	)
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

func subscriptionPeriodEnd(from time.Time, planKey string) time.Time {
	switch strings.ToLower(strings.TrimSpace(planKey)) {
	case subscriptionPlanMonthly:
		return from.AddDate(0, 1, 0)
	case subscriptionPlanQuarterly:
		return from.AddDate(0, 3, 0)
	case subscriptionPlanYearly:
		return from.AddDate(1, 0, 0)
	default:
		return from.AddDate(0, 1, 0)
	}
}

func normalizeSubscriptionStorageStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "active", "approved":
		return "active"
	case "trialing":
		return "active"
	case "canceled", "cancelled":
		return "canceled"
	case "pending", "pending_waiting_transfer":
		return "pending"
	case "unpaid", "rejected", "inactive", "inactive_subscription":
		return "inactive"
	default:
		return "inactive"
	}
}

func mpPaymentStatusToLocal(payment *mpPaymentResponse) string {
	if payment == nil {
		return "inactive"
	}
	switch strings.ToLower(strings.TrimSpace(payment.Status)) {
	case "approved":
		return "active"
	case "pending", "in_process", "in_mediation":
		return "pending"
	case "rejected", "cancelled", "refunded", "charged_back":
		return "inactive"
	default:
		return "inactive"
	}
}

func parseExternalReference(ref string) (uint, string, string, error) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return 0, "", "", errors.New("external_reference vazio")
	}
	parts := strings.Split(ref, "|")
	if len(parts) != 3 {
		return 0, "", "", errors.New("external_reference invalido")
	}
	uid, err := strconv.ParseUint(strings.TrimSpace(parts[0]), 10, 64)
	if err != nil {
		return 0, "", "", err
	}
	return uint(uid), strings.TrimSpace(parts[1]), strings.TrimSpace(parts[2]), nil
}

func buildExternalReference(userID uint, planKey, role string) string {
	return strconv.FormatUint(uint64(userID), 10) + "|" + planKey + "|" + role
}

// pendingSubscriptionPaymentID evita mp_external_id UNIQUE com ” (varios pendentes).
func pendingSubscriptionPaymentID(preferenceID string) string {
	return "pending:" + strings.TrimSpace(preferenceID)
}

func upsertSubscriptionRecord(tx *gorm.DB, sub models.Subscription) (models.Subscription, error) {
	var existing models.Subscription
	err := tx.Where("user_id = ?", sub.UserID).First(&existing).Error
	switch {
	case err == nil:
		sub.ID = existing.ID
		sub.CreatedAt = existing.CreatedAt
		if sub.PayerID == "" {
			sub.PayerID = existing.PayerID
		}
		if sub.PaymentID == "" {
			sub.PaymentID = existing.PaymentID
		}
		if sub.PlanRef == "" {
			sub.PlanRef = existing.PlanRef
		}
		if sub.PreferenceID == "" {
			sub.PreferenceID = existing.PreferenceID
		}
		if sub.ExpiresAt.IsZero() {
			sub.ExpiresAt = existing.ExpiresAt
		}
		if err := tx.Save(&sub).Error; err != nil {
			return models.Subscription{}, err
		}
		if err := tx.First(&sub, sub.ID).Error; err != nil {
			return models.Subscription{}, err
		}
		return sub, nil
	case errors.Is(err, gorm.ErrRecordNotFound):
		if err := tx.Create(&sub).Error; err != nil {
			return models.Subscription{}, err
		}
		return sub, nil
	default:
		return models.Subscription{}, err
	}
}

func createOrUpdatePendingSubscription(user models.User, plan subscriptionPlanConfig, preferenceID string) (models.Subscription, error) {
	record := models.Subscription{
		UserID:       user.ID,
		Role:         user.Role,
		Plan:         plan.StoragePlan,
		Price:        plan.Price,
		PlanRef:      plan.Plan,
		PaymentID:    pendingSubscriptionPaymentID(preferenceID),
		PreferenceID: preferenceID,
		Status:       normalizeSubscriptionStorageStatus("pending"),
		ExpiresAt:    time.Now().UTC().Add(30 * time.Minute),
	}
	return upsertSubscriptionRecord(config.DB, record)
}

// augmentPaymentExternalRefFromPendingPreference preenche external_reference no objeto de pagamento
// quando a API MP devolve o campo vazio mas inclui preference_id (Checkout Pro).
func augmentPaymentExternalRefFromPendingPreference(tx *gorm.DB, payment *mpPaymentResponse) {
	if payment == nil || strings.TrimSpace(payment.ExternalReference) != "" {
		return
	}
	pid := strings.TrimSpace(payment.PreferenceID)
	if pid == "" {
		return
	}
	var pending models.Subscription
	err := tx.Where(&models.Subscription{PreferenceID: pid}).First(&pending).Error
	if err != nil || pending.UserID == 0 {
		return
	}
	planKey := strings.TrimSpace(pending.PlanRef)
	role := strings.TrimSpace(pending.Role)
	if planKey == "" || role == "" {
		return
	}
	payment.ExternalReference = buildExternalReference(pending.UserID, planKey, role)
}

func syncSubscriptionFromApprovedPayment(tx *gorm.DB, payment *mpPaymentResponse, notificationID string, notificationCreated int64) (models.Subscription, bool, error) {
	if payment == nil {
		return models.Subscription{}, false, errors.New("pagamento ausente")
	}
	augmentPaymentExternalRefFromPendingPreference(tx, payment)
	extRef := strings.TrimSpace(payment.ExternalReference)
	userID, planKey, role, err := parseExternalReference(extRef)
	if err != nil {
		return models.Subscription{}, false, err
	}

	var existing models.Subscription
	err = tx.Where("user_id = ?", userID).First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Subscription{}, false, err
	}

	if existing.ID != 0 && notificationCreated > 0 && existing.LastWebhookEventCreated > notificationCreated {
		return existing, false, nil
	}

	cfg, cfgOk := subscriptionPlanByName(planKey)
	planLabel := normalizeSubscriptionPlan(planKey)
	if cfgOk {
		planLabel = cfg.StoragePlan
	}

	st := mpPaymentStatusToLocal(payment)
	now := time.Now().UTC()
	paymentID := payment.PaymentIDString()
	payerID := payerIDString(payment.Payer)

	priceVal := payment.TransactionAmount
	if cfgOk && priceVal <= 0 {
		priceVal = cfg.Price
	}

	record := models.Subscription{
		ID:                      existing.ID,
		UserID:                  userID,
		Role:                    role,
		Plan:                    planLabel,
		Price:                   priceVal,
		PayerID:                 payerID,
		PaymentID:               paymentID,
		PlanRef:                 planKey,
		PreferenceID:            existing.PreferenceID,
		Status:                  st,
		ExpiresAt:               existing.ExpiresAt,
		CurrentPeriodStart:      existing.CurrentPeriodStart,
		CurrentPeriodEnd:        existing.CurrentPeriodEnd,
		LastWebhookEventID:      notificationID,
		LastWebhookEventCreated: notificationCreated,
	}

	if strings.EqualFold(payment.Status, "approved") {
		record.CurrentPeriodStart = &now
		end := subscriptionPeriodEnd(now, planKey)
		record.CurrentPeriodEnd = &end
		record.ExpiresAt = end
	} else if existing.ID != 0 {
		record.ExpiresAt = existing.ExpiresAt
	}

	if existing.ID != 0 && record.PreferenceID == "" {
		record.PreferenceID = existing.PreferenceID
	}

	updated, err := upsertSubscriptionRecord(tx, record)
	if err != nil {
		return models.Subscription{}, false, err
	}
	return updated, true, nil
}

func preapprovalStatusToLocal(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "authorized":
		return "active"
	case "pending":
		return "pending"
	case "paused":
		return "inactive"
	case "cancelled", "canceled":
		return "canceled"
	default:
		return "inactive"
	}
}

func syncSubscriptionFromPreapproval(tx *gorm.DB, pre *mpPreapprovalResponse, notificationID string, notificationCreated int64) (models.Subscription, bool, error) {
	if pre == nil {
		return models.Subscription{}, false, errors.New("preapproval ausente")
	}
	extRef := strings.TrimSpace(pre.ExternalReference)
	userID, planKey, role, err := parseExternalReference(extRef)
	if err != nil {
		log.Printf("[subscription] preapproval external_reference invalido ou ausente ref=%q err=%v", extRef, err)
		return models.Subscription{}, false, nil
	}

	var existing models.Subscription
	err = tx.Where("user_id = ?", userID).First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Subscription{}, false, err
	}

	if existing.ID != 0 && notificationCreated > 0 && existing.LastWebhookEventCreated > notificationCreated {
		return existing, false, nil
	}

	cfg, cfgOk := subscriptionPlanByName(planKey)
	planLabel := normalizeSubscriptionPlan(planKey)
	if cfgOk {
		planLabel = cfg.StoragePlan
	}

	st := preapprovalStatusToLocal(pre.Status)
	payerID := payerIDFromRaw(pre.PayerID)
	prepID := pre.PreapprovalIDString()

	priceVal := 0.0
	if cfgOk {
		priceVal = cfg.Price
	}

	now := time.Now().UTC()
	record := models.Subscription{
		ID:                      existing.ID,
		UserID:                  userID,
		Role:                    role,
		Plan:                    planLabel,
		Price:                   priceVal,
		PayerID:                 payerID,
		PaymentID:               prepID,
		PlanRef:                 planKey,
		PreferenceID:            existing.PreferenceID,
		Status:                  st,
		ExpiresAt:               existing.ExpiresAt,
		CurrentPeriodStart:      existing.CurrentPeriodStart,
		CurrentPeriodEnd:        existing.CurrentPeriodEnd,
		LastWebhookEventID:      notificationID,
		LastWebhookEventCreated: notificationCreated,
	}

	if strings.EqualFold(pre.Status, "authorized") {
		record.CurrentPeriodStart = &now
		end := subscriptionPeriodEnd(now, planKey)
		record.CurrentPeriodEnd = &end
		record.ExpiresAt = end
	} else if existing.ID != 0 {
		record.ExpiresAt = existing.ExpiresAt
	}

	if existing.ID != 0 && record.PreferenceID == "" {
		record.PreferenceID = existing.PreferenceID
	}

	updated, err := upsertSubscriptionRecord(tx, record)
	if err != nil {
		return models.Subscription{}, false, err
	}
	return updated, true, nil
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

	if !mercadoPagoConfigured() {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "MERCADO_PAGO_ACCESS_TOKEN nao configurada",
			"code":  "mp_token_missing",
		})
	}

	user, err := loadUserByID(userID)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Usuario nao encontrado"})
	}

	existing, _ := GetCurrentSubscriptionForUser(userID)
	if subscriptionStatusAllowsAccess(existing.Status) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Usuario ja possui assinatura valida"})
	}

	token := getMercadoPagoAccessToken()
	extRef := buildExternalReference(user.ID, planConfig.Plan, user.Role)

	itemTitle := "Assinatura Limpae — " + planConfig.Plan
	prefBody := mpPreferenceRequest{
		Items: []mpPreferenceItem{{
			Title:      itemTitle,
			Quantity:   1,
			UnitPrice:  planConfig.Price,
			CurrencyID: "BRL",
		}},
		Payer: mpPayer{Email: user.Email},
		BackURLs: resolveMercadoPagoCheckoutBackURLs(request),
		AutoReturn:        "approved",
		ExternalReference: extRef,
		NotificationURL:   getMercadoPagoWebhookPublicURL(),
		Metadata: map[string]string{
			"user_id": strconv.FormatUint(uint64(user.ID), 10),
			"plan":    planConfig.Plan,
			"role":    user.Role,
		},
	}

	pref, err := createMercadoPagoPreferenceFunc(token, prefBody)
	if err != nil {
		log.Printf("[subscription] mercado pago preference erro: %v", err)
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "Erro ao criar checkout no Mercado Pago"})
	}

	record, err := createOrUpdatePendingSubscription(user, planConfig, pref.ID)
	if err != nil {
		log.Printf("[subscription] persistir assinatura pendente: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Erro ao persistir assinatura pendente",
			"code":  "subscription_persist_failed",
		})
	}

	_ = record

	return c.Status(fiber.StatusCreated).JSON(SubscriptionCheckoutSessionResponseDTO{
		SessionID:        pref.ID,
		URL:              "",
		InitPoint:        pref.InitPoint,
		SandboxInitPoint: pref.SandboxInitPoint,
	})
}

// ConfirmMercadoPagoPayment permite ao app nativo sincronizar a assinatura apos o deep link,
// quando o webhook MP ainda nao correu ou o pagamento veio sem external_reference.
func ConfirmMercadoPagoPayment(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var req MercadoPagoConfirmPaymentRequestDTO
	if decodeErrors := decodeStrictJSON(c, &req); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	payID := strings.TrimSpace(req.PaymentID)
	if payID == "" {
		return writeValidationError(c, []ValidationFieldError{{Field: "payment_id", Reason: "is required"}})
	}

	if !mercadoPagoConfigured() {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "MERCADO_PAGO_ACCESS_TOKEN nao configurada",
			"code":  "mp_token_missing",
		})
	}

	token := getMercadoPagoAccessToken()
	payment, err := getMercadoPagoPaymentFunc(token, payID)
	if err != nil {
		log.Printf("[subscription] confirm-mp-payment consulta MP id=%s err=%v", payID, err)
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": "Nao foi possivel consultar o pagamento no Mercado Pago",
		})
	}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		augmentPaymentExternalRefFromPendingPreference(tx, payment)
		extRef := strings.TrimSpace(payment.ExternalReference)
		puid, _, _, perr := parseExternalReference(extRef)
		if perr != nil {
			return perr
		}
		if puid != userID {
			return errMercadoPagoPaymentUserMismatch
		}
		_, _, syncErr := syncSubscriptionFromApprovedPayment(tx, payment, "app-confirm:"+payID, time.Now().Unix())
		return syncErr
	})

	if err != nil {
		if errors.Is(err, errMercadoPagoPaymentUserMismatch) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Este pagamento nao corresponde ao usuario logado",
				"code":  "mp_payment_user_mismatch",
			})
		}
		log.Printf("[subscription] confirm-mp-payment persistencia id=%s err=%v", payID, err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Nao foi possivel sincronizar a assinatura a partir deste pagamento",
			"code":  "mp_sync_failed",
		})
	}

	return c.JSON(fiber.Map{"received": true})
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
		"error": "Atualizacao manual de assinatura nao e suportada; use o portal Mercado Pago ou novo checkout",
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

	sub, err := GetCurrentSubscriptionForUser(userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Assinatura nao encontrada"})
	}

	now := time.Now().UTC()
	sub.Status = "canceled"
	sub.CanceledAt = &now
	sub.EndedAt = &now
	sub.CancelAt = &now
	sub.CurrentPeriodEnd = &now

	if err := config.DB.Save(&sub).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao persistir cancelamento da assinatura"})
	}

	return c.JSON(fiber.Map{
		"message":      "Assinatura cancelada no aplicativo (renovacao automatica via Mercado Pago deve ser gerenciada na conta MP se aplicavel)",
		"subscription": toSubscriptionResponseDTO(sub),
	})
}

func MercadoPagoWebhookHandler(c *fiber.Ctx) error {
	if !mercadoPagoConfigured() {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "MERCADO_PAGO_ACCESS_TOKEN nao configurada"})
	}

	body := c.Body()
	var note mercadoPagoWebhookNotification
	if err := json.Unmarshal(body, &note); err != nil {
		log.Printf("[subscription] webhook json invalido: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "payload invalido"})
	}

	kind := strings.ToLower(strings.TrimSpace(note.Type))
	if kind == "" {
		kind = strings.ToLower(strings.TrimSpace(note.Topic))
	}
	if kind == "" {
		kind = "payment"
	}

	paymentDataID, errData := parsePaymentIDFromRaw(note.Data.ID)
	if paymentDataID == "" && errData != nil {
		log.Printf("[subscription] webhook sem data.id valido type=%s", note.Type)
		return c.JSON(fiber.Map{"received": true})
	}

	token := getMercadoPagoAccessToken()

	notificationID := ""
	if id, err := parsePaymentIDFromRaw(note.ID); err == nil && id != "" {
		notificationID = id
	}
	if notificationID == "" && paymentDataID != "" {
		notificationID = "mp-data-" + paymentDataID
	}
	if notificationID == "" {
		notificationID = fmt.Sprintf("mp-fallback-%d", time.Now().UnixNano())
	}
	ts := time.Now().Unix()

	switch kind {
	case "subscription_preapproval":
		pre, err := getMercadoPagoPreapprovalFunc(token, paymentDataID)
		if err != nil {
			log.Printf("[subscription] webhook fetch preapproval/subscription falhou id=%s err=%v", paymentDataID, err)
			return c.JSON(fiber.Map{
				"received": true,
				"warning":  "consulta_mp_falhou_veja_logs",
			})
		}
		err = config.DB.Transaction(func(tx *gorm.DB) error {
			dup, err := registerWebhookEventDedupe(tx, notificationID, note.Action)
			if err != nil {
				return err
			}
			if dup {
				return nil
			}
			_, _, err = syncSubscriptionFromPreapproval(tx, pre, notificationID, ts)
			return err
		})
		if err != nil {
			log.Printf("[subscription] webhook preapproval persistencia erro: %v", err)
			return c.JSON(fiber.Map{"received": true, "warning": "persistencia_falhou_veja_logs"})
		}
		return c.JSON(fiber.Map{"received": true})

	case "payment":
		payment, err := getMercadoPagoPaymentFunc(token, paymentDataID)
		if err != nil {
			log.Printf("[subscription] webhook fetch payment falhou id=%s err=%v", paymentDataID, err)
			return c.JSON(fiber.Map{"received": true, "warning": "consulta_pagamento_falhou"})
		}
		if notificationID == "" || strings.HasPrefix(notificationID, "mp-data-") {
			notificationID = "mp-" + paymentDataID + "-" + payment.Status
		}
		err = config.DB.Transaction(func(tx *gorm.DB) error {
			dup, err := registerWebhookEventDedupe(tx, notificationID, note.Action)
			if err != nil {
				return err
			}
			if dup {
				return nil
			}
			_, _, err = syncSubscriptionFromApprovedPayment(tx, payment, notificationID, ts)
			return err
		})
		if err != nil {
			log.Printf("[subscription] webhook payment erro: %v", err)
			return c.JSON(fiber.Map{"received": true, "warning": err.Error()})
		}
		return c.JSON(fiber.Map{"received": true})

	default:
		log.Printf("[subscription] webhook ignorado type=%s", note.Type)
		return c.JSON(fiber.Map{"received": true})
	}
}

func registerWebhookEventDedupe(tx *gorm.DB, eventID string, eventType string) (bool, error) {
	if strings.TrimSpace(eventID) == "" {
		return false, errors.New("event id vazio")
	}
	var existing models.WebhookEventDedupe
	if err := tx.Where("event_id = ?", eventID).First(&existing).Error; err == nil {
		return true, nil
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, err
	}

	rec := models.WebhookEventDedupe{
		EventID:   eventID,
		EventType: eventType,
	}
	if err := tx.Create(&rec).Error; err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return true, nil
		}
		return false, err
	}
	return false, nil
}

func PaymentStripeWebhookHandler(c *fiber.Ctx) error {
	return MercadoPagoWebhookHandler(c)
}

func StripeWebhookHandler(c *fiber.Ctx) error {
	return MercadoPagoWebhookHandler(c)
}
