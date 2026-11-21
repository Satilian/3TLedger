import Redis from 'ioredis';
import type { SsrCachePolicy } from './ssr/cache-policy';

let redis: Redis | undefined;
const pending = new Map<string, Promise<string>>();

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT || 6379),
      enableOfflineQueue: false,
      commandTimeout: 500,
      maxRetriesPerRequest: 0,
    });
    redis.on('error', (error) => console.error('SSR Redis connection error:', error.message));
  }
  return redis;
}

async function readCache(key: string): Promise<{ html: string; createdAt: number } | undefined> {
  try {
    const value = await getRedis().get(key);
    if (!value) return;
    const entry: unknown = JSON.parse(value);
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'html' in entry &&
      typeof entry.html === 'string' &&
      'createdAt' in entry &&
      typeof entry.createdAt === 'number' &&
      Number.isFinite(entry.createdAt)
    ) {
      return { html: entry.html, createdAt: entry.createdAt };
    }
  } catch (error) {
    console.error('SSR cache read failed:', error);
  }
}

function refresh(render: () => Promise<string>, { key, max }: SsrCachePolicy): Promise<string> {
  const existing = pending.get(key);
  if (existing) return existing;

  const result = render()
    .then(async (html) => {
      try {
        await getRedis().set(key, JSON.stringify({ html, createdAt: Date.now() }), 'EX', max);
      } catch (error) {
        console.error('SSR cache write failed:', error);
      }
      return html;
    })
    .finally(() => pending.delete(key));

  pending.set(key, result);
  return result;
}

export async function staleWhileRevalidate(render: () => Promise<string>, policy: SsrCachePolicy): Promise<string> {
  const entry = await readCache(policy.key);
  const age = entry ? (Date.now() - entry.createdAt) / 1000 : Infinity;
  if (entry && age >= 0 && age < policy.max) {
    if (age >= policy.min) {
      void refresh(render, policy).catch((error) => console.error('SSR revalidation failed:', error));
    }
    return entry.html;
  }
  return refresh(render, policy);
}
