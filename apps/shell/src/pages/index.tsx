/* eslint-disable @typescript-eslint/no-explicit-any */
import { RouterProvider, RouterProviderProps } from '@satilian/router';
import { HydrationBoundary, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from 'src/utils';
import { routesConfig } from './routes';

type Props = Omit<RouterProviderProps, 'config'> & {
  queryClient?: QueryClient;
};

export default function App({ queryClient = getQueryClient(), pathname, matches, query, ...props }: Props) {
  const initialState = typeof window !== 'undefined' ? (window as any).__initialState : props.initialState;
  const dehydrated = typeof window !== 'undefined' ? (window as any).__dehydratedClient : undefined;

  return (
    <QueryClientProvider client={queryClient}>
      {pathname ? (
        // SSR
        <RouterProvider
          config={routesConfig}
          initialState={initialState}
          pathname={pathname}
          matches={matches}
          query={query}
        />
      ) : (
        // Client
        <HydrationBoundary state={dehydrated}>
          <RouterProvider config={routesConfig} initialState={initialState} />
        </HydrationBoundary>
      )}
    </QueryClientProvider>
  );
}
