import { useRootStore } from '@/shared';
import { RootState } from 'modules/root';
import { BREAKPOINTS } from 'src/constants';

export const useDeviceType = () => {
  const { clientWidth } = useRootStore<RootState>();

  return {
    isMobile: clientWidth < BREAKPOINTS.mobile,
    isTablet: clientWidth >= BREAKPOINTS.mobile && clientWidth < BREAKPOINTS.tablet,
    isLaptop: clientWidth >= BREAKPOINTS.tablet && clientWidth < BREAKPOINTS.laptop,
    isDesktop: clientWidth >= BREAKPOINTS.laptop && clientWidth < BREAKPOINTS.desktop,
    isLarge: clientWidth >= BREAKPOINTS.desktop,
  };
};
