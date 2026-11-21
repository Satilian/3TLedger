import type { Response } from 'express';
import { staleWhileRevalidate } from 'src/server/redis';
import { BaseRequest } from 'src/types';
import { resolveSsrCachePolicy } from './cache-policy';
import { renderStream } from './render-stream';

// const isDev = process.env.NODE_ENV === 'development';

export const dynamicHandler = async (req: BaseRequest, res: Response) => {
  res.statusCode = 200;
  res.setHeader('Content-type', 'text/html');
  res.set('Accept-CH', 'Sec-CH-Viewport-Width, Viewport-Width');
  res.set('Vary', 'Sec-CH-Viewport-Width, User-Agent'); // важно для кэширования

  try {
    const cachePolicy = resolveSsrCachePolicy(req);
    const render = renderStream.bind(null, req, res);

    if (!cachePolicy.enabled) {
      res.write(await render());
      res.end();
      return;
    }

    res.write(
      await staleWhileRevalidate(render, {
        url: cachePolicy.cacheKey,
        min: cachePolicy.min,
        max: cachePolicy.max,
      }),
    );
    res.end();
  } catch (error) {
    console.error(`❌ [dynamicHandler] \r\n${error}`);
    res.status(500).send('<h1>An error occurred while rendering the page</h1>');
  }
};
