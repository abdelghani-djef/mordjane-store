import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { asLocale, resolveLocale } from "@/i18n/locale";
import { CheckoutForm } from "@/components/shop/checkout-form";
import type { DeliveryCity } from "@/lib/api";
import { serverApi } from "@/lib/server-api";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/checkout">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "Checkout" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CheckoutPage({ params }: PageProps<"/[locale]/checkout">) {
  await resolveLocale(params);
  const t = await getTranslations("Checkout");
  const cities = await serverApi<DeliveryCity[]>("/delivery-cities");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <CheckoutForm cities={cities} />
    </div>
  );
}
