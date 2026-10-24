"use client";

import { createContext, useContext } from "react";

import { cn } from "@/lib/utils";

const LogoUrl = createContext<string | null>(null);

/** The logo an admin uploaded under Appearance; without one, the hazelnut mark and name show. */
export function LogoProvider({ url, children }: { url: string | null; children: React.ReactNode }) {
  return <LogoUrl value={url}>{children}</LogoUrl>;
}

/** Hazelnut on a red disc: the core ingredient of the range, in the brand red. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <circle cx="16" cy="16" r="15.5" fill="#C8202B" />
      {/* hazelnut: brown body, pale base, small tip */}
      <path d="M16 6.4c7.3.4 8.4 9.3 7 13.3H9c-1.4-4 -.3-12.9 7-13.3Z" fill="#C0803F" />
      <path d="M9 19.3c.8 4.4 13.2 4.4 14 0-3.6 1.5-10.4 1.5-14 0Z" fill="#F4DDB2" />
      <path d="M16 6.4l1.5-2.4-2.8.2Z" fill="#F4DDB2" />
      <ellipse cx="12.6" cy="11.8" rx="1.8" ry="3.2" fill="white" opacity=".35" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  const url = useContext(LogoUrl);
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- any size or shape the admin uploads
      <img
        src={url}
        alt="Mordjane"
        className={cn("h-10 w-auto max-w-40 object-contain", className)}
      />
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-heading text-[1.45rem] leading-none font-semibold tracking-[-0.01em]">
        Mordjane
      </span>
    </span>
  );
}
