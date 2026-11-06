'use client';

import { useEffect } from 'react';

// Plays each [data-reveal] block's entrance once it scrolls in; blocks already on screen stay as rendered.
export function LandingReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = 'in';
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.2 },
    );
    for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
      const box = el.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) continue;
      el.dataset.reveal = 'armed';
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return null;
}
