import { Outlet, RouterSuspense } from '@satilian/router';
import { memo } from 'react';

export default memo(function MainLayout() {
  return (
    <RouterSuspense fallback={<div>Loading...</div>}>
      <Outlet />
    </RouterSuspense>
  );
});
