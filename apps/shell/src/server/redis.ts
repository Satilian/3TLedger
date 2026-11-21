import Redis from 'ioredis';

export const redis = new Redis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) });

export const cached = async <R, P = unknown>(
  key: string,
  expiration: number,
  fn: (...args: P[]) => Promise<R>,
  ...args: P[]
): Promise<R | null> => {
  try {
    const ttl = await redis.ttl(key);

    if (ttl > 0) {
      const cachedValue = await redis.get(key);
      if (cachedValue) {
        console.log(`🟨 Cache hit with TTL for key: ${key}, TTL: ${ttl} seconds`);
        return JSON.parse(cachedValue);
      }
    }
  } catch (error) {
    console.error(`❌ Error checking cache for key: ${key}`, error);
  }

  try {
    const result = await fn(...args);

    redis.set(key, JSON.stringify(result), 'EX', expiration).catch((error) => {
      console.error(`❌ Error caching key: ${key}`, error);
    });

    console.log(`🟩 Cached key: ${key} with expiration: ${expiration} seconds`);

    return result;
  } catch (error) {
    console.error(`❌ Error executing function for key: ${key}`, error);
  }

  return null;
};

const revalidateCache = async (cacheKey: string, metaKey: string, promise: Promise<string>) => {
  const result = await promise;

  if (!result) throw new Error(`noResult`);

  await redis.set(cacheKey, result);
  await redis.set(metaKey, Math.floor(Date.now() / 1000));
};

export const staleWhileRevalidate = async (
  fn: (options?: { writeToResponse?: boolean }) => Promise<string>,
  { url, min, max }: { url: string; min: number; max: number },
): Promise<string> => {
  const cacheKey = `ssr:${url}`;
  const metaKey = `ssr-meta:${url}`;

  const { cached, cachedAt } = await Promise.all([redis.get(cacheKey), redis.get(metaKey)])
    .then(([cached, cachedMeta]) => ({ cached, cachedAt: Number(cachedMeta) || 0 }))
    .catch((error) => {
      console.error(`❌ [${error.message}] Error checking cache for url: ${url}`);
      return { cached: null, cachedAt: 0 };
    });

  const age = Math.floor(Date.now() / 1000) - cachedAt;
  const isFresh = age < min;
  const isStale = age >= min && age < max;

  if (isStale)
    setImmediate(() => {
      revalidateCache(cacheKey, metaKey, fn())
        .then(() => console.log(`🔃 Cache revalidated for url: ${url}`))
        .catch((error) => console.error(`❌ [Revalidating cache] url: ${url} \n\r ${error}`));
    });

  if (cached && (isFresh || isStale)) {
    console.log(`➡️ Cache returned for url: ${url}`);
    return cached;
  }

  await revalidateCache(cacheKey, metaKey, fn({ writeToResponse: true }))
    .then(() => console.log(`💾 Cache generated for url: ${url}`))
    .catch((error) => console.error(`❌ [Generating cache] url: ${url} \n\r ${error}`));

  return '';
};
