import { RoutesConfigObject } from '@satilian/router';
import Statistics from 'analytics/Statistics';
import { getQueryClient } from 'src/utils';
import AboutPage from './about';
import HomePage from './home';
import Layout from './layout';
import { NotFound } from './not-found';
import { rootLoader } from './root.loader';

export const routesConfig: RoutesConfigObject = {
  loader: rootLoader,
  loaderContext: { queryClient: getQueryClient() },
  routes: [
    {
      id: 'root',
      path: '/',
      layout: <Layout />,
      children: [
        {
          id: 'home',
          index: true,
          element: <HomePage />,
        },
        {
          id: 'statistics',
          path: 'statistics',
          element: <Statistics />,
        },
        {
          id: 'about',
          path: 'about',
          element: <AboutPage />,
        },
      ],
    },
    {
      id: 'not-found',
      path: '*',
      element: <NotFound />,
    },
  ],
};
