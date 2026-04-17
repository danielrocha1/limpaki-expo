package handlers

import (
	"encoding/json"
	"fmt"
	"strings"

	"limpae/go/src/models"
)

func maskCPF(cpf string) string {
	digits := strings.NewReplacer(".", "", "-", "", " ", "").Replace(strings.TrimSpace(cpf))
	if len(digits) != 11 {
		return cpf
	}

	return digits[:3] + ".***.***-" + digits[len(digits)-2:]
}

func toUserSummaryDTO(user models.User) UserSummaryDTO {
	return UserSummaryDTO{
		ID:    user.ID,
		Name:  user.Name,
		Photo: user.Photo,
		Email: user.Email,
		Phone: user.Phone,
		Role:  user.Role,
	}
}

func toAddressResponseDTO(address models.Address) AddressResponseDTO {
	response := AddressResponseDTO{
		ID:             address.ID,
		Street:         address.Street,
		Number:         address.Number,
		ResidenceType:  address.ResidenceType,
		Complement:     address.Complement,
		Neighborhood:   address.Neighborhood,
		ReferencePoint: address.ReferencePoint,
		City:           address.City,
		State:          address.State,
		Zipcode:        address.Zipcode,
		Latitude:       address.Latitude,
		Longitude:      address.Longitude,
	}
	if len(address.Rooms) > 0 {
		response.Rooms = make([]AddressRoomResponseDTO, 0, len(address.Rooms))
		for _, room := range address.Rooms {
			response.Rooms = append(response.Rooms, AddressRoomResponseDTO{
				ID:       room.ID,
				Name:     room.Name,
				Quantity: room.Quantity,
			})
		}
	}
	return response
}

func toDiaristProfileResponseDTO(profile models.Diarists) *DiaristProfileResponseDTO {
	if profile.ID == 0 {
		return nil
	}

	var specialties []string
	_ = json.Unmarshal([]byte(profile.Specialties), &specialties)
	return &DiaristProfileResponseDTO{
		ID:              profile.ID,
		UserID:          profile.UserID,
		Bio:             profile.Bio,
		ExperienceYears: profile.ExperienceYears,
		PricePerHour:    profile.PricePerHour,
		PricePerDay:     profile.PricePerDay,
		Specialties:     specialties,
		Available:       profile.Available,
	}
}

func toUserProfileResponseDTO(profile models.UserProfile) *UserProfileResponseDTO {
	if profile.ID == 0 {
		return nil
	}
	return &UserProfileResponseDTO{
		ID:               profile.ID,
		UserID:           profile.UserID,
		ResidenceType:    profile.ResidenceType,
		HasPets:          profile.HasPets,
		DesiredFrequency: profile.DesiredFrequency,
	}
}

func toReviewResponseDTO(review models.Review) *ReviewResponseDTO {
	if review.ID == 0 {
		return nil
	}
	return &ReviewResponseDTO{
		ID:             review.ID,
		ServiceID:      review.ServiceID,
		ClientID:       review.ClientID,
		DiaristID:      review.DiaristID,
		ClientComment:  review.ClientComment,
		DiaristComment: review.DiaristComment,
		ClientRating:   review.ClientRating,
		DiaristRating:  review.DiaristRating,
		CreatedAt:      review.CreatedAt,
	}
}

func toOfferNegotiationResponseDTO(negotiation models.OfferNegotiation) OfferNegotiationResponseDTO {
	return OfferNegotiationResponseDTO{
		ID:                   negotiation.ID,
		OfferID:              negotiation.OfferID,
		DiaristID:            negotiation.DiaristID,
		CounterValue:         negotiation.CounterValue,
		CounterDurationHours: negotiation.CounterDurationHours,
		Status:               negotiation.Status,
		Message:              negotiation.Message,
		RejectionReason:      negotiation.RejectionReason,
		CreatedAt:            negotiation.CreatedAt,
		UpdatedAt:            negotiation.UpdatedAt,
		DiaristDistance:      negotiation.DiaristDistance,
		DiaristRating:        negotiation.DiaristRating,
		Diarist:              toUserSummaryDTO(negotiation.Diarist),
		DiaristProfile:       toDiaristProfileResponseDTO(negotiation.Diarist.DiaristProfile),
	}
}

