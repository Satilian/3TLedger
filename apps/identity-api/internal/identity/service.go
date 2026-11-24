package identity

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/satilian/3tledger/apps/identity-api/internal/platform"
	"golang.org/x/oauth2"
)

const (
	bootstrapTTL = 10 * time.Minute
	loginTTL     = 5 * time.Minute
	sessionTTL   = 12 * time.Hour
)

var ErrUnauthenticated = errors.New("session required")
var ErrInvalidLogin = errors.New("login expired or invalid")

type User struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type Session struct {
	User      *User  `json:"user,omitempty"`
	CSRFToken string `json:"csrfToken"`
}
type Credentials struct{ Token, CSRF string }

type Service struct {
	db       *pgxpool.Pool
	config   platform.Config
	client   *http.Client
	verifier *oidc.IDTokenVerifier
	oauth    oauth2.Config
}

func New(ctx context.Context, db *pgxpool.Pool, config platform.Config, client *http.Client) (*Service, error) {
	provider, err := oidc.NewProvider(oidc.ClientContext(ctx, client), config.Issuer)
	if err != nil {
		return nil, errors.New("OIDC discovery failed; check issuer connectivity and OIDC_CA_FILE")
	}
	return &Service{db: db, config: config, client: client, verifier: provider.Verifier(&oidc.Config{ClientID: config.ClientID}), oauth: oauth2.Config{ClientID: config.ClientID, ClientSecret: config.ClientSecret, Endpoint: provider.Endpoint(), RedirectURL: config.RedirectURL, Scopes: []string{oidc.ScopeOpenID, "profile"}}}, nil
}

