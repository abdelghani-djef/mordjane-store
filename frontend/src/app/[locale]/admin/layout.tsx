import type { Metadata } from "next";

import { QueryProvider } from "@/components/admin/query-provider";
import { resolveLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { ADMIN_FALLBACK_LOCALE, ADMIN_LOCALES } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminRootLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const locale = await resolveLocale(params);
  // The proxy already sends /ar/admin/… to French; this covers anything that slips past it.
  if (!(ADMIN_LOCALES as readonly string[]).includes(locale)) {
    redirect({ href: "/admin", locale: ADMIN_FALLBACK_LOCALE });
  }
  return <QueryProvider>{children}</QueryProvider>;
}
