import { LoaderCtx } from 'src/types';

export function HomePage() {
  return <div>Home Page Content</div>;
}

export default HomePage;

export const homePageLoader = async ({ queryClient }: LoaderCtx) => {
  if (!queryClient) return null;

  return {
    counter: { count: 0 },
  };
};
