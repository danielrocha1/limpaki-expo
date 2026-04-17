package handlers

import (
	"limpae/go/src/models"
	"limpae/go/src/utils"
	"log"
)

func resolveUserPhoto(user *models.User) error {
	if user == nil {
		return nil
	}

	resolvedPhoto, err := utils.ResolveStoredPhotoURL(user.Photo)
	if err != nil {
		log.Println("Falha ao resolver foto do usuario, usando valor armazenado:", err)
		return nil
	}

	if resolvedPhoto != "" {
		user.Photo = resolvedPhoto
	}

	return nil
}

func resolveOfferPhotos(offer *models.Offer) error {
	if offer == nil {
		return nil
	}

	if err := resolveUserPhoto(&offer.Client); err != nil {
		return err
	}

	if err := resolveUserPhoto(&offer.AcceptedByDiarist); err != nil {
		return err
	}

	for index := range offer.Negotiations {
		if err := resolveUserPhoto(&offer.Negotiations[index].Diarist); err != nil {
			return err
		}
	}

	return nil
}

func resolveServicePhotos(service *models.Service) error {
	if service == nil {
		return nil
	}

	if err := resolveUserPhoto(&service.Client); err != nil {
		return err
	}

	if err := resolveUserPhoto(&service.Diarist); err != nil {
		return err
	}

	return nil
}
