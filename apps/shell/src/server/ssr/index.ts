import express from 'express';
import { clientWidthMiddleware, routeMatchesMiddleware } from 'src/server/middleware';
import { dynamicHandler } from './dynamic-handler';

const router = express.Router();
router.use(routeMatchesMiddleware, clientWidthMiddleware);
router.get('/{*splat}', dynamicHandler);

export default router;
