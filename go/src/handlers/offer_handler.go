package handlers

import (
	"limpae/go/src/config"
	"limpae/go/src/models"
	"limpae/go/src/realtime"
	"limpae/go/src/utils"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func getDiaristWeightedRating(diaristID uint) (float64, error) {
	var ratedReviews int64
	var sumRatings float64

	if err := config.DB.Table("reviews").
		Where("diarist_id = ? AND client_rating > 0", diaristID).
		Count(&ratedReviews).
		Select("COALESCE(SUM(client_rating), 0) AS sum_ratings").
		Scan(&sumRatings).Error; err != nil {
		return 0, err
	}

	if ratedReviews == 0 {
		return 0, nil
	}

	averageRating := math.Round((sumRatings/float64(ratedReviews))*100) / 100
	return averageRating, nil
}

func getClientWeightedRating(clientID uint) (float64, int64, error) {
	var totalReviews int64
	var ratedReviews int64
	var sumRatings float64

	if err := config.DB.Table("reviews").
		Where("client_id = ? AND (diarist_rating > 0 OR TRIM(COALESCE(diarist_comment, '')) <> '')", clientID).
		Count(&totalReviews).Error; err != nil {
		return 0, 0, err
	}

	if err := config.DB.Table("reviews").
		Where("client_id = ? AND diarist_rating > 0", clientID).
		Count(&ratedReviews).
		Select("COALESCE(SUM(diarist_rating), 0) AS sum_ratings").
		Scan(&sumRatings).Error; err != nil {
		return 0, 0, err
	}

	if ratedReviews == 0 {
		return 0, totalReviews, nil
	}

	averageRating := math.Round((sumRatings/float64(ratedReviews))*100) / 100
	return averageRating, totalReviews, nil
}

// CalculateDistance calcula a distancia em km entre duas coordenadas usando a formula de Haversine
func CalculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Raio da Terra em km
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

func hasCoordinates(lat, lon float64) bool {
	return lat != 0 && lon != 0
}

func firstAddressWithCoordinates(addresses []models.Address) *models.Address {
	for index := range addresses {
		address := &addresses[index]
		if hasCoordinates(address.Latitude, address.Longitude) {
			return address
		}
	}

	return nil
}

func calculateDistancePointer(lat1, lon1, lat2, lon2 float64) *float64 {
	if !hasCoordinates(lat1, lon1) || !hasCoordinates(lat2, lon2) {
		return nil
	}

	distance := CalculateDistance(lat1, lon1, lat2, lon2)
	return &distance
}

func calculateDistanceBetweenAddresses(origin, destination *models.Address) *float64 {
	if origin == nil || destination == nil {
		return nil
	}

	return calculateDistancePointer(
		origin.Latitude,
		origin.Longitude,
		destination.Latitude,
		destination.Longitude,
	)
}

func calculateMinimumDistanceBetweenAddressLists(originAddresses, destinationAddresses []models.Address) *float64 {
	var minDistance *float64

	for originIndex := range originAddresses {
		origin := &originAddresses[originIndex]
		if !hasCoordinates(origin.Latitude, origin.Longitude) {
			continue
		}

		for destinationIndex := range destinationAddresses {
			destination := &destinationAddresses[destinationIndex]
			if !hasCoordinates(destination.Latitude, destination.Longitude) {
				continue
			}

			distance := CalculateDistance(
				origin.Latitude,
				origin.Longitude,
				destination.Latitude,
				destination.Longitude,
			)

			if minDistance == nil || distance < *minDistance {
				nextDistance := distance
				minDistance = &nextDistance
			}
		}
	}

	return minDistance
}

func calculateDistanceFromAddressListToCoordinates(addresses []models.Address, lat, lon float64) *float64 {
	if !hasCoordinates(lat, lon) {
		return nil
	}

	var minDistance *float64
	for index := range addresses {
		address := &addresses[index]
		if !hasCoordinates(address.Latitude, address.Longitude) {
			continue
		}

		distance := CalculateDistance(address.Latitude, address.Longitude, lat, lon)
		if minDistance == nil || distance < *minDistance {
			nextDistance := distance
			minDistance = &nextDistance
		}
	}

	return minDistance
}

// OfferForDiarist representa uma oferta para visualizacao da diarista, com informacoes limitadas de endereco.
type OfferForDiarist struct {
	ID                    uint                      `json:"id"`
	ClientID              uint                      `json:"client_id"`
	Address               *AddressResponseDTO       `json:"address,omitempty"`
	ClientRating          float64                   `json:"client_rating"`
	ClientTotalReviews    int64                     `json:"client_total_reviews"`
	ServiceType           string                    `json:"service_type"`
	ScheduledAt           time.Time                 `json:"scheduled_at"`
	DurationHours         float64                   `json:"duration_hours"`
	InitialValue          float64                   `json:"initial_value"`
	CurrentValue          float64                   `json:"current_value"`
	Status                string                    `json:"status"`
	Observations          string                    `json:"observations"`
	ClientName            string                    `json:"client_name"`
	ClientPhoto           string                    `json:"client_photo"`
	AddressNeighborhood   string                    `json:"address_neighborhood"`
	AddressCity           string                    `json:"address_city"`
	Distance              *float64                  `json:"distance"`
	HasPendingNegotiation bool                      `json:"has_pending_negotiation"`
	Negotiations          []models.OfferNegotiation `json:"negotiations"`
}

type DiaristNegotiationResponse struct {
	ID                   uint       `json:"id"`
	OfferID              uint       `json:"offer_id"`
	DiaristID            uint       `json:"diarist_id"`
	ClientName           string     `json:"client_name"`
	ClientPhoto          string     `json:"client_photo"`
	AddressNeighborhood  string     `json:"address_neighborhood"`
	ScheduledAt          *time.Time `json:"scheduled_at"`
	DurationHours        float64    `json:"duration_hours"`
	InitialValue         float64    `json:"initial_value"`
	CounterValue         float64    `json:"counter_value"`
	CounterDurationHours float64    `json:"counter_duration_hours"`
	Status               string     `json:"status"`
	Message              string     `json:"message"`
	RejectionReason      string     `json:"rejection_reason"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
	Distance             *float64   `json:"distance"`
}

type diaristNegotiationRow struct {
	ID                   uint      `gorm:"column:id"`
	OfferID              uint      `gorm:"column:offer_id"`
	DiaristID            uint      `gorm:"column:diarist_id"`
	ClientName           string    `gorm:"column:client_name"`
	ClientPhoto          string    `gorm:"column:client_photo"`
	AddressNeighborhood  string    `gorm:"column:address_neighborhood"`
	ScheduledAt          time.Time `gorm:"column:scheduled_at"`
	DurationHours        float64   `gorm:"column:duration_hours"`
	InitialValue         float64   `gorm:"column:initial_value"`
	CounterValue         float64   `gorm:"column:counter_value"`
	CounterDurationHours float64   `gorm:"column:counter_duration_hours"`
	Status               string    `gorm:"column:status"`
	Message              string    `gorm:"column:message"`
	RejectionReason      string    `gorm:"column:rejection_reason"`
	CreatedAt            time.Time `gorm:"column:created_at"`
	UpdatedAt            time.Time `gorm:"column:updated_at"`
	OfferLatitude        float64   `gorm:"column:offer_latitude"`
	OfferLongitude       float64   `gorm:"column:offer_longitude"`
}

type diaristOpenOfferRow struct {
	ID                    uint
	ClientID              uint
	AddressID             *uint
	ServiceType           string
	ScheduledAt           time.Time
	DurationHours         float64
	InitialValue          float64
	CurrentValue          float64
	Status                string
	Observations          string
	ClientName            string
	ClientPhoto           string
	AddressNeighborhood   string
	AddressCity           string
	OfferLatitude         float64
	OfferLongitude        float64
	HasPendingNegotiation bool
}

func getPaginationParams(c *fiber.Ctx) (int, int, int) {
	page, err := strconv.Atoi(c.Query("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}

	pageSize, err := strconv.Atoi(c.Query("page_size", "6"))
	if err != nil || pageSize < 1 {
		pageSize = 6
	}

	if pageSize > 20 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	return page, pageSize, offset
}

func buildPaginationPayload(page int, pageSize int, totalItems int64) fiber.Map {
	totalPages := int((totalItems + int64(pageSize) - 1) / int64(pageSize))
	if totalPages == 0 {
		totalPages = 1
	}

	if page > totalPages {
		page = totalPages
	}

	return fiber.Map{
		"page":         page,
		"page_size":    pageSize,
		"total_items":  totalItems,
		"total_pages":  totalPages,
		"has_next":     page < totalPages,
		"has_previous": page > 1,
	}
}

// CreateOffer - Criar uma nova oferta (Cliente)
func CreateOffer(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	if err := requireUserRole(userID, "cliente"); err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Sem permissao para criar oferta"})
	}

	var request OfferCreateRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}
	validator := &validationCollector{}
	if request.AddressID == 0 {
		validator.Add("address_id", "is required")
	}
	serviceType := validateRequiredString(validator, "service_type", request.ServiceType, 50)
	observations := validateOptionalString(validator, "observations", request.Observations, 4000)
	validateScheduledAt(validator, "scheduled_at", request.ScheduledAt)
	validatePositiveFloat(validator, "duration_hours", request.DurationHours, false)
	validateNonNegativeFloat(validator, "initial_value", request.InitialValue)
	if validator.HasErrors() {
		return writeValidationError(c, validator.errors)
	}

	addressID := request.AddressID
	if _, err := findOwnedAddress(userID, addressID); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Endereco nao encontrado"})
	}

	offer := &models.Offer{
		ClientID:      userID,
		AddressID:     &addressID,
		ServiceType:   serviceType,
		ScheduledAt:   request.ScheduledAt,
		DurationHours: request.DurationHours,
		InitialValue:  request.InitialValue,
		CurrentValue:  request.InitialValue,
		Status:        "aberta",
		Observations:  observations,
	}

	if err := config.DB.Create(&offer).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao criar oferta"})
	}

	// Retorna a oferta com os dados carregados
	config.DB.Preload("Client").Preload("Address").First(&offer, offer.ID)

	realtime.PublishOfferCreated(realtime.OfferEventPayload{
		OfferID:       offer.ID,
		ClientID:      offer.ClientID,
		Status:        offer.Status,
		ServiceType:   offer.ServiceType,
		CurrentValue:  offer.CurrentValue,
		InitialValue:  offer.InitialValue,
		TriggeredBy:   userID,
		TriggeredRole: "cliente",
	})

	return c.Status(201).JSON(toOfferResponseDTO(*offer, ""))
}

// GetOpenOffers - Listar ofertas abertas (Diarista)
func GetOpenOffers(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	if err := requireUserRole(userID, "diarista"); err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Sem permissao para listar ofertas"})
	}
	page, pageSize, _ := getPaginationParams(c)
	var diarist models.User

	if err := config.DB.
		Preload("Address").
		First(&diarist, userID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao carregar dados da diarista"})
	}

	baseQuery := config.DB.
		Table("offers").
		Joins("JOIN users ON users.id = offers.client_id").
		Joins("LEFT JOIN addresses ON addresses.id = offers.address_id").
		Where("offers.status IN ?", []string{"aberta", "negociacao"})

	var totalItems int64
	if err := baseQuery.
		Session(&gorm.Session{}).
		Count(&totalItems).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao contar ofertas"})
	}

	totalPages := int((totalItems + int64(pageSize) - 1) / int64(pageSize))
	if totalPages == 0 {
		totalPages = 1
	}
	if page > totalPages {
		page = totalPages
	}
	offset := (page - 1) * pageSize

	var offers []diaristOpenOfferRow
	if err := baseQuery.
		Select(`
			offers.id,
			offers.client_id,
			offers.address_id,
			offers.service_type,
			offers.scheduled_at,
			offers.duration_hours,
			offers.initial_value,
			offers.current_value,
			offers.status,
			offers.observations,
			users.name as client_name,
			users.photo as client_photo,
			addresses.neighborhood as address_neighborhood,
			addresses.city as address_city,
			addresses.latitude as offer_latitude,
			addresses.longitude as offer_longitude,
			CASE
				WHEN EXISTS (
					SELECT 1
					FROM offer_negotiations
					WHERE offer_negotiations.offer_id = offers.id
					  AND offer_negotiations.diarist_id = ?
					  AND offer_negotiations.status = 'pendente'
				)
				THEN true
				ELSE false
			END as has_pending_negotiation
		`, userID).
		Order("offers.scheduled_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&offers).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao buscar ofertas"})
	}

	addressIDs := make([]uint, 0, len(offers))
	for _, offer := range offers {
		if offer.AddressID != nil && *offer.AddressID != 0 {
			addressIDs = append(addressIDs, *offer.AddressID)
		}
	}

	addressByID := map[uint]models.Address{}
	if len(addressIDs) > 0 {
		var addresses []models.Address
		if err := config.DB.
			Preload("Rooms").
			Where("id IN ?", addressIDs).
			Find(&addresses).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao carregar endereços das ofertas"})
		}

		for _, address := range addresses {
			addressByID[address.ID] = address
		}
	}

	offersForDiarist := []OfferForDiarist{}
	for _, offer := range offers {
		distance := calculateDistanceFromAddressListToCoordinates(
			diarist.Address,
			offer.OfferLatitude,
			offer.OfferLongitude,
		)
		var addressDTO *AddressResponseDTO
		clientRating, clientTotalReviews, err := getClientWeightedRating(offer.ClientID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao calcular avaliacao da cliente"})
		}

		if offer.AddressID != nil {
			if address, ok := addressByID[*offer.AddressID]; ok {
				dto := toAddressResponseDTO(address)
				addressDTO = &dto
			}
		}

		offersForDiarist = append(offersForDiarist, OfferForDiarist{
			ID:                    offer.ID,
			ClientID:              offer.ClientID,
			Address:               addressDTO,
			ClientRating:          clientRating,
			ClientTotalReviews:    clientTotalReviews,
			ServiceType:           offer.ServiceType,
			ScheduledAt:           offer.ScheduledAt,
			DurationHours:         offer.DurationHours,
			InitialValue:          offer.InitialValue,
			CurrentValue:          offer.CurrentValue,
			Status:                offer.Status,
			Observations:          offer.Observations,
			ClientName:            offer.ClientName,
			ClientPhoto:           offer.ClientPhoto,
			AddressNeighborhood:   offer.AddressNeighborhood,
			AddressCity:           offer.AddressCity,
			Distance:              distance,
			HasPendingNegotiation: offer.HasPendingNegotiation,
			Negotiations:          nil,
		})
	}
	for index := range offersForDiarist {
		resolvedPhoto, err := utils.ResolveStoredPhotoURL(offersForDiarist[index].ClientPhoto)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
		}
		offersForDiarist[index].ClientPhoto = resolvedPhoto
	}

	return c.JSON(fiber.Map{
		"items":      offersForDiarist,
		"pagination": buildPaginationPayload(page, pageSize, totalItems),
	})
}

// GetMyOffers - Listar minhas ofertas (Cliente/Diarista)
func GetMyOffers(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	if err := requireUserRole(userID, "cliente"); err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Sem permissao para listar ofertas"})
	}
	statusGroup := strings.ToLower(strings.TrimSpace(c.Query("status_group")))
	page, pageSize, _ := getPaginationParams(c)
	if statusGroup == "accepted" {
		pageSize = 4
	}
	var offers []models.Offer

	query := config.DB.Model(&models.Offer{}).
		Where("client_id = ?", userID).
		Preload("Client").
		Preload("Address").
		Preload("AcceptedByDiarist").
		Preload("Negotiations").
		Preload("Negotiations.Diarist").
		Preload("Negotiations.Diarist.DiaristProfile").
		Preload("Negotiations.Diarist.Address")

	switch statusGroup {
	case "accepted":
		query = query.Where("status = ?", "aceita")
	default:
		query = query.Where("status IN ?", []string{"aberta", "negociacao", "pendente"})
	}

	var totalItems int64
	if err := query.Session(&gorm.Session{}).Count(&totalItems).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao contar ofertas"})
	}

	totalPages := int((totalItems + int64(pageSize) - 1) / int64(pageSize))
	if totalPages == 0 {
		totalPages = 1
	}
	if page > totalPages {
		page = totalPages
	}
	offset := (page - 1) * pageSize

	if err := query.Order("scheduled_at DESC").Offset(offset).Limit(pageSize).Find(&offers).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao buscar ofertas"})
	}

	for offerIndex := range offers {
		offer := &offers[offerIndex]

		if err := resolveOfferPhotos(offer); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
		}

		for negotiationIndex := range offer.Negotiations {
			negotiation := &offer.Negotiations[negotiationIndex]

			if offer.Address.ID != 0 {
				negotiation.DiaristDistance = calculateMinimumDistanceBetweenAddressLists(
					[]models.Address{offer.Address},
					negotiation.Diarist.Address,
				)
			}

			rating, err := getDiaristWeightedRating(negotiation.DiaristID)
			if err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Erro ao calcular avaliacao da diarista"})
			}
			negotiation.DiaristRating = rating
		}
	}

	serviceStatusByOfferID, err := loadServiceStatusesByOfferIDs(offers)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao buscar status dos pedidos"})
	}

	responseItems := make([]OfferResponseDTO, 0, len(offers))
	for _, offer := range offers {
		responseItems = append(responseItems, toOfferResponseDTO(offer, serviceStatusByOfferID[offer.ID]))
	}

	return c.JSON(fiber.Map{
		"items":      responseItems,
		"pagination": buildPaginationPayload(page, pageSize, totalItems),
	})
}

// GetOfferByID - Detalhes de uma oferta
func GetOfferByID(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	offerID := c.Params("id")

	user, err := loadUserByID(userID)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Usuario nao autenticado"})
	}

	offer, err := findAccessibleOfferForRead(user, offerID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Oferta nao encontrada"})
	}

	if err := resolveOfferPhotos(&offer); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}

	serviceStatus, err := loadServiceStatusByOfferID(offer.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao buscar status do pedido"})
	}

	return c.JSON(toOfferResponseDTO(offer, serviceStatus))
}

func GetOfferClientProfile(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	offerID := c.Params("id")

	user, err := loadUserByID(userID)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Usuario nao autenticado"})
	}

	offer, err := findAccessibleOfferForRead(user, offerID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Oferta nao encontrada"})
	}

	if err := config.DB.
		Preload("Client").
		Preload("Client.UserProfile").
		Preload("Client.Address").
		Preload("Client.Address.Rooms").
		First(&offer, offer.ID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao carregar perfil da cliente"})
	}

	if err := resolveUserPhoto(&offer.Client); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}

	clientRating, clientTotalReviews, err := getClientWeightedRating(offer.ClientID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao calcular avaliacao da cliente"})
	}

	response := OfferClientProfileResponseDTO{
		ID:            offer.Client.ID,
		Name:          offer.Client.Name,
		Photo:         offer.Client.Photo,
		EmailVerified: offer.Client.EmailVerified,
		Address:       make([]AddressResponseDTO, 0, len(offer.Client.Address)),
		UserProfile:   toUserProfileResponseDTO(offer.Client.UserProfile),
		AverageRating: clientRating,
		TotalReviews:  clientTotalReviews,
		Reviews:       make([]ReviewResponseDTO, 0),
		Observations:  offer.Observations,
	}

	for _, address := range offer.Client.Address {
		response.Address = append(response.Address, toAddressResponseDTO(address))
	}

	var reviews []models.Review
	if err := config.DB.
		Where("client_id = ?", offer.ClientID).
		Order("created_at DESC").
		Find(&reviews).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao carregar avaliacoes da cliente"})
	}

	for _, review := range reviews {
		if !hasReviewFeedback(review.DiaristRating, review.DiaristComment) {
			continue
		}
		if dto := toReviewResponseDTO(review); dto != nil {
			response.Reviews = append(response.Reviews, *dto)
		}
	}

	if user.Role == "diarista" {
		offerAddress := &offer.Address
		if offer.Address.ID == 0 {
			offerAddress = firstAddressWithCoordinates(offer.Client.Address)
		}

		if offerAddress != nil {
			response.Distance = calculateMinimumDistanceBetweenAddressLists(
				user.Address,
				[]models.Address{*offerAddress},
			)
		}
	}

	return c.JSON(response)
}

// CancelOffer - Cancelar uma oferta (Cliente)
func CancelOffer(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	offerID := c.Params("id")
	var request ActionReasonRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}
	validator := &validationCollector{}
	reason := validateRequiredString(validator, "reason", request.Reason, 1000)
	if validator.HasErrors() {
		return writeValidationError(c, validator.errors)
	}

	var txOffer models.Offer
	if err := config.DB.Transaction(func(tx *gorm.DB) error {
		var flowErr error
		txOffer, flowErr = cancelOfferTx(tx, offerID, userID, reason)
		return flowErr
	}); err != nil {
		if handled, ok := isFlowError(err); ok {
			return c.Status(handled.status).JSON(fiber.Map{"error": handled.message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao cancelar oferta"})
	}

	config.DB.Preload("Client").Preload("Address").Preload("AcceptedByDiarist").First(&txOffer, txOffer.ID)

	realtime.PublishOfferUpdated(realtime.OfferEventPayload{
		OfferID:       txOffer.ID,
		ClientID:      txOffer.ClientID,
		Status:        txOffer.Status,
		ServiceType:   txOffer.ServiceType,
		CurrentValue:  txOffer.CurrentValue,
		InitialValue:  txOffer.InitialValue,
		TriggeredBy:   userID,
		TriggeredRole: "cliente",
	}, []uint{txOffer.ClientID}, []string{"diarista"})

	serviceStatus, err := loadServiceStatusByOfferID(txOffer.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao buscar status do pedido"})
	}

	return c.JSON(toOfferResponseDTO(txOffer, serviceStatus))
}

// AcceptOffer - Aceitar uma oferta pelo valor original (Diarista)
func AcceptOffer(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	offerID := c.Params("id")

	var txOffer models.Offer
	var txService models.Service
	if err := config.DB.Transaction(func(tx *gorm.DB) error {
		var flowErr error
		txOffer, txService, flowErr = acceptOfferTx(tx, offerID, userID)
		return flowErr
	}); err != nil {
		if handled, ok := isFlowError(err); ok {
			return c.Status(handled.status).JSON(fiber.Map{"error": handled.message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao aceitar oferta"})
	}

	config.DB.Preload("Client").Preload("Address").Preload("AcceptedByDiarist").First(&txOffer, txOffer.ID)

	realtime.PublishOfferUpdated(realtime.OfferEventPayload{
		OfferID:       txOffer.ID,
		ClientID:      txOffer.ClientID,
		DiaristID:     txOffer.AcceptedByDiaristID,
		ServiceID:     &txService.ID,
		Status:        txOffer.Status,
		ServiceType:   txOffer.ServiceType,
		CurrentValue:  txOffer.CurrentValue,
		InitialValue:  txOffer.InitialValue,
		TriggeredBy:   userID,
		TriggeredRole: "diarista",
	}, []uint{txOffer.ClientID, userID}, nil)

	realtime.PublishServiceUpdated(realtime.OfferEventPayload{
		OfferID:       txOffer.ID,
		ClientID:      txOffer.ClientID,
		DiaristID:     txOffer.AcceptedByDiaristID,
		ServiceID:     &txService.ID,
		Status:        txService.Status,
		ServiceType:   txService.ServiceType,
		CurrentValue:  txService.TotalPrice,
		TriggeredBy:   userID,
		TriggeredRole: "diarista",
	}, []uint{txOffer.ClientID, userID})

	return c.JSON(toOfferResponseDTO(txOffer, txService.Status))
}

func loadServiceStatusesByOfferIDs(offers []models.Offer) (map[uint]string, error) {
	offerIDs := make([]uint, 0, len(offers))
	for _, offer := range offers {
		if offer.ID != 0 {
			offerIDs = append(offerIDs, offer.ID)
		}
	}

	if len(offerIDs) == 0 {
		return map[uint]string{}, nil
	}

	var services []models.Service
	if err := config.DB.Select("offer_id", "status").Where("offer_id IN ?", offerIDs).Find(&services).Error; err != nil {
		return nil, err
	}

	statusByOfferID := make(map[uint]string, len(services))
	for _, serviceModel := range services {
		if serviceModel.OfferID != nil {
			statusByOfferID[*serviceModel.OfferID] = serviceModel.Status
		}
	}

	return statusByOfferID, nil
}

func loadServiceStatusByOfferID(offerID uint) (string, error) {
	statusByOfferID, err := loadServiceStatusesByOfferIDs([]models.Offer{{ID: offerID}})
	if err != nil {
		return "", err
	}

	return statusByOfferID[offerID], nil
}

// SendCounterOffer - Enviar uma contraproposta (Diarista)
func SendCounterOffer(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	offerID := c.Params("id")

	var request OfferNegotiationRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, translateCounterOfferValidationErrors(decodeErrors))
	}
	validator := &validationCollector{}
	validatePositiveFloat(validator, "counter_value", request.CounterValue, false)
	validatePositiveFloat(validator, "counter_duration_hours", request.CounterDurationHours, false)
	message := validateOptionalString(validator, "message", request.Message, 1000)
	if validator.HasErrors() {
		return writeValidationError(c, translateCounterOfferValidationErrors(validator.errors))
	}
	negotiation := &models.OfferNegotiation{
		CounterValue:         request.CounterValue,
		CounterDurationHours: request.CounterDurationHours,
		Message:              message,
	}

	var txOffer models.Offer
	if err := config.DB.Transaction(func(tx *gorm.DB) error {
		var flowErr error
		txOffer, *negotiation, flowErr = sendCounterOfferTx(tx, offerID, userID, *negotiation)
		return flowErr
	}); err != nil {
		if handled, ok := isFlowError(err); ok {
			return c.Status(handled.status).JSON(fiber.Map{"error": handled.message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao enviar contraproposta"})
	}

	config.DB.Preload("Diarist").First(&negotiation, negotiation.ID)
	if err := resolveUserPhoto(&negotiation.Diarist); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}

	realtime.PublishNegotiationCreated(realtime.OfferEventPayload{
		OfferID:       txOffer.ID,
		ClientID:      txOffer.ClientID,
		DiaristID:     &negotiation.DiaristID,
		NegotiationID: &negotiation.ID,
		Status:        negotiation.Status,
		ServiceType:   txOffer.ServiceType,
		CurrentValue:  negotiation.CounterValue,
		InitialValue:  txOffer.InitialValue,
		TriggeredBy:   userID,
		TriggeredRole: "diarista",
	}, []uint{txOffer.ClientID, userID})

	return c.Status(201).JSON(toOfferNegotiationResponseDTO(*negotiation))
}

func translateCounterOfferValidationErrors(errors []ValidationFieldError) []ValidationFieldError {
	translated := make([]ValidationFieldError, 0, len(errors))

	for _, item := range errors {
		reason := item.Reason

		switch item.Field {
		case "counter_value":
			if item.Reason == "must be greater than zero" {
				reason = "informe um valor maior que zero para a contraproposta"
			}
		case "counter_duration_hours":
			if item.Reason == "must be greater than zero" {
				reason = "informe uma duração maior que zero para a contraproposta"
			}
		case "message":
			if item.Reason == "is too long" {
				reason = "a mensagem da contraproposta excede o limite de 1000 caracteres"
			}
		case "body":
			if item.Reason == "body is required" {
				reason = "envie os dados da contraproposta"
			}
		}

		translated = append(translated, ValidationFieldError{
			Field:  item.Field,
			Reason: reason,
		})
	}

	return translated
}

// AcceptNegotiation - Aceitar uma contraproposta (Cliente)
func AcceptNegotiation(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	offerID := c.Params("id")
	negotiationID := c.Params("negotiationId")

	var txOffer models.Offer
	var txNegotiation models.OfferNegotiation
	var txService models.Service
	if err := config.DB.Transaction(func(tx *gorm.DB) error {
		var flowErr error
		txOffer, txNegotiation, txService, flowErr = acceptNegotiationTx(tx, offerID, negotiationID, userID)
		return flowErr
	}); err != nil {
		if handled, ok := isFlowError(err); ok {
			return c.Status(handled.status).JSON(fiber.Map{"error": handled.message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao aceitar contraproposta"})
	}

	config.DB.Preload("Diarist").First(&txNegotiation, txNegotiation.ID)
	if err := resolveUserPhoto(&txNegotiation.Diarist); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}

	realtime.PublishNegotiationUpdated(realtime.OfferEventPayload{
		OfferID:       txOffer.ID,
		ClientID:      txOffer.ClientID,
		DiaristID:     &txNegotiation.DiaristID,
		NegotiationID: &txNegotiation.ID,
		ServiceID:     &txService.ID,
		Status:        txNegotiation.Status,
		ServiceType:   txOffer.ServiceType,
		CurrentValue:  txNegotiation.CounterValue,
		InitialValue:  txOffer.InitialValue,
		TriggeredBy:   userID,
		TriggeredRole: "cliente",
	}, []uint{txOffer.ClientID, txNegotiation.DiaristID})

	realtime.PublishServiceUpdated(realtime.OfferEventPayload{
		OfferID:       txOffer.ID,
		ClientID:      txOffer.ClientID,
		DiaristID:     &txNegotiation.DiaristID,
		ServiceID:     &txService.ID,
		Status:        txService.Status,
		ServiceType:   txService.ServiceType,
		CurrentValue:  txService.TotalPrice,
		TriggeredBy:   userID,
		TriggeredRole: "cliente",
	}, []uint{txOffer.ClientID, txNegotiation.DiaristID})

	return c.JSON(toOfferNegotiationResponseDTO(txNegotiation))
}

// RejectNegotiation - Recusar uma contraproposta (Cliente)
func RejectNegotiation(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	offerID := c.Params("id")
	negotiationID := c.Params("negotiationId")
	var request ActionReasonRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}
	validator := &validationCollector{}
	reason := validateRequiredString(validator, "reason", request.Reason, 1000)
	if validator.HasErrors() {
		return writeValidationError(c, validator.errors)
	}

	var txOffer models.Offer
	var txNegotiation models.OfferNegotiation
	if err := config.DB.Transaction(func(tx *gorm.DB) error {
		var flowErr error
		txOffer, txNegotiation, flowErr = rejectNegotiationTx(tx, offerID, negotiationID, userID, reason)
		return flowErr
	}); err != nil {
		if handled, ok := isFlowError(err); ok {
			return c.Status(handled.status).JSON(fiber.Map{"error": handled.message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao recusar contraproposta"})
	}

	config.DB.Preload("Diarist").First(&txNegotiation, txNegotiation.ID)
	if err := resolveUserPhoto(&txNegotiation.Diarist); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}

	realtime.PublishNegotiationUpdated(realtime.OfferEventPayload{
		OfferID:       txOffer.ID,
		ClientID:      txOffer.ClientID,
		DiaristID:     &txNegotiation.DiaristID,
		NegotiationID: &txNegotiation.ID,
		Status:        txNegotiation.Status,
		ServiceType:   txOffer.ServiceType,
		CurrentValue:  txNegotiation.CounterValue,
		InitialValue:  txOffer.InitialValue,
		TriggeredBy:   userID,
		TriggeredRole: "cliente",
	}, []uint{txOffer.ClientID, txNegotiation.DiaristID})

	return c.JSON(toOfferNegotiationResponseDTO(txNegotiation))
}

// GetDiaristNegotiations - Listar negociaÃ§Ãµes de uma diarista
func GetDiaristNegotiations(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	if err := requireUserRole(userID, "diarista"); err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Sem permissao para listar negociacoes"})
	}
	page, pageSize, _ := getPaginationParams(c)
	var diarist models.User

	if err := config.DB.
		Preload("Address").
		First(&diarist, userID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao carregar dados da diarista"})
	}

	baseQuery := config.DB.
		Table("offer_negotiations").
		Joins("JOIN offers ON offers.id = offer_negotiations.offer_id").
		Joins("JOIN users ON users.id = offers.client_id").
		Joins("LEFT JOIN addresses ON addresses.id = offers.address_id").
		Where("offer_negotiations.diarist_id = ?", userID).
		Where("offer_negotiations.status IN ?", []string{"pendente", "recusada"})

	var totalItems int64
	if err := baseQuery.Session(&gorm.Session{}).Count(&totalItems).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao contar negociaÃ§Ãµes"})
	}

	totalPages := int((totalItems + int64(pageSize) - 1) / int64(pageSize))
	if totalPages == 0 {
		totalPages = 1
	}
	if page > totalPages {
		page = totalPages
	}
	offset := (page - 1) * pageSize

	var negotiations []diaristNegotiationRow
	if err := baseQuery.
		Select(`
			offer_negotiations.id,
			offer_negotiations.offer_id,
			offer_negotiations.diarist_id,
			offer_negotiations.counter_value as counter_value,
			offer_negotiations.counter_duration_hours as counter_duration_hours,
			offer_negotiations.status,
			offer_negotiations.message,
			offer_negotiations.rejection_reason as rejection_reason,
			offer_negotiations.created_at,
			offer_negotiations.updated_at,
			offers.scheduled_at as scheduled_at,
			offers.duration_hours as duration_hours,
			offers.initial_value as initial_value,
			users.name as client_name,
			users.photo as client_photo,
			addresses.neighborhood as address_neighborhood,
			addresses.latitude as offer_latitude,
			addresses.longitude as offer_longitude
		`).
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&negotiations).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao buscar negociaÃ§Ãµes"})
	}

	response := make([]DiaristNegotiationResponse, 0, len(negotiations))
	for _, negotiation := range negotiations {
		distance := calculateDistanceFromAddressListToCoordinates(
			diarist.Address,
			negotiation.OfferLatitude,
			negotiation.OfferLongitude,
		)

		response = append(response, DiaristNegotiationResponse{
			ID:                   negotiation.ID,
			OfferID:              negotiation.OfferID,
			DiaristID:            negotiation.DiaristID,
			ClientName:           negotiation.ClientName,
			ClientPhoto:          negotiation.ClientPhoto,
			AddressNeighborhood:  negotiation.AddressNeighborhood,
			ScheduledAt:          &negotiation.ScheduledAt,
			DurationHours:        negotiation.DurationHours,
			InitialValue:         negotiation.InitialValue,
			CounterValue:         negotiation.CounterValue,
			CounterDurationHours: negotiation.CounterDurationHours,
			Status:               negotiation.Status,
			Message:              negotiation.Message,
			RejectionReason:      negotiation.RejectionReason,
			CreatedAt:            negotiation.CreatedAt,
			UpdatedAt:            negotiation.UpdatedAt,
			Distance:             distance,
		})
	}

	for index := range response {
		resolvedPhoto, err := utils.ResolveStoredPhotoURL(response[index].ClientPhoto)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
		}
		response[index].ClientPhoto = resolvedPhoto
	}

	return c.JSON(fiber.Map{
		"items":      response,
		"pagination": buildPaginationPayload(page, pageSize, totalItems),
	})
}
