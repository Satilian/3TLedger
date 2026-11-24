import { RouterProvider, RouterProviderProps } from '@satilian/router';
import { HydrationBoundary, QueryClient, QueryClientProvider, type DehydratedState } from '@tanstack/react-query';
import { getQueryClient } from 'src/utils';
import LandingPage from './landing';
import { routesConfig } from './routes';

declare global {
  interface Window {
    __authenticated?: boolean;
    __initialState?: RouterProviderProps['initialState'];
    __dehydratedClient?: DehydratedState;
  }
}

type Props = Omit<RouterProviderProps, 'config'> & {
  authenticated?: boolean;
  queryClient?: QueryClient;
};

export default function App({
  authenticated = typeof window !== 'undefined' && window.__authenticated === true,
  queryClient = getQueryClient(),
  pathname,
  matches,
  query,
  ...props
}: Props) {
  if (!authenticated) return <LandingPage />;

  const initialState = typeof window !== 'undefined' ? window.__initialState : props.initialState;
  const dehydrated = typeof window !== 'undefined' ? window.__dehydratedClient : undefined;

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
