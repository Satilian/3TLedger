-- +goose Up
CREATE TABLE users (
    id uuid PRIMARY KEY,
    issuer text NOT NULL,
    subject text NOT NULL,
    name text NOT NULL,
    timezone text NOT NULL DEFAULT 'UTC',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (issuer, subject)
);

CREATE TABLE sessions (
    token_hash bytea PRIMARY KEY,
    user_id uuid REFERENCES users(id),
    csrf_hash bytea NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry ON sessions(expires_at);

CREATE TABLE login_transactions (
    id uuid PRIMARY KEY,
    session_hash bytea NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
    state_hash bytea NOT NULL UNIQUE,
    nonce_hash bytea NOT NULL,
    pkce_verifier text NOT NULL,
    expires_at timestamptz NOT NULL
);

-- +goose Down
DROP TABLE login_transactions;
DROP TABLE sessions;
DROP TABLE users;
