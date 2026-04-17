package handlers

import (
	"encoding/json"
	"fmt"
	"limpae/go/src/config"
	"limpae/go/src/models"
	"regexp"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

// Estrutura para o payload de registro unificado
type RegisterPayload struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	Phone      int64  `json:"phone"`
	Cpf        string `json:"cpf"`
	Password   string `json:"password"`
	Role       string `json:"role"`
	IsTestUser bool   `json:"is_test_user"`

	Address models.Address `json:"address"`

	ClientPreferences models.UserProfile `json:"client_preferences"`

	DiaristProfile struct {
		Bio             string   `json:"bio"`
		ExperienceYears int      `json:"experience_years"`
		PricePerHour    float64  `json:"price_per_hour"`
		PricePerDay     float64  `json:"price_per_day"`
		Specialties     []string `json:"specialties"`
		Available       bool     `json:"available"`
	} `json:"diarist_profile"`
}

// Função para validar CPF
func isValidCPF(cpf string) bool {
	cpf = strings.TrimSpace(cpf)
	cpf = strings.ReplaceAll(strings.ReplaceAll(cpf, ".", ""), "-", "")

	if len(cpf) != 11 || todosDigitosIguais(cpf) {
		return false
	}

	digito1 := calcularDigito(cpf[:9], 10)
	digito2 := calcularDigito(cpf[:10], 11)

	return cpf[9:] == fmt.Sprintf("%d%d", digito1, digito2)
}

func todosDigitosIguais(cpf string) bool {
	for i := 1; i < len(cpf); i++ {
		if cpf[i] != cpf[0] {
			return false
		}
	}
	return true
}

func calcularDigito(cpfParcial string, pesoInicial int) int {
	soma := 0
	for i, peso := 0, pesoInicial; i < len(cpfParcial); i, peso = i+1, peso-1 {
		num, _ := strconv.Atoi(string(cpfParcial[i]))
		soma += num * peso
	}

	resto := soma % 11
	if resto < 2 {
		return 0
	}
	return 11 - resto
}

func isValidEmail(email string) bool {
	re := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return re.MatchString(email)
}

func isValidPhone(phone int64) bool {
	phoneStr := strconv.FormatInt(phone, 10)
	return len(phoneStr) >= 10 && len(phoneStr) <= 11
}

func hashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedPassword), nil
}

const defaultPhotoURL = "https://e7.pngegg.com/pngimages/956/783/png-clipart-computer-icons-female-youtube-woman-avatar-business-woman-face-black-hair-thumbnail.png"

