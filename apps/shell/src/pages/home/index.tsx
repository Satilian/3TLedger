import Dashboard from 'analytics/Dashboard';
import { LoaderCtx } from 'src/types';
import { KafkaTestActions } from './kafka-test-actions';

export function HomePage() {
  return (
    <>
      <Dashboard />
      <KafkaTestActions />
    </>
  );
}

export default HomePage;

export const homePageLoader = async ({ queryClient }: LoaderCtx) => {
  if (!queryClient) return null;

  return {
    counter: { count: 0 },
  };
};
