package handlers

import (
	"limpae/go/src/config"
	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
)

func CreatePayment(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var request PaymentCreateRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	validator := &validationCollector{}
	if request.ServiceID == 0 {
		validator.Add("service_id", "is required")
	}
	validateNonNegativeFloat(validator, "amount", request.Amount)
	method := validateOptionalString(validator, "method", request.Method, 20)
	if validator.HasErrors() {
		return writeValidationError(c, validator.errors)
	}

	serviceModel, err := findScopedService(userID, request.ServiceID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Servico nao encontrado"})
	}
	if serviceModel.ClientID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Apenas o cliente pode criar o pagamento"})
	}

	payment := models.Payment{
		ServiceID: request.ServiceID,
		ClientID:  serviceModel.ClientID,
		DiaristID: serviceModel.DiaristID,
		Amount:    request.Amount,
		Method:    method,
		Status:    "pendente",
	}
	if payment.Amount == 0 {
		payment.Amount = serviceModel.TotalPrice
	}

	if err := config.DB.Create(&payment).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao criar pagamento"})
	}
	return c.JSON(toPaymentResponseDTO(payment))
}

func GetPayments(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var payments []models.Payment
	config.DB.Where("client_id = ? OR diarist_id = ?", userID, userID).Find(&payments)

	response := make([]PaymentResponseDTO, 0, len(payments))
	for _, payment := range payments {
		response = append(response, toPaymentResponseDTO(payment))
	}
	return c.JSON(response)
}

func GetPayment(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	payment, err := findScopedPayment(userID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Pagamento nao encontrado"})
	}
	return c.JSON(toPaymentResponseDTO(payment))
}

func UpdatePayment(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	payment, err := findScopedPayment(userID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Pagamento nao encontrado"})
	}
	if payment.ClientID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Apenas o cliente pode atualizar o pagamento"})
	}

	var request PaymentUpdateRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	validator := &validationCollector{}
	validateNonNegativeFloat(validator, "amount", request.Amount)
	payment.Method = validateOptionalString(validator, "method", request.Method, 20)
	if validator.HasErrors() {
		return writeValidationError(c, validator.errors)
	}

	payment.Amount = request.Amount
	if err := config.DB.Save(&payment).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao atualizar pagamento"})
	}
	return c.JSON(toPaymentResponseDTO(payment))
}

func DeletePayment(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	payment, err := findScopedPayment(userID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Pagamento nao encontrado"})
	}
	if payment.ClientID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Apenas o cliente pode excluir o pagamento"})
	}
	config.DB.Delete(&models.Payment{}, payment.ID)
	return c.SendStatus(204)
}

func ProcessPayment(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	type requestDTO struct {
		SubscriptionID uint   `json:"subscription_id"`
		PaymentMethod  string `json:"payment_method"`
	}

	var request requestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}
	if request.SubscriptionID == 0 {
		return writeValidationError(c, []ValidationFieldError{{Field: "subscription_id", Reason: "is required"}})
	}

	subscription, err := findOwnedSubscription(userID, request.SubscriptionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Assinatura nao encontrada"})
	}

	subscription.Status = "active"
	config.DB.Save(&subscription)

	return c.JSON(fiber.Map{
		"message":      "Pagamento aprovado",
		"subscription": toSubscriptionResponseDTO(subscription),
	})
}
