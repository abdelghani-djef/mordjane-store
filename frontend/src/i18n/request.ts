import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

type Messages = { [key: string]: string | Messages };

/** Fill keys missing from `messages` with `fallback` (Arabic falls back to French). */
function withFallback(messages: Messages, fallback: Messages): Messages {
  const merged: Messages = { ...fallback };
  for (const [key, value] of Object.entries(messages)) {
    const base = fallback[key];
    merged[key] =
      typeof value === "object" && typeof base === "object" ? withFallback(value, base) : value;
  }
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages: Messages = (await import(`../../messages/${locale}.json`)).default;
  return {
    locale,
    messages:
      locale === "ar"
        ? withFallback(messages, (await import("../../messages/fr.json")).default)
        : messages,
    timeZone: "Africa/Tunis",
  };
});
