import type { Request } from 'express';

const sessionCookie = '__Host-ledger-session';
const csrfCookie = '__Host-ledger-csrf';

const isSessionToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

export async function hasAuthenticatedSession(req: Request): Promise<boolean> {
  const session: unknown = req.cookies?.[sessionCookie];
  const csrf: unknown = req.cookies?.[csrfCookie];
  if (!isSessionToken(session) || !isSessionToken(csrf)) return false;

  try {
    const url = new URL('/api/v1/session', process.env.AUTH_GATEWAY_URL ?? 'http://127.0.0.1:8080');
    const response = await fetch(url, {
      headers: { Cookie: `${sessionCookie}=${session}; ${csrfCookie}=${csrf}` },
      redirect: 'error',
      signal: AbortSignal.timeout(2000),
    });
    await response.body?.cancel();
    if (response.status !== 200 && response.status !== 401) {
      console.warn('Identity session check returned status', response.status);
    }
    return response.status === 200;
  } catch {
    console.warn('Identity session check failed');
    return false;
  }
}
