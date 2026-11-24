import { useEffect, useState } from 'react';
import { useIsClient } from 'src/hooks/use-is-client';
import styles from './kafka-test-actions.module.css';

type Status = { state: 'idle' | 'pending' | 'error' } | { state: 'success'; eventId: string };

const receiptRoutes = {
  'analytics-api': '/api/v1/insights/test-events',
  'budgets-api': '/api/v1/budgets/test-events',
  'notifications-api': '/api/v1/notifications/test-events',
};

type Subscriber = keyof typeof receiptRoutes;
type Receipt = { topic: string; partition: number; offset: number };

const transactionSubscribers: Subscriber[] = ['analytics-api', 'budgets-api', 'notifications-api'];
const thresholdSubscribers: Subscriber[] = ['notifications-api'];

async function readReceipt(subscriber: Subscriber, eventId: string, signal: AbortSignal): Promise<Receipt | undefined> {
  const response = await fetch(receiptRoutes[subscriber] + '/' + encodeURIComponent(eventId), {
    cache: 'no-store',
    signal,
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error('Could not read consumer receipt');
  const receipt: unknown = await response.json();
  if (
    typeof receipt !== 'object' ||
    receipt === null ||
    !('eventId' in receipt) ||
    receipt.eventId !== eventId ||
    !('topic' in receipt) ||
    typeof receipt.topic !== 'string' ||
    !('partition' in receipt) ||
    typeof receipt.partition !== 'number' ||
    !('offset' in receipt) ||
    typeof receipt.offset !== 'number'
  ) {
    throw new Error('Invalid consumer receipt');
  }
  return { topic: receipt.topic, partition: receipt.partition, offset: receipt.offset };
}

function PublishButton({
  label,
  endpoint,
  subscribers,
}: {
  label: string;
  endpoint: string;
  subscribers: Subscriber[];
}) {
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [receipts, setReceipts] = useState<Partial<Record<Subscriber, Receipt>>>({});
  const [timedOut, setTimedOut] = useState(false);
  const eventId = status.state === 'success' ? status.eventId : undefined;

  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();
    const pending = new Set(subscribers);
    let nextPoll: number | undefined;
    const timeout = window.setTimeout(() => {
      controller.abort();
      window.clearTimeout(nextPoll);
      setTimedOut(true);
    }, 10_000);

    async function poll(id: string) {
      const results = await Promise.allSettled(
        [...pending].map(async (subscriber) => ({
          subscriber,
          receipt: await readReceipt(subscriber, id, controller.signal),
        })),
      );
      if (controller.signal.aborted) return;

      const received: Partial<Record<Subscriber, Receipt>> = {};
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.receipt) {
          const { subscriber, receipt } = result.value;
          pending.delete(subscriber);
          received[subscriber] = receipt;
        }
      }
      if (Object.keys(received).length > 0) {
        setReceipts((previous) => ({ ...previous, ...received }));
      }
      if (pending.size) {
        nextPoll = window.setTimeout(() => void poll(id), 1_000);
      } else {
        window.clearTimeout(timeout);
      }
    }

    void poll(eventId);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
      window.clearTimeout(nextPoll);
    };
  }, [eventId, subscribers]);

  async function publish() {
    setReceipts({});
    setTimedOut(false);
    setStatus({ state: 'pending' });
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) {
        throw new Error('Test event publication failed');
      }
      const result: unknown = await response.json();
      if (
        typeof result !== 'object' ||
        result === null ||
        !('eventId' in result) ||
        typeof result.eventId !== 'string'
      ) {
        throw new Error('Missing test event ID');
      }
      setStatus({ state: 'success', eventId: result.eventId });
    } catch {
      setStatus({ state: 'error' });
    }
  }

  return (
    <div>
      <button type="button" className={styles.button} disabled={status.state === 'pending'} onClick={publish}>
        {label}
      </button>
      <div className={styles.status} role="status">
        {status.state === 'pending' && 'Publishing…'}
        {status.state === 'success' && (
          <>
            Published. Event ID <code>{status.eventId}</code>
            <ul className={styles.receipts}>
              {subscribers.map((subscriber) => {
                const receipt = receipts[subscriber];
                return (
                  <li key={subscriber}>
                    <strong>{subscriber}</strong>{' '}
                    {receipt
                      ? `Received · ${receipt.topic} · partition ${receipt.partition} · offset ${receipt.offset}`
                      : timedOut
                        ? 'No confirmation after 10 seconds'
                        : 'Awaiting confirmation…'}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {status.state === 'error' && 'Could not publish the test event. Check the local Kafka API.'}
      </div>
    </div>
  );
}

export function KafkaTestActions() {
  const isClient = useIsClient();
  if (!isClient || !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return null;

  return (
    <section className={styles.actions} aria-label="Kafka test events">
      <PublishButton
        label="Publish test transaction"
        endpoint="/api/v1/operations/test-events"
        subscribers={transactionSubscribers}
      />
      <PublishButton
        label="Publish test spending threshold"
        endpoint="/api/v1/budgets/test-events"
        subscribers={thresholdSubscribers}
      />
    </section>
  );
}
