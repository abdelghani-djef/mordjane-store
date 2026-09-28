import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr", "ar"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/** The admin panel is staff-only and stays in English or French; Arabic is for the shop. */
export const ADMIN_LOCALES = ["en", "fr"] as const satisfies readonly Locale[];
export const ADMIN_FALLBACK_LOCALE = "fr";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export function isRtl(locale: string): boolean {
  return locale === "ar";
}
