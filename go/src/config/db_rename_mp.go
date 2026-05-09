package config

import (
	"gorm.io/gorm"
)

// renameLegacyStripeSchemaToMercadoPago renomeia colunas/tabelas legadas de Stripe para nomes Mercado Pago.
// Idempotente no Postgres: seguro se ja foi aplicada ou se mp_* ja existe sem stripe_*.
func renameLegacyStripeSchemaToMercadoPago(db *gorm.DB) error {
	if db == nil || db.Dialector.Name() != "postgres" {
		return nil
	}

	const sql = `
DO $$
BEGIN
	-- mp_payer_id
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'stripe_customer_id'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'mp_payer_id'
	) THEN
		ALTER TABLE subscriptions RENAME COLUMN stripe_customer_id TO mp_payer_id;
	ELSIF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'stripe_customer_id'
	) AND EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'mp_payer_id'
	) THEN
		UPDATE subscriptions SET mp_payer_id = COALESCE(NULLIF(TRIM(mp_payer_id), ''), stripe_customer_id);
		ALTER TABLE subscriptions DROP COLUMN stripe_customer_id;
	END IF;

	-- mp_external_id
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'stripe_subscription_id'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'mp_external_id'
	) THEN
		ALTER TABLE subscriptions RENAME COLUMN stripe_subscription_id TO mp_external_id;
	ELSIF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'stripe_subscription_id'
	) AND EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'mp_external_id'
	) THEN
		UPDATE subscriptions SET mp_external_id = COALESCE(NULLIF(TRIM(mp_external_id), ''), stripe_subscription_id);
		ALTER TABLE subscriptions DROP COLUMN stripe_subscription_id;
	END IF;

	-- mp_plan_key
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'stripe_price_id'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'mp_plan_key'
	) THEN
		ALTER TABLE subscriptions RENAME COLUMN stripe_price_id TO mp_plan_key;
	ELSIF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'stripe_price_id'
	) AND EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'mp_plan_key'
	) THEN
		UPDATE subscriptions SET mp_plan_key = COALESCE(NULLIF(TRIM(mp_plan_key), ''), stripe_price_id);
		ALTER TABLE subscriptions DROP COLUMN stripe_price_id;
	END IF;

	-- mp_preference_id
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'stripe_checkout_session_id'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'mp_preference_id'
	) THEN
		ALTER TABLE subscriptions RENAME COLUMN stripe_checkout_session_id TO mp_preference_id;
	ELSIF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'stripe_checkout_session_id'
	) AND EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'subscriptions' AND column_name = 'mp_preference_id'
	) THEN
		UPDATE subscriptions SET mp_preference_id = COALESCE(NULLIF(TRIM(mp_preference_id), ''), stripe_checkout_session_id);
		ALTER TABLE subscriptions DROP COLUMN stripe_checkout_session_id;
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
