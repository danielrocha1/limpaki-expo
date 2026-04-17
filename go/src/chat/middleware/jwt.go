package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const userIDContextKey contextKey = "chat_user_id"

type JWTMiddleware struct {
	secret []byte
}

func NewJWTMiddleware(secret string) *JWTMiddleware {
	return &JWTMiddleware{secret: []byte(secret)}
}

func (m *JWTMiddleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, err := m.ParseRequest(r)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userIDContextKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (m *JWTMiddleware) ParseRequest(r *http.Request) (uint, error) {
	tokenString := strings.TrimSpace(parseWebSocketProtocolToken(r.Header.Values("Sec-WebSocket-Protocol")))
	if tokenString == "" {
		header := strings.TrimSpace(r.Header.Get("Authorization"))
		if strings.HasPrefix(strings.ToLower(header), "bearer ") {
			tokenString = strings.TrimSpace(header[7:])
		}
	}
	if tokenString == "" {
		return 0, errors.New("missing token")
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return m.secret, nil
	})
	if err != nil || !token.Valid {
		return 0, errors.New("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, errors.New("invalid claims")
	}

	rawUserID, ok := claims["user_id"]
	if !ok {
		return 0, errors.New("missing user_id")
	}

	switch value := rawUserID.(type) {
	case float64:
		return uint(value), nil
	case int64:
		return uint(value), nil
	default:
		return 0, errors.New("invalid user_id")
	}
}

func UserIDFromContext(ctx context.Context) (uint, bool) {
	value, ok := ctx.Value(userIDContextKey).(uint)
	return value, ok
}

func parseWebSocketProtocolToken(protocolHeaders []string) string {
	for _, header := range protocolHeaders {
		for _, part := range strings.Split(header, ",") {
			token := strings.TrimSpace(part)
			if !strings.HasPrefix(strings.ToLower(token), "bearer.") {
				continue
			}

			return strings.TrimSpace(token[len("bearer."):])
		}
	}

	return ""
}
