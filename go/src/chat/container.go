package chat

import (
	"log/slog"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"limpae/go/src/chat/repository"
	"limpae/go/src/chat/service"
	chatws "limpae/go/src/chat/websocket"
	"limpae/go/src/config"
)

type Container struct {
	ServiceAccess    *service.ServiceAccessService
	MessageService   *service.MessageService
	LocationService  *service.LocationService
	Hub              *chatws.Hub
	AllowedOrigins   []string
	ReadBufferSize   int
	WriteBufferSize  int
	LocationInterval time.Duration
}

var (
	container     *Container
	containerOnce sync.Once
	hubStartOnce  sync.Once
)

func GetContainer() *Container {
	containerOnce.Do(func() {
		logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

		serviceRepo := repository.NewServiceRepository(config.DB)
		messageRepo := repository.NewMessageRepository(config.DB)
		locationRepo := repository.NewLocationRepository(config.DB)
		roomRepo := repository.NewRoomRepository(config.DB)
		serviceAccess := service.NewServiceAccessService(serviceRepo)

		locationInterval := parseDurationEnv("CHAT_LOCATION_MIN_INTERVAL", time.Second)
		hub := chatws.NewHub(logger)

		container = &Container{
			ServiceAccess:    serviceAccess,
			MessageService:   service.NewMessageService(serviceAccess, messageRepo, roomRepo),
			LocationService:  service.NewLocationService(serviceAccess, locationRepo, roomRepo, locationInterval),
			Hub:              hub,
			AllowedOrigins:   resolveAllowedOrigins(),
			ReadBufferSize:   parseIntEnv("CHAT_WS_READ_BUFFER", 1024),
			WriteBufferSize:  parseIntEnv("CHAT_WS_WRITE_BUFFER", 1024),
			LocationInterval: locationInterval,
		}
	})

	return container
}

func Start() {
	instance := GetContainer()
	hubStartOnce.Do(func() {
		go instance.Hub.Run()
	})
}

func resolveAllowedOrigins() []string {
	csv := strings.TrimSpace(os.Getenv("CHAT_ALLOWED_ORIGINS"))
	if csv != "" {
		parts := strings.Split(csv, ",")
		origins := make([]string, 0, len(parts))
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				origins = append(origins, trimmed)
			}
		}
		if len(origins) > 0 {
			return origins
		}
	}

	return config.ResolveAllowedOrigins()
}

func parseDurationEnv(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func parseIntEnv(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
