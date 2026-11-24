import type { NextFunction, Response } from 'express';
import { staleWhileRevalidate } from 'src/server/redis';
import { hasAuthenticatedSession } from 'src/server/session';
import type { BaseRequest } from 'src/types';
import { resolveSsrCachePolicy } from './cache-policy';
import { renderStream } from './render-stream';

export const dynamicHandler = async (req: BaseRequest, res: Response, next: NextFunction) => {
  const status = !req.matches?.length || req.matches.some(({ route }) => route.id === 'not-found') ? 404 : 200;
  res.set('Accept-CH', 'Sec-CH-Viewport-Width, Viewport-Width');
  res.set('Cache-Control', 'no-store');

  try {
    const authenticated = await hasAuthenticatedSession(req);
    if (!authenticated && req.path !== '/' && status === 200) {
      res.redirect(302, '/');
      return;
    }
    const policy = status === 200 ? resolveSsrCachePolicy(req) : undefined;
    const render = () => renderStream(req, authenticated);
    const html = policy ? await staleWhileRevalidate(render, policy) : await render();
    res.status(status).type('html').send(html);
  } catch (error) {
    next(error);
  }
};
