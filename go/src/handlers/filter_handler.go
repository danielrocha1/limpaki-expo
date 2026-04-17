package handlers

import (
	"fmt"
	"math"
	"net/http"
	"strconv"

	"limpae/go/src/config"
	"limpae/go/src/models"
	"limpae/go/src/utils"

	"github.com/gofiber/fiber/v2"
)

func GetNearbyDiarists(c *fiber.Ctx) error {
	latParam := c.Query("latitude")
	lonParam := c.Query("longitude")

	latitude, err1 := strconv.ParseFloat(latParam, 64)
	longitude, err2 := strconv.ParseFloat(lonParam, 64)
	if err1 != nil || err2 != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Parametros de latitude e longitude invalidos"})
	}

	var diarists []models.User
	err := config.DB.
		Preload("Address").
		Preload("DiaristProfile").
		Where("role = ?", "diarista").
		Find(&diarists).Error
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao buscar diaristas"})
	}

	nearbyDiarists := make([]NearbyDiaristResponseDTO, 0)
	for _, diarist := range diarists {
		addr := firstAddressWithCoordinates(diarist.Address)
		if addr == nil {
			continue
		}

		resolvedPhoto, err := utils.ResolveStoredPhotoURL(diarist.Photo)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
		}

		distancePointer := calculateDistanceFromAddressListToCoordinates(
			diarist.Address,
			latitude,
			longitude,
		)
		if distancePointer == nil {
			continue
		}

		km := *distancePointer
		distance := fmt.Sprintf("%.2f km", km)

		var isDiarist bool
		if err := config.DB.Raw(`
			SELECT EXISTS (
				SELECT 1 FROM reviews WHERE diarist_id = ?
			)`, diarist.ID).Scan(&isDiarist).Error; err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao verificar tipo de usuario"})
		}

		var totalReviews int64
		var ratedReviews int64
		var sumRatings float64
		ratingColumn := "diarist_rating"
		if isDiarist {
			ratingColumn = "client_rating"
		}

		if err := config.DB.Table("reviews").
			Where("diarist_id = ?", diarist.ID).
			Count(&totalReviews).Error; err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao calcular rating"})
		}

		if err := config.DB.Table("reviews").
			Where("diarist_id = ? AND "+ratingColumn+" > 0", diarist.ID).
			Count(&ratedReviews).
			Select("COALESCE(SUM(" + ratingColumn + "), 0) AS sum_ratings").
			Scan(&sumRatings).Error; err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao calcular rating"})
		}

		averageRating := 0.0
		if ratedReviews > 0 {
			averageRating = math.Round((sumRatings/float64(ratedReviews))*100) / 100
		}

		nearbyDiarists = append(nearbyDiarists, NearbyDiaristResponseDTO{
			ID:            diarist.ID,
			Name:          diarist.Name,
			Distance:      distance,
			Photo:         resolvedPhoto,
			EmailVerified: diarist.EmailVerified,
			AverageRating: averageRating,
			TotalReviews:  totalReviews,
			Coordinates: AddressCoordinatesDTO{
				Latitude:  addr.Latitude,
				Longitude: addr.Longitude,
			},
			DiaristProfile: toDiaristProfileResponseDTO(diarist.DiaristProfile),
		})
	}

	return c.JSON(nearbyDiarists)
}
