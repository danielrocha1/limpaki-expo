package config

import (
	"gorm.io/gorm"
)

// renameLegacyStripeSchemaToMercadoPago renomeia colunas/tabelas legadas de Stripe para nomes Mercado Pago.
// Idempotente: só altera se os nomes antigos existirem (Postgres em produção).
func renameLegacyStripeSchemaToMercadoPago(db *gorm.DB) error {
	if db == nil || db.Dialector.Name() != "postgres" {
		return nil
	}

	const sql = `
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'stripe_customer_id'
	) THEN
		ALTER TABLE subscriptions RENAME COLUMN stripe_customer_id TO mp_payer_id;
	END IF;

	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'stripe_subscription_id'
	) THEN
		ALTER TABLE subscriptions RENAME COLUMN stripe_subscription_id TO mp_external_id;
	END IF;

	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'stripe_price_id'
	) THEN
		ALTER TABLE subscriptions RENAME COLUMN stripe_price_id TO mp_plan_key;
	END IF;

	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'stripe_checkout_session_id'
	) THEN
		ALTER TABLE subscriptions RENAME COLUMN stripe_checkout_session_id TO mp_preference_id;
	END IF;

	IF EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = current_schema() AND table_name = 'stripe_webhook_events'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = current_schema() AND table_name = 'mp_webhook_events'
	) THEN
		ALTER TABLE stripe_webhook_events RENAME TO mp_webhook_events;
	END IF;
END $$;
`
	return db.Exec(sql).Error
}
