import type { NextFunction, Response } from 'express';
import { matchRoutes } from '@satilian/router';
import { routesConfig } from 'src/pages/routes';
import type { BaseRequest } from 'src/types';

export const routeMatchesMiddleware = (req: BaseRequest, _: Response, next: NextFunction) => {
  req.matches = matchRoutes(routesConfig.routes, req.path);
  next();
};
