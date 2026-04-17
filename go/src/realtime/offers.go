package realtime

type OfferEventPayload struct {
	OfferID       uint    `json:"offer_id"`
	ClientID      uint    `json:"client_id"`
	DiaristID     *uint   `json:"diarist_id,omitempty"`
	NegotiationID *uint   `json:"negotiation_id,omitempty"`
	ServiceID     *uint   `json:"service_id,omitempty"`
	Status        string  `json:"status"`
	ServiceType   string  `json:"service_type,omitempty"`
	CurrentValue  float64 `json:"current_value,omitempty"`
	InitialValue  float64 `json:"initial_value,omitempty"`
	TriggeredBy   uint    `json:"triggered_by"`
	TriggeredRole string  `json:"triggered_role,omitempty"`
}

func PublishOfferCreated(payload OfferEventPayload) {
	OfferHub.Publish("offer.created", payload, DispatchOptions{
		Roles: []string{"diarista"},
	})
}

func PublishOfferUpdated(payload OfferEventPayload, userIDs []uint, roles []string) {
	OfferHub.Publish("offer.updated", payload, DispatchOptions{
		UserIDs: userIDs,
		Roles:   roles,
	})
}

func PublishNegotiationCreated(payload OfferEventPayload, userIDs []uint) {
	OfferHub.Publish("negotiation.created", payload, DispatchOptions{
		UserIDs: userIDs,
	})
}

func PublishNegotiationUpdated(payload OfferEventPayload, userIDs []uint) {
	OfferHub.Publish("negotiation.updated", payload, DispatchOptions{
		UserIDs: userIDs,
	})
}

func PublishServiceUpdated(payload OfferEventPayload, userIDs []uint) {
	OfferHub.Publish("service.updated", payload, DispatchOptions{
		UserIDs: userIDs,
	})
}
