package handlers

import (
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"limpae/go/src/constants"
	"limpae/go/src/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const legacyAcceptedServiceStatus = "em andamento"

type flowError struct {
	status  int
	message string
}

func (e *flowError) Error() string {
	return e.message
}

func newFlowError(status int, message string) error {
	return &flowError{status: status, message: message}
}

func isFlowError(err error) (*flowError, bool) {
	var target *flowError
	if errors.As(err, &target) {
		return target, true
	}
	return nil, false
}

func getOfferForUpdate(tx *gorm.DB, offerID interface{}) (models.Offer, error) {
	var offer models.Offer
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&offer, offerID).Error
	return offer, err
}

func getNegotiationForUpdate(tx *gorm.DB, negotiationID interface{}) (models.OfferNegotiation, error) {
	var negotiation models.OfferNegotiation
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&negotiation, negotiationID).Error
	return negotiation, err
}

func getServiceForUpdate(tx *gorm.DB, serviceID interface{}) (models.Service, error) {
	var serviceModel models.Service
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&serviceModel, serviceID).Error
	return serviceModel, err
}

func lockUserRow(tx *gorm.DB, userID uint) error {
	var user models.User
	return tx.Model(&models.User{}).
		Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("id").
		First(&user, userID).Error
}

func findServiceByOfferID(tx *gorm.DB, offerID uint) (models.Service, bool, error) {
	var serviceModel models.Service
	err := tx.Where("offer_id = ?", offerID).First(&serviceModel).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Service{}, false, nil
	}
	if err != nil {
		return models.Service{}, false, err
	}
	return serviceModel, true, nil
}

func findLegacyAcceptedService(tx *gorm.DB, offer models.Offer, diaristID uint, totalPrice float64, durationHours float64) (models.Service, bool, error) {
	var serviceModel models.Service
	err := tx.
		Where("offer_id IS NULL").
		Where("client_id = ? AND diarist_id = ?", offer.ClientID, diaristID).
		Where("scheduled_at = ?", offer.ScheduledAt).
		Where("service_type = ?", offer.ServiceType).
		Where("total_price = ? AND duration_hours = ?", totalPrice, durationHours).
		Order("id ASC").
		First(&serviceModel).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Service{}, false, nil
	}
	if err != nil {
		return models.Service{}, false, err
	}

	serviceModel.OfferID = &offer.ID
	if err := tx.Save(&serviceModel).Error; err != nil {
		return models.Service{}, false, err
	}
	return serviceModel, true, nil
}

func hasScheduleConflict(tx *gorm.DB, diaristID uint, scheduledAt time.Time, durationHours float64, excludeServiceID uint) (bool, error) {
	var services []models.Service
	query := tx.Model(&models.Service{}).
		Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("diarist_id = ? AND status NOT IN ?", diaristID, []string{constants.StatusCanceled, constants.StatusCompleted})
	if excludeServiceID != 0 {
		query = query.Where("id <> ?", excludeServiceID)
	}

	if err := query.Find(&services).Error; err != nil {
		return false, err
	}

	requestEnd := scheduledAt.Add(time.Duration(durationHours * float64(time.Hour)))
	for _, existing := range services {
		existingEnd := existing.ScheduledAt.Add(time.Duration(existing.DurationHours * float64(time.Hour)))
		if scheduledAt.Before(existingEnd) && requestEnd.After(existing.ScheduledAt) {
			return true, nil
		}
	}

	return false, nil
}

