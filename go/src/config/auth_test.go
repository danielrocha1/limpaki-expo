package config

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v4"
)

func signedTestToken(t *testing.T, userID uint, email string) string {
	t.Helper()

	oldSecret := os.Getenv("JWT_SECRET")
	_ = os.Setenv("JWT_SECRET", "test-secret")
	t.Cleanup(func() {
		_ = os.Setenv("JWT_SECRET", oldSecret)
	})

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": float64(userID),
		"email":   email,
		"exp":     time.Now().Add(time.Hour).Unix(),
	})

	signed, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func TestAuthenticateWebSocketUpgradeRejectsMissingToken(t *testing.T) {
	app := fiber.New()
	app.Get("/ws", func(c *fiber.Ctx) error {
		_, status, err := AuthenticateWebSocketUpgrade(c, []string{"https://app.example.com"})
		if err == nil {
			return c.SendStatus(fiber.StatusNoContent)
		}
		return c.Status(status).JSON(fiber.Map{"error": err.Error()})
	})

	req := httptest.NewRequest("GET", "/ws", nil)
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Sec-WebSocket-Key", "test-key")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

func TestAuthenticateWebSocketUpgradeRejectsForbiddenOrigin(t *testing.T) {
	token := signedTestToken(t, 1, "user@example.com")
	app := fiber.New()
	app.Get("/ws", func(c *fiber.Ctx) error {
		_, status, err := AuthenticateWebSocketUpgrade(c, []string{"https://app.example.com"})
		if err == nil {
			return c.SendStatus(fiber.StatusNoContent)
		}
		return c.Status(status).JSON(fiber.Map{"error": err.Error()})
	})

	req := httptest.NewRequest("GET", "/ws", nil)
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Origin", "https://evil.example.com")
	req.Header.Set("Sec-WebSocket-Key", "test-key")
	req.AddCookie(&http.Cookie{Name: "auth_token", Value: token})

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("status = %d, want 403", resp.StatusCode)
	}
}

func TestAuthenticateWebSocketUpgradeAcceptsCookieToken(t *testing.T) {
	token := signedTestToken(t, 7, "user@example.com")
	app := fiber.New()
	app.Get("/ws", func(c *fiber.Ctx) error {
		auth, status, err := AuthenticateWebSocketUpgrade(c, []string{"https://app.example.com"})
		if err != nil {
			return c.Status(status).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"user_id": auth.User.ID, "origin": auth.Origin})
	})

	req := httptest.NewRequest("GET", "/ws", nil)
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Sec-WebSocket-Key", "test-key")
	req.AddCookie(&http.Cookie{Name: "auth_token", Value: token})

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
}

func TestAuthenticateWebSocketUpgradeAcceptsQueryToken(t *testing.T) {
	token := signedTestToken(t, 9, "user@example.com")
	app := fiber.New()
	app.Get("/ws", func(c *fiber.Ctx) error {
		auth, status, err := AuthenticateWebSocketUpgrade(c, []string{"https://app.example.com"})
		if err != nil {
			return c.Status(status).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"user_id": auth.User.ID, "origin": auth.Origin})
	})

	req := httptest.NewRequest("GET", "/ws?access_token="+token, nil)
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Sec-WebSocket-Key", "test-key")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
}
