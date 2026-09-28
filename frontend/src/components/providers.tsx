"use client";

import { useLocale } from "next-intl";
import { ThemeProvider } from "next-themes";
import { Direction } from "radix-ui";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isRtl } from "@/i18n/routing";

export function Providers({ children }: { children: React.ReactNode }) {
  // Radix primitives (scroll areas, menus, selects…) read direction from context, not from
  // <html dir>, and default to left-to-right.
  const dir = isRtl(useLocale()) ? "rtl" : "ltr";
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      // The inline theme script only has to run from the server HTML, before first paint.
      // Switching language re-renders this layout in the browser, where React won't run
      // scripts and warns about them: there, mark it as inert data instead (next-themes
      // already suppresses the hydration diff on this tag).
      scriptProps={{ type: typeof window === "undefined" ? undefined : "application/json" }}
    >
      <Direction.Provider dir={dir}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position="top-center" closeButton dir={dir} />
        </TooltipProvider>
      </Direction.Provider>
    </ThemeProvider>
  );
}
