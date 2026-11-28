import { RoutesConfigObject } from '@satilian/router';
import Statistics from 'analytics/Statistics';
import BudgetPlanning from 'budgets/BudgetPlanning';
import Accounts from 'ledger/Accounts';
import Transactions from 'ledger/Transactions';
import Income from 'ledger/Income';
import Expenses from 'ledger/Expenses';
import Transfers from 'ledger/Transfers';
import Categories from 'ledger/Categories';
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
          id: 'accounts',
          path: 'accounts',
          element: <Accounts />,
        },
        {
          id: 'transactions',
          path: 'transactions',
          element: <Transactions />,
        },
        {
          id: 'income',
          path: 'income',
          element: <Income />,
        },
        {
          id: 'expenses',
          path: 'expenses',
          element: <Expenses />,
        },
        {
          id: 'transfers',
          path: 'transfers',
          element: <Transfers />,
        },
        {
          id: 'categories',
          path: 'categories',
          element: <Categories />,
        },
        {
          id: 'statistics',
          path: 'statistics',
          element: <Statistics />,
        },
        {
          id: 'budget-planning',
          path: 'budget-planning',
          element: <BudgetPlanning />,
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
