import { useCallback, useRef } from 'react';

/**
 * Hook that throttles a callback to run at most once per specified interval
 * Useful for rate-limiting frequent updates like realtime data
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef<number>(0);
  const pendingArgs = useRef<Parameters<T> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const elapsed = now - lastCall.current;

      if (elapsed >= delay) {
        // Enough time has passed, execute immediately
        lastCall.current = now;
        callback(...args);
      } else {
        // Store args and schedule execution
        pendingArgs.current = args;
        
        if (!timeoutRef.current) {
          timeoutRef.current = setTimeout(() => {
            if (pendingArgs.current) {
              lastCall.current = Date.now();
              callback(...pendingArgs.current);
              pendingArgs.current = null;
            }
            timeoutRef.current = null;
          }, delay - elapsed);
        }
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * Hook that debounces a callback - only executes after delay with no calls
 * Useful for batching rapid updates
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
        timeoutRef.current = null;
      }, delay);
    }) as T,
    [callback, delay]
  );
}
