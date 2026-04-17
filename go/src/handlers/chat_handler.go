package handlers

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"

	chatapp "limpae/go/src/chat"
	chathandler "limpae/go/src/chat/handler"
	chatservice "limpae/go/src/chat/service"
	"limpae/go/src/config"
	"limpae/go/src/realtime"

	"github.com/gofiber/fiber/v2"
)

var (
	chatWSOnce    sync.Once
	chatWSHandler *chathandler.WebSocketHandler
)

func ensureChatRuntime() {
	chatapp.Start()
}

func ChatRoomsHandler(c *fiber.Ctx) error {
	return c.Status(fiber.StatusGone).JSON(fiber.Map{"error": "Chat por sala foi removido; use o chat por servico"})
}

func ChatMessagesHandler(c *fiber.Ctx) error {
	ensureChatRuntime()
	container := chatapp.GetContainer()
	userID, authErr := RequireAuthenticatedUser(c)
	if authErr != nil {
		return authErr
	}

	serviceID, err := strconv.ParseUint(c.Query("service_id"), 10, 64)
	if err != nil || serviceID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "service_id e obrigatorio"})
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "20"))

	ctx, cancel := requestContext(c.Context())
	defer cancel()

	messages, total, err := container.MessageService.GetMessages(ctx, userID, uint(serviceID), page, pageSize)
	if err != nil {
		if errors.Is(err, chatservice.ErrForbidden) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Servico nao encontrado"})
		}
		if errors.Is(err, chatservice.ErrChatUnavailable) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Chat indisponivel para este servico"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao listar mensagens"})
	}

	return c.JSON(fiber.Map{
		"items": messages,
		"pagination": fiber.Map{
			"page":        page,
			"page_size":   pageSize,
			"total_items": total,
		},
	})
}

func ChatLocationsHandler(c *fiber.Ctx) error {
	ensureChatRuntime()
	container := chatapp.GetContainer()
	userID, authErr := RequireAuthenticatedUser(c)
	if authErr != nil {
		return authErr
	}

	serviceID, err := strconv.ParseUint(c.Query("service_id"), 10, 64)
	if err != nil || serviceID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "service_id e obrigatorio"})
	}

	ctx, cancel := requestContext(c.Context())
	defer cancel()

	locations, err := container.LocationService.ListLocations(ctx, userID, uint(serviceID))
	if err != nil {
		if errors.Is(err, chatservice.ErrForbidden) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Servico nao encontrado"})
		}
		if errors.Is(err, chatservice.ErrChatUnavailable) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Chat indisponivel para este servico"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao listar localizacoes"})
	}

	return c.JSON(fiber.Map{"items": locations})
}

func ChatWebSocketUpgradeMiddleware(c *fiber.Ctx) error {
	ensureChatRuntime()

	upgradeAuth, statusCode, err := config.AuthenticateWebSocketUpgrade(c, config.ResolveAllowedOrigins())
	if err != nil {
		slog.Default().Warn("chat websocket upgrade rejected", "status", statusCode, "origin", c.Get("Origin"), "remote", c.IP(), "error", err)
		return c.Status(statusCode).JSON(fiber.Map{"error": err.Error()})
	}

	serviceID, err := chathandler.ParseServiceID(c.Query("service_id"))
	if err != nil || serviceID == 0 {
		slog.Default().Warn("chat websocket missing service_id", "raw_service_id", c.Query("service_id"), "user_id", upgradeAuth.User.ID)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "service_id e obrigatorio"})
	}

	handler := ensureChatWebSocketHandler()
	ctx, cancel := requestContext(c.Context())
	defer cancel()

	hasAccess, accessErr := CanAccessPremiumFeatures(upgradeAuth.User.ID)
	if accessErr != nil || !hasAccess {
		slog.Default().Warn("chat websocket premium access denied", "user_id", upgradeAuth.User.ID, "service_id", serviceID, "has_access", hasAccess, "error", accessErr)
		return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{"error": "Assinatura valida obrigatoria para acessar este recurso"})
	}

	if err := handler.ValidateConnection(ctx, upgradeAuth.User.ID, serviceID); err != nil {
		slog.Default().Warn("chat websocket validation failed", "user_id", upgradeAuth.User.ID, "service_id", serviceID, "error", err)
		switch {
		case errors.Is(err, chatservice.ErrInvalidInput):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		case errors.Is(err, chatservice.ErrForbidden):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Servico nao encontrado"})
		case errors.Is(err, chatservice.ErrChatUnavailable):
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Chat indisponivel para este servico"})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao validar servico"})
		}
	}

	c.Locals("user_id", upgradeAuth.User.ID)
	c.Locals("service_id", serviceID)
	c.Locals("ws_key", upgradeAuth.WebSocketKey)
	c.Locals("ws_protocol", upgradeAuth.SelectedProtocol)
	return c.Next()
}

func ChatWebSocketHandler() fiber.Handler {
	ensureChatRuntime()
	handler := ensureChatWebSocketHandler()

	return func(c *fiber.Ctx) error {
		userID, ok := c.Locals("user_id").(uint)
		if !ok || userID == 0 {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Usuario nao autenticado"})
		}

		serviceID, ok := c.Locals("service_id").(uint)
		if !ok || serviceID == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "service_id e obrigatorio"})
		}

		websocketKey, ok := c.Locals("ws_key").(string)
		if !ok || strings.TrimSpace(websocketKey) == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cabecalho Sec-WebSocket-Key ausente"})
		}

		acceptKey := realtime.ComputeWebSocketAcceptKey(websocketKey)
		selectedProtocol, _ := c.Locals("ws_protocol").(string)

		c.Status(fiber.StatusSwitchingProtocols)
		c.Set("Upgrade", "websocket")
		c.Set("Connection", "Upgrade")
		c.Set("Sec-WebSocket-Accept", acceptKey)
		if selectedProtocol != "" {
			c.Set("Sec-WebSocket-Protocol", selectedProtocol)
		}
		c.Context().HijackSetNoResponse(true)
		c.Context().Hijack(func(conn net.Conn) {
			response := fmt.Sprintf(
				"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n",
				acceptKey,
			)
			if selectedProtocol != "" {
				response += fmt.Sprintf("Sec-WebSocket-Protocol: %s\r\n", selectedProtocol)
			}
			response += "\r\n"

			if _, err := fmt.Fprint(conn, response); err != nil {
				slog.Default().Error("chat websocket handshake failed", "user_id", userID, "service_id", serviceID, "error", err)
				_ = conn.Close()
				return
			}

			handler.ServeConn(userID, serviceID, realtime.NewWSConn(conn))
		})

		return nil
	}
}

func requestContext(_ interface{}) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 5*time.Second)
}

func ensureChatWebSocketHandler() *chathandler.WebSocketHandler {
	chatWSOnce.Do(func() {
		container := chatapp.GetContainer()
		chatWSHandler = chathandler.NewWebSocketHandler(
			slog.Default(),
			container.ServiceAccess,
			container.MessageService,
			container.LocationService,
			container.Hub,
		)
	})

	return chatWSHandler
}
