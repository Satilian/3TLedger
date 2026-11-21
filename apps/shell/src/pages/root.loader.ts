import { LoaderCtx } from 'src/types';

export const rootLoader = async ({ queryClient, req }: LoaderCtx) => {
  if (!queryClient) return;

  return {
    clientWidth: req?.clientWidth || null,
  };
};