func (s *Service) Session(ctx context.Context, credentials Credentials) (Session, error) {
	if credentials.Token == "" || credentials.CSRF == "" {
		return Session{}, ErrUnauthenticated
	}
	var id, name *string
	var csrfHash []byte
	err := s.db.QueryRow(ctx, `SELECT u.id::text, u.name, s.csrf_hash FROM sessions s
        LEFT JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, hash(credentials.Token)).Scan(&id, &name, &csrfHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return Session{}, ErrUnauthenticated
	}
	if err != nil {
		return Session{}, fmt.Errorf("read session: %w", err)
	}
	if subtle.ConstantTimeCompare(csrfHash, hash(credentials.CSRF)) != 1 {
		return Session{}, ErrUnauthenticated
	}
	session := Session{CSRFToken: credentials.CSRF}
	if id != nil && name != nil {
		session.User = &User{ID: *id, Name: *name}
	}
	return session, nil
}

func (s *Service) Bootstrap(ctx context.Context, credentials Credentials) (Session, Credentials, error) {
	session, err := s.Session(ctx, credentials)
	if err == nil {
		return session, credentials, nil
	}
	if !errors.Is(err, ErrUnauthenticated) {
		return Session{}, Credentials{}, err
	}
	credentials, err = newCredentials()
	if err != nil {
		return Session{}, Credentials{}, err
	}
	_, err = s.db.Exec(ctx, `INSERT INTO sessions(token_hash,csrf_hash,expires_at) VALUES($1,$2,$3)`, hash(credentials.Token), hash(credentials.CSRF), time.Now().Add(bootstrapTTL))
	if err != nil {
		return Session{}, Credentials{}, fmt.Errorf("create bootstrap session: %w", err)
	}
	return Session{CSRFToken: credentials.CSRF}, credentials, nil
}

func (s *Service) Start(ctx context.Context, credentials Credentials) (string, error) {
	state, err := randomToken()
	if err != nil {
		return "", err
	}
	nonce, err := randomToken()
	if err != nil {
		return "", err
	}
	id, err := randomUUID()
	if err != nil {
		return "", err
	}
	verifier := oauth2.GenerateVerifier()
	_, err = s.db.Exec(ctx, `INSERT INTO login_transactions(id,session_hash,state_hash,nonce_hash,pkce_verifier,expires_at)
        VALUES($1,$2,$3,$4,$5,$6)`, id, hash(credentials.Token), hash(state), hash(nonce), verifier, time.Now().Add(loginTTL))
	if err != nil {
		return "", fmt.Errorf("create login transaction: %w", err)
	}
	return s.oauth.AuthCodeURL(state, oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier)), nil
}

func (s *Service) Callback(ctx context.Context, credentials Credentials, state, code string) (Credentials, error) {
	if credentials.Token == "" || state == "" || code == "" || len(state) > 256 || len(code) > 4096 {
		return Credentials{}, ErrInvalidLogin
	}
	if _, err := s.Session(ctx, credentials); err != nil {
		return Credentials{}, err
	}
	var nonceHash []byte
	var verifier string
	err := s.db.QueryRow(ctx, `DELETE FROM login_transactions WHERE state_hash=$1 AND session_hash=$2 AND expires_at>now() RETURNING nonce_hash,pkce_verifier`, hash(state), hash(credentials.Token)).Scan(&nonceHash, &verifier)
	if errors.Is(err, pgx.ErrNoRows) {
		return Credentials{}, ErrInvalidLogin
	}
	if err != nil {
		return Credentials{}, fmt.Errorf("consume login transaction: %w", err)
	}
	providerCtx := oidc.ClientContext(ctx, s.client)
	tokens, err := s.oauth.Exchange(providerCtx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return Credentials{}, ErrInvalidLogin
	}
	raw, ok := tokens.Extra("id_token").(string)
	if !ok {
		return Credentials{}, ErrInvalidLogin
	}
	idToken, err := s.verifier.Verify(providerCtx, raw)
	if err != nil || idToken.Subject == "" {
		return Credentials{}, ErrInvalidLogin
	}
	if subtle.ConstantTimeCompare(nonceHash, hash(idToken.Nonce)) != 1 {
		return Credentials{}, ErrInvalidLogin
	}
	var claims struct {
		Name     string `json:"name"`
		Username string `json:"preferred_username"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return Credentials{}, ErrInvalidLogin
	}
	name := claims.Name
	if name == "" {
		name = claims.Username
	}
	if name == "" {
		name = "User"
	}
	userID, err := randomUUID()
	if err != nil {
		return Credentials{}, err
	}
	rotated, err := newCredentials()
	if err != nil {
		return Credentials{}, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Credentials{}, fmt.Errorf("begin session rotation: %w", err)
	}
	defer rollback(tx)
	// The old session must still exist: a concurrent logout/callback wins atomically.
	result, err := tx.Exec(ctx, `DELETE FROM sessions WHERE token_hash=$1 AND expires_at>now()`, hash(credentials.Token))
	if err != nil {
		return Credentials{}, fmt.Errorf("rotate session: %w", err)
	}
	if result.RowsAffected() != 1 {
		return Credentials{}, ErrInvalidLogin
	}
	err = tx.QueryRow(ctx, `INSERT INTO users(id,issuer,subject,name) VALUES($1,$2,$3,$4)
        ON CONFLICT(issuer,subject) DO UPDATE SET name=excluded.name RETURNING id::text`, userID, s.config.Issuer, idToken.Subject, name).Scan(&userID)
	if err != nil {
		return Credentials{}, fmt.Errorf("save user: %w", err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO sessions(token_hash,user_id,csrf_hash,expires_at) VALUES($1,$2,$3,$4)`, hash(rotated.Token), userID, hash(rotated.CSRF), time.Now().Add(sessionTTL))
	if err != nil {
		return Credentials{}, fmt.Errorf("save authenticated session: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return Credentials{}, fmt.Errorf("commit session: %w", err)
	}
	return rotated, nil
}

func (s *Service) Logout(ctx context.Context, credentials Credentials) error {
	_, err := s.db.Exec(ctx, `DELETE FROM sessions WHERE token_hash=$1`, hash(credentials.Token))
	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func hash(value string) []byte { h := sha256.Sum256([]byte(value)); return h[:] }
func newCredentials() (Credentials, error) {
	token, err := randomToken()
	if err != nil {
		return Credentials{}, err
	}
	csrf, err := randomToken()
	if err != nil {
		return Credentials{}, err
	}
	return Credentials{Token: token, CSRF: csrf}, nil
}
func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func randomUUID() (string, error) {
	return platform.NewID()
}

func rollback(tx pgx.Tx) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := tx.Rollback(ctx); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
		slog.Error("session transaction rollback failed")
	}
}
