-- +goose Up
CREATE TABLE profiles (
    user_id uuid PRIMARY KEY,
    display_name varchar(120) NOT NULL CHECK (display_name <> ''),
    avatar_url varchar(2048) NOT NULL DEFAULT '',
    locale varchar(35) NOT NULL DEFAULT '',
    time_zone varchar(100) NOT NULL DEFAULT ''
);

-- +goose Down
DROP TABLE profiles;
