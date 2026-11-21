import type { BaseRequest } from 'src/types';

export type SsrCachePolicy = {
  key: string;
  min: number;
  max: number;
};

const bypassPrefixes = (process.env.SSR_CACHE_BYPASS_PREFIXES ?? '/admin')
  .split(',')
  .map((prefix) => prefix.trim())
  .filter(Boolean);

const validSeconds = (value: number, fallback: number) =>
  Number.isSafeInteger(value) && value >= 0 ? value : fallback;

export const resolveSsrCachePolicy = (req: BaseRequest): SsrCachePolicy | undefined => {
  if (process.env.SSR_CACHE_ENABLED === 'false' || req.get('Cookie') || req.get('Authorization')) return;
  if (bypassPrefixes.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) return;

  const option = req.matches?.at(-1)?.route.ssrCache;
  if (!option || (typeof option === 'object' && option.enabled === false)) return;

  const config = typeof option === 'object' ? option : undefined;
  const min = validSeconds(config?.min ?? Number(process.env.SSR_CACHE_MIN ?? 3), 3);
  const max = Math.max(min, validSeconds(config?.max ?? Number(process.env.SSR_CACHE_MAX ?? 6), 6));
  if (max === 0) return;

  const originalUrl = req.originalUrl || req.path;
  const routeKey = config?.key?.({ pathname: req.path, originalUrl }) ?? originalUrl;
  return {
    key: `shell:ssr:v2:${JSON.stringify([req.get('Host'), originalUrl, routeKey, req.clientWidth])}`,
    min,
    max,
  };
};
