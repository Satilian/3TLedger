module github.com/satilian/3tledger/apps/analytics-api

go 1.23.0

require github.com/satilian/3tledger/packages/kafkatest v0.0.0

require (
	github.com/klauspost/compress v1.17.11 // indirect
	github.com/pierrec/lz4/v4 v4.1.22 // indirect
	github.com/twmb/franz-go v1.18.1 // indirect
	github.com/twmb/franz-go/pkg/kmsg v1.9.0 // indirect
	golang.org/x/crypto v0.32.0 // indirect
)

replace github.com/satilian/3tledger/packages/kafkatest => ../../packages/kafkatest
