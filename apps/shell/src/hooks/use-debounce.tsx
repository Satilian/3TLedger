import { useCallback, useRef } from 'react';

export const useDebounce = (callback: () => void, delay: number = 300) => {
  const callbackRef = useRef(callback);
  const handlerRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(() => {
    if (handlerRef.current) clearTimeout(handlerRef.current);
    handlerRef.current = setTimeout(() => callbackRef.current(), delay);
  }, [delay]);
};
