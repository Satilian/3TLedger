package platform

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL, Issuer, ClientID, ClientSecret, RedirectURL, PublicURL, CAFile string
}

func OIDCConfigured() bool {
	for _, key := range []string{"OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URL", "PUBLIC_BASE_URL", "OIDC_CA_FILE"} {
		if os.Getenv(key) != "" {
			return true
		}
	}
	return false
}

func LoadEnv(path string) error {
	if path == "" {
		return nil
	}
	if err := godotenv.Load(path); err != nil {
		return errors.New("cannot load environment file")
	}
	return nil
}

func LoadConfig() (Config, error) {
	c := Config{DatabaseURL: os.Getenv("DATABASE_URL"), Issuer: os.Getenv("OIDC_ISSUER_URL"), ClientID: os.Getenv("OIDC_CLIENT_ID"), ClientSecret: os.Getenv("OIDC_CLIENT_SECRET"), RedirectURL: os.Getenv("OIDC_REDIRECT_URL"), PublicURL: os.Getenv("PUBLIC_BASE_URL"), CAFile: os.Getenv("OIDC_CA_FILE")}
	for _, entry := range []struct{ key, value string }{{"DATABASE_URL", c.DatabaseURL}, {"OIDC_CLIENT_ID", c.ClientID}, {"OIDC_CLIENT_SECRET", c.ClientSecret}} {
		if strings.TrimSpace(entry.value) == "" || strings.Contains(entry.value, "CHANGE_ME") {
			return c, fmt.Errorf("%s is required", entry.key)
		}
	}
	for _, entry := range []struct{ key, value string }{{"PUBLIC_BASE_URL", c.PublicURL}, {"OIDC_ISSUER_URL", c.Issuer}, {"OIDC_REDIRECT_URL", c.RedirectURL}} {
		u, err := url.Parse(entry.value)
		if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" {
			return c, fmt.Errorf("%s must be an HTTPS URL", entry.key)
		}
	}
	public, _ := url.Parse(c.PublicURL)
	redirect, _ := url.Parse(c.RedirectURL)
	if public.Path != "" && public.Path != "/" {
		return c, errors.New("PUBLIC_BASE_URL must contain only an origin")
	}
	c.PublicURL = strings.TrimRight(c.PublicURL, "/")
	if redirect.Host != public.Host || redirect.Path != "/api/v1/auth/callback" {
		return c, errors.New("OIDC_REDIRECT_URL must be the public /api/v1/auth/callback")
	}
	return c, nil
}

func HTTPClient(caFile string) (*http.Client, error) {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	if caFile != "" {
		pem, err := os.ReadFile(caFile)
		if err != nil {
			return nil, errors.New("cannot read OIDC_CA_FILE")
		}
		pool, err := x509.SystemCertPool()
		if err != nil {
			pool = x509.NewCertPool()
		}
		if !pool.AppendCertsFromPEM(pem) {
			return nil, errors.New("OIDC_CA_FILE contains no PEM certificates")
		}
		transport.TLSClientConfig.RootCAs = pool
	}
	return &http.Client{Transport: transport, Timeout: 10 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }}, nil
}
