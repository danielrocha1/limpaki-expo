package config

import (
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v4"
)

type AuthenticatedUser struct {
	ID    uint
	Email string
}

type WebSocketUpgradeAuth struct {
	User             *AuthenticatedUser
	WebSocketKey     string
	SelectedProtocol string
	Origin           string
}

func ExtractBearerToken(c *fiber.Ctx) string {
	authHeader := strings.TrimSpace(c.Get("Authorization"))
	if authHeader != "" {
		tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if tokenString != authHeader {
			return tokenString
		}
	}

	cookieToken := strings.TrimSpace(c.Cookies("auth_token"))
	if cookieToken != "" {
		return cookieToken
	}

	return ""
}

func ExtractWebSocketBearerToken(c *fiber.Ctx) string {
	if token := parseWebSocketProtocolToken(c.Get("Sec-WebSocket-Protocol")); token != "" {
		return token
	}

	if token := strings.TrimSpace(c.Query("access_token")); token != "" {
		return token
	}

	if token := strings.TrimSpace(c.Query("token")); token != "" {
		return token
	}

	return strings.TrimSpace(c.Cookies("auth_token"))
}

func ResolveAllowedOrigins() []string {
	if csv := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS")); csv != "" {
		return splitCSV(csv)
	}

	origins := make([]string, 0, 5)
	if value := strings.TrimSpace(os.Getenv("FRONT_END_URL")); value != "" {
		origins = append(origins, value)
	}
	if value := strings.TrimSpace(os.Getenv("FRONT_END_URL1")); value != "" {
		origins = append(origins, value)
	}
	if len(origins) == 0 {
		origins = append(origins,
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"https://limpae.onrender.com",
			"https://limpae-jcqa.onrender.com",
		)
	}

	return normalizeOrigins(origins)
}

func IsAllowedOrigin(requestOrigin string, allowedOrigins []string) bool {
	normalizedRequestOrigin := normalizeOrigin(requestOrigin)
	if normalizedRequestOrigin == "" {
		return false
	}

	normalizedAllowedOrigins := normalizeOrigins(allowedOrigins)
	if slices.Contains(normalizedAllowedOrigins, "*") || slices.Contains(normalizedAllowedOrigins, normalizedRequestOrigin) {
		return true
	}

	return strings.HasPrefix(normalizedRequestOrigin, "https://") &&
		strings.HasSuffix(normalizedRequestOrigin, ".onrender.com")
}

func ValidateWebSocketOrigin(c *fiber.Ctx, allowedOrigins []string) error {
	requestOrigin := normalizeOrigin(c.Get("Origin"))
	if requestOrigin == "" {
		return errors.New("origin ausente")
	}

	normalizedAllowedOrigins := normalizeOrigins(allowedOrigins)
	if len(normalizedAllowedOrigins) == 0 {
		return errors.New("nenhum origin permitido configurado")
	}

	if IsAllowedOrigin(requestOrigin, normalizedAllowedOrigins) {
		return nil
	}

	return fmt.Errorf("origin nao permitido: %s", requestOrigin)
}

func AuthenticateWebSocketUpgrade(c *fiber.Ctx, allowedOrigins []string) (*WebSocketUpgradeAuth, int, error) {
	if !isWebSocketUpgradeRequest(c) {
		return nil, fiber.StatusUpgradeRequired, errors.New("requisicao deve ser um upgrade para WebSocket")
	}

	if err := ValidateWebSocketOrigin(c, allowedOrigins); err != nil {
		return nil, fiber.StatusForbidden, err
	}

	websocketKey := strings.TrimSpace(c.Get("Sec-WebSocket-Key"))
	if websocketKey == "" {
		return nil, fiber.StatusBadRequest, errors.New("cabecalho Sec-WebSocket-Key ausente")
	}

	tokenString := ExtractWebSocketBearerToken(c)
	if tokenString == "" {
		return nil, fiber.StatusUnauthorized, errors.New("token ausente no protocolo do websocket")
	}

	authenticatedUser, err := ParseJWTToken(tokenString)
	if err != nil {
		return nil, fiber.StatusUnauthorized, err
	}

	return &WebSocketUpgradeAuth{
		User:             authenticatedUser,
		WebSocketKey:     websocketKey,
		SelectedProtocol: selectWebSocketProtocol(c.Get("Sec-WebSocket-Protocol")),
		Origin:           normalizeOrigin(c.Get("Origin")),
	}, fiber.StatusOK, nil
}

func isWebSocketUpgradeRequest(c *fiber.Ctx) bool {
	connectionHeader := strings.ToLower(c.Get("Connection"))
	upgradeHeader := strings.ToLower(c.Get("Upgrade"))

	return strings.Contains(connectionHeader, "upgrade") && upgradeHeader == "websocket"
}

func ParseJWTToken(tokenString string) (*AuthenticatedUser, error) {
	secretKey := os.Getenv("JWT_SECRET")
	if secretKey == "" {
		return nil, errors.New("chave secreta nao configurada")
	}

	if strings.TrimSpace(tokenString) == "" {
		return nil, errors.New("token ausente")
	}

	token, err := jwt.ParseWithClaims(tokenString, jwt.MapClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("metodo de assinatura invalido: %v", token.Header["alg"])
		}

		return []byte(secretKey), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("token invalido")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("erro ao extrair dados do token")
	}

	expValue, ok := claims["exp"]
	if !ok {
		return nil, errors.New("token sem expiracao")
	}

	expirationFloat, ok := expValue.(float64)
	if !ok {
		return nil, errors.New("expiracao do token invalida")
	}

	if time.Now().Unix() > int64(expirationFloat) {
		return nil, errors.New("token expirado")
	}

	userIDValue, ok := claims["user_id"]
	if !ok {
		return nil, errors.New("id do usuario ausente")
	}

	userIDFloat, ok := userIDValue.(float64)
	if !ok {
		return nil, errors.New("id do usuario invalido")
	}

	userEmailValue, ok := claims["email"]
	if !ok {
		return nil, errors.New("email do usuario ausente")
	}

	userEmail, ok := userEmailValue.(string)
	if !ok || userEmail == "" {
		return nil, errors.New("email do usuario invalido")
	}

	return &AuthenticatedUser{
		ID:    uint(userIDFloat),
		Email: userEmail,
	}, nil
}

func parseWebSocketProtocolToken(protocolHeader string) string {
	for _, part := range strings.Split(protocolHeader, ",") {
		token := strings.TrimSpace(part)
		if !strings.HasPrefix(strings.ToLower(token), "bearer.") {
			continue
		}

		return strings.TrimSpace(token[len("bearer."):])
	}

	return ""
}

func selectWebSocketProtocol(protocolHeader string) string {
	for _, part := range strings.Split(protocolHeader, ",") {
		protocol := strings.TrimSpace(part)
		if strings.EqualFold(protocol, "json") {
			return "json"
		}
	}

	return ""
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return normalizeOrigins(out)
}

func normalizeOrigins(origins []string) []string {
	unique := make([]string, 0, len(origins))
	seen := make(map[string]struct{}, len(origins))

	for _, origin := range origins {
		normalized := normalizeOrigin(origin)
		if normalized == "" {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		unique = append(unique, normalized)
	}

	return unique
}

func normalizeOrigin(origin string) string {
	trimmed := strings.TrimSpace(origin)
	if trimmed == "" {
		return ""
	}
	if trimmed == "*" {
		return "*"
	}

	return strings.TrimRight(strings.ToLower(trimmed), "/")
}
