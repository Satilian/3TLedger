package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"
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
	mux.HandleFunc("GET /health/ready", health)
	if err := registerRoutes(mux); err != nil {
		return err
	}

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
		slog.Info("HTTP server starting", "service", "api-gateway", "address", address)
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

func registerRoutes(mux *http.ServeMux) error {
	routes := []struct {
		env   string
		paths []string
	}{
		{"IDENTITY_URL", []string{"/auth", "/session"}},
		{"LEDGER_URL", []string{"/accounts", "/categories", "/operations", "/operation-requests"}},
		{"BUDGETS_URL", []string{"/budgets"}},
		{"ANALYTICS_URL", []string{"/insights", "/reports"}},
		{"NOTIFICATIONS_URL", []string{"/notifications"}},
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.ResponseHeaderTimeout = 20 * time.Second

	for _, route := range routes {
		raw := os.Getenv(route.env)
		if raw == "" {
			continue
		}
		target, err := url.Parse(raw)
		if err != nil || (target.Scheme != "http" && target.Scheme != "https") || target.Hostname() == "" ||
			target.User != nil || target.RawQuery != "" || target.ForceQuery || target.Fragment != "" || (target.Path != "" && target.Path != "/") {
			return fmt.Errorf("%s must be an HTTP(S) origin", route.env)
		}
		proxy := &httputil.ReverseProxy{
			Transport: transport,
			Rewrite: func(req *httputil.ProxyRequest) {
				req.SetURL(target)
				req.SetXForwarded()
			},
			ErrorHandler: func(w http.ResponseWriter, _ *http.Request, _ error) {
				slog.Warn("upstream request failed", "upstream", route.env)
				http.Error(w, "upstream unavailable", http.StatusBadGateway)
			},
		}

		for _, path := range route.paths {
			prefix := "/api/v1" + path
			mux.Handle(prefix, proxy)
			mux.Handle(prefix+"/", proxy)
		}
	}
	return nil
}
