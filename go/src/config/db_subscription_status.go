package config

import (
	"gorm.io/gorm"
)

// ensureSubscriptionStatusCheckConstraint recria chk_subscriptions_status para incluir pending/trialing,
// alinhado a normalizeSubscriptionStorageStatus no handler.
func ensureSubscriptionStatusCheckConstraint(db *gorm.DB) error {
	if db == nil || db.Dialector.Name() != "postgres" {
		return nil
	}

	stmts := []string{
		`ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS chk_subscriptions_status;`,
		`UPDATE subscriptions SET status = TRIM(status);`,
		`UPDATE subscriptions SET status = 'canceled' WHERE status IN ('cancelled');`,
		`UPDATE subscriptions SET status = 'inactive' WHERE status IS NULL OR TRIM(COALESCE(status, '')) = '';`,
		`UPDATE subscriptions SET status = 'inactive' WHERE status NOT IN ('active','inactive','canceled','pending','trialing');`,
		`ALTER TABLE subscriptions ADD CONSTRAINT chk_subscriptions_status CHECK (status IN ('active','inactive','canceled','pending','trialing'));`,
	}
	for _, q := range stmts {
		if err := db.Exec(q).Error; err != nil {
			return err
		}
	}
	return nil
}
