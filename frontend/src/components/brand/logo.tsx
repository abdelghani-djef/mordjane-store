import { cn } from "@/lib/utils";

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

export function Logo({ className, tagline }: { className?: string; tagline?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-[1.45rem] font-semibold tracking-[-0.01em]">
          Mordjane
        </span>
        {tagline && (
          <span className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{tagline}</span>
        )}
      </span>
    </span>
  );
}
