package handlers

import (
	"strconv"
	"strings"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
)

type UpdateProfilePayload struct {
	Name             string   `json:"name"`
	Email            string   `json:"email"`
	Phone            string   `json:"phone"`
	Bio              string   `json:"bio"`
	ExperienceYears  int      `json:"experience_years"`
	ResidenceType    string   `json:"residence_type"`
	DesiredFrequency string   `json:"desired_frequency"`
	HasPets          *bool    `json:"has_pets"`
	PricePerHour     float64  `json:"price_per_hour"`
	PricePerDay      float64  `json:"price_per_day"`
	Specialties      []string `json:"specialties"`
	Available        *bool    `json:"available"`
}

func buildUserProfileFromDTO(userID uint, request UserProfileUpsertRequestDTO) (models.UserProfile, []ValidationFieldError) {
	validator := &validationCollector{}
	residenceType := validateEnum(validator, "residence_type", request.ResidenceType, "apartment", "house", "studio")
	desiredFrequency := validateEnum(validator, "desired_frequency", request.DesiredFrequency, "weekly", "biweekly", "monthly", "occasional")
	if validator.HasErrors() {
		return models.UserProfile{}, validator.errors
	}

	return models.UserProfile{
		UserID:           userID,
		ResidenceType:    residenceType,
		DesiredFrequency: desiredFrequency,
		HasPets:          request.HasPets != nil && *request.HasPets,
	}, nil
}

func CreateUserProfile(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var request UserProfileUpsertRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	profile, validationErrors := buildUserProfileFromDTO(userID, request)
	if len(validationErrors) > 0 {
		return writeValidationError(c, validationErrors)
	}

	if err := config.DB.Where("user_id = ?", userID).Assign(profile).FirstOrCreate(&profile).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create userprofile"})
	}
	return c.Status(201).JSON(toUserProfileResponseDTO(profile))
}

func GetUserProfiles(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var userprofiles []models.UserProfile
	config.DB.Where("user_id = ?", userID).Find(&userprofiles)

	response := make([]UserProfileResponseDTO, 0, len(userprofiles))
	for _, profile := range userprofiles {
		if dto := toUserProfileResponseDTO(profile); dto != nil {
			response = append(response, *dto)
		}
	}
	return c.JSON(response)
}

func GetUserProfile(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var user models.User
	if err := config.DB.Preload("UserProfile").Preload("DiaristProfile").Preload("Address").Preload("Address.Rooms").First(&user, userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Usuario nao encontrado"})
	}
	if err := resolveUserPhoto(&user); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}

	return c.JSON(toUserResponseDTO(user))
}

func UpdateProfile(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var payload UpdateProfilePayload
	if decodeErrors := decodeStrictJSON(c, &payload); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	var user models.User
	if err := config.DB.Preload("UserProfile").Preload("DiaristProfile").Preload("Address").Preload("Address.Rooms").First(&user, userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Usuario nao encontrado"})
	}

	validator := &validationCollector{}
	name := validateOptionalString(validator, "name", payload.Name, 100)
	email := ""
	if strings.TrimSpace(payload.Email) != "" {
		email = validateEmailField(validator, "email", payload.Email)
	}
	var phoneValue int64
	if strings.TrimSpace(payload.Phone) != "" {
		phoneDigits := validatePhoneField(validator, "phone", payload.Phone)
		if !validator.HasErrors() {
			parsedPhone, parseErr := strconv.ParseInt(phoneDigits, 10, 64)
			if parseErr != nil {
				validator.Add("phone", "must contain only digits")
			} else {
				phoneValue = parsedPhone
			}
		}
	}
	if validator.HasErrors() {
		return writeValidationError(c, validator.errors)
	}

	tx := config.DB.Begin()
	if tx.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao iniciar transacao"})
	}

	updates := map[string]interface{}{}
	if name != "" {
		updates["name"] = name
	}
	if email != "" {
		updates["email"] = email
	}
	if phoneValue != 0 {
		updates["phone"] = phoneValue
	}
	if len(updates) > 0 {
		if err := tx.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao atualizar usuario"})
		}
	}

	if user.Role == "diarista" {
		profile, validationErrors := buildDiaristProfileFromDTO(userID, DiaristProfileUpsertRequestDTO{
			Bio:             payload.Bio,
			ExperienceYears: payload.ExperienceYears,
			PricePerHour:    payload.PricePerHour,
			PricePerDay:     payload.PricePerDay,
			Specialties:     payload.Specialties,
			Available:       payload.Available,
		})
		if len(validationErrors) > 0 {
			tx.Rollback()
			return writeValidationError(c, validationErrors)
		}

		if err := tx.Where("user_id = ?", userID).Assign(profile).FirstOrCreate(&models.Diarists{}, models.Diarists{UserID: userID}).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao atualizar perfil da diarista"})
		}
	} else {
		profile, validationErrors := buildUserProfileFromDTO(userID, UserProfileUpsertRequestDTO{
			ResidenceType:    payload.ResidenceType,
			DesiredFrequency: payload.DesiredFrequency,
			HasPets:          payload.HasPets,
		})
		if len(validationErrors) > 0 {
			tx.Rollback()
			return writeValidationError(c, validationErrors)
		}

		if err := tx.Where("user_id = ?", userID).Assign(profile).FirstOrCreate(&models.UserProfile{}, models.UserProfile{UserID: userID}).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao atualizar preferencias do cliente"})
		}
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao salvar alteracoes"})
	}

	if err := config.DB.Preload("UserProfile").Preload("DiaristProfile").Preload("Address").Preload("Address.Rooms").First(&user, userID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao carregar perfil atualizado"})
	}
	if err := resolveUserPhoto(&user); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}

	return c.JSON(toUserResponseDTO(user))
}

func UpdateUserProfile(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	var userprofile models.UserProfile
	if err := config.DB.Where("user_id = ?", userID).First(&userprofile, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	var request UserProfileUpsertRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	nextProfile, validationErrors := buildUserProfileFromDTO(userID, request)
	if len(validationErrors) > 0 {
		return writeValidationError(c, validationErrors)
	}

	userprofile.ResidenceType = nextProfile.ResidenceType
	userprofile.HasPets = nextProfile.HasPets
	userprofile.DesiredFrequency = nextProfile.DesiredFrequency
	config.DB.Save(&userprofile)
	return c.JSON(toUserProfileResponseDTO(userprofile))
}

func DeleteUserProfile(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	var userprofile models.UserProfile
	if err := config.DB.Where("user_id = ?", userID).First(&userprofile, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}
	if err := config.DB.Delete(&models.UserProfile{}, userprofile.ID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete userprofile"})
	}
	return c.JSON(fiber.Map{"message": "User deleted successfully"})
}
