// Tunisian dinar: 1 DT = 1000 millimes, conventionally written with 3 decimals ("12,500 DT").
export const CURRENCY_LABEL = process.env.NEXT_PUBLIC_CURRENCY_LABEL ?? "DT";
export const TIME_ZONE = "Africa/Tunis";

type Named = { name_en: string; name_fr: string; name_ar?: string | null };
type Described = { description_en: string; description_fr: string; description_ar?: string | null };

/**
 * Pick the text for the active locale. Arabic falls back to French (the language most of the
 * catalogue is written in), French and English fall back to English.
 */
export function localizedText(
  locale: string,
  text: { en: string; fr?: string | null; ar?: string | null },
): string {
  if (locale === "ar") return text.ar || text.fr || text.en;
  if (locale === "fr") return text.fr || text.en;
  return text.en;
}

export function localizedName(item: Named, locale: string): string {
  return localizedText(locale, { en: item.name_en, fr: item.name_fr, ar: item.name_ar });
}

/**
 * Where an order goes, "Delegation, Governorate". Orders placed before delegations existed only
 * have the governorate.
 */
export function deliveryArea(
  place: { delegation?: string | null; city: string },
  locale = "fr",
): string {
  return [place.delegation, place.city].filter(Boolean).join(locale === "ar" ? "، " : ", ");
}

export function localizedDescription(item: Described, locale: string): string {
  return localizedText(locale, {
    en: item.description_en,
    fr: item.description_fr,
    ar: item.description_ar,
  });
}

// Tunisia writes Arabic with Western digits and French-style separators: "12,500 د.ت".
const NUMBER_LOCALE: Record<string, string> = { en: "en-US", fr: "fr-TN", ar: "ar-TN" };
const DATE_LOCALE: Record<string, string> = { en: "en-GB", fr: "fr-FR", ar: "ar-TN" };

function numberLocale(locale: string) {
  return NUMBER_LOCALE[locale] ?? "en-US";
}

export function currencyLabel(locale: string): string {
  return locale === "ar" ? "د.ت" : CURRENCY_LABEL;
}

export function formatPrice(value: string | number, locale: string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  const formatted = new Intl.NumberFormat(numberLocale(locale), {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    numberingSystem: "latn",
  }).format(amount);
  return `${formatted} ${currencyLabel(locale)}`;
}

export function formatWeight(grams: number | null | undefined, locale: string): string | null {
  if (!grams) return null;
  const [g, kg] = locale === "ar" ? ["غ", "كغ"] : ["g", "kg"];
  if (grams >= 1000) {
    const value = new Intl.NumberFormat(numberLocale(locale), {
      maximumFractionDigits: 2,
      numberingSystem: "latn",
    }).format(grams / 1000);
    return `${value} ${kg}`;
  }
  return `${grams} ${g}`;
}

export function pricePerKg(price: string | number, grams: number | null | undefined) {
  if (!grams) return null;
  return (Number(price) * 1000) / grams;
}

// Arabic spells the month out ("28 سبتمبر 2026"): the numeric medium style reads poorly in RTL.
const DATE_OPTIONS: Record<string, Intl.DateTimeFormatOptions> = {
  ar: { day: "numeric", month: "long", year: "numeric" },
};
const TIME_OPTIONS: Record<string, Intl.DateTimeFormatOptions> = {
  ar: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
};

export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? "en-GB", {
    ...(DATE_OPTIONS[locale] ?? { dateStyle: "medium" }),
    ...(TIME_OPTIONS[locale] ?? { timeStyle: "short" }),
    numberingSystem: "latn",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? "en-GB", {
    ...(DATE_OPTIONS[locale] ?? { dateStyle: "medium" }),
    numberingSystem: "latn",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
