package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

const (
	emailVerificationTokenTTL    = time.Hour
	emailVerificationResendDelay = time.Minute
)

type VerifyEmailRequestDTO struct {
	Token string `json:"token"`
}

func normalizeEmailAddress(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func hashVerificationToken(token string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(token)))
	return hex.EncodeToString(sum[:])
}

func generateEmailVerificationToken() (string, string, error) {
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", "", err
	}

	token := base64.RawURLEncoding.EncodeToString(randomBytes)
	return token, hashVerificationToken(token), nil
}

func resolveEmailVerificationBaseURL() string {
	candidates := []string{
		strings.TrimSpace(os.Getenv("FRONT_END_URL")),
		strings.TrimSpace(os.Getenv("FRONT_END_URL1")),
		strings.TrimSpace(os.Getenv("APP_URL")),
		strings.TrimSpace(os.Getenv("PUBLIC_APP_URL")),
	}

	for _, candidate := range candidates {
		if candidate != "" {
			return strings.TrimRight(candidate, "/")
		}
	}

	allowedOrigins := config.ResolveAllowedOrigins()
	if len(allowedOrigins) > 0 {
		return strings.TrimRight(allowedOrigins[0], "/")
	}

	return "http://localhost:3000"
}

func buildEmailVerificationURL(token string) string {
	return fmt.Sprintf("%s/verify-email?token=%s", resolveEmailVerificationBaseURL(), token)
}

func resolveVerificationSender() string {
	fromAddress := strings.TrimSpace(os.Getenv("RESEND_FROM_EMAIL"))
	fromName := strings.TrimSpace(os.Getenv("RESEND_FROM_NAME"))
	if fromAddress == "" {
		return ""
	}
	if fromName == "" {
		fromName = "Limpae"
	}
	return fmt.Sprintf("%s <%s>", fromName, fromAddress)
}

func sendVerificationEmail(user models.User, token string) error {
	apiKey := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	fromAddress := resolveVerificationSender()
	if apiKey == "" {
		return fmt.Errorf("RESEND_API_KEY nao configurada")
	}
	if fromAddress == "" {
		return fmt.Errorf("RESEND_FROM_EMAIL nao configurado")
	}

	verificationURL := buildEmailVerificationURL(token)
	html := fmt.Sprintf(`
		<div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a">
			<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbeafe;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.08)">
				<div style="padding:28px 28px 20px;background:linear-gradient(135deg,#1d4ed8 0%%,#60a5fa 100%%);color:#ffffff">
					<p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#facc15;font-weight:800">Limpaê</p>
					<h1 style="margin:0;font-size:28px;line-height:1.2;color:#fde68a">Confirme seu e-mail</h1>
				</div>
				<div style="padding:28px">
					<p style="margin:0 0 16px;font-size:16px;line-height:1.7">
						Olá, %s. Falta só confirmar seu e-mail para manter sua conta segura e garantir que você receba avisos importantes.
					</p>
					<p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#334155">
						Clique no botão abaixo para concluir a ativação. Este link expira em 1 hora.
					</p>
					<p style="margin:0 0 24px">
						<a href="%s" style="display:inline-block;padding:14px 22px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:14px;font-weight:700">
							Confirmar e-mail
						</a>
					</p>
					<div style="padding:16px;border-radius:16px;background:#eff6ff;border:1px solid #bfdbfe">
						<p style="margin:0 0 8px;font-size:14px;color:#475569">Se preferir, copie este link:</p>
						<p style="margin:0;font-size:14px;word-break:break-all;color:#1d4ed8">%s</p>
					</div>
				</div>
			</div>
		</div>
	`, user.Name, verificationURL, verificationURL)

	payload := strings.NewReader(fmt.Sprintf(`{"from":%q,"to":[%q],"subject":%q,"html":%q}`,
		fromAddress,
		user.Email,
		"Confirme seu e-mail no Limpae",
		html,
	))

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", payload)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		trimmedBody := strings.TrimSpace(string(body))
		if trimmedBody != "" {
			return fmt.Errorf("resend retornou status %d: %s", resp.StatusCode, trimmedBody)
		}
		return fmt.Errorf("resend retornou status %d", resp.StatusCode)
	}

	return nil
}

