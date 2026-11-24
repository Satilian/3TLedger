package identity

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"
)

const sessionCookie = "__Host-ledger-session"
const csrfCookie = "__Host-ledger-csrf"

func (s *Service) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/session", s.sessionHTTP)
	mux.HandleFunc("GET /api/v1/session/csrf", s.bootstrapHTTP)
	mux.HandleFunc("GET /api/v1/auth/start", s.startHTTP)
	mux.HandleFunc("GET /api/v1/auth/callback", s.callbackHTTP)
	mux.HandleFunc("POST /api/v1/session/logout", s.logoutHTTP)
}

func (s *Service) sessionHTTP(w http.ResponseWriter, r *http.Request) {
	session, err := s.Session(r.Context(), readCredentials(r))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	if session.User == nil {
		s.fail(w, r, ErrUnauthenticated)
		return
	}
	writeJSON(w, session)
}

func (s *Service) bootstrapHTTP(w http.ResponseWriter, r *http.Request) {
	session, credentials, err := s.Bootstrap(r.Context(), readCredentials(r))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	setCredentials(w, credentials, 12*60*60)
	writeJSON(w, struct {
		CSRFToken string `json:"csrfToken"`
	}{session.CSRFToken})
}

func (s *Service) startHTTP(w http.ResponseWriter, r *http.Request) {
	_, credentials, err := s.Bootstrap(r.Context(), readCredentials(r))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	location, err := s.Start(r.Context(), credentials)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	setCredentials(w, credentials, int(bootstrapTTL/time.Second))
	http.Redirect(w, r, location, http.StatusSeeOther)
}

func (s *Service) callbackHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("error") != "" {
		s.fail(w, r, ErrInvalidLogin)
		return
	}
	result, err := s.Callback(r.Context(), readCredentials(r), r.URL.Query().Get("state"), r.URL.Query().Get("code"))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	setCredentials(w, result, int(sessionTTL/time.Second))
	http.Redirect(w, r, s.config.PublicURL+"/", http.StatusSeeOther)
}

func (s *Service) logoutHTTP(w http.ResponseWriter, r *http.Request) {
	credentials := readCredentials(r)
	if _, err := s.Session(r.Context(), credentials); err != nil {
		s.fail(w, r, err)
		return
	}
	if r.Header.Get("Origin") != s.config.PublicURL || credentials.CSRF == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("X-CSRF-Token")), []byte(credentials.CSRF)) != 1 {
		writeError(w, http.StatusForbidden, "csrf_invalid", r.Header.Get("X-Request-ID"))
		return
	}
	if err := s.Logout(r.Context(), credentials); err != nil {
		s.fail(w, r, err)
		return
	}
	setCredentials(w, Credentials{}, -1)
	w.WriteHeader(http.StatusNoContent)
}

func readCredentials(r *http.Request) Credentials {
	var c Credentials
	if cookie, err := r.Cookie(sessionCookie); err == nil {
		c.Token = cookie.Value
	}
	if cookie, err := r.Cookie(csrfCookie); err == nil {
		c.CSRF = cookie.Value
	}
	if len(c.Token) > 256 || len(c.CSRF) > 256 {
		return Credentials{}
	}
	return c
}

func setCredentials(w http.ResponseWriter, c Credentials, maxAge int) {
	for _, cookie := range []http.Cookie{{Name: sessionCookie, Value: c.Token}, {Name: csrfCookie, Value: c.CSRF}} {
		cookie.Path = "/"
		cookie.Secure = true
		cookie.HttpOnly = true
		cookie.SameSite = http.SameSiteLaxMode
		cookie.MaxAge = maxAge
		http.SetCookie(w, &cookie)
	}
}

func (s *Service) fail(w http.ResponseWriter, r *http.Request, err error) {
	status, code := http.StatusServiceUnavailable, "service_unavailable"
	if errors.Is(err, ErrUnauthenticated) {
		status, code = http.StatusUnauthorized, "session_required"
	}
	if errors.Is(err, ErrInvalidLogin) {
		status, code = http.StatusBadRequest, "login_invalid"
	}
	if status == http.StatusServiceUnavailable {
		slog.Error("identity request failed", "requestId", r.Header.Get("X-Request-ID"))
	}
	writeError(w, status, code, r.Header.Get("X-Request-ID"))
}

func writeJSON(w http.ResponseWriter, value interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(value); err != nil {
		slog.Warn("response write failed")
	}
}

func writeError(w http.ResponseWriter, status int, code, requestID string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	writeJSON(w, struct {
		Code      string `json:"code"`
		Message   string `json:"message"`
		RequestID string `json:"requestId"`
	}{code, http.StatusText(status), requestID})
}

func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, err := randomToken()
		if err != nil {
			writeError(w, http.StatusServiceUnavailable, "service_unavailable", "")
			return
		}
		r.Header.Set("X-Request-ID", id)
		w.Header().Set("X-Request-ID", id)
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
