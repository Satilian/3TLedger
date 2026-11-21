import { useLayoutEffect, useRef, useId } from 'react';

type Key =
  | 'Escape'
  | 'Enter'
  | 'Tab'
  | 'Backspace'
  | 'Delete'
  | 'Shift'
  | 'Control'
  | 'Alt'
  | 'Meta'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Space'
  | 'CapsLock'
  | 'NumLock'
  | 'ScrollLock'
  | 'Pause'
  | 'Insert'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown'
  | ' ';

// Shared registry: Map<Key, Map<ComponentInstanceId, ActionRef>>
// Allows multiple components to listen to same key without conflicts
const handlersByKey = new Map<Key, Map<string, React.RefObject<() => void>>>();

let isListening = false;

const onKeyDown = (event: KeyboardEvent) => {
  const keyHandlers = handlersByKey.get(event.key as Key);

  if (!keyHandlers) return;

  keyHandlers.forEach((actionRef) => actionRef.current());
};

const addGlobalListener = () => {
  if (isListening) return;

  window.addEventListener('keydown', onKeyDown);
  isListening = true;
};

const removeGlobalListener = () => {
  if (!isListening || handlersByKey.size > 0) return;

  window.removeEventListener('keydown', onKeyDown);
  isListening = false;
};

export const useOnKeyPress = (keys: Key | Key[], action: () => void) => {
  const id = useId();
  const actionRef = useRef(action);

  // Keep actionRef current with latest action
  useLayoutEffect(() => {
    actionRef.current = action;
  }, [action]);

  // Register/unregister this component instance for keypress events
  useLayoutEffect(() => {
    // Normalize keys to array
    const keyArray = Array.isArray(keys) ? keys : [keys];

    // Register for all keys
    keyArray.forEach((key) => {
      let keyHandlers = handlersByKey.get(key);

      if (!keyHandlers) {
        keyHandlers = new Map();
        handlersByKey.set(key, keyHandlers);
      }

      keyHandlers.set(id, actionRef);
    });

    addGlobalListener();

    return () => {
      // Unregister from all keys
      keyArray.forEach((key) => {
        const keyHandlers = handlersByKey.get(key);

        if (!keyHandlers) return;

        keyHandlers.delete(id);

        if (keyHandlers.size === 0) handlersByKey.delete(key);
      });

      removeGlobalListener();
    };
  }, [keys, id]);
};
