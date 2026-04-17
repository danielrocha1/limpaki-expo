package handlers

import (
	"errors"
	"strings"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func subscriptionStatusAllowsAccess(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "active", "trialing":
		return true
	default:
		return false
	}
}

func GetCurrentSubscriptionForUser(userID uint) (models.Subscription, error) {
	var sub models.Subscription
	err := config.DB.Where("user_id = ?", userID).First(&sub).Error
	return sub, err
}

func isTestUser(userID uint) (bool, error) {
	var user models.User
	if err := config.DB.Select("id", "is_test_user").First(&user, userID).Error; err != nil {
		return false, err
	}
	return user.IsTestUser, nil
}

func HasValidSubscription(userID uint) (bool, error) {
	testUser, err := isTestUser(userID)
	if err == nil && testUser {
		return true, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, err
	}

	sub, err := GetCurrentSubscriptionForUser(userID)
	if err != nil {
		return false, err
	}
	return subscriptionStatusAllowsAccess(sub.Status), nil
}

func CanAccessPremiumFeatures(userID uint) (bool, error) {
	return HasValidSubscription(userID)
}

func RequireValidSubscriptionMiddleware(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	hasAccess, accessErr := HasValidSubscription(userID)
	if accessErr != nil {
		return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
			"error": "Assinatura valida obrigatoria para acessar este recurso",
		})
	}
	if !hasAccess {
		return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
			"error": "Assinatura valida obrigatoria para acessar este recurso",
		})
	}

	return c.Next()
}
