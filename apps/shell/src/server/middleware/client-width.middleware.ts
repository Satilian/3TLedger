import type { NextFunction, Response } from 'express';
import type { BaseRequest } from 'src/types';

const MIN_WIDTH = 320;
const MAX_WIDTH = 1920;
const DEFAULT_MOBILE_WIDTH = 390;
const DEFAULT_DESKTOP_WIDTH = 1440;

export const clientWidthMiddleware = (req: BaseRequest, _: Response, next: NextFunction) => {
  // 1. Client Hint (самое точное, когда приходит)
  let widthStr = req.get('Sec-CH-Viewport-Width') || req.get('Viewport-Width');

  // 2. Cookie (может быть устаревшим, но лучше, чем ничего)
  if (!widthStr) {
    const cookie: unknown = req.cookies?.clientWidth;
    if (typeof cookie === 'string') widthStr = cookie;
  }

  // 3. Fallback через User-Agent
  if (!widthStr) {
    const ua = req.get('User-Agent') || '';
    const isMobile = /mobile|android|iphone|ipad|ipod|blackberry/i.test(ua.toLowerCase());
    widthStr = (isMobile ? DEFAULT_MOBILE_WIDTH : DEFAULT_DESKTOP_WIDTH).toString();
  }

  // 3. Валидация и парсинг
  const parsed = parseInt(widthStr.trim(), 10);
  req.clientWidth = !Number.isNaN(parsed) ? Math.max(MIN_WIDTH, Math.min(parsed, MAX_WIDTH)) : DEFAULT_DESKTOP_WIDTH;

  next();
};
