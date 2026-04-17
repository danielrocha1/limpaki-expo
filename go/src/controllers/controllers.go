package controllers

import (
	"log"
	"net/http"
	"strings"

	"github.com/gofiber/fiber/v2"
	"limpae/go/src/config"
	"limpae/go/src/models"
	"limpae/go/src/utils"
)

const maxUserPhotoSize = 10 * 1024 * 1024

// UploadPhotoHandler receives the authenticated user's image, uploads it to
// Supabase Storage using a stable path based on the user ID, persists the path
// in users.photo, and returns a temporary signed URL for immediate rendering.
func UploadPhotoHandler(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)

	fileHeader, err := c.FormFile("photo")
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Arquivo invalido"})
	}

	contentType := strings.TrimSpace(fileHeader.Header.Get("Content-Type"))
	if !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Apenas imagens sao permitidas"})
	}

	if fileHeader.Size > maxUserPhotoSize {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "A imagem deve ter no maximo 10MB"})
	}

	fileExt := utils.DetectImageExtension(fileHeader)
	if fileExt == "" {
		fileExt = detectExtensionFromContentType(contentType)
	}
	if fileExt == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Formato de imagem nao suportado"})
	}

	fileContent, err := fileHeader.Open()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao abrir o arquivo"})
	}
	defer fileContent.Close()

	filePath := utils.BuildUserPhotoPath(userID, fileExt)
	_, err = utils.UploadFileToSupabase(fileContent, filePath, contentType)
	if err != nil {
		log.Println("Erro ao enviar foto para o Supabase:", err)
		errorMessage := "Erro ao fazer upload da foto: " + err.Error()
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error":  errorMessage,
			"detail": err.Error(),
		})
	}

	signedURL, err := utils.ResolveStoredPhotoURL(filePath)
	if err != nil {
		log.Println("Erro ao gerar signed url da foto:", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error":  "Erro ao gerar acesso da foto: " + err.Error(),
			"detail": err.Error(),
		})
	}

	result := config.DB.Model(&models.User{}).Where("id = ?", userID).Update("photo", filePath)
	if result.Error != nil {
		log.Println("Erro ao salvar caminho da foto no banco:", result.Error)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao salvar caminho da foto"})
	}

	return c.JSON(fiber.Map{
		"url":  signedURL,
		"path": filePath,
	})
}

func detectExtensionFromContentType(contentType string) string {
	switch strings.ToLower(strings.TrimSpace(contentType)) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ""
	}
}
