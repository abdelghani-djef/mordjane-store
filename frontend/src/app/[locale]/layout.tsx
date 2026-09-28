import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Providers } from "@/components/providers";
import { isRtl, routing } from "@/i18n/routing";

import "../globals.css";

// Self-hosted (OFL) variable fonts, so builds never depend on reaching Google Fonts.
// Fredoka's soft, rounded forms for headings (creamy, friendly); Figtree for reading.
const fredoka = localFont({
  src: "../../fonts/fredoka-latin-wght-normal.woff2",
  variable: "--font-fredoka",
  weight: "300 700",
  display: "swap",
});

const figtree = localFont({
  src: "../../fonts/figtree-latin-wght-normal.woff2",
  variable: "--font-figtree",
  weight: "300 900",
  display: "swap",
});

// Arabic companions, chained after the Latin faces in the font stacks: Baloo Bhaijaan 2 is
// Fredoka's rounded, friendly counterpart; Noto Sans Arabic is a calm reading face. The
// unicode-range (the Arabic block; next/font needs it written out as a literal each time)
// keeps English/French pages from downloading them.

const baloo = localFont({
  src: "../../fonts/baloo-bhaijaan-2-arabic-wght-normal.woff2",
  variable: "--font-baloo-arabic",
  weight: "400 800",
  display: "swap",
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC",
    },
  ],
});

const notoArabic = localFont({
  src: "../../fonts/noto-sans-arabic-arabic-wght-normal.woff2",
  variable: "--font-noto-arabic",
  weight: "100 900",
  display: "swap",
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC",
    },
  ],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: hasLocale(routing.locales, locale) ? locale : "en",
    namespace: "Meta",
  });
  return {
    title: { default: t("title"), template: `%s · Mordjane` },
    description: t("description"),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFBF5" },
    { media: "(prefers-color-scheme: dark)", color: "#1B130E" },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      suppressHydrationWarning
      className={`${fredoka.variable} ${figtree.variable} ${baloo.variable} ${notoArabic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
