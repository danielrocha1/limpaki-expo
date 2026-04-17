package handlers

import (
	"bytes"
	"encoding/json"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type ValidationFieldError struct {
	Field  string `json:"field"`
	Reason string `json:"reason"`
}

type ValidationErrorResponse struct {
	Message string                 `json:"message"`
	Errors  []ValidationFieldError `json:"errors"`
}

type validationCollector struct {
	errors []ValidationFieldError
}

func (c *validationCollector) Add(field string, reason string) {
	c.errors = append(c.errors, ValidationFieldError{Field: field, Reason: reason})
}

func (c *validationCollector) HasErrors() bool {
	return len(c.errors) > 0
}

func writeValidationError(c *fiber.Ctx, errors []ValidationFieldError) error {
	return c.Status(fiber.StatusBadRequest).JSON(ValidationErrorResponse{
		Message: "validation failed",
		Errors:  errors,
	})
}

func decodeStrictJSON(c *fiber.Ctx, target interface{}) []ValidationFieldError {
	if len(bytes.TrimSpace(c.Body())) == 0 {
		return []ValidationFieldError{{Field: "body", Reason: "body is required"}}
	}

	decoder := json.NewDecoder(bytes.NewReader(c.Body()))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return []ValidationFieldError{{Field: "body", Reason: err.Error()}}
	}

	if decoder.More() {
		return []ValidationFieldError{{Field: "body", Reason: "body must contain a single JSON object"}}
	}

	return nil
}

func normalizedNonEmpty(value string) string {
	return strings.TrimSpace(value)
}

func validateRequiredString(v *validationCollector, field string, value string, maxLen int) string {
	normalized := normalizedNonEmpty(value)
	if normalized == "" {
		v.Add(field, "is required")
		return ""
	}
	if maxLen > 0 && len(normalized) > maxLen {
		v.Add(field, "is too long")
	}
	return normalized
}

func validateOptionalString(v *validationCollector, field string, value string, maxLen int) string {
	normalized := normalizedNonEmpty(value)
	if maxLen > 0 && len(normalized) > maxLen {
		v.Add(field, "is too long")
	}
	return normalized
}

func validatePositiveFloat(v *validationCollector, field string, value float64, allowZero bool) {
	if allowZero && value == 0 {
		return
	}
	if value <= 0 {
		v.Add(field, "must be greater than zero")
	}
}

func validateNonNegativeFloat(v *validationCollector, field string, value float64) {
	if value < 0 {
		v.Add(field, "must be zero or greater")
	}
}

func validateIntRange(v *validationCollector, field string, value int, min int, max int) {
	if value < min || value > max {
		v.Add(field, "is outside the allowed range")
	}
}

func validateEnum(v *validationCollector, field string, value string, allowed ...string) string {
	normalized := normalizedNonEmpty(strings.ToLower(value))
	if normalized == "" {
		v.Add(field, "is required")
		return ""
	}
	for _, candidate := range allowed {
		if normalized == candidate {
			return normalized
		}
	}
	v.Add(field, "has an invalid value")
	return normalized
}

func validateScheduledAt(v *validationCollector, field string, value time.Time) {
	if value.IsZero() {
		v.Add(field, "is required")
		return
	}
	if value.Before(time.Now().Add(-1 * time.Minute)) {
		v.Add(field, "must be in the future")
	}
}

func validateEmailField(v *validationCollector, field string, value string) string {
	normalized := strings.ToLower(normalizedNonEmpty(value))
	if normalized == "" {
		v.Add(field, "is required")
		return ""
	}
	if !isValidEmail(normalized) {
		v.Add(field, "must be a valid email")
	}
	return normalized
}

func normalizePhone(value string) string {
	replacer := strings.NewReplacer(" ", "", "-", "", "(", "", ")", "", "+", "")
	return replacer.Replace(strings.TrimSpace(value))
}

func validatePhoneField(v *validationCollector, field string, value string) string {
	normalized := normalizePhone(value)
	if normalized == "" {
		v.Add(field, "is required")
		return ""
	}
	matched, _ := regexp.MatchString(`^\d{10,11}$`, normalized)
	if !matched {
		v.Add(field, "must contain 10 or 11 digits")
	}
	return normalized
}

func validateZipcode(v *validationCollector, field string, value string) string {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		v.Add(field, "is required")
		return ""
	}
	matched, _ := regexp.MatchString(`^\d{5}-?\d{3}$`, normalized)
	if !matched {
		v.Add(field, "must be a valid zipcode")
	}
	return normalized
}

