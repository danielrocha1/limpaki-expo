package handlers

import (
	"errors"
	"math"
	"strings"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func validateRating(v *validationCollector, field string, value int) {
	if value < 1 || value > 5 {
		v.Add(field, "must be between 1 and 5")
	}
}

func hasReviewFeedback(rating int, comment string) bool {
	return rating > 0 || strings.TrimSpace(comment) != ""
}

func CreateReview(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var request ReviewWriteRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	validator := &validationCollector{}
	if request.ServiceID == 0 {
		validator.Add("service_id", "is required")
	}
	request.ClientComment = validateOptionalString(validator, "client_comment", request.ClientComment, 1000)
	request.DiaristComment = validateOptionalString(validator, "diarist_comment", request.DiaristComment, 1000)
	if request.ClientRating != 0 {
		validateRating(validator, "client_rating", request.ClientRating)
	}
	if request.DiaristRating != 0 {
		validateRating(validator, "diarist_rating", request.DiaristRating)
	}
	if validator.HasErrors() {
		return writeValidationError(c, validator.errors)
	}

	serviceModel, err := findScopedService(userID, request.ServiceID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Service not found"})
	}

	var existingReview models.Review
	err = config.DB.Where("service_id = ?", request.ServiceID).First(&existingReview).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if serviceModel.ClientID != userID {
			return c.Status(403).JSON(fiber.Map{"error": "Permission denied"})
		}
		if !hasReviewFeedback(request.ClientRating, request.ClientComment) {
			return writeValidationError(c, []ValidationFieldError{
				{Field: "client_comment", Reason: "client_rating or client_comment is required"},
			})
		}
		review := models.Review{
			ServiceID:     serviceModel.ID,
			ClientID:      serviceModel.ClientID,
			DiaristID:     serviceModel.DiaristID,
			ClientComment: request.ClientComment,
			ClientRating:  request.ClientRating,
		}
		if err := config.DB.Create(&review).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create review"})
		}
		return c.Status(201).JSON(toReviewResponseDTO(review))
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load review"})
	}

	if serviceModel.DiaristID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Permission denied"})
	}
	if !hasReviewFeedback(request.DiaristRating, request.DiaristComment) {
		return writeValidationError(c, []ValidationFieldError{
			{Field: "diarist_comment", Reason: "diarist_rating or diarist_comment is required"},
		})
	}

	existingReview.DiaristComment = request.DiaristComment
	existingReview.DiaristRating = request.DiaristRating
	if err := config.DB.Save(&existingReview).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update review"})
	}
	return c.JSON(toReviewResponseDTO(existingReview))
}

func GetReviews(c *fiber.Ctx) error {
	var reviews []models.Review
	config.DB.Find(&reviews)

	response := make([]ReviewResponseDTO, 0, len(reviews))
	for _, review := range reviews {
		if dto := toReviewResponseDTO(review); dto != nil {
			response = append(response, *dto)
		}
	}
	return c.JSON(response)
}

func GetReview(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	review, err := findScopedReview(userID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Review not found"})
	}
	return c.JSON(toReviewResponseDTO(review))
}

func UpdateReview(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	review, err := findScopedReview(userID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Review not found"})
	}

	var request ReviewWriteRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}
	validator := &validationCollector{}
	request.ClientComment = validateOptionalString(validator, "client_comment", request.ClientComment, 1000)
	request.DiaristComment = validateOptionalString(validator, "diarist_comment", request.DiaristComment, 1000)
	if request.ClientRating != 0 {
		validateRating(validator, "client_rating", request.ClientRating)
	}
	if request.DiaristRating != 0 {
		validateRating(validator, "diarist_rating", request.DiaristRating)
	}
	if validator.HasErrors() {
		return writeValidationError(c, validator.errors)
	}

	if review.ClientID == userID {
		if !hasReviewFeedback(request.ClientRating, request.ClientComment) {
			return writeValidationError(c, []ValidationFieldError{
				{Field: "client_comment", Reason: "client_rating or client_comment is required"},
			})
		}
		review.ClientComment = request.ClientComment
		review.ClientRating = request.ClientRating
	} else if review.DiaristID == userID {
		if !hasReviewFeedback(request.DiaristRating, request.DiaristComment) {
			return writeValidationError(c, []ValidationFieldError{
				{Field: "diarist_comment", Reason: "diarist_rating or diarist_comment is required"},
			})
		}
		review.DiaristComment = request.DiaristComment
		review.DiaristRating = request.DiaristRating
	} else {
		return c.Status(403).JSON(fiber.Map{"error": "Permission denied"})
	}

	config.DB.Save(&review)
	return c.JSON(toReviewResponseDTO(review))
}

func DeleteReview(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	review, err := findScopedReview(userID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Review not found"})
	}
	config.DB.Delete(&models.Review{}, review.ID)
	return c.JSON(fiber.Map{"message": "Review deleted successfully"})
}

func GetDiaristReviews(c *fiber.Ctx) error {
	diaristID := c.Params("id")
	var reviews []models.Review

	if err := config.DB.Where("diarist_id = ?", diaristID).
		Order("created_at DESC").
		Find(&reviews).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao buscar avaliacoes"})
	}

	response := make([]ReviewResponseDTO, 0, len(reviews))
	for _, review := range reviews {
		if !hasReviewFeedback(review.ClientRating, review.ClientComment) {
			continue
		}
		if dto := toReviewResponseDTO(review); dto != nil {
			response = append(response, *dto)
		}
	}
	return c.JSON(response)
}

func GetWeightedRating(c *fiber.Ctx) error {
	userID := c.Params("id")

	var totalReviews int64
	var ratedReviews int64
	var sumRatings float64
	var isDiarist bool

	if err := config.DB.Raw(`
        SELECT EXISTS (
            SELECT 1 FROM reviews WHERE diarist_id = ?
        )`, userID).Scan(&isDiarist).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao verificar tipo de usuario"})
	}

	if isDiarist {
		if err := config.DB.Table("reviews").
			Where("diarist_id = ? AND (client_rating > 0 OR TRIM(COALESCE(client_comment, '')) <> '')", userID).
			Count(&totalReviews).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao calcular quantidade de avaliacoes"})
		}
		if err := config.DB.Table("reviews").
			Where("diarist_id = ? AND client_rating > 0", userID).
			Count(&ratedReviews).
			Select("COALESCE(SUM(client_rating), 0) AS sum_ratings").
			Scan(&sumRatings).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao calcular rating"})
		}
	} else {
		if err := config.DB.Table("reviews").
			Where("client_id = ? AND (diarist_rating > 0 OR TRIM(COALESCE(diarist_comment, '')) <> '')", userID).
			Count(&totalReviews).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao calcular quantidade de avaliacoes"})
		}
		if err := config.DB.Table("reviews").
			Where("client_id = ? AND diarist_rating > 0", userID).
			Count(&ratedReviews).
			Select("COALESCE(SUM(diarist_rating), 0) AS sum_ratings").
			Scan(&sumRatings).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao calcular rating"})
		}
	}

	if ratedReviews == 0 {
		return c.JSON(fiber.Map{"rating": 0, "total_reviews": totalReviews})
	}

	averageRating := math.Round((sumRatings/float64(ratedReviews))*100) / 100
	return c.JSON(fiber.Map{"rating": averageRating, "total_reviews": totalReviews})
}
