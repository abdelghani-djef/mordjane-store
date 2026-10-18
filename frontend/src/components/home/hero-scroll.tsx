"use client";

import { useEffect, useRef } from "react";

/**
 * The hero's section element, exposing how far it has been scrolled away as `--hero-p`
 * (0 at the top, 1 once scrolled by its own height). The children style themselves from it
 * (see `.hero-*` in globals.css). Works in every browser; with reduced motion, or in an in-app
 * browser (see the root layout), it stays at 0 and nothing runs while scrolling.
 */
export function HeroScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    const still =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.hasAttribute("data-in-app");
    if (!el || still) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / (el.offsetHeight || 1)));
      el.style.setProperty("--hero-p", progress.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  );
}
