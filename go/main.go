package main

import (
	"fmt"
	"limpae/go/src/chat"
	"limpae/go/src/config"
	"limpae/go/src/realtime"
	"limpae/go/src/routes"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	// Iniciar conexão com o banco de dados
	fmt.Println("Iniciando conexão com o banco de dados...")
	config.ConnectDB()

	// Criar nova instância do Fiber
	fmt.Println("Iniciando servidor...")
	app := fiber.New()

	allowedOrigins := config.ResolveAllowedOrigins()

	// Middlewares globais
	app.Use(logger.New()) // Logger de requisições
	app.Use(cors.New(cors.Config{
		AllowOriginsFunc: func(origin string) bool {
			return config.IsAllowedOrigin(origin, allowedOrigins)
		},
		AllowMethods:     "GET,POST,HEAD,PUT,DELETE,PATCH",
		AllowCredentials: true,
	}))

	fmt.Println("Configurando rotas...")
	// Configurar Rotas

	go realtime.OfferHub.Run()
	chat.Start()

	routes.SetupRoutes(app)
	fmt.Println("Rotas Configuradas")

	// Rota inicial
	app.Get("/", func(c *fiber.Ctx) error {
		fmt.Println("Rota raiz acessada")
		return c.SendString("Hello World!")
	})

	// Pega a variável de ambiente 'PORT' fornecida pelo Render
	port := os.Getenv("PORT")
	if port == "" {
		port = "4000" // Porta padrão para desenvolvimento local, caso a variável não esteja configurada
	}

	// Inicia um goroutine para fazer requisições a cada 20 segundos
	go startRequestTimer()

	// Inicia o servidor e faz o bind para o host 0.0.0.0 e a porta fornecida
	address := fmt.Sprintf("0.0.0.0:%s", port)
	err := app.Listen(address)
	if err != nil {
		log.Fatalf("Erro ao iniciar o servidor: %v", err)
	}
}

// startRequestTimer faz uma requisição GET a cada 20 segundos
func startRequestTimer() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		resp, err := http.Get("https://limpae-jcqa.onrender.com")
		if err != nil {
			log.Printf("Erro ao fazer requisição: %v", err)
			continue
		}
		_ = resp.Body.Close()
		log.Println("Requisição feita com sucesso para https://limpae.onrender.com")
	}
}
