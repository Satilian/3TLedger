import { type Match, type SsrCacheOption } from '@satilian/router';
import type { BaseRequest } from 'src/types';

export type ResolvedSsrCachePolicy = {
  enabled: boolean;
  min: number;
  max: number;
  cacheKey: string;
};

type GlobalSsrCachePolicy = {
  enabled: boolean;
  min: number;
  max: number;
  bypassPrefixes: string[];
  bypassAuthenticated: boolean;
};

const DEFAULT_GLOBAL_POLICY: GlobalSsrCachePolicy = {
  enabled: process.env.SSR_CACHE_ENABLED !== 'false',
  min: Number(process.env.SSR_CACHE_MIN ?? 3),
  max: Number(process.env.SSR_CACHE_MAX ?? 6),
  bypassPrefixes: (process.env.SSR_CACHE_BYPASS_PREFIXES ?? '/admin')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  bypassAuthenticated: process.env.SSR_CACHE_BYPASS_AUTHENTICATED !== 'false',
};

const toValidNumber = (value: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  if (value < 0) return fallback;
  return value;
};

const normalizePathname = (pathname: string) => pathname || '/';

const normalizeCacheKey = (url: string) => {
  const path = url.split('?')[0];
  return path || '/';
};

const normalizeMinMax = (min: number, max: number) => {
  const safeMin = toValidNumber(min, DEFAULT_GLOBAL_POLICY.min);
  const safeMax = toValidNumber(max, DEFAULT_GLOBAL_POLICY.max);

  if (safeMax < safeMin) {
    return { min: safeMin, max: safeMin };
  }

  return { min: safeMin, max: safeMax };
};

const resolveRouteCacheOption = (matches: Match[] | null): SsrCacheOption | undefined => {
  if (!matches?.length) return undefined;

  for (let i = matches.length - 1; i >= 0; i--) {
    const routeOption = matches[i]?.route?.ssrCache;
    if (routeOption !== undefined) {
      return routeOption;
    }
  }

  return undefined;
};

export const resolveSsrCachePolicy = (req: BaseRequest): ResolvedSsrCachePolicy => {
  const pathname = normalizePathname(req.path);
  const originalUrl = req.originalUrl || pathname;
  const routeOption = resolveRouteCacheOption(req.matches ?? null);

  let enabled = DEFAULT_GLOBAL_POLICY.enabled;
  let min = DEFAULT_GLOBAL_POLICY.min;
  let max = DEFAULT_GLOBAL_POLICY.max;
  let cacheKey = normalizeCacheKey(originalUrl);

  if (typeof routeOption === 'boolean') {
    enabled = routeOption;
  } else if (routeOption) {
    if (routeOption.enabled !== undefined) enabled = routeOption.enabled;
    if (routeOption.min !== undefined) min = routeOption.min;
    if (routeOption.max !== undefined) max = routeOption.max;
    if (routeOption.key) {
      const key = routeOption.key({ pathname, originalUrl });
      cacheKey = normalizeCacheKey(key);
    }
  }

  const hasAuthCookie = Boolean(req.cookies?.authToken);
  const isAuthenticated = hasAuthCookie;
  const isBypassedPrefix = DEFAULT_GLOBAL_POLICY.bypassPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isBypassedPrefix) {
    enabled = false;
  }

  if (DEFAULT_GLOBAL_POLICY.bypassAuthenticated && isAuthenticated) {
    enabled = false;
  }

  const normalized = normalizeMinMax(min, max);

  return {
    enabled,
    min: normalized.min,
    max: normalized.max,
    cacheKey,
  };
};
