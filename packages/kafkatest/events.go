package kafkatest

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/twmb/franz-go/pkg/kgo"
)

const testHeader = "3tledger-smoke"
const receiptTTL = 5 * time.Minute

type Publisher struct {
	Path      string
	TopicEnv  string
	EventType string
}

type Subscription struct {
	Path      string
	TopicEnvs []string
}

type receipt struct {
	EventID   string `json:"eventId"`
	Topic     string `json:"topic"`
	Partition int32  `json:"partition"`
	Offset    int64  `json:"offset"`
	expiresAt time.Time
}

func Register(ctx context.Context, mux *http.ServeMux, address string, publisher Publisher, subscription Subscription) (func(), error) {
	if os.Getenv("KAFKA_TEST_EVENTS_ENABLED") != "true" {
		return func() {}, nil
	}
	host, _, err := net.SplitHostPort(address)
	if err != nil || !net.ParseIP(host).IsLoopback() {
		return nil, errors.New("test Kafka events require HTTP_ADDR bound to a loopback IP")
	}
	options, err := clientOptions()
	if err != nil {
		return nil, err
	}
	var publishTopic string
	if publisher.Path != "" {
		publishTopic, err = requiredTopic(publisher.TopicEnv)
		if err != nil {
			return nil, err
		}
	}
	if subscription.Path != "" {
		group := strings.TrimSpace(os.Getenv("KAFKA_CONSUMER_GROUP_ID"))
		if group == "" {
			return nil, errors.New("KAFKA_CONSUMER_GROUP_ID is required")
		}
		topics := make([]string, 0, len(subscription.TopicEnvs))
		for _, name := range subscription.TopicEnvs {
			topic, err := requiredTopic(name)
			if err != nil {
				return nil, err
			}
			topics = append(topics, topic)
		}
		options = append(options, kgo.ConsumerGroup(group), kgo.ConsumeTopics(topics...),
			kgo.ConsumeResetOffset(kgo.NewOffset().AtStart()), kgo.DisableAutoCommit(), kgo.BlockRebalanceOnPoll())
	}
	client, err := kgo.NewClient(options...)
	if err != nil {
		return nil, err
	}
	if publisher.Path != "" {
		mux.HandleFunc("POST "+publisher.Path, publishHandler(client, publishTopic, publisher.EventType))
	}
	if subscription.Path == "" {
		return client.Close, nil
	}
	store := &receiptStore{byID: make(map[string]receipt)}
	mux.HandleFunc("GET "+subscription.Path+"/{eventId}", store.serveHTTP)
	consumerCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		consume(consumerCtx, client, store)
	}()
	return func() {
		cancel()
		<-done
		client.CloseAllowingRebalance()
	}, nil
}

func requiredTopic(name string) (string, error) {
	topic := strings.TrimSpace(os.Getenv(name))
	if topic == "" {
		return "", fmt.Errorf("%s is required", name)
	}
	return topic, nil
}

func publishHandler(client *kgo.Client, topic, eventType string) http.HandlerFunc {
	return func(w http.ResponseWriter, request *http.Request) {
		contentType, _, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
		if err != nil || contentType != "application/json" {
			http.Error(w, "expected application/json", http.StatusUnsupportedMediaType)
			return
		}
		var randomID [16]byte
		if _, err := rand.Read(randomID[:]); err != nil {
			slog.Error("could not generate test event ID", "error", err)
			http.Error(w, "could not create test event", http.StatusInternalServerError)
			return
		}
		id := hex.EncodeToString(randomID[:])
		value, err := json.Marshal(struct {
			ID   string `json:"id"`
			Type string `json:"type"`
		}{ID: id, Type: eventType})
		if err != nil {
			slog.Error("could not encode test event", "error", err)
			http.Error(w, "could not create test event", http.StatusInternalServerError)
			return
		}
		ctx, cancel := context.WithTimeout(request.Context(), 10*time.Second)
		defer cancel()
		record := &kgo.Record{Topic: topic, Key: []byte(id), Value: value,
			Headers: []kgo.RecordHeader{{Key: testHeader, Value: []byte("1")}}}
		if err := client.ProduceSync(ctx, record).FirstErr(); err != nil {
			slog.Warn("could not publish test event", "topic", topic, "error", err)
			http.Error(w, "could not publish test event", http.StatusServiceUnavailable)
			return
		}
		writeJSON(w, http.StatusCreated, struct {
			EventID string `json:"eventId"`
		}{EventID: id})
	}
}

func consume(ctx context.Context, client *kgo.Client, store *receiptStore) {
	for ctx.Err() == nil {
		fetches := client.PollRecords(ctx, 1)
		for _, failure := range fetches.Errors() {
			if ctx.Err() == nil {
				slog.Warn("test consumer fetch failed", "topic", failure.Topic, "error", failure.Err)
			}
		}
		records := fetches.Records()
		if len(records) == 0 {
			client.AllowRebalance()
			continue
		}
		record := records[0]
		commit, cancel := context.WithTimeout(ctx, 5*time.Second)
		err := client.CommitRecords(commit, record)
		cancel()
		client.AllowRebalance()
		if err != nil {
			if ctx.Err() == nil {
				slog.Error("test consumer stopped after failed offset commit", "topic", record.Topic, "error", err)
			}
			return
		}
		for _, header := range record.Headers {
			if header.Key == testHeader && string(header.Value) == "1" && validID(string(record.Key)) {
				store.save(record)
				break
			}
		}
	}
}

type receiptStore struct {
	mu   sync.Mutex
	byID map[string]receipt
}

func (store *receiptStore) save(record *kgo.Record) {
	store.mu.Lock()
	defer store.mu.Unlock()
	now := time.Now()
	for id, item := range store.byID {
		if !item.expiresAt.After(now) {
			delete(store.byID, id)
		}
	}
	id := string(record.Key)
	store.byID[id] = receipt{EventID: id, Topic: record.Topic, Partition: record.Partition,
		Offset: record.Offset, expiresAt: now.Add(receiptTTL)}
}

func (store *receiptStore) serveHTTP(w http.ResponseWriter, request *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	id := request.PathValue("eventId")
	if !validID(id) {
		http.Error(w, "invalid event ID", http.StatusBadRequest)
		return
	}
	store.mu.Lock()
	item, found := store.byID[id]
	if found && !item.expiresAt.After(time.Now()) {
		delete(store.byID, id)
		found = false
	}
	store.mu.Unlock()
	if !found {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func validID(id string) bool {
	if len(id) != 32 {
		return false
	}
	var decoded [16]byte
	_, err := hex.Decode(decoded[:], []byte(id))
	return err == nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		slog.Warn("could not write test event response", "error", err)
	}
}
