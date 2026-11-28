package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/satilian/3tledger/apps/profile-api/internal/platform"
	"github.com/satilian/3tledger/apps/profile-api/migrations"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func run(ctx context.Context) error {
	address := os.Getenv("HTTP_ADDR")
	if address == "" {
		address = ":8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health/live", health)
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	identityOrigin, err := origin("IDENTITY_URL", false)
	if err != nil {
		return err
	}
	publicOrigin, err := origin("PUBLIC_BASE_URL", true)
	if err != nil {
		return err
	}

	startup, cancel := context.WithTimeout(ctx, 10*time.Second)
	db, err := platform.OpenDatabase(startup, databaseURL)
	cancel()
	if err != nil {
		return err
	}
	defer db.Close()
	client := &http.Client{
		Timeout:       5 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
	}
	defer client.CloseIdleConnections()

	api := profileAPI{db: db, client: client, sessionURL: identityOrigin + "/api/v1/session", publicOrigin: publicOrigin}
	mux.HandleFunc("GET /api/v1/profile", api.serve)
	mux.HandleFunc("PUT /api/v1/profile", api.serve)
	mux.HandleFunc("GET /health/ready", func(w http.ResponseWriter, r *http.Request) {
		probe, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		var schemaReady bool
		if err := db.QueryRow(probe, migrations.SchemaReadyQuery).Scan(&schemaReady); err != nil {
			slog.Warn("profile readiness database query failed")
			http.Error(w, "profile database query failed", http.StatusServiceUnavailable)
			return
		}
		if !schemaReady {
			slog.Warn("profile readiness schema missing")
			http.Error(w, "profile schema missing", http.StatusServiceUnavailable)
			return
		}
		health(w, r)
	})

	server := &http.Server{
		Addr:              address,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	stopped := make(chan error, 1)
	go func() {
		slog.Info("HTTP server starting", "service", "profile-api", "address", address)
		stopped <- server.ListenAndServe()
	}()

	select {
	case err := <-stopped:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdown)
	}
}

func health(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func origin(key string, httpsOnly bool) (string, error) {
	raw := os.Getenv(key)
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && (httpsOnly || u.Scheme != "http")) ||
		u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.ForceQuery ||
		strings.Contains(raw, "#") || (u.Path != "" && u.Path != "/") {
		return "", errors.New(key + " must be a valid origin")
	}
	return strings.TrimRight(raw, "/"), nil
}
