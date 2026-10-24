"use client";

import { createContext, useContext } from "react";

import { cn } from "@/lib/utils";

type LogoSettings = { light: string | null; dark: string | null; height: number };

export const DEFAULT_LOGO_HEIGHT = 40;

const LogoContext = createContext<LogoSettings>({
  light: null,
  dark: null,
  height: DEFAULT_LOGO_HEIGHT,
});

/**
 * The logo set under Appearance: an uploaded image (with its own dark-theme version, or the same
 * one) at the chosen height; without one, the hazelnut mark and name.
 */
export function LogoProvider({
  value,
  children,
}: {
  value: LogoSettings;
  children: React.ReactNode;
}) {
  return <LogoContext value={value}>{children}</LogoContext>;
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
  return <LogoView {...useContext(LogoContext)} className={className} />;
}

/**
 * A logo from explicit settings (the admin previews unsaved ones). `theme` pins one version;
 * otherwise both render and the page's theme shows one. Sizes are in rem so the desktop zoom in
 * globals.css scales them with the rest of the site; phones cap the height at 3rem to leave
 * room for the menu and cart.
 */
export function LogoView({
  light,
  dark,
  height,
  theme,
  className,
}: LogoSettings & { theme?: "light" | "dark"; className?: string }) {
  const size = { "--logo-h": `${height / 16}rem` } as React.CSSProperties;
  if (light) {
    const img = (src: string, extra?: string) => (
      // eslint-disable-next-line @next/next/no-img-element -- any size or shape the admin uploads
      <img
        src={src}
        alt="Mordjane"
        style={size}
        className={cn(
          "h-[min(var(--logo-h),3rem)] w-auto max-w-[min(calc(var(--logo-h)*5),55vw)] shrink-0 object-contain sm:h-(--logo-h)",
          extra,
          className,
        )}
      />
    );
    if (!dark || theme === "light") return img(light);
    if (theme === "dark") return img(dark);
    return (
      <>
        {img(light, "dark:hidden")}
        {img(dark, "hidden dark:block")}
      </>
    );
  }
  return (
    <span
      style={size}
      className={cn(
        "inline-flex items-center gap-2 [--h:min(var(--logo-h),3rem)] sm:[--h:var(--logo-h)]",
        className,
      )}
    >
      <LogoMark className="size-(--h)" />
      <span className="font-heading text-[calc(var(--h)*0.72)] leading-none font-semibold tracking-[-0.01em]">
        Mordjane
      </span>
    </span>
  );
}
