package config

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
)

// Carregar variáveis de ambiente do .env
func init() {
	err := godotenv.Load("./src/config/.env")
	if err != nil {
		if runningUnderGoTest() {
			log.Println("Aviso ao carregar o .env:", err)
			return
		}
		log.Fatal("Erro ao carregar o .env:", err)
	}
}

func runningUnderGoTest() bool {
	binaryName := filepath.Base(os.Args[0])
	return strings.Contains(binaryName, ".test")
}

// JWTMiddleware valida o token e armazena o ID do usuário no contexto
func JWTMiddleware(c *fiber.Ctx) error {
	tokenString := ExtractBearerToken(c)
	if tokenString == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token ausente"})
	}

	user, err := ParseJWTToken(tokenString)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	log.Println("JWT autenticado para o usuário", user.ID)

	c.Locals("user_id", user.ID)
	c.Locals("email", user.Email)

	return c.Next()
}
