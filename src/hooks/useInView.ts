"use client";

import { useEffect, useRef, useState } from 'react';

interface Options {
  rootMargin?: string;
  threshold?: number;
  once?: boolean;
}

export function useInView<T extends Element = HTMLDivElement>(
  options: Options = {},
): { ref: React.RefObject<T | null>; inView: boolean } {
  const { rootMargin = '200px', threshold = 0, once = true } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return { ref, inView };
}
