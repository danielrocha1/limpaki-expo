package routes

import (
	"limpae/go/src/config"
	"limpae/go/src/controllers"
	"limpae/go/src/handlers"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("/api", config.JWTMiddleware)

	app.Use("/api/ws/offers", handlers.OfferWebSocketUpgradeMiddleware)
	app.Get("/api/ws/offers", handlers.OfferWebSocketHandler)
	app.Use("/api/ws/chat", handlers.ChatWebSocketUpgradeMiddleware)
	app.Get("/api/ws/chat", handlers.ChatWebSocketHandler())
	app.Post("/stripe/webhook", handlers.StripeWebhookHandler)
	app.Post("/paymentstripe", handlers.PaymentStripeWebhookHandler)

	app.Post("/register", handlers.CreateUser)
	app.Post("/users", handlers.CreateUser)
	app.Post("/login", handlers.LoginHandler)
	app.Get("/verify-email", handlers.VerifyEmailHandler)
	app.Post("/verify-email", handlers.VerifyEmailHandler)

	api.Get("/users", handlers.GetUsers)
	api.Get("/users/:id", handlers.GetUser)
	api.Put("/users/:id", handlers.UpdateUser)
	api.Delete("/users/:id", handlers.DeleteUser)
	api.Get("/users-role", handlers.GetUserRole)
	api.Post("/auth/email-verification/resend", handlers.ResendVerificationEmailHandler)

	api.Get("/profile", handlers.GetUserProfile)
	api.Put("/profile", handlers.UpdateProfile)

	api.Post("/diarists", handlers.CreateDiaristProfile)
	api.Get("/diarists", handlers.GetDiarists)
	api.Get("/diarists/:id", handlers.GetDiarist)
	api.Put("/diarists/:id", handlers.UpdateDiarist)
	api.Delete("/diarists/:id", handlers.DeleteDiarist)

	api.Post("/addresses", handlers.CreateAddress)
	api.Get("/addresses/", handlers.GetAddress)
	api.Put("/addresses/:id", handlers.UpdateAddress)
	api.Delete("/addresses/:id", handlers.DeleteAddress)

	servicesAPI := api.Group("/services", handlers.RequireValidSubscriptionMiddleware)
	servicesAPI.Post("/", handlers.CreateService)
	servicesAPI.Get("/", handlers.GetServices)
	servicesAPI.Get("/my", handlers.GetServicesByClientID)
	servicesAPI.Get("/pending-schedules/:id", handlers.GetPendingSchedules)
	servicesAPI.Put("/:id/:action", handlers.UpdateService)
	servicesAPI.Post("/:id/start-with-pin", handlers.StartServiceWithPIN)
	servicesAPI.Delete("/:id", handlers.DeleteService)

	api.Post("/payments", handlers.CreatePayment)
	api.Get("/payments", handlers.GetPayments)
	api.Get("/payments/:id", handlers.GetPayment)
	api.Put("/payments/:id", handlers.UpdatePayment)
	api.Delete("/payments/:id", handlers.DeletePayment)

	api.Post("/reviews", handlers.CreateReview)
	app.Get("/reviews", handlers.GetReviews)
	api.Get("/reviews/:id", handlers.GetReview)
	api.Put("/reviews/:id", handlers.UpdateReview)
	api.Delete("/reviews/:id", handlers.DeleteReview)
	api.Get("/weightedRating/:id", handlers.GetWeightedRating)
	api.Get("/diarist-reviews/:id", handlers.GetDiaristReviews)

	api.Post("/subscriptions", handlers.CreateSubscription)
	api.Get("/subscriptions", handlers.GetSubscriptions)
	api.Get("/subscriptions/current", handlers.GetCurrentSubscription)
	api.Get("/subscriptions/access-status", handlers.GetSubscriptionAccessStatus)
	api.Post("/subscriptions/checkout-session", handlers.CreateCheckoutSession)
	api.Post("/subscriptions/cancel", handlers.CancelCurrentSubscription)
	api.Get("/subscriptions/:id", handlers.GetSubscription)
	api.Put("/subscriptions/:id", handlers.UpdateSubscription)
	api.Delete("/subscriptions/:id", handlers.CancelSubscription)

	offersAPI := api.Group("/offers", handlers.RequireValidSubscriptionMiddleware)
	offersAPI.Post("/", handlers.CreateOffer)
	offersAPI.Get("/", handlers.GetOpenOffers)
	offersAPI.Get("/my", handlers.GetMyOffers)
	offersAPI.Get("/:id", handlers.GetOfferByID)
	offersAPI.Get("/:id/client-profile", handlers.GetOfferClientProfile)
	offersAPI.Put("/:id/cancel", handlers.CancelOffer)
	offersAPI.Post("/:id/accept", handlers.AcceptOffer)
	offersAPI.Post("/:id/negotiate", handlers.SendCounterOffer)
	offersAPI.Put("/:id/negotiate/:negotiationId/accept", handlers.AcceptNegotiation)
	offersAPI.Put("/:id/negotiate/:negotiationId/reject", handlers.RejectNegotiation)

	negotiationsAPI := api.Group("/negotiations", handlers.RequireValidSubscriptionMiddleware)
	negotiationsAPI.Get("/my", handlers.GetDiaristNegotiations)

	realtimeAPI := api.Group("/realtime", handlers.RequireValidSubscriptionMiddleware)
	realtimeAPI.Get("/online-users", handlers.GetOnlineUsers)

	messagesAPI := api.Group("/messages", handlers.RequireValidSubscriptionMiddleware)
	messagesAPI.Get("/", handlers.ChatMessagesHandler)

	locationsAPI := api.Group("/locations", handlers.RequireValidSubscriptionMiddleware)
	locationsAPI.Get("/", handlers.ChatLocationsHandler)

	api.Post("/userprofile", handlers.CreateUserProfile)
	api.Post("/upload-photo", controllers.UploadPhotoHandler)
	api.Post("/upload-document", handlers.UploadDocuments)

	api.Get("/diarists-nearby", handlers.RequireValidSubscriptionMiddleware, func(c *fiber.Ctx) error {
		return handlers.GetNearbyDiarists(c)
	})

	app.Use(func(c *fiber.Ctx) error {
		return c.Status(404).SendString("Pagina nao encontrada")
	})
}