func validateState(v *validationCollector, field string, value string) string {
	normalized := strings.ToUpper(strings.TrimSpace(value))
	if len(normalized) != 2 {
		v.Add(field, "must be a 2-letter state code")
	}
	return normalized
}

type UserUpdateRequestDTO struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
	IsTestUser *bool  `json:"is_test_user"`
}

type AddressUpsertRequestDTO struct {
	Street         string                        `json:"street"`
	Number         string                        `json:"number"`
	ResidenceType  string                        `json:"residence_type"`
	Complement     string                        `json:"complement"`
	Neighborhood   string                        `json:"neighborhood"`
	ReferencePoint string                        `json:"reference_point"`
	City           string                        `json:"city"`
	State          string                        `json:"state"`
	Zipcode        string                        `json:"zipcode"`
	Latitude       float64                       `json:"latitude,omitempty"`
	Longitude      float64                       `json:"longitude,omitempty"`
	Rooms          []AddressRoomUpsertRequestDTO `json:"rooms"`
}

type AddressRoomUpsertRequestDTO struct {
	Name     string `json:"name"`
	Quantity int    `json:"quantity"`
}

type DiaristProfileUpsertRequestDTO struct {
	Bio             string   `json:"bio"`
	ExperienceYears int      `json:"experience_years"`
	PricePerHour    float64  `json:"price_per_hour"`
	PricePerDay     float64  `json:"price_per_day"`
	Specialties     []string `json:"specialties"`
	Available       *bool    `json:"available"`
}

type UserProfileUpsertRequestDTO struct {
	ResidenceType    string `json:"residence_type"`
	DesiredFrequency string `json:"desired_frequency"`
	HasPets          *bool  `json:"has_pets"`
}

type OfferCreateRequestDTO struct {
	AddressID     uint      `json:"address_id"`
	ServiceType   string    `json:"service_type"`
	ScheduledAt   time.Time `json:"scheduled_at"`
	DurationHours float64   `json:"duration_hours"`
	InitialValue  float64   `json:"initial_value"`
	Observations  string    `json:"observations"`
}

type OfferNegotiationRequestDTO struct {
	CounterValue         float64 `json:"counter_value"`
	CounterDurationHours float64 `json:"counter_duration_hours"`
	Message              string  `json:"message"`
}

type ActionReasonRequestDTO struct {
	Reason string `json:"reason"`
}

type ServiceCreateRequestDTO struct {
	DiaristID     uint      `json:"diarist_id"`
	AddressID     *uint     `json:"address_id"`
	TotalPrice    float64   `json:"total_price"`
	DurationHours float64   `json:"duration_hours"`
	ScheduledAt   time.Time `json:"scheduled_at"`
	ServiceType   string    `json:"service_type"`
	HasPets       bool      `json:"has_pets"`
	Observations  string    `json:"observations"`
	RoomCount     int       `json:"room_count"`
	BathroomCount int       `json:"bathroom_count"`
}

type PaymentCreateRequestDTO struct {
	ServiceID uint    `json:"service_id"`
	Amount    float64 `json:"amount"`
	Method    string  `json:"method"`
}

type PaymentUpdateRequestDTO struct {
	Amount float64 `json:"amount"`
	Method string  `json:"method"`
}

type SubscriptionCreateRequestDTO struct {
	Plan string `json:"plan"`
}

type ReviewWriteRequestDTO struct {
	ServiceID      uint   `json:"service_id"`
	ClientComment  string `json:"client_comment"`
	ClientRating   int    `json:"client_rating"`
	DiaristComment string `json:"diarist_comment"`
	DiaristRating  int    `json:"diarist_rating"`
}

type StartServiceWithPINRequestDTO struct {
	PIN string `json:"pin"`
}

type UserSummaryDTO struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Photo string `json:"photo"`
	Email string `json:"email,omitempty"`
	Phone int64  `json:"phone,omitempty"`
	Role  string `json:"role,omitempty"`
}

type AddressResponseDTO struct {
	ID             uint                     `json:"id"`
	Street         string                   `json:"street"`
	Number         string                   `json:"number"`
	ResidenceType  string                   `json:"residence_type"`
	Complement     string                   `json:"complement"`
	Neighborhood   string                   `json:"neighborhood"`
	ReferencePoint string                   `json:"reference_point"`
	City           string                   `json:"city"`
	State          string                   `json:"state"`
	Zipcode        string                   `json:"zipcode"`
	Latitude       float64                  `json:"latitude,omitempty"`
	Longitude      float64                  `json:"longitude,omitempty"`
	Rooms          []AddressRoomResponseDTO `json:"rooms,omitempty"`
}

