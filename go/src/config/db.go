package config

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"limpae/go/src/models"
)

var DB *gorm.DB

func ConnectDB() {
	err := godotenv.Load("./src/config/.env")
	if err != nil {
		log.Fatal("Erro ao carregar o .env:", err)
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("A variavel de ambiente DATABASE_URL nao esta configurada.")
	}

	DB, err = gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		log.Fatal("Erro ao conectar ao banco de dados:", err)
	}

	err = DB.AutoMigrate(
		&models.User{},
		&models.EmailVerificationToken{},
		&models.Address{},
		&models.AddressRoom{},
		&models.Diarists{},
		&models.UserProfile{},
		&models.Service{},
		&models.Payment{},
		&models.Review{},
		&models.Subscription{},
		&models.Offer{},
		&models.OfferNegotiation{},
		&models.ChatRoom{},
		&models.ChatRoomUser{},
		&models.ChatMessage{},
		&models.ChatMessageRead{},
		&models.ChatLocation{},
		&models.StripeWebhookEvent{},
	)
	if err != nil {
		log.Fatal("Erro ao migrar tabelas:", err)
	}

	if err := ensureServiceTypeColumnLength(); err != nil {
		log.Fatal("Erro ao alinhar tamanho de service_type:", err)
	}

	fmt.Println("Banco de dados conectado e migrado com sucesso!")
}

func ensureServiceTypeColumnLength() error {
	statements := []string{
		`ALTER TABLE services ALTER COLUMN service_type TYPE varchar(500);`,
		`ALTER TABLE offers ALTER COLUMN service_type TYPE varchar(500);`,
	}

	for _, statement := range statements {
		if err := DB.Exec(statement).Error; err != nil {
			return err
		}
	}

	return nil
}
