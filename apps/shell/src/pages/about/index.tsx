import { LoaderCtx } from 'src/types';

export function AboutPage() {
  return <div>About Page Content</div>;
}

export default AboutPage;

export const aboutPageLoader = async ({ queryClient }: LoaderCtx) => {
  if (!queryClient) return;
};
