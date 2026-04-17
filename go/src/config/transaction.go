package config

import (
	"context"

	"gorm.io/gorm"
)

type transactionContextKey struct{}

func DBFromContext(ctx context.Context, fallback *gorm.DB) *gorm.DB {
	if ctx == nil {
		return fallback
	}

	tx, ok := ctx.Value(transactionContextKey{}).(*gorm.DB)
	if ok && tx != nil {
		return tx
	}

	return fallback
}

func WithTransaction(ctx context.Context, db *gorm.DB, fn func(txCtx context.Context) error) error {
	if ctx == nil {
		ctx = context.Background()
	}

	if existing := DBFromContext(ctx, nil); existing != nil && existing != db {
		return fn(ctx)
	}

	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		txCtx := context.WithValue(ctx, transactionContextKey{}, tx.WithContext(ctx))
		return fn(txCtx)
	})
}
