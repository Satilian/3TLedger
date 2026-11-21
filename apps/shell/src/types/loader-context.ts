import { QueryClient } from '@tanstack/react-query';
import { BaseRequest } from './base-request';
import { LoaderCtx } from '@satilian/router';

export type AppLoaderCtx = LoaderCtx & {
  queryClient?: QueryClient;
  req?: BaseRequest;
};
