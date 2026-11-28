package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"
	_ "time/tzdata"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/text/language"
)

type profile struct {
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
	Locale      string `json:"locale"`
	TimeZone    string `json:"timeZone"`
}

type session struct {
	User struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"user"`
	CSRFToken string `json:"csrfToken"`
}

type profileAPI struct {
	db           *pgxpool.Pool
	client       *http.Client
	sessionURL   string
	publicOrigin string
}

func (a profileAPI) serve(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	r = r.WithContext(ctx)

	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	s, status := a.authenticate(r)
	if status != http.StatusOK {
		http.Error(w, http.StatusText(status), status)
		return
	}

	var p profile
	var err error
	if r.Method == http.MethodPut {
		if r.Header.Get("Origin") != a.publicOrigin || subtle.ConstantTimeCompare([]byte(r.Header.Get("X-CSRF-Token")), []byte(s.CSRFToken)) != 1 {
			http.Error(w, "invalid CSRF token or origin", http.StatusForbidden)
			return
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&p) != nil || decoder.Decode(new(json.RawMessage)) != io.EOF || !p.validate() {
			http.Error(w, "invalid profile", http.StatusBadRequest)
			return
		}
		_, err = a.db.Exec(r.Context(), `INSERT INTO profiles (user_id, display_name, avatar_url, locale, time_zone)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (user_id) DO UPDATE SET display_name=EXCLUDED.display_name,
			avatar_url=EXCLUDED.avatar_url, locale=EXCLUDED.locale, time_zone=EXCLUDED.time_zone`,
			s.User.ID, p.DisplayName, p.AvatarURL, p.Locale, p.TimeZone)
	} else {
		err = a.db.QueryRow(r.Context(), `SELECT display_name, avatar_url, locale, time_zone FROM profiles WHERE user_id=$1`, s.User.ID).
			Scan(&p.DisplayName, &p.AvatarURL, &p.Locale, &p.TimeZone)
		if errors.Is(err, pgx.ErrNoRows) {
			p.DisplayName = s.User.Name
			err = nil
		}
	}

	if err != nil {
		slog.Error("profile database request failed", "method", r.Method)
		http.Error(w, "profile unavailable", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(p); err != nil {
		slog.Warn("profile response write failed")
	}
}

func (a profileAPI) authenticate(r *http.Request) (session, int) {
	var s session
	request, err := http.NewRequestWithContext(r.Context(), http.MethodGet, a.sessionURL, nil)
	if err != nil {
		slog.Error("cannot create session request")
		return s, http.StatusServiceUnavailable
	}
	for _, name := range []string{"__Host-ledger-session", "__Host-ledger-csrf"} {
		cookie, err := r.Cookie(name)
		if err != nil || cookie.Value == "" {
			return s, http.StatusUnauthorized
		}
		request.AddCookie(cookie)
	}
	response, err := a.client.Do(request)
	if err != nil {
		slog.Warn("identity session request failed")
		return s, http.StatusServiceUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized {
		return s, http.StatusUnauthorized
	}
	if response.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(response.Body, 8192)).Decode(&s) != nil || s.User.ID == "" || s.CSRFToken == "" {
		slog.Warn("identity session response invalid", "status", response.StatusCode)
		return s, http.StatusServiceUnavailable
	}
	return s, http.StatusOK
}

func (p *profile) validate() bool {
	p.DisplayName = strings.TrimSpace(p.DisplayName)
	if p.DisplayName == "" || utf8.RuneCountInString(p.DisplayName) > 120 || strings.ContainsRune(p.DisplayName, 0) || len(p.AvatarURL) > 2048 || len(p.Locale) > 35 || len(p.TimeZone) > 100 {
		return false
	}
	if p.AvatarURL != "" {
		u, err := url.Parse(p.AvatarURL)
		if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil {
			return false
		}
	}
	if p.Locale != "" {
		if _, err := language.Parse(p.Locale); err != nil {
			return false
		}
	}
	if p.TimeZone != "" {
		if p.TimeZone == "Local" {
			return false
		}
		if _, err := time.LoadLocation(p.TimeZone); err != nil {
			return false
		}
	}
	return true
}
