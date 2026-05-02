package migrations

import (
	"context"
	_ "embed"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed 001_init.sql
var init001 string

// Run executes all migrations in order against the given pool.
// Each migration is idempotent (uses IF NOT EXISTS), so it is safe to run on
// every startup.
func Run(ctx context.Context, pool *pgxpool.Pool) error {
	scripts := []string{init001}
	for _, sql := range scripts {
		if _, err := pool.Exec(ctx, sql); err != nil {
			return err
		}
	}
	return nil
}
