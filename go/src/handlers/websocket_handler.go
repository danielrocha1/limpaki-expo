package handlers

import (
	"fmt"
	"log"
	"net"
	"strings"

	"limpae/go/src/config"
	"limpae/go/src/models"
	"limpae/go/src/realtime"

	"github.com/gofiber/fiber/v2"
)

func OfferWebSocketUpgradeMiddleware(c *fiber.Ctx) error {
	upgradeAuth, statusCode, err := config.AuthenticateWebSocketUpgrade(c, config.ResolveAllowedOrigins())
	if err != nil {
		log.Printf("[ws][offers] upgrade rejected status=%d origin=%q remote=%q error=%v", statusCode, c.Get("Origin"), c.IP(), err)
		return c.Status(statusCode).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	var user models.User
	if err := config.DB.Select("id", "role").First(&user, upgradeAuth.User.ID).Error; err != nil {
		log.Printf("[ws][offers] user lookup failed user_id=%d error=%v", upgradeAuth.User.ID, err)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Usuario nao encontrado",
		})
	}
	hasAccess, err := CanAccessPremiumFeatures(upgradeAuth.User.ID)
	if err != nil || !hasAccess {
		log.Printf("[ws][offers] premium access denied user_id=%d has_access=%t error=%v", upgradeAuth.User.ID, hasAccess, err)
		return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
			"error": "Assinatura valida obrigatoria para acessar este recurso",
		})
	}

	c.Locals("user_id", upgradeAuth.User.ID)
	c.Locals("email", upgradeAuth.User.Email)
	c.Locals("user_role", user.Role)
	c.Locals("ws_key", upgradeAuth.WebSocketKey)
	c.Locals("ws_protocol", upgradeAuth.SelectedProtocol)

	return c.Next()
}

func OfferWebSocketHandler(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(uint)
	if !ok || userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Usuario nao autenticado"})
	}

	userRole, ok := c.Locals("user_role").(string)
	if !ok || userRole == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Perfil do usuario nao encontrado"})
	}

	websocketKey, ok := c.Locals("ws_key").(string)
	if !ok || strings.TrimSpace(websocketKey) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cabecalho Sec-WebSocket-Key ausente"})
	}
	selectedProtocol, _ := c.Locals("ws_protocol").(string)

	acceptKey := realtime.ComputeWebSocketAcceptKey(websocketKey)

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
			log.Printf("[ws] falha no handshake user_id=%d: %v", userID, err)
			_ = conn.Close()
			return
		}

		log.Printf("[ws] websocket conectado user_id=%d role=%s", userID, userRole)
		realtime.OfferHub.RegisterConnection(realtime.NewWSConn(conn), userID, userRole)
	})

	return nil
}
