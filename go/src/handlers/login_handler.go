package handlers

import (
	"os"
	"strings"
	"time"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v4"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

func shouldUseSecureCookies() bool {
	appEnv := os.Getenv("APP_ENV")
	return appEnv == "production" || appEnv == "staging" || appEnv == "render"
}

func LoginHandler(c *fiber.Ctx) error {
	var request LoginRequest
	if err := c.BodyParser(&request); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	var user models.User
	if err := config.DB.Where("email = ?", strings.ToLower(strings.TrimSpace(request.Email))).First(&user).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(request.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":        user.ID,
		"email":          user.Email,
		"email_verified": user.EmailVerified,
		"exp":            time.Now().Add(24 * time.Hour).Unix(),
	})

	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
		Value:    tokenString,
		HTTPOnly: true,
		Secure:   shouldUseSecureCookies(),
		SameSite: "None",
		Path:     "/",
		MaxAge:   60 * 60 * 24,
		Expires:  time.Now().Add(24 * time.Hour),
	})

	return c.JSON(fiber.Map{
		"token":          tokenString,
		"email_verified": user.EmailVerified,
		"user_id":        user.ID,
	})
}
