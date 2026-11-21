import { useEffect, useRef } from 'react';

type ScrollLockState = {
  locks: Set<symbol>;
  bodyOriginalOverflow?: string;
  bodyOriginalPaddingRight?: string;
};

const state: ScrollLockState = { locks: new Set<symbol>() };

export const useLockBodyScroll = (lock?: boolean) => {
  const lockIdRef = useRef<symbol>(Symbol('body-scroll-lock'));

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    if (!lock) return;

    const body = document.body;
    const lockId = lockIdRef.current;

    if (state.locks.size === 0) {
      state.bodyOriginalOverflow = body.style.overflow;
      state.bodyOriginalPaddingRight = body.style.paddingRight;

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
      }
    }

    state.locks.add(lockId);

    return () => {
      state.locks.delete(lockId);

      if (state.locks.size === 0) {
        body.style.overflow = state.bodyOriginalOverflow ?? '';
        body.style.paddingRight = state.bodyOriginalPaddingRight ?? '';
        state.bodyOriginalOverflow = undefined;
        state.bodyOriginalPaddingRight = undefined;
      }
    };
  }, [lock]);
};