func acceptOfferTx(tx *gorm.DB, offerID interface{}, diaristID uint) (models.Offer, models.Service, error) {
	if err := requireUserRoleTx(tx, diaristID, "diarista"); err != nil {
		return models.Offer{}, models.Service{}, err
	}

	offer, err := getOfferForUpdate(tx, offerID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Offer{}, models.Service{}, newFlowError(404, "Oferta nao encontrada")
	}
	if err != nil {
		return models.Offer{}, models.Service{}, err
	}

	if offer.Status == "aceita" {
		if offer.AcceptedByDiaristID != nil && *offer.AcceptedByDiaristID == diaristID {
			existingService, found, findErr := findServiceByOfferID(tx, offer.ID)
			if findErr != nil {
				return models.Offer{}, models.Service{}, findErr
			}
			if found {
				return offer, existingService, nil
			}
			legacyService, legacyFound, legacyErr := findLegacyAcceptedService(tx, offer, diaristID, offer.InitialValue, offer.DurationHours)
			if legacyErr != nil {
				return models.Offer{}, models.Service{}, legacyErr
			}
			if legacyFound {
				return offer, legacyService, nil
			}
		}
		return models.Offer{}, models.Service{}, newFlowError(409, "Esta oferta ja foi aceita")
	}

	if offer.Status == "cancelada" {
		return models.Offer{}, models.Service{}, newFlowError(409, "Esta oferta nao esta disponivel")
	}

	if offer.Status != "aberta" && offer.Status != "negociacao" {
		return models.Offer{}, models.Service{}, newFlowError(400, "Esta oferta nao esta disponivel")
	}

	if err := lockUserRow(tx, diaristID); err != nil {
		return models.Offer{}, models.Service{}, err
	}

	conflict, err := hasScheduleConflict(tx, diaristID, offer.ScheduledAt, offer.DurationHours, 0)
	if err != nil {
		return models.Offer{}, models.Service{}, err
	}
	if conflict {
		return models.Offer{}, models.Service{}, newFlowError(409, "A diarista ja possui um servico nesse horario")
	}

	offer.Status = "aceita"
	offer.AcceptedByDiaristID = &diaristID
	offer.CurrentValue = offer.InitialValue
	if err := tx.Save(&offer).Error; err != nil {
		return models.Offer{}, models.Service{}, err
	}

	service := models.Service{
		OfferID:       &offer.ID,
		ClientID:      offer.ClientID,
		DiaristID:     diaristID,
		AddressID:     offer.AddressID,
		Status:        constants.StatusAccepted,
		TotalPrice:    offer.CurrentValue,
		DurationHours: offer.DurationHours,
		ScheduledAt:   offer.ScheduledAt,
		ServiceType:   offer.ServiceType,
		Observations:  offer.Observations,
	}
	if err := tx.Create(&service).Error; err != nil {
		return models.Offer{}, models.Service{}, err
	}

	if err := tx.Model(&models.OfferNegotiation{}).
		Where("offer_id = ? AND status = ?", offer.ID, "pendente").
		Update("status", "recusada").Error; err != nil {
		return models.Offer{}, models.Service{}, err
	}

	return offer, service, nil
}

func acceptNegotiationTx(tx *gorm.DB, offerID interface{}, negotiationID interface{}, clientID uint) (models.Offer, models.OfferNegotiation, models.Service, error) {
	if err := requireUserRoleTx(tx, clientID, "cliente"); err != nil {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, err
	}

	offer, err := getOfferForUpdate(tx, offerID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, newFlowError(404, "Oferta nao encontrada")
	}
	if err != nil {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, err
	}

	if offer.ClientID != clientID {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, newFlowError(403, "Sem permissao")
	}

	negotiation, err := getNegotiationForUpdate(tx, negotiationID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, newFlowError(404, "Contraproposta nao encontrada")
	}
	if err != nil {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, err
	}

	if negotiation.OfferID != offer.ID {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, newFlowError(400, "Negociacao nao corresponde a oferta")
	}

	if offer.Status == "aceita" {
		if offer.AcceptedByDiaristID != nil && *offer.AcceptedByDiaristID == negotiation.DiaristID {
			existingService, found, findErr := findServiceByOfferID(tx, offer.ID)
			if findErr != nil {
				return models.Offer{}, models.OfferNegotiation{}, models.Service{}, findErr
			}
			if found {
				return offer, negotiation, existingService, nil
			}
			legacyService, legacyFound, legacyErr := findLegacyAcceptedService(tx, offer, negotiation.DiaristID, negotiation.CounterValue, negotiation.CounterDurationHours)
			if legacyErr != nil {
				return models.Offer{}, models.OfferNegotiation{}, models.Service{}, legacyErr
			}
			if legacyFound {
				return offer, negotiation, legacyService, nil
			}
		}
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, newFlowError(409, "Esta oferta ja foi aceita")
	}

	if offer.Status == "cancelada" {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, newFlowError(409, "Esta oferta nao esta disponivel")
	}

	if negotiation.Status == "recusada" {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, newFlowError(409, "Contraproposta ja foi recusada")
	}

	if err := lockUserRow(tx, negotiation.DiaristID); err != nil {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, err
	}

	conflict, err := hasScheduleConflict(tx, negotiation.DiaristID, offer.ScheduledAt, negotiation.CounterDurationHours, 0)
	if err != nil {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, err
	}
	if conflict {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, newFlowError(409, "A diarista ja possui um servico nesse horario")
	}

	negotiation.Status = "aceita"
	if err := tx.Save(&negotiation).Error; err != nil {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, err
	}

	if err := tx.Model(&models.OfferNegotiation{}).
		Where("offer_id = ? AND id <> ? AND status = ?", offer.ID, negotiation.ID, "pendente").
		Update("status", "recusada").Error; err != nil {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, err
	}

	offer.Status = "aceita"
	offer.CurrentValue = negotiation.CounterValue
	offer.AcceptedByDiaristID = &negotiation.DiaristID
	if err := tx.Save(&offer).Error; err != nil {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, err
	}

	service := models.Service{
		OfferID:       &offer.ID,
		ClientID:      offer.ClientID,
		DiaristID:     negotiation.DiaristID,
		AddressID:     offer.AddressID,
		Status:        constants.StatusAccepted,
		TotalPrice:    negotiation.CounterValue,
		DurationHours: negotiation.CounterDurationHours,
		ScheduledAt:   offer.ScheduledAt,
		ServiceType:   offer.ServiceType,
		Observations:  offer.Observations,
	}
	if err := tx.Create(&service).Error; err != nil {
		return models.Offer{}, models.OfferNegotiation{}, models.Service{}, err
	}

	return offer, negotiation, service, nil
}

