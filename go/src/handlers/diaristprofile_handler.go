package handlers

import (
	"encoding/json"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
)

func buildDiaristProfileFromDTO(userID uint, request DiaristProfileUpsertRequestDTO) (models.Diarists, []ValidationFieldError) {
	validator := &validationCollector{}
	profile := models.Diarists{
		UserID:          userID,
		Bio:             validateOptionalString(validator, "bio", request.Bio, 2000),
		ExperienceYears: request.ExperienceYears,
		PricePerHour:    request.PricePerHour,
		PricePerDay:     request.PricePerDay,
		Available:       request.Available != nil && *request.Available,
	}
	if request.ExperienceYears < 0 {
		validator.Add("experience_years", "must be zero or greater")
	}
	validateNonNegativeFloat(validator, "price_per_hour", request.PricePerHour)
	validateNonNegativeFloat(validator, "price_per_day", request.PricePerDay)

	specialtiesJSON, err := json.Marshal(request.Specialties)
	if err != nil {
		validator.Add("specialties", "must be a valid string array")
	} else {
		profile.Specialties = string(specialtiesJSON)
	}

	if validator.HasErrors() {
		return models.Diarists{}, validator.errors
	}
	return profile, nil
}

func CreateDiaristProfile(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	if err := requireUserRole(userID, "diarista"); err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Permission denied"})
	}

	var request DiaristProfileUpsertRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	profile, validationErrors := buildDiaristProfileFromDTO(userID, request)
	if len(validationErrors) > 0 {
		return writeValidationError(c, validationErrors)
	}

	if err := config.DB.Where("user_id = ?", userID).Assign(profile).FirstOrCreate(&profile).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create diarist"})
	}
	return c.Status(201).JSON(toDiaristProfileResponseDTO(profile))
}

func GetDiarists(c *fiber.Ctx) error {
	var diarists []models.Diarists
	config.DB.Find(&diarists)

	response := make([]DiaristProfileResponseDTO, 0, len(diarists))
	for _, diarist := range diarists {
		if dto := toDiaristProfileResponseDTO(diarist); dto != nil {
			response = append(response, *dto)
		}
	}
	return c.JSON(response)
}

func GetDiarist(c *fiber.Ctx) error {
	id := c.Params("id")
	var diarist models.Diarists
	if err := config.DB.First(&diarist, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Diarist not found"})
	}
	return c.JSON(toDiaristProfileResponseDTO(diarist))
}

func UpdateDiarist(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	var diarist models.Diarists
	if err := config.DB.Where("user_id = ?", userID).First(&diarist, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Diarist not found"})
	}

	var request DiaristProfileUpsertRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	nextProfile, validationErrors := buildDiaristProfileFromDTO(userID, request)
	if len(validationErrors) > 0 {
		return writeValidationError(c, validationErrors)
	}

	diarist.Bio = nextProfile.Bio
	diarist.ExperienceYears = nextProfile.ExperienceYears
	diarist.PricePerHour = nextProfile.PricePerHour
	diarist.PricePerDay = nextProfile.PricePerDay
	diarist.Specialties = nextProfile.Specialties
	diarist.Available = nextProfile.Available

	config.DB.Save(&diarist)
	return c.JSON(toDiaristProfileResponseDTO(diarist))
}

func DeleteDiarist(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	var diarist models.Diarists
	if err := config.DB.Where("user_id = ?", userID).First(&diarist, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Diarist not found"})
	}
	if err := config.DB.Delete(&models.Diarists{}, diarist.ID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete diarist"})
	}
	return c.JSON(fiber.Map{"message": "Diarist deleted successfully"})
}