func toOfferResponseDTO(offer models.Offer, serviceStatus string) OfferResponseDTO {
	response := OfferResponseDTO{
		ID:                  offer.ID,
		ClientID:            offer.ClientID,
		AddressID:           offer.AddressID,
		ServiceType:         offer.ServiceType,
		ScheduledAt:         offer.ScheduledAt,
		DurationHours:       offer.DurationHours,
		InitialValue:        offer.InitialValue,
		CurrentValue:        offer.CurrentValue,
		Status:              offer.Status,
		Observations:        offer.Observations,
		CancelReason:        offer.CancelReason,
		ServiceStatus:       serviceStatus,
		AcceptedByDiaristID: offer.AcceptedByDiaristID,
		CreatedAt:           offer.CreatedAt,
		UpdatedAt:           offer.UpdatedAt,
		Client:              toUserSummaryDTO(offer.Client),
		Address:             toAddressResponseDTO(offer.Address),
		Negotiations:        make([]OfferNegotiationResponseDTO, 0, len(offer.Negotiations)),
	}
	if offer.AcceptedByDiaristID != nil && offer.AcceptedByDiarist.ID != 0 {
		summary := toUserSummaryDTO(offer.AcceptedByDiarist)
		response.AcceptedByDiarist = &summary
	}
	for _, negotiation := range offer.Negotiations {
		response.Negotiations = append(response.Negotiations, toOfferNegotiationResponseDTO(negotiation))
	}
	return response
}

func getServiceStartPIN(serviceModel models.Service, viewerID uint) string {
	if serviceModel.ClientID != viewerID {
		return ""
	}

	phone := fmt.Sprintf("%d", serviceModel.Client.Phone)
	if len(phone) < 4 {
		return ""
	}

	return phone[len(phone)-4:]
}

func toServiceResponseDTO(serviceModel models.Service, viewerID uint) ServiceResponseDTO {
	return ServiceResponseDTO{
		ID:              serviceModel.ID,
		OfferID:         serviceModel.OfferID,
		ClientID:        serviceModel.ClientID,
		DiaristID:       serviceModel.DiaristID,
		AddressID:       serviceModel.AddressID,
		Status:          serviceModel.Status,
		TotalPrice:      serviceModel.TotalPrice,
		DurationHours:   serviceModel.DurationHours,
		ScheduledAt:     serviceModel.ScheduledAt,
		CompletedAt:     serviceModel.CompletedAt,
		CreatedAt:       serviceModel.CreatedAt,
		ServiceType:     serviceModel.ServiceType,
		HasPets:         serviceModel.HasPets,
		Observations:    serviceModel.Observations,
		CancelReason:    serviceModel.CancelReason,
		RejectionReason: serviceModel.RejectionReason,
		RoomCount:       serviceModel.RoomCount,
		BathroomCount:   serviceModel.BathroomCount,
		StartPIN:        getServiceStartPIN(serviceModel, viewerID),
		Client:          toUserSummaryDTO(serviceModel.Client),
		Diarist:         toUserSummaryDTO(serviceModel.Diarist),
		Address:         toAddressResponseDTO(serviceModel.Address),
		Review:          toReviewResponseDTO(serviceModel.Review),
	}
}

func toPaymentResponseDTO(payment models.Payment) PaymentResponseDTO {
	return PaymentResponseDTO{
		ID:        payment.ID,
		ServiceID: payment.ServiceID,
		ClientID:  payment.ClientID,
		DiaristID: payment.DiaristID,
		Amount:    payment.Amount,
		Status:    payment.Status,
		Method:    payment.Method,
		PaidAt:    payment.PaidAt,
	}
}

func toSubscriptionResponseDTO(sub models.Subscription) SubscriptionResponseDTO {
	return SubscriptionResponseDTO{
		ID:                      sub.ID,
		UserID:                  sub.UserID,
		Role:                    sub.Role,
		Plan:                    sub.Plan,
		Price:                   sub.Price,
		Status:                  sub.Status,
		StripeCustomerID:        sub.StripeCustomerID,
		StripeSubscriptionID:    sub.StripeSubscriptionID,
		StripePriceID:           sub.StripePriceID,
		StripeCheckoutSessionID: sub.StripeCheckoutSessionID,
		CurrentPeriodStart:      sub.CurrentPeriodStart,
		CurrentPeriodEnd:        sub.CurrentPeriodEnd,
		CancelAt:                sub.CancelAt,
		CanceledAt:              sub.CanceledAt,
		EndedAt:                 sub.EndedAt,
		LastWebhookEventID:      sub.LastWebhookEventID,
		AccessValid:             subscriptionStatusAllowsAccess(sub.Status),
		CreatedAt:               sub.CreatedAt,
		UpdatedAt:               sub.UpdatedAt,
	}
}

func toUserResponseDTO(user models.User) UserResponseDTO {
	response := UserResponseDTO{
		ID:              user.ID,
		Name:            user.Name,
		Photo:           user.Photo,
		Email:           user.Email,
		EmailVerified:   user.EmailVerified,
		EmailVerifiedAt: user.EmailVerifiedAt,
		Phone:           user.Phone,
		Cpf:             maskCPF(user.Cpf),
		Role:            user.Role,
		IsTestUser:      user.IsTestUser,
		CreatedAt:       user.CreatedAt,
		Address:         make([]AddressResponseDTO, 0, len(user.Address)),
		UserProfile:     toUserProfileResponseDTO(user.UserProfile),
		DiaristProfile:  toDiaristProfileResponseDTO(user.DiaristProfile),
	}
	for _, address := range user.Address {
		response.Address = append(response.Address, toAddressResponseDTO(address))
	}
	return response
}
