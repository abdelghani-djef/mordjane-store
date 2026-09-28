import {} from "next-intl/server";

import { resolveLocale } from "@/i18n/locale";
import { SiteFooter } from "@/components/shop/site-footer";
import { SiteHeader } from "@/components/shop/site-header";
import type { Category } from "@/lib/api";
import { serverApi } from "@/lib/server-api";

export default async function ShopLayout({ children, params }: LayoutProps<"/[locale]">) {
  await resolveLocale(params);
  const categories = await serverApi<Category[]>("/categories");

  return (
    <>
      <SiteHeader categories={categories} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter categories={categories} />
    </>
  );
}
