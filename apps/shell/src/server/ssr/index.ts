import express from 'express';
import { clientWidthMiddleware, routeMatchesMiddleware } from 'src/server/middleware';
import { dynamicHandler } from './dynamic-hendler';
import { staticHandler } from './static-handler';

const router = express.Router();

router.use(routeMatchesMiddleware);
router.use(clientWidthMiddleware);

const staticRoutes = ['/', '/about', '/delivery', '/contacts', '/admin', '/catalog'];
const dynamicRoutes = ['/admin*splat', '/catalog*splat', '/product*splat', '/auth*splat'];

for (const path of [...staticRoutes, ...dynamicRoutes]) {
  router.get(path, dynamicHandler);
}

router.get(
  '*splat',
  (req, _, next) => {
    console.log('🟩 staticHandler', req.path);
    next();
  },
  staticHandler,
);

export default router;
