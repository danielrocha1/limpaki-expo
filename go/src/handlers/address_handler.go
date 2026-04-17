package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"limpae/go/src/config"
	"limpae/go/src/models"

	"github.com/gofiber/fiber/v2"
)

func getCoordinates(address string) (float64, float64, error) {
	baseURL := "https://nominatim.openstreetmap.org/search"
	query := url.Values{}
	query.Set("q", address)
	query.Set("format", "jsonv2")
	query.Set("limit", "1")
	query.Set("countrycodes", "br")

	resp, err := http.Get(fmt.Sprintf("%s?%s", baseURL, query.Encode()))
	if err != nil {
		return 0, 0, err
	}
	defer resp.Body.Close()

	var results []struct {
		Lat string `json:"lat"`
		Lon string `json:"lon"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return 0, 0, err
	}
	if len(results) == 0 {
		return 0, 0, fmt.Errorf("endereco nao encontrado")
	}

	var lat, lon float64
	fmt.Sscanf(results[0].Lat, "%f", &lat)
	fmt.Sscanf(results[0].Lon, "%f", &lon)
	return lat, lon, nil
}

func buildAddressRoomsFromDTO(request AddressUpsertRequestDTO) ([]models.AddressRoom, []ValidationFieldError) {
	validator := &validationCollector{}
	rooms := make([]models.AddressRoom, 0, len(request.Rooms))

	if len(request.Rooms) == 0 {
		return rooms, nil
	}

	for index, room := range request.Rooms {
		name := validateRequiredString(validator, fmt.Sprintf("rooms[%d].name", index), room.Name, 100)
		validateIntRange(validator, fmt.Sprintf("rooms[%d].quantity", index), room.Quantity, 1, 99)
		rooms = append(rooms, models.AddressRoom{
			Name:     name,
			Quantity: room.Quantity,
		})
	}

	if validator.HasErrors() {
		return nil, validator.errors
	}

	return rooms, nil
}

func buildAddressSearchText(address models.Address) string {
	parts := []string{
		address.Street,
		address.Number,
		address.Complement,
		address.Neighborhood,
		address.ReferencePoint,
		address.City,
		address.State,
		address.Zipcode,
		"Brasil",
	}

	normalizedParts := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			normalizedParts = append(normalizedParts, trimmed)
		}
	}

	return strings.Join(normalizedParts, ", ")
}

func resolveAddressCoordinates(address *models.Address, request AddressUpsertRequestDTO) error {
	if hasCoordinates(request.Latitude, request.Longitude) {
		address.Latitude = request.Latitude
		address.Longitude = request.Longitude
		return nil
	}

	latitude, longitude, err := getCoordinates(buildAddressSearchText(*address))
	if err != nil {
		return err
	}

	address.Latitude = latitude
	address.Longitude = longitude
	return nil
}

func buildAddressFromDTO(userID uint, request AddressUpsertRequestDTO) (models.Address, []models.AddressRoom, []ValidationFieldError, error) {
	validator := &validationCollector{}
	residenceType := strings.TrimSpace(request.ResidenceType)
	if residenceType == "" {
		residenceType = "apartment"
	}
	address := models.Address{
		UserID:         userID,
		Street:         validateRequiredString(validator, "street", request.Street, 150),
		Number:         validateOptionalString(validator, "number", request.Number, 10),
		ResidenceType:  validateEnum(validator, "residence_type", residenceType, "apartment", "house", "office"),
		Complement:     validateOptionalString(validator, "complement", request.Complement, 150),
		Neighborhood:   validateRequiredString(validator, "neighborhood", request.Neighborhood, 100),
		ReferencePoint: validateOptionalString(validator, "reference_point", request.ReferencePoint, 150),
		City:           validateRequiredString(validator, "city", request.City, 50),
		State:          validateState(validator, "state", request.State),
		Zipcode:        validateZipcode(validator, "zipcode", request.Zipcode),
	}

	rooms, roomValidationErrors := buildAddressRoomsFromDTO(request)
	if len(roomValidationErrors) > 0 {
		validator.errors = append(validator.errors, roomValidationErrors...)
	}

	if validator.HasErrors() {
		return models.Address{}, nil, validator.errors, nil
	}

	if err := resolveAddressCoordinates(&address, request); err != nil {
		return models.Address{}, nil, nil, err
	}

	return address, rooms, nil, nil
}

func CreateAddress(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var request AddressUpsertRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	address, rooms, validationErrors, coordinateErr := buildAddressFromDTO(userID, request)
	if len(validationErrors) > 0 {
		return writeValidationError(c, validationErrors)
	}
	if coordinateErr != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Nao foi possivel localizar o endereco informado"})
	}

	if err := config.DB.Create(&address).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao criar endereco"})
	}
	for index := range rooms {
		rooms[index].AddressID = address.ID
	}
	if len(rooms) > 0 {
		if err := config.DB.Create(&rooms).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao criar comodos do endereco"})
		}
	}
	address.Rooms = rooms

	return c.JSON(toAddressResponseDTO(address))
}

func CreateNewAddress(c *fiber.Ctx) error {
	return CreateAddress(c)
}

func GetAddresses(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	var addresses []models.Address
	if err := config.DB.Preload("Rooms").Where("user_id = ?", userID).Find(&addresses).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao buscar enderecos"})
	}

	response := make([]AddressResponseDTO, 0, len(addresses))
	for _, address := range addresses {
		response = append(response, toAddressResponseDTO(address))
	}
	return c.JSON(response)
}

func GetAddress(c *fiber.Ctx) error {
	return GetAddresses(c)
}

func UpdateAddress(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	address, err := findOwnedAddress(userID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Endereco nao encontrado"})
	}

	var request AddressUpsertRequestDTO
	if decodeErrors := decodeStrictJSON(c, &request); len(decodeErrors) > 0 {
		return writeValidationError(c, decodeErrors)
	}

	nextAddress, rooms, validationErrors, coordinateErr := buildAddressFromDTO(userID, request)
	if len(validationErrors) > 0 {
		return writeValidationError(c, validationErrors)
	}
	if coordinateErr != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Nao foi possivel localizar o endereco informado"})
	}

	address.Street = nextAddress.Street
	address.Number = nextAddress.Number
	address.ResidenceType = nextAddress.ResidenceType
	address.Complement = nextAddress.Complement
	address.Neighborhood = nextAddress.Neighborhood
	address.ReferencePoint = nextAddress.ReferencePoint
	address.City = nextAddress.City
	address.State = nextAddress.State
	address.Zipcode = nextAddress.Zipcode
	address.Latitude = nextAddress.Latitude
	address.Longitude = nextAddress.Longitude

	if err := config.DB.Save(&address).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao atualizar endereco"})
	}
	if err := config.DB.Where("address_id = ?", address.ID).Delete(&models.AddressRoom{}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao atualizar comodos do endereco"})
	}
	for index := range rooms {
		rooms[index].AddressID = address.ID
	}
	if len(rooms) > 0 {
		if err := config.DB.Create(&rooms).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Erro ao salvar comodos do endereco"})
		}
	}
	address.Rooms = rooms

	return c.JSON(toAddressResponseDTO(address))
}

func DeleteAddress(c *fiber.Ctx) error {
	userID, err := RequireAuthenticatedUser(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	address, err := findOwnedAddress(userID, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Endereco nao encontrado"})
	}

	config.DB.Delete(&models.Address{}, address.ID)
	return c.SendStatus(204)
}
