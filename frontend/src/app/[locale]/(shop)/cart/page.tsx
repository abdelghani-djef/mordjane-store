import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { asLocale, resolveLocale } from "@/i18n/locale";
import { CartView } from "@/components/shop/cart-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/cart">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "Cart" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CartPage({ params }: PageProps<"/[locale]/cart">) {
  await resolveLocale(params);
  const t = await getTranslations("Cart");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <CartView />
    </div>
  );
}
