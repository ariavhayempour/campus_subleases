'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Latched: once the element nears the viewport it stays "in view", so nothing unmounts and re-bills.
export function useInView<T extends Element>(
  rootMargin = '200px',
): [ref: (node: T | null) => void, inView: boolean] {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node || inView) return;
      if (typeof IntersectionObserver === 'undefined') {
        setInView(true);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setInView(true);
            observer.disconnect();
          }
        },
        { rootMargin },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [inView, rootMargin],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, inView];
}