func cancelOfferTx(tx *gorm.DB, offerID interface{}, clientID uint, reason string) (models.Offer, error) {
	if err := requireUserRoleTx(tx, clientID, "cliente"); err != nil {
		return models.Offer{}, err
	}

	offer, err := getOfferForUpdate(tx, offerID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Offer{}, newFlowError(404, "Oferta nao encontrada")
	}
	if err != nil {
		return models.Offer{}, err
	}

	if offer.ClientID != clientID {
		return models.Offer{}, newFlowError(403, "Sem permissao para cancelar esta oferta")
	}

	if offer.Status == "cancelada" {
		return offer, nil
	}

	if offer.Status == "aceita" {
		return models.Offer{}, newFlowError(409, "Nao e possivel cancelar uma oferta ja aceita")
	}

	offer.Status = "cancelada"
	offer.CancelReason = strings.TrimSpace(reason)
	if err := tx.Save(&offer).Error; err != nil {
		return models.Offer{}, err
	}

	if err := tx.Model(&models.OfferNegotiation{}).
		Where("offer_id = ? AND status = ?", offer.ID, "pendente").
		Update("status", "recusada").Error; err != nil {
		return models.Offer{}, err
	}

	return offer, nil
}

func sendCounterOfferTx(tx *gorm.DB, offerID interface{}, diaristID uint, negotiationInput models.OfferNegotiation) (models.Offer, models.OfferNegotiation, error) {
	if err := requireUserRoleTx(tx, diaristID, "diarista"); err != nil {
		return models.Offer{}, models.OfferNegotiation{}, err
	}

	offer, err := getOfferForUpdate(tx, offerID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Offer{}, models.OfferNegotiation{}, newFlowError(404, "Oferta não encontrada.")
	}
	if err != nil {
		return models.Offer{}, models.OfferNegotiation{}, err
	}

	if offer.Status == "aceita" {
		return models.Offer{}, models.OfferNegotiation{}, newFlowError(409, "Esta oferta já foi aceita e não pode mais receber contraproposta.")
	}

	if offer.Status == "cancelada" {
		return models.Offer{}, models.OfferNegotiation{}, newFlowError(409, "Esta oferta foi cancelada e não está disponível para contraproposta.")
	}

	if offer.Status != "aberta" && offer.Status != "negociacao" {
		return models.Offer{}, models.OfferNegotiation{}, newFlowError(409, "Esta oferta não está disponível para contraproposta.")
	}

	if negotiationInput.CounterValue > (offer.InitialValue * 2) {
		return models.Offer{}, models.OfferNegotiation{}, newFlowError(400, "O valor da contraproposta não pode ultrapassar o dobro do valor inicial da oferta.")
	}

	duration := negotiationInput.CounterDurationHours
	if duration == 0 {
		duration = offer.DurationHours
	}

	if offer.DurationHours >= 8 && duration > offer.DurationHours {
		return models.Offer{}, models.OfferNegotiation{}, newFlowError(400, "Esta oferta já tem 8 horas ou mais, então a contraproposta não pode aumentar a duração.")
	}

	if duration > (offer.DurationHours * 2) {
		return models.Offer{}, models.OfferNegotiation{}, newFlowError(400, "A duração da contraproposta não pode ultrapassar o dobro da duração original da oferta.")
	}

	var negotiation models.OfferNegotiation
	err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("offer_id = ? AND diarist_id = ? AND status = ?", offer.ID, diaristID, "pendente").
		First(&negotiation).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		negotiation = models.OfferNegotiation{
			OfferID:              offer.ID,
			DiaristID:            diaristID,
			CounterValue:         negotiationInput.CounterValue,
			CounterDurationHours: duration,
			Status:               "pendente",
			Message:              negotiationInput.Message,
		}
		if err := tx.Create(&negotiation).Error; err != nil {
			return models.Offer{}, models.OfferNegotiation{}, err
		}
	} else if err != nil {
		return models.Offer{}, models.OfferNegotiation{}, err
	} else {
		negotiation.CounterValue = negotiationInput.CounterValue
		negotiation.CounterDurationHours = duration
		negotiation.Message = negotiationInput.Message
		if err := tx.Save(&negotiation).Error; err != nil {
			return models.Offer{}, models.OfferNegotiation{}, err
		}
	}

	if offer.Status == "aberta" {
		offer.Status = "negociacao"
		if err := tx.Save(&offer).Error; err != nil {
			return models.Offer{}, models.OfferNegotiation{}, err
		}
	}

	return offer, negotiation, nil
}

