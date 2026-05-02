package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"genogram/backend/internal/config"
	"genogram/backend/internal/httpapi"
	"genogram/backend/internal/store"
)

func main() {
	cfg := config.Load()

	diagramStore, cleanup := initStore(cfg)
	defer cleanup()

	h := httpapi.NewHandler(diagramStore)
	handler := cors.Handler(cors.Options{
		AllowedOrigins: []string{cfg.CORSOrigin},
		AllowedMethods: []string{"GET", "POST", "PUT", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
	})(h.Routes())

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  30 * time.Second,
	}

	go func() {
		log.Printf("backend listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}

func initStore(cfg config.Config) (store.DiagramStore, func()) {
	if cfg.DBDSN == "" {
		log.Println("DB_DSN not configured: using in-memory store")
		return store.NewMemoryStore(), func() {}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, cfg.DBDSN)
	if err != nil {
		log.Printf("failed to connect DB, using in-memory store: %v", err)
		return store.NewMemoryStore(), func() {}
	}

	return store.NewPostgresStore(pool), func() { pool.Close() }
}
