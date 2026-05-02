package config

import (
	"os"
)

type Config struct {
	Port       string
	DBDSN      string
	CORSOrigin string
}

func Load() Config {
	cfg := Config{
		Port:       getEnv("PORT", "8080"),
		DBDSN:      getEnv("DB_DSN", "postgres://genogram:genogram@localhost:5432/genogram?sslmode=disable"),
		CORSOrigin: getEnv("CORS_ORIGIN", "http://localhost:5173"),
	}
	return cfg
}

func getEnv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}