func rejectNegotiationTx(tx *gorm.DB, offerID interface{}, negotiationID interface{}, clientID uint, reason string) (models.Offer, models.OfferNegotiation, error) {
	if err := requireUserRoleTx(tx, clientID, "cliente"); err != nil {
		return models.Offer{}, models.OfferNegotiation{}, err
	}

	offer, err := getOfferForUpdate(tx, offerID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Offer{}, models.OfferNegotiation{}, newFlowError(404, "Oferta nao encontrada")
	}
	if err != nil {
		return models.Offer{}, models.OfferNegotiation{}, err
	}

	if offer.ClientID != clientID {
		return models.Offer{}, models.OfferNegotiation{}, newFlowError(403, "Sem permissao")
	}

	negotiation, err := getNegotiationForUpdate(tx, negotiationID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Offer{}, models.OfferNegotiation{}, newFlowError(404, "Contraproposta nao encontrada")
	}
	if err != nil {
		return models.Offer{}, models.OfferNegotiation{}, err
	}

	if negotiation.OfferID != offer.ID {
		return models.Offer{}, models.OfferNegotiation{}, newFlowError(400, "Negociacao nao corresponde a oferta")
	}

	if negotiation.Status == "aceita" {
		return models.Offer{}, models.OfferNegotiation{}, newFlowError(409, "Nao e possivel recusar uma contraproposta ja aceita")
	}

	if negotiation.Status == "recusada" {
		return offer, negotiation, nil
	}

	negotiation.Status = "recusada"
	negotiation.RejectionReason = strings.TrimSpace(reason)
	if err := tx.Save(&negotiation).Error; err != nil {
		return models.Offer{}, models.OfferNegotiation{}, err
	}

	return offer, negotiation, nil
}

func createServiceTx(tx *gorm.DB, serviceModel *models.Service, clientID uint) error {
	if err := requireUserRoleTx(tx, clientID, "cliente"); err != nil {
		return err
	}

	serviceModel.ClientID = clientID
	serviceModel.Status = constants.StatusPending

	if err := lockUserRow(tx, serviceModel.DiaristID); err != nil {
		return err
	}

	conflict, err := hasScheduleConflict(tx, serviceModel.DiaristID, serviceModel.ScheduledAt, serviceModel.DurationHours, 0)
	if err != nil {
		return err
	}
	if conflict {
		return newFlowError(409, "A diarista ja possui um servico nesse horario")
	}

	if err := tx.Create(serviceModel).Error; err != nil {
		log.Printf("[service_create] tx.Create failed client_id=%d diarist_id=%d address_id=%v scheduled_at=%s service_type_len=%d status=%q error=%v", clientID, serviceModel.DiaristID, serviceModel.AddressID, serviceModel.ScheduledAt.Format(time.RFC3339), len(serviceModel.ServiceType), serviceModel.Status, err)
		return err
	}

	return nil
}