func CreateUser(c *fiber.Ctx) error {
	payload := new(RegisterPayload)
	if err := c.BodyParser(payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Dados inválidos"})
	}

	if payload.Name == "" || payload.Email == "" || payload.Phone == 0 || payload.Cpf == "" || payload.Password == "" || payload.Role == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Campos obrigatórios faltando"})
	}
	if !isValidEmail(payload.Email) {
		return c.Status(400).JSON(fiber.Map{"error": "E-mail inválido"})
	}
	if !isValidPhone(payload.Phone) {
		return c.Status(400).JSON(fiber.Map{"error": "Telefone inválido (deve ter 10 ou 11 dígitos)"})
	}
	if !isValidCPF(payload.Cpf) {
		return c.Status(400).JSON(fiber.Map{"error": "CPF inválido"})
	}
	if payload.Role != "cliente" && payload.Role != "diarista" {
		return c.Status(400).JSON(fiber.Map{"error": "Papel deve ser 'cliente' ou 'diarista'"})
	}

	existingUser := models.User{}
	normalizedEmail := normalizeEmailAddress(payload.Email)
	if err := config.DB.Where("email = ? OR phone = ? OR cpf = ?", normalizedEmail, payload.Phone, payload.Cpf).First(&existingUser).Error; err == nil {
		return c.Status(400).JSON(fiber.Map{"error": "E-mail, telefone ou CPF já cadastrado"})
	}

	hashedPassword, err := hashPassword(payload.Password)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao criar hash da senha"})
	}

	user := models.User{
		Name:         strings.TrimSpace(payload.Name),
		Email:        normalizedEmail,
		Phone:        payload.Phone,
		Cpf:          strings.TrimSpace(payload.Cpf),
		PasswordHash: hashedPassword,
		Role:         strings.TrimSpace(payload.Role),
		IsTestUser:   payload.IsTestUser,
		Photo:        defaultPhotoURL,
	}

	tx := config.DB.Begin()
	if tx.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao iniciar transação"})
	}

	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao criar usuário"})
	}

	address := payload.Address
	rooms := address.Rooms
	address.Rooms = nil
	address.UserID = user.ID
	if err := tx.Create(&address).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao cadastrar endereço"})
	}

	if user.Role == "cliente" {
		if len(rooms) == 0 {
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{"error": "Pelo menos um cômodo deve ser informado"})
		}
		for index := range rooms {
			rooms[index].AddressID = address.ID
		}
		if err := tx.Create(&rooms).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao cadastrar cômodos do endereço"})
		}
	}

	if user.Role == "cliente" {
		profile := payload.ClientPreferences
		profile.UserID = user.ID
		if err := tx.Create(&profile).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao criar perfil de cliente"})
		}
	} else if user.Role == "diarista" {
		specialtiesJSON, err := json.Marshal(payload.DiaristProfile.Specialties)
		if err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao serializar especialidades"})
		}

		profile := models.Diarists{
			UserID:          user.ID,
			Bio:             payload.DiaristProfile.Bio,
			ExperienceYears: payload.DiaristProfile.ExperienceYears,
			PricePerHour:    payload.DiaristProfile.PricePerHour,
			PricePerDay:     payload.DiaristProfile.PricePerDay,
			Specialties:     string(specialtiesJSON),
			Available:       payload.DiaristProfile.Available,
		}

		if err := tx.Create(&profile).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao criar perfil de diarista"})
		}
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao finalizar cadastro"})
	}

	verificationEmailSent := dispatchVerificationEmail(user)

	user.PasswordHash = ""
	return c.Status(201).JSON(fiber.Map{
		"id":                      user.ID,
		"email":                   user.Email,
		"role":                    user.Role,
		"email_verified":          false,
		"verification_email_sent": verificationEmailSent,
		"message": func() string {
			if verificationEmailSent {
				return "Cadastro concluido. Enviamos um e-mail para voce confirmar sua conta."
			}
			return "Cadastro concluido, mas nao foi possivel enviar o e-mail agora. Voce pode reenviar depois."
		}(),
	})
}

func GetUsers(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	user, err := findScopedUser(userID, userID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Usuário não encontrado"})
	}
	if err := resolveUserPhoto(&user); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}

	return c.JSON([]UserResponseDTO{toUserResponseDTO(user)})
}

func GetUser(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	targetID := c.Params("id")
	user, err := findScopedUser(userID, targetID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Usuário não encontrado"})
	}
	if err := resolveUserPhoto(&user); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}
	return c.JSON(toUserResponseDTO(user))
}

func UpdateUser(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	targetID := c.Params("id")
	user, err := findScopedUser(userID, targetID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Usuário não encontrado"})
	}
	var request UserUpdateRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}
	validator := &validationCollector{}
	name := validateOptionalString(validator, "name", request.Name, 100)
	email := validateEmailField(validator, "email", request.Email)
	phoneDigits := validatePhoneField(validator, "phone", request.Phone)
	if validator.HasErrors() {
		return writeValidationError(c, validator.errors)
	}

	phoneValue, parseErr := strconv.ParseInt(phoneDigits, 10, 64)
	if parseErr != nil {
		return writeValidationError(c, []ValidationFieldError{{Field: "phone", Reason: "must contain only digits"}})
	}

	user.Name = name
	emailChanged := user.Email != email
	user.Email = email
	user.Phone = phoneValue
	if request.IsTestUser != nil {
		user.IsTestUser = *request.IsTestUser
	}
	if emailChanged {
		user.EmailVerified = false
		user.EmailVerifiedAt = nil
	}
	config.DB.Save(&user)
	if emailChanged {
		dispatchVerificationEmail(user)
	}
	if err := resolveUserPhoto(&user); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}
	return c.JSON(toUserResponseDTO(user))
}

func DeleteUser(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	targetID := c.Params("id")
	user, err := findScopedUser(userID, targetID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Usuário não encontrado"})
	}

	config.DB.Delete(&models.User{}, user.ID)
	return c.SendStatus(204)
}

func GetUserRole(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)

	fmt.Println("ID", userID)

	var user models.User

	if err := config.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Usuário não encontrado",
		})
	}

	return c.JSON(fiber.Map{
		"role":           user.Role,
		"email_verified": user.EmailVerified,
		"is_test_user":   user.IsTestUser,
	})
}
