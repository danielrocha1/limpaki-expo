package handlers

import (
	"errors"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ResourceAction string

const (
	ActionRead   ResourceAction = "read"
	ActionCreate ResourceAction = "create"
	ActionUpdate ResourceAction = "update"
	ActionDelete ResourceAction = "delete"
	ActionCancel ResourceAction = "cancel"
	ActionAccept ResourceAction = "accept"
)

type AuthzDecision struct {
	Allowed bool
	Hide    bool
	Message string
}

func allow() AuthzDecision {
	return AuthzDecision{Allowed: true}
}

func denyForbidden(message string) AuthzDecision {
	return AuthzDecision{Message: message}
}

func denyHidden(message string) AuthzDecision {
	return AuthzDecision{Hide: true, Message: message}
}

func authzErrorResponse(c *fiber.Ctx, decision AuthzDecision, notFoundMessage string) error {
	if decision.Allowed {
		return nil
	}
	if decision.Hide {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": notFoundMessage})
	}

	message := decision.Message
	if message == "" {
		message = "Acesso negado"
	}
	return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": message})
}

func authzFlowError(decision AuthzDecision, notFoundMessage string) error {
	if decision.Allowed {
		return nil
	}
	if decision.Hide {
		return fiberError(fiber.StatusNotFound, notFoundMessage)
	}

	message := decision.Message
	if message == "" {
		message = "Acesso negado"
	}
	return fiberError(fiber.StatusForbidden, message)
}

func loadUserByID(userID uint) (models.User, error) {
	var user models.User
	err := config.DB.Select("id", "role", "email").First(&user, userID).Error
	return user, err
}

func findScopedUser(userID uint, targetID interface{}) (models.User, error) {
	var user models.User
	err := config.DB.
		Preload("Address").
		Preload("Address.Rooms").
		Preload("DiaristProfile").
		Preload("UserProfile").
		Where("id = ?", userID).
		First(&user, targetID).Error
	return user, err
}

func findOwnedAddress(userID uint, addressID interface{}) (models.Address, error) {
	var address models.Address
	err := config.DB.Preload("Rooms").Where("user_id = ?", userID).First(&address, addressID).Error
	return address, err
}

func findScopedService(userID uint, serviceID interface{}) (models.Service, error) {
	var serviceModel models.Service
	err := config.DB.
		Preload("Address").
		Preload("Address.Rooms").
		Preload("Client").
		Preload("Diarist").
		Preload("Review").
		Where("client_id = ? OR diarist_id = ?", userID, userID).
		First(&serviceModel, serviceID).Error
	return serviceModel, err
}

func findScopedPayment(userID uint, paymentID interface{}) (models.Payment, error) {
	var payment models.Payment
	err := config.DB.
		Where("client_id = ? OR diarist_id = ?", userID, userID).
		First(&payment, paymentID).Error
	return payment, err
}

func findOwnedSubscription(userID uint, subscriptionID interface{}) (models.Subscription, error) {
	var sub models.Subscription
	err := config.DB.Where("user_id = ?", userID).First(&sub, subscriptionID).Error
	return sub, err
}

func findScopedReview(userID uint, reviewID interface{}) (models.Review, error) {
	var review models.Review
	err := config.DB.
		Where("client_id = ? OR diarist_id = ?", userID, userID).
		First(&review, reviewID).Error
	return review, err
}

func findAccessibleOfferForRead(user models.User, offerID interface{}) (models.Offer, error) {
	query := config.DB.
		Model(&models.Offer{}).
		Preload("Client").
		Preload("Address").
		Preload("Address.Rooms").
		Preload("AcceptedByDiarist").
		Preload("Negotiations").
		Preload("Negotiations.Diarist")

	switch user.Role {
	case "cliente":
		query = query.Where("offers.client_id = ?", user.ID)
	case "diarista":
		query = query.Where(`
			offers.status IN ? OR
			offers.accepted_by_diarist_id = ? OR
			EXISTS (
				SELECT 1
				FROM offer_negotiations
				WHERE offer_negotiations.offer_id = offers.id
				  AND offer_negotiations.diarist_id = ?
			)
		`, []string{"aberta", "negociacao"}, user.ID, user.ID)
	default:
		return models.Offer{}, gorm.ErrRecordNotFound
	}

	var offer models.Offer
	err := query.First(&offer, offerID).Error
	return offer, err
}

func RequireAuthenticatedUser(c *fiber.Ctx) (uint, error) {
	userID, ok := c.Locals("user_id").(uint)
	if !ok || userID == 0 {
		return 0, c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Usuario nao autenticado"})
	}
	return userID, nil
}

func CanUserAccessUser(actor models.User, target models.User, action ResourceAction) AuthzDecision {
	if actor.ID == target.ID {
		return allow()
	}
	return denyHidden("Usuario fora do escopo")
}

func CanUserAccessAddress(actor models.User, address models.Address, action ResourceAction) AuthzDecision {
	if actor.ID == address.UserID {
		return allow()
	}
	return denyHidden("Endereco fora do escopo")
}

func CanUserAccessService(actor models.User, serviceModel models.Service, action ResourceAction) AuthzDecision {
	if actor.ID != serviceModel.ClientID && actor.ID != serviceModel.DiaristID {
		return denyHidden("Servico fora do escopo")
	}

	switch action {
	case ActionDelete, ActionCancel:
		if actor.ID != serviceModel.ClientID {
			return denyForbidden("Apenas a cliente pode executar esta acao")
		}
	case ActionAccept:
		if actor.ID != serviceModel.DiaristID {
			return denyForbidden("Apenas a diarista pode executar esta acao")
		}
	}

	return allow()
}

func CanUserAccessPayment(actor models.User, payment models.Payment, action ResourceAction) AuthzDecision {
	if actor.ID != payment.ClientID && actor.ID != payment.DiaristID {
		return denyHidden("Pagamento fora do escopo")
	}
	if (action == ActionUpdate || action == ActionDelete || action == ActionCreate) && actor.ID != payment.ClientID {
		return denyForbidden("Apenas o cliente pode alterar este pagamento")
	}
	return allow()
}

func CanUserAccessSubscription(actor models.User, sub models.Subscription, action ResourceAction) AuthzDecision {
	if actor.ID == sub.UserID {
		return allow()
	}
	return denyHidden("Assinatura fora do escopo")
}

func CanUserAccessReview(actor models.User, review models.Review, action ResourceAction) AuthzDecision {
	if actor.ID != review.ClientID && actor.ID != review.DiaristID {
		return denyHidden("Review fora do escopo")
	}
	return allow()
}

func CanUserAccessOffer(actor models.User, offer models.Offer, action ResourceAction) AuthzDecision {
	switch action {
	case ActionRead:
		if actor.Role == "cliente" && actor.ID == offer.ClientID {
			return allow()
		}
		if actor.Role == "diarista" && (offer.Status == "aberta" || offer.Status == "negociacao" || (offer.AcceptedByDiaristID != nil && *offer.AcceptedByDiaristID == actor.ID)) {
			return allow()
		}
		return denyHidden("Oferta fora do escopo")
	case ActionCreate, ActionCancel:
		if actor.Role != "cliente" || actor.ID != offer.ClientID {
			return denyForbidden("Apenas o cliente dono pode alterar esta oferta")
		}
		return allow()
	case ActionAccept:
		if actor.Role != "diarista" {
			return denyForbidden("Apenas diaristas podem aceitar ofertas")
		}
		return allow()
	default:
		return allow()
	}
}

func requireUserRole(userID uint, expectedRole string) error {
	user, err := loadUserByID(userID)
	if err != nil {
		return err
	}
	return requireLoadedUserRole(user, expectedRole)
}

func requireUserRoleTx(tx *gorm.DB, userID uint, expectedRole string) error {
	var user models.User
	if err := tx.Select("id", "role", "email").First(&user, userID).Error; err != nil {
		return err
	}
	return requireLoadedUserRole(user, expectedRole)
}

func requireLoadedUserRole(user models.User, expectedRole string) error {
	if user.Role != expectedRole {
		return fiberError(fiber.StatusForbidden, "Sem permissao para esta acao")
	}
	return nil
}

func fiberError(status int, message string) error {
	return &flowError{status: status, message: message}
}

func isNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
