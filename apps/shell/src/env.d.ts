/// <reference types="@rsbuild/core/types" />

declare module 'analytics/Dashboard' {
  const Dashboard: import('react').ComponentType;
  export default Dashboard;
}

declare module 'analytics/Statistics' {
  const Statistics: import('react').ComponentType;
  export default Statistics;
}

declare module 'ledger/Accounts' {
  const Accounts: import('react').ComponentType;
  export default Accounts;
}

declare module 'ledger/Transactions' {
  const Transactions: import('react').ComponentType;
  export default Transactions;
}

declare module 'ledger/Income' {
  const Income: import('react').ComponentType;
  export default Income;
}

declare module 'ledger/Expenses' {
  const Expenses: import('react').ComponentType;
  export default Expenses;
}

declare module 'ledger/Transfers' {
  const Transfers: import('react').ComponentType;
  export default Transfers;
}

declare module 'ledger/Categories' {
  const Categories: import('react').ComponentType;
  export default Categories;
}

declare module 'budgets/BudgetPlanning' {
  const BudgetPlanning: import('react').ComponentType;
  export default BudgetPlanning;
}

declare module 'profile/Profile' {
  type Section = 'profile' | 'settings' | 'notifications' | 'billing' | 'privacy' | 'help-support';
  const Profile: import('react').ComponentType<{ section?: Section }>;
  export default Profile;
}