type AddressRoomResponseDTO struct {
	ID       uint   `json:"id"`
	Name     string `json:"name"`
	Quantity int    `json:"quantity"`
}

type DiaristProfileResponseDTO struct {
	ID              uint     `json:"id"`
	UserID          uint     `json:"user_id"`
	Bio             string   `json:"bio"`
	ExperienceYears int      `json:"experience_years"`
	PricePerHour    float64  `json:"price_per_hour"`
	PricePerDay     float64  `json:"price_per_day"`
	Specialties     []string `json:"specialties"`
	Available       bool     `json:"available"`
}

type ReviewResponseDTO struct {
	ID             uint      `json:"id"`
	ServiceID      uint      `json:"service_id"`
	ClientID       uint      `json:"client_id"`
	DiaristID      uint      `json:"diarist_id"`
	ClientComment  string    `json:"client_comment"`
	DiaristComment string    `json:"diarist_comment"`
	ClientRating   int       `json:"client_rating"`
	DiaristRating  int       `json:"diarist_rating"`
	CreatedAt      time.Time `json:"created_at"`
}

type OfferNegotiationResponseDTO struct {
	ID                   uint                       `json:"id"`
	OfferID              uint                       `json:"offer_id"`
	DiaristID            uint                       `json:"diarist_id"`
	CounterValue         float64                    `json:"counter_value"`
	CounterDurationHours float64                    `json:"counter_duration_hours"`
	Status               string                     `json:"status"`
	Message              string                     `json:"message"`
	RejectionReason      string                     `json:"rejection_reason"`
	CreatedAt            time.Time                  `json:"created_at"`
	UpdatedAt            time.Time                  `json:"updated_at"`
	DiaristDistance      *float64                   `json:"diarist_distance,omitempty"`
	DiaristRating        float64                    `json:"diarist_rating"`
	Diarist              UserSummaryDTO             `json:"diarist"`
	DiaristProfile       *DiaristProfileResponseDTO `json:"diarist_profile,omitempty"`
}

type OfferResponseDTO struct {
	ID                  uint                          `json:"id"`
	ClientID            uint                          `json:"client_id"`
	AddressID           *uint                         `json:"address_id"`
	ServiceType         string                        `json:"service_type"`
	ScheduledAt         time.Time                     `json:"scheduled_at"`
	DurationHours       float64                       `json:"duration_hours"`
	InitialValue        float64                       `json:"initial_value"`
	CurrentValue        float64                       `json:"current_value"`
	Status              string                        `json:"status"`
	Observations        string                        `json:"observations"`
	CancelReason        string                        `json:"cancel_reason"`
	ServiceStatus       string                        `json:"service_status,omitempty"`
	AcceptedByDiaristID *uint                         `json:"accepted_by_diarist_id,omitempty"`
	CreatedAt           time.Time                     `json:"created_at"`
	UpdatedAt           time.Time                     `json:"updated_at"`
	Client              UserSummaryDTO                `json:"client"`
	Address             AddressResponseDTO            `json:"address"`
	AcceptedByDiarist   *UserSummaryDTO               `json:"accepted_by_diarist,omitempty"`
	Negotiations        []OfferNegotiationResponseDTO `json:"negotiations,omitempty"`
}

type ServiceResponseDTO struct {
	ID              uint               `json:"id"`
	OfferID         *uint              `json:"offer_id,omitempty"`
	ClientID        uint               `json:"client_id"`
	DiaristID       uint               `json:"diarist_id"`
	AddressID       *uint              `json:"address_id,omitempty"`
	Status          string             `json:"status"`
	TotalPrice      float64            `json:"total_price"`
	DurationHours   float64            `json:"duration_hours"`
	ScheduledAt     time.Time          `json:"scheduled_at"`
	CompletedAt     *time.Time         `json:"completed_at,omitempty"`
	CreatedAt       time.Time          `json:"created_at"`
	ServiceType     string             `json:"service_type"`
	HasPets         bool               `json:"has_pets"`
	Observations    string             `json:"observations"`
	CancelReason    string             `json:"cancel_reason"`
	RejectionReason string             `json:"rejection_reason"`
	RoomCount       int                `json:"room_count"`
	BathroomCount   int                `json:"bathroom_count"`
	StartPIN        string             `json:"start_pin,omitempty"`
	Client          UserSummaryDTO     `json:"client"`
	Diarist         UserSummaryDTO     `json:"diarist"`
	Address         AddressResponseDTO `json:"address"`
	Review          *ReviewResponseDTO `json:"review,omitempty"`
}

