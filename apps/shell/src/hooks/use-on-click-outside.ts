import { useEffect, useRef, useId } from 'react';

// Shared registry for all hook instances: Map<ComponentInstanceId, handler>
const handlersRegistry = new Map<string, (event: PointerEvent) => void>();

let isListening = false;

const onPointerDown = (event: PointerEvent) => {
  handlersRegistry.forEach((handler) => handler(event));
};

const addGlobalListener = () => {
  if (isListening) return;

  document.addEventListener('pointerdown', onPointerDown);
  isListening = true;
};

const removeGlobalListener = () => {
  if (!isListening || handlersRegistry.size > 0) return;

  document.removeEventListener('pointerdown', onPointerDown);
  isListening = false;
};

export const useOnClickOutside = (
  refs: React.RefObject<HTMLElement | null> | React.RefObject<HTMLElement | null>[],
  handler: (event: PointerEvent) => void,
) => {
  const id = useId();
  const refsRef = useRef(refs);
  const handlerRef = useRef(handler);

  // Keep refs and handler current
  useEffect(() => {
    refsRef.current = refs;
  }, [refs]);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Register/unregister this component instance
  useEffect(() => {
    const listener = (event: PointerEvent) => {
      // Normalize refs to array
      const refArray = Array.isArray(refsRef.current) ? refsRef.current : [refsRef.current];

      // Check if click is inside any of the refs
      const isClickInside = refArray.some((ref) => {
        return ref.current && ref.current.contains(event.target as Node);
      });

      // Do nothing if clicking inside any ref's element or descendants
      if (!isClickInside) handlerRef.current(event);
    };

    handlersRegistry.set(id, listener);
    addGlobalListener();

    return () => {
      handlersRegistry.delete(id);
      removeGlobalListener();
    };
  }, [id]);
};