func createEmailVerificationToken(tx *gorm.DB, user models.User) (string, string, error) {
	token, tokenHash, err := generateEmailVerificationToken()
	if err != nil {
		return "", "", err
	}

	if err := tx.Where("user_id = ? AND used_at IS NULL", user.ID).
		Delete(&models.EmailVerificationToken{}).Error; err != nil {
		return "", "", err
	}

	record := models.EmailVerificationToken{
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(emailVerificationTokenTTL).UTC(),
	}

	if err := tx.Create(&record).Error; err != nil {
		return "", "", err
	}

	return token, tokenHash, nil
}

func dispatchVerificationEmail(user models.User) bool {
	var token string
	var tokenHash string
	err := config.DB.Transaction(func(tx *gorm.DB) error {
		var lookupUser models.User
		if err := tx.First(&lookupUser, user.ID).Error; err != nil {
			return err
		}

		generatedToken, generatedTokenHash, err := createEmailVerificationToken(tx, lookupUser)
		if err != nil {
			return err
		}
		token = generatedToken
		tokenHash = generatedTokenHash
		return nil
	})
	if err != nil {
		log.Printf("[email_verification] erro ao criar token user_id=%d: %v", user.ID, err)
		return false
	}

	if err := sendVerificationEmail(user, token); err != nil {
		if tokenHash != "" {
			_ = config.DB.Where("token_hash = ?", tokenHash).Delete(&models.EmailVerificationToken{}).Error
		}
		log.Printf("[email_verification] erro ao enviar e-mail user_id=%d: %v", user.ID, err)
		return false
	}

	return true
}

func VerifyEmailHandler(c *fiber.Ctx) error {
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		var request VerifyEmailRequestDTO
		if err := c.BodyParser(&request); err == nil {
			token = strings.TrimSpace(request.Token)
		}
	}

	if token == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Token de verificacao nao informado",
		})
	}

	var verificationToken models.EmailVerificationToken
	err := config.DB.Preload("User").
		Where("token_hash = ?", hashVerificationToken(token)).
		First(&verificationToken).Error
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Link de verificacao invalido ou expirado",
		})
	}

	if verificationToken.UsedAt != nil || verificationToken.ExpiresAt.Before(time.Now()) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Link de verificacao invalido ou expirado",
		})
	}

	now := time.Now().UTC()
	err = config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.User{}).
			Where("id = ?", verificationToken.UserID).
			Updates(map[string]interface{}{
				"email_verified":    true,
				"email_verified_at": now,
			}).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.EmailVerificationToken{}).
			Where("id = ?", verificationToken.ID).
			Update("used_at", now).Error; err != nil {
			return err
		}

		return tx.Model(&models.EmailVerificationToken{}).
			Where("user_id = ? AND id <> ? AND used_at IS NULL", verificationToken.UserID, verificationToken.ID).
			Update("used_at", now).Error
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Nao foi possivel confirmar o e-mail agora",
		})
	}

	return c.JSON(fiber.Map{
		"message":        "E-mail confirmado com sucesso",
		"email_verified": true,
	})
}

func ResendVerificationEmailHandler(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Usuario nao encontrado",
		})
	}

	if user.EmailVerified {
		return c.JSON(fiber.Map{
			"message":        "Seu e-mail ja esta verificado",
			"email_verified": true,
		})
	}

	var lastToken models.EmailVerificationToken
	if err := config.DB.
		Where("user_id = ?", user.ID).
		Order("created_at DESC").
		First(&lastToken).Error; err == nil {
		if time.Since(lastToken.CreatedAt) < emailVerificationResendDelay {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Aguarde alguns segundos antes de reenviar o e-mail",
			})
		}
	}

	if !dispatchVerificationEmail(user) {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": "Não foi possível reenviar o e-mail de verificação agora. Verifique o remetente configurado no Resend.",
		})
	}

	return c.JSON(fiber.Map{
		"message":        "E-mail de verificação reenviado com sucesso",
		"email_verified": false,
	})
}
