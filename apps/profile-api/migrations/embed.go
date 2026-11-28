package migrations

import "embed"

const SchemaReadyQuery = "SELECT to_regclass('profiles') IS NOT NULL"

//go:embed *.sql
var Files embed.FS
