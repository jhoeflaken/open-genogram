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
		DBDSN:      os.Getenv("DB_DSN"),
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
