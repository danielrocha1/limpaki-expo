package handlers

import (
	"limpae/go/src/realtime"

	"github.com/gofiber/fiber/v2"
)

func GetOnlineUsers(c *fiber.Ctx) error {
	role := c.Query("role")
	if role == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Parametro role e obrigatorio",
		})
	}

	return c.JSON(fiber.Map{
		"role":     role,
		"user_ids": realtime.OfferHub.OnlineUserIDsByRole(role),
	})
}
