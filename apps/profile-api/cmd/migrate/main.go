package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/pressly/goose/v3"
	"github.com/satilian/3tledger/apps/profile-api/migrations"
)

func main() {
	envFile := flag.String("env", "", "optional environment file")
	flag.Parse()
	if *envFile != "" && godotenv.Load(*envFile) != nil {
		fail("cannot load environment file")
	}
	connectionString := os.Getenv("DATABASE_URL")
	if connectionString == "" {
		fail("DATABASE_URL is required")
	}
	db, err := sql.Open("pgx", connectionString)
	if err != nil {
		fail("cannot configure database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	goose.SetBaseFS(migrations.Files)
	if err := goose.SetDialect("postgres"); err != nil {
		fail("cannot configure migrations")
	}
	if err := goose.UpContext(ctx, db, "."); err != nil {
		fail("migration failed; inspect database permissions and schema (details suppressed)")
	}
	var schemaReady bool
	schemaErr := db.QueryRowContext(ctx, migrations.SchemaReadyQuery).Scan(&schemaReady)
	closeErr := db.Close()
	if schemaErr != nil {
		fail("cannot verify profile schema after migration")
	}
	if !schemaReady {
		fail("profiles table is missing after migration; check DATABASE_URL, search_path and migration history")
	}
	if closeErr != nil {
		fail("database close failed")
	}
	fmt.Println("Migrations applied")
}

func fail(message string) { fmt.Fprintln(os.Stderr, message); os.Exit(1) }
