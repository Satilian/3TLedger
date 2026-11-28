import Dashboard from 'analytics/Dashboard';
import { LoaderCtx } from 'src/types';

export function HomePage() {
  return <Dashboard />;
}

export default HomePage;

export const homePageLoader = async ({ queryClient }: LoaderCtx) => {
  if (!queryClient) return null;

  return {
    counter: { count: 0 },
  };
};
