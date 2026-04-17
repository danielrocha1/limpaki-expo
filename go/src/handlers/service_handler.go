package handlers

import (
	"log"
	"strconv"
	"strings"
	"time"

	"limpae/go/src/config"
	"limpae/go/src/constants"
	"limpae/go/src/models"
	"limpae/go/src/realtime"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func CreateService(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	if err := requireUserRole(userID, "cliente"); err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Sem permissao para criar servico"})
	}

	var request ServiceCreateRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		log.Printf("[service_create] decode validation failed user_id=%d errors=%+v raw_body=%s", userID, decodeErrors, string(c.Body()))
		return writeValidationError(c, decodeErrors)
	}
	validator := &validationCollector{}
	if request.DiaristID == 0 {
		validator.Add("diarist_id", "is required")
	}
	validateNonNegativeFloat(validator, "total_price", request.TotalPrice)
	validatePositiveFloat(validator, "duration_hours", request.DurationHours, false)
	validateScheduledAt(validator, "scheduled_at", request.ScheduledAt)
	serviceType := validateRequiredString(validator, "service_type", request.ServiceType, 500)
	observations := validateOptionalString(validator, "observations", request.Observations, 4000)
	if request.RoomCount < 0 {
		validator.Add("room_count", "must be zero or greater")
	}
	if request.BathroomCount < 0 {
		validator.Add("bathroom_count", "must be zero or greater")
	}
	if validator.HasErrors() {
		log.Printf(
			"[service_create] validation failed user_id=%d diarist_id=%d address_id=%v scheduled_at=%s duration_hours=%v total_price=%v service_type=%q observations_len=%d room_count=%d bathroom_count=%d errors=%+v",
			userID,
			request.DiaristID,
			request.AddressID,
			request.ScheduledAt.Format(time.RFC3339),
			request.DurationHours,
			request.TotalPrice,
			request.ServiceType,
			len(strings.TrimSpace(request.Observations)),
			request.RoomCount,
			request.BathroomCount,
			validator.errors,
		)
		return writeValidationError(c, validator.errors)
	}

	if request.AddressID != nil && *request.AddressID != 0 {
		if _, err := findOwnedAddress(userID, *request.AddressID); err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Endereco nao encontrado"})
		}
	}
	service := &models.Service{
		DiaristID:     request.DiaristID,
		AddressID:     request.AddressID,
		TotalPrice:    request.TotalPrice,
		DurationHours: request.DurationHours,
		ScheduledAt:   request.ScheduledAt,
		ServiceType:   serviceType,
		HasPets:       request.HasPets,
		Observations:  observations,
		RoomCount:     request.RoomCount,
		BathroomCount: request.BathroomCount,
	}

	if err := config.DB.Transaction(func(tx *gorm.DB) error {
		return createServiceTx(tx, service, userID)
	}); err != nil {
		log.Printf("[service_create] transaction failed user_id=%d diarist_id=%d address_id=%v scheduled_at=%s service_type_len=%d error=%v", userID, service.DiaristID, service.AddressID, service.ScheduledAt.Format(time.RFC3339), len(service.ServiceType), err)
		if handled, ok := isFlowError(err); ok {
			return c.Status(handled.status).JSON(fiber.Map{"error": handled.message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao criar servico"})
	}

	config.DB.
		Preload("Address").
		Preload("Address.Rooms").
		Preload("Client").
		Preload("Diarist").
		First(&service, service.ID)
	if err := resolveServicePhotos(service); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}

	realtime.PublishServiceUpdated(realtime.OfferEventPayload{
		ServiceID:     &service.ID,
		ClientID:      service.ClientID,
		DiaristID:     &service.DiaristID,
		Status:        service.Status,
		ServiceType:   service.ServiceType,
		CurrentValue:  service.TotalPrice,
		TriggeredBy:   service.ClientID,
		TriggeredRole: "cliente",
	}, []uint{service.ClientID, service.DiaristID})

	return c.JSON(toServiceResponseDTO(*service, userID))
}
func GetServices(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	var services []models.Service
	config.DB.
		Preload("Address").
		Preload("Address.Rooms").
		Preload("Client").
		Preload("Diarist").
		Where("client_id = ? OR diarist_id = ?", userID, userID).
		Find(&services)

	for index := range services {
		if err := resolveServicePhotos(&services[index]); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
		}
	}

	response := make([]ServiceResponseDTO, 0, len(services))
	for _, serviceModel := range services {
		response = append(response, toServiceResponseDTO(serviceModel, userID))
	}
	return c.JSON(response)
}

func GetPendingSchedules(c *fiber.Ctx) error {
	id := c.Params("id")
	var schedules []time.Time
	if err := config.DB.Model(&models.Service{}).
		Where("diarist_id = ? AND status NOT IN (?, ?)", id, "cancelado", constants.StatusCompleted).
		Pluck("scheduled_at", &schedules).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao buscar agendamentos"})
	}

	return c.JSON(fiber.Map{"pending_schedules": schedules})
}

func GetService(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	serviceID := c.Params("id")

	service, err := findScopedService(userID, serviceID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Servico nao encontrado"})
	}

	if err := resolveServicePhotos(&service); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}

	return c.JSON(toServiceResponseDTO(service, userID))
}

