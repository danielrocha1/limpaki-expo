package handlers

import (
	"fmt"
	"github.com/gofiber/fiber/v2"
	"gopkg.in/gomail.v2"
	"io"
	"os"
)

func UploadDocuments(c *fiber.Ctx) error {
	fields := []string{
		"rgFront",
		"rgBack",
		"cpf",
		"comprovante",
		"selfie",
	}

	from := os.Getenv("EMAIL_FROM")
	to := os.Getenv("EMAIL_ALERT_TO")
	password := os.Getenv("EMAIL_PASSWORD")

	userID := c.Locals("user_id").(uint) // Certifique-se de converter para uint se necessário
	userIDStr := fmt.Sprintf("%v", userID)

	userEmail := c.Locals("email").(string) // Certifique-se de converter para uint se necessário

	m := gomail.NewMessage()
	m.SetHeader("From", from)
	m.SetHeader("To", to)
	m.SetHeader("Subject", "Documentação do usuário")
	body := fmt.Sprintf(
	`Olá,

Segue em anexo a documentação enviada por um usuário da plataforma.

🧾 Informações do usuário:
- ID: %v
- Email: %v

📎 Documentos enviados estão anexados neste e-mail.

Atenciosamente,
Sistema de Validação`,
	userIDStr,
	userEmail,
)

m.SetBody("text/plain", body)

	filesAnexados := 0
	erros := []string{}

	for _, field := range fields {
		fileHeader, err := c.FormFile(field)
		if err != nil {
			msg := fmt.Sprintf("Arquivo faltando ou inválido: %s", field)
			fmt.Println(msg)
			erros = append(erros, msg)
			continue
		}

		file, err := fileHeader.Open()
		if err != nil {
			msg := fmt.Sprintf("Erro ao abrir o arquivo %s: %v", fileHeader.Filename, err)
			fmt.Println(msg)
			erros = append(erros, msg)
			continue
		}
		defer file.Close()

		m.Attach(fileHeader.Filename, gomail.SetCopyFunc(func(w io.Writer) error {
			_, err := io.Copy(w, file)
			return err
		}))


		if err != nil {
			msg := fmt.Sprintf("Erro ao anexar o arquivo %s: %v", fileHeader.Filename, err)
			fmt.Println(msg)
			erros = append(erros, msg)
			continue
		}

		filesAnexados++
	}

	if filesAnexados == 0 {
		return c.Status(400).JSON(fiber.Map{
			"message": "Nenhum arquivo foi enviado com sucesso.",
			"errors":  erros,
		})
	}

	d := gomail.NewDialer("smtp.kinghost.net", 587, from, password)
	if err := d.DialAndSend(m); err != nil {
		return c.Status(500).SendString("Erro ao enviar e-mail: " + err.Error())
	}

	return c.JSON(fiber.Map{
		"message":       "Documentos enviados com sucesso.",
		"arquivos":      filesAnexados,
		"errosParciais": erros,
	})
}
