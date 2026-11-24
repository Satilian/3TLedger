package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"math/big"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

func main() {
	if err := run(); err != nil {
		slog.Error("development proxy stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cert := flag.String("cert", ".local/localhost.crt", "local TLS certificate")
	key := flag.String("key", ".local/localhost.key", "local TLS private key")
	gateway := flag.String("gateway", "http://127.0.0.1:8080", "local Gateway origin")
	frontend := flag.String("frontend", "http://127.0.0.1:3000", "local Shell origin")
	flag.Parse()
	if err := ensureCertificate(*cert, *key); err != nil {
		return err
	}
	gatewayProxy, err := localProxy("gateway", *gateway)
	if err != nil {
		return err
	}
	frontendProxy, err := localProxy("shell", *frontend)
	if err != nil {
		return err
	}
	mux := http.NewServeMux()
	mux.Handle("/api/", gatewayProxy)
	mux.Handle("/health/", gatewayProxy)
	mux.Handle("/", frontendProxy)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	server := &http.Server{Addr: "127.0.0.1:3443", Handler: mux, ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	failed := make(chan error, 1)
	go func() { failed <- server.ListenAndServeTLS(*cert, *key) }()
	slog.Info("local HTTPS proxy starting", "origin", "https://localhost:3443")
	select {
	case err := <-failed:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return server.Shutdown(shutdown)
	}
}

func localProxy(name, origin string) (*httputil.ReverseProxy, error) {
	target, err := url.Parse(origin)
	if err != nil || target.Scheme != "http" || target.Hostname() != "127.0.0.1" || target.Port() == "" || target.Path != "" || target.User != nil || target.RawQuery != "" || target.Fragment != "" || target.ForceQuery {
		return nil, fmt.Errorf("%s must be an HTTP origin on 127.0.0.1", name)
	}
	return &httputil.ReverseProxy{
		Rewrite: func(req *httputil.ProxyRequest) {
			req.SetURL(target)
			req.SetXForwarded()
		},
		ErrorHandler: func(w http.ResponseWriter, _ *http.Request, err error) {
			slog.Warn("local upstream request failed", "upstream", name, "error", err)
			http.Error(w, "local upstream unavailable", http.StatusBadGateway)
		},
	}, nil
}

func ensureCertificate(certPath, keyPath string) error {
	_, certErr := os.Stat(certPath)
	_, keyErr := os.Stat(keyPath)
	if certErr == nil && keyErr == nil {
		return nil
	}
	if !errors.Is(certErr, os.ErrNotExist) || !errors.Is(keyErr, os.ErrNotExist) {
		return errors.New("local TLS certificate and key must both exist or both be absent")
	}
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return err
	}
	template := &x509.Certificate{SerialNumber: serial, Subject: pkix.Name{CommonName: "3TLedger localhost development"}, DNSNames: []string{"localhost"}, IPAddresses: []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")}, NotBefore: time.Now().Add(-5 * time.Minute), NotAfter: time.Now().Add(365 * 24 * time.Hour), KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}, BasicConstraintsValid: true}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		return err
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return err
	}
	for _, path := range []string{certPath, keyPath} {
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			return err
		}
	}
	if err := writeExclusive(keyPath, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})); err != nil {
		return err
	}
	if err := writeExclusive(certPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})); err != nil {
		return errors.Join(err, os.Remove(keyPath))
	}
	fmt.Printf("Local TLS certificate created: %s\n", certPath)
	return nil
}

func writeExclusive(path string, data []byte) error {
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	_, writeErr := file.Write(data)
	closeErr := file.Close()
	if err := errors.Join(writeErr, closeErr); err != nil {
		return errors.Join(err, os.Remove(path))
	}
	return nil
}