func GetServicesByClientID(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	statusGroup := strings.ToLower(strings.TrimSpace(c.Query("status_group")))
	if statusGroup != "history" {
		statusGroup = "active"
	}
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
	var services []models.Service
	query := config.DB.Preload("Address").
		Preload("Address.Rooms").
		Preload("Client").
		Preload("Diarist").
		Preload("Review").
		Where("client_id = ? OR diarist_id = ?", userID, userID).
		Order("scheduled_at DESC")

	switch statusGroup {
	case "active":
		query = query.Where("status NOT IN ?", []string{constants.StatusCompleted, constants.StatusCanceled})
	case "history":
		query = query.Where("status IN ?", []string{constants.StatusCompleted, constants.StatusCanceled})
	}

	var totalItems int64
	if err := query.Model(&models.Service{}).Count(&totalItems).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao contar servicos"})
	}

	totalPages := int((totalItems + int64(pageSize) - 1) / int64(pageSize))
	if totalPages == 0 {
		totalPages = 1
	}
	if page > totalPages {
		page = totalPages
	}
	offset := (page - 1) * pageSize

	if err := query.Offset(offset).Limit(pageSize).Find(&services).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao buscar servicos"})
	}

	for index := range services {
		if err := resolveServicePhotos(&services[index]); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
		}
	}

	response := make([]ServiceResponseDTO, 0, len(services))
	for _, serviceModel := range services {
		response = append(response, toServiceResponseDTO(serviceModel, userID))
	}

	return c.JSON(fiber.Map{
		"items": response,
		"pagination": fiber.Map{
			"page":         page,
			"page_size":    pageSize,
			"total_items":  totalItems,
			"total_pages":  totalPages,
			"has_next":     page < totalPages,
			"has_previous": page > 1,
		},
	})
}

func UpdateService(c *fiber.Ctx) error {
	id := c.Params("id")
	action := c.Params("action")
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	reason := ""
	if action == "cancel" {
		var request ActionReasonRequestDTO
		if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
			return writeValidationError(c, decodeErrors)
		}
		validator := &validationCollector{}
		reason = validateRequiredString(validator, "reason", request.Reason, 1000)
		if validator.HasErrors() {
			return writeValidationError(c, validator.errors)
		}
	}

	var txService models.Service
	if err := config.DB.Transaction(func(tx *gorm.DB) error {
		var flowErr error
		txService, flowErr = updateServiceActionTx(tx, id, action, userID, reason)
		return flowErr
	}); err != nil {
		if handled, ok := isFlowError(err); ok {
			return c.Status(handled.status).JSON(fiber.Map{"error": handled.message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao atualizar servico"})
	}

	config.DB.
		Preload("Address").
		Preload("Address.Rooms").
		Preload("Client").
		Preload("Diarist").
		First(&txService, txService.ID)
	if err := resolveServicePhotos(&txService); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}

	var offerID uint
	if txService.OfferID != nil {
		offerID = *txService.OfferID
	}

	realtime.PublishServiceUpdated(realtime.OfferEventPayload{
		OfferID:      offerID,
		ServiceID:    &txService.ID,
		ClientID:     txService.ClientID,
		DiaristID:    &txService.DiaristID,
		Status:       txService.Status,
		ServiceType:  txService.ServiceType,
		CurrentValue: txService.TotalPrice,
		TriggeredBy:  userID,
	}, []uint{txService.ClientID, txService.DiaristID})

	return c.JSON(toServiceResponseDTO(txService, userID))
}
func StartServiceWithPIN(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}
	serviceID := c.Params("id")

	var pinReq StartServiceWithPINRequestDTO
	if decodeErrors := decodeStrictJSON(c, &pinReq); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	if len(pinReq.PIN) != 4 || !isNumeric(pinReq.PIN) {
		return writeValidationError(c, []ValidationFieldError{{Field: "pin", Reason: "must contain exactly 4 digits"}})
	}

	var txService models.Service
	if err := config.DB.Transaction(func(tx *gorm.DB) error {
		var flowErr error
		txService, flowErr = startServiceWithPINTx(tx, serviceID, userID, pinReq.PIN)
		return flowErr
	}); err != nil {
		if handled, ok := isFlowError(err); ok {
			return c.Status(handled.status).JSON(fiber.Map{"error": handled.message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao iniciar servico"})
	}

	config.DB.
		Preload("Address").
		Preload("Address.Rooms").
		Preload("Client").
		Preload("Diarist").
		First(&txService, txService.ID)
	if err := resolveServicePhotos(&txService); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao gerar acesso da foto"})
	}

	realtime.PublishServiceUpdated(realtime.OfferEventPayload{
		ServiceID:     &txService.ID,
		ClientID:      txService.ClientID,
		DiaristID:     &txService.DiaristID,
		Status:        txService.Status,
		ServiceType:   txService.ServiceType,
		CurrentValue:  txService.TotalPrice,
		TriggeredBy:   userID,
		TriggeredRole: "diarista",
	}, []uint{txService.ClientID, txService.DiaristID})

	return c.JSON(fiber.Map{"message": "Servico iniciado com sucesso", "service": toServiceResponseDTO(txService, userID)})
}
func isNumeric(s string) bool {
	for _, char := range s {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}

func DeleteService(c *fiber.Ctx) error {
	id := c.Params("id")
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	service, err := findScopedService(userID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Servico nao encontrado"})
	}

	if service.ClientID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Apenas o cliente pode excluir o agendamento"})
	}

	config.DB.Delete(&service)
	return c.SendStatus(204)
}