type PaymentResponseDTO struct {
	ID        uint       `json:"id"`
	ServiceID uint       `json:"service_id"`
	ClientID  uint       `json:"client_id"`
	DiaristID uint       `json:"diarist_id"`
	Amount    float64    `json:"amount"`
	Status    string     `json:"status"`
	Method    string     `json:"method"`
	PaidAt    *time.Time `json:"paid_at,omitempty"`
}

type SubscriptionResponseDTO struct {
	ID                      uint       `json:"id"`
	UserID                  uint       `json:"user_id"`
	Role                    string     `json:"role"`
	Plan                    string     `json:"plan"`
	Price                   float64    `json:"price"`
	Status                  string     `json:"status"`
	StripeCustomerID        string     `json:"stripe_customer_id,omitempty"`
	StripeSubscriptionID    string     `json:"stripe_subscription_id,omitempty"`
	StripePriceID           string     `json:"stripe_price_id,omitempty"`
	StripeCheckoutSessionID string     `json:"stripe_checkout_session_id,omitempty"`
	CurrentPeriodStart      *time.Time `json:"current_period_start,omitempty"`
	CurrentPeriodEnd        *time.Time `json:"current_period_end,omitempty"`
	CancelAt                *time.Time `json:"cancel_at,omitempty"`
	CanceledAt              *time.Time `json:"canceled_at,omitempty"`
	EndedAt                 *time.Time `json:"ended_at,omitempty"`
	LastWebhookEventID      string     `json:"last_webhook_event_id,omitempty"`
	AccessValid             bool       `json:"access_valid"`
	CreatedAt               time.Time  `json:"created_at"`
	UpdatedAt               time.Time  `json:"updated_at"`
}

type SubscriptionCheckoutSessionResponseDTO struct {
	SessionID string `json:"session_id"`
	URL       string `json:"url"`
}

type UserResponseDTO struct {
	ID              uint                       `json:"id"`
	Name            string                     `json:"name"`
	Photo           string                     `json:"photo"`
	Email           string                     `json:"email"`
	EmailVerified   bool                       `json:"email_verified"`
	EmailVerifiedAt *time.Time                 `json:"email_verified_at,omitempty"`
	Phone           int64                      `json:"phone"`
	Cpf             string                     `json:"cpf"`
	Role            string                     `json:"role"`
	IsTestUser      bool                       `json:"is_test_user"`
	CreatedAt       time.Time                  `json:"created_at"`
	Address         []AddressResponseDTO       `json:"address,omitempty"`
	UserProfile     *UserProfileResponseDTO    `json:"user_profile,omitempty"`
	DiaristProfile  *DiaristProfileResponseDTO `json:"diarist_profile,omitempty"`
}

type UserProfileResponseDTO struct {
	ID               uint   `json:"id"`
	UserID           uint   `json:"user_id"`
	ResidenceType    string `json:"residence_type"`
	HasPets          bool   `json:"has_pets"`
	DesiredFrequency string `json:"desired_frequency"`
}

type OfferClientProfileResponseDTO struct {
	ID            uint                    `json:"id"`
	Name          string                  `json:"name"`
	Photo         string                  `json:"photo"`
	EmailVerified bool                    `json:"email_verified"`
	Address       []AddressResponseDTO    `json:"address,omitempty"`
	UserProfile   *UserProfileResponseDTO `json:"user_profile,omitempty"`
	AverageRating float64                 `json:"average_rating"`
	TotalReviews  int64                   `json:"total_reviews"`
	Reviews       []ReviewResponseDTO     `json:"reviews,omitempty"`
	Observations  string                  `json:"observations"`
	Distance      *float64                `json:"distance,omitempty"`
}

type NearbyDiaristResponseDTO struct {
	ID             uint                       `json:"id"`
	Name           string                     `json:"name"`
	Distance       string                     `json:"distance"`
	Photo          string                     `json:"photo"`
	EmailVerified  bool                       `json:"email_verified"`
	AverageRating  float64                    `json:"average_rating"`
	TotalReviews   int64                      `json:"total_reviews"`
	Coordinates    AddressCoordinatesDTO      `json:"coordinates"`
	DiaristProfile *DiaristProfileResponseDTO `json:"diarist_profile,omitempty"`
}

type AddressCoordinatesDTO struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}