func updateServiceActionTx(tx *gorm.DB, serviceID interface{}, action string, userID uint, reason string) (models.Service, error) {
	serviceModel, err := getServiceForUpdate(tx, serviceID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Service{}, newFlowError(404, "Servico nao encontrado")
	}
	if err != nil {
		return models.Service{}, err
	}

	if serviceModel.ClientID != userID && serviceModel.DiaristID != userID {
		return models.Service{}, newFlowError(403, "Sem permissao para alterar este servico")
	}

	expectedRole := "cliente"
	if serviceModel.DiaristID == userID {
		expectedRole = "diarista"
	}
	if err := requireUserRoleTx(tx, userID, expectedRole); err != nil {
		return models.Service{}, err
	}

	switch action {
	case "accept":
		if serviceModel.DiaristID != userID {
			return models.Service{}, newFlowError(403, "Apenas a diarista pode aceitar o servico")
		}
		if serviceModel.Status == constants.StatusAccepted {
			return serviceModel, nil
		}
		if serviceModel.Status != constants.StatusPending {
			return models.Service{}, newFlowError(409, "O servico precisa estar pendente")
		}
		serviceModel.Status = constants.StatusAccepted
	case "start":
		if serviceModel.DiaristID != userID {
			return models.Service{}, newFlowError(403, "Apenas a diarista pode iniciar a jornada")
		}
		if serviceModel.Status == constants.StatusInJourney || serviceModel.Status == constants.StatusInService {
			return serviceModel, nil
		}
		if serviceModel.Status != constants.StatusAccepted && serviceModel.Status != legacyAcceptedServiceStatus {
			return models.Service{}, newFlowError(409, "O servico precisa estar aceito para iniciar a jornada")
		}
		return serviceModel, nil
	case "complete":
		if serviceModel.DiaristID != userID {
			return models.Service{}, newFlowError(403, "Apenas a diarista pode concluir o servico")
		}
		if serviceModel.Status == constants.StatusCompleted {
			return serviceModel, nil
		}
		if serviceModel.Status != constants.StatusInJourney && serviceModel.Status != constants.StatusInService {
			return models.Service{}, newFlowError(409, "O servico precisa estar em jornada para ser concluido")
		}
		now := time.Now().UTC()
		serviceModel.Status = constants.StatusCompleted
		serviceModel.CompletedAt = &now
	case "cancel":
		if serviceModel.Status == constants.StatusCompleted {
			return models.Service{}, newFlowError(409, "Nao e possivel cancelar um servico ja concluido")
		}
		if serviceModel.Status == constants.StatusCanceled {
			return serviceModel, nil
		}
		serviceModel.Status = constants.StatusCanceled
		if serviceModel.ClientID == userID {
			serviceModel.CancelReason = strings.TrimSpace(reason)
		} else {
			serviceModel.RejectionReason = strings.TrimSpace(reason)
		}
	default:
		return models.Service{}, newFlowError(400, "Acao invalida")
	}

	if err := tx.Save(&serviceModel).Error; err != nil {
		return models.Service{}, err
	}
	return serviceModel, nil
}

func startServiceWithPINTx(tx *gorm.DB, serviceID interface{}, userID uint, pin string) (models.Service, error) {
	if err := requireUserRoleTx(tx, userID, "diarista"); err != nil {
		return models.Service{}, err
	}

	serviceModel, err := getServiceForUpdate(tx, serviceID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Service{}, newFlowError(404, "Servico nao encontrado")
	}
	if err != nil {
		return models.Service{}, err
	}

	if serviceModel.DiaristID != userID {
		return models.Service{}, newFlowError(403, "Apenas a diarista pode iniciar o servico")
	}

	if serviceModel.Status == constants.StatusInJourney {
		return serviceModel, nil
	}

	if serviceModel.Status == constants.StatusInService {
		serviceModel.Status = constants.StatusInJourney
		if err := tx.Save(&serviceModel).Error; err != nil {
			return models.Service{}, err
		}
		return serviceModel, nil
	}

	if serviceModel.Status != constants.StatusAccepted && serviceModel.Status != legacyAcceptedServiceStatus {
		return models.Service{}, newFlowError(409, "O servico deve estar aceito para validar o PIN")
	}

	var client models.User
	if err := tx.Select("id", "phone").First(&client, serviceModel.ClientID).Error; err != nil {
		return models.Service{}, err
	}

	cleanPhone := fmt.Sprintf("%d", client.Phone)
	if len(cleanPhone) < 4 {
		return models.Service{}, newFlowError(500, "Telefone da cliente invalido no cadastro")
	}

	if pin != cleanPhone[len(cleanPhone)-4:] {
		return models.Service{}, newFlowError(401, "PIN incorreto. Use os 4 ultimos digitos do telefone cadastrado do cliente.")
	}

	serviceModel.Status = constants.StatusInJourney
	if err := tx.Save(&serviceModel).Error; err != nil {
		return models.Service{}, err
	}

	return serviceModel, nil
}

func duplicateUsersFingerprint(userIDs []uint) string {
	parts := make([]string, 0, len(userIDs))
	for _, userID := range userIDs {
		parts = append(parts, fmt.Sprintf("%d", userID))
	}
	return strings.Join(parts, ":")
}
