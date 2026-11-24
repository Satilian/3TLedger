package kafkatest

import (
	"crypto/tls"
	"errors"
	"os"
	"strconv"
	"strings"

	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl"
	"github.com/twmb/franz-go/pkg/sasl/plain"
	"github.com/twmb/franz-go/pkg/sasl/scram"
)

const (
	Transactions = "KAFKA_TOPIC_LEDGER_TRANSACTIONS"
	Thresholds   = "KAFKA_TOPIC_BUDGET_THRESHOLDS"
)

func clientOptions() ([]kgo.Opt, error) {
	brokers := strings.Split(os.Getenv("KAFKA_BROKER_HOSTS"), ",")
	for i, broker := range brokers {
		brokers[i] = strings.TrimSpace(broker)
		if brokers[i] == "" {
			return nil, errors.New("KAFKA_BROKER_HOSTS must contain comma-separated broker addresses")
		}
	}
	options := []kgo.Opt{kgo.SeedBrokers(brokers...)}
	if id := os.Getenv("KAFKA_CLIENT_ID"); id != "" {
		options = append(options, kgo.ClientID(id))
	}
	if setting := os.Getenv("KAFKA_SSL"); setting != "" {
		enabled, err := strconv.ParseBool(setting)
		if err != nil {
			return nil, errors.New("KAFKA_SSL must be a boolean")
		}
		if enabled {
			options = append(options, kgo.DialTLSConfig(&tls.Config{MinVersion: tls.VersionTLS12}))
		}
	}
	mechanism := strings.ToLower(os.Getenv("KAFKA_SASL_MECHANISM"))
	user, password := os.Getenv("KAFKA_SASL_USERNAME"), os.Getenv("KAFKA_SASL_PASSWORD")
	if mechanism == "" && user == "" && password == "" {
		return options, nil
	}
	if user == "" || password == "" {
		return nil, errors.New("both Kafka SASL credentials are required")
	}
	var auth sasl.Mechanism
	switch mechanism {
	case "plain":
		auth = plain.Auth{User: user, Pass: password}.AsMechanism()
	case "scram-sha-256":
		auth = scram.Auth{User: user, Pass: password}.AsSha256Mechanism()
	case "scram-sha-512":
		auth = scram.Auth{User: user, Pass: password}.AsSha512Mechanism()
	default:
		return nil, errors.New("KAFKA_SASL_MECHANISM must be plain, scram-sha-256, or scram-sha-512")
	}
	return append(options, kgo.SASL(auth)), nil
}
