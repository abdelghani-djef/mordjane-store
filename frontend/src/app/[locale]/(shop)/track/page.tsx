import { MapPinIcon, PartyPopperIcon, SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { asLocale, resolveLocale } from "@/i18n/locale";
import { Alert } from "@/components/shop/alert";
import { StatusBadge, StatusTimeline } from "@/components/shop/status-timeline";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { DeliveryCity, OrderTrack } from "@/lib/api";
import {
  deliveryArea,
  formatDateTime,
  formatPrice,
  formatWeight,
  localizedName,
  localizedText,
} from "@/lib/format";
import { serverApi, serverApiOrNull } from "@/lib/server-api";

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

/**
 * "Delegation, Governorate". Orders keep French snapshots of both; show them in the shop's
 * language while that governorate and delegation are still offered.
 */
async function orderArea(order: OrderTrack, locale: string): Promise<string> {
  if (locale === "fr") return deliveryArea(order, locale);
  const cities = await serverApi<DeliveryCity[]>("/delivery-cities").catch(() => []);
  const city = cities.find((c) => c.name_fr === order.city);
  const delegation = city?.delegations.find((d) => d.name_fr === order.delegation);
  if (!city || (order.delegation && !delegation)) return deliveryArea(order, locale);
  return deliveryArea(
    {
      city: localizedName(city, locale),
      delegation: delegation ? localizedName(delegation, locale) : "",
    },
    locale,
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/track">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "Track" });
  return { title: t("title"), robots: { index: false } };
}

export default async function TrackPage({ params, searchParams }: PageProps<"/[locale]/track">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Track");
  const tCart = await getTranslations("Cart");
  const sp = await searchParams;
  const code = first(sp.code)?.toUpperCase();
  const phone = first(sp.phone);
  const isNew = first(sp.new) === "1";

  const order =
    code && phone ? await serverApiOrNull<OrderTrack>("/orders/track", { code, phone }) : null;
  const searched = Boolean(code && phone);
  const area = order ? await orderArea(order, locale) : null;
  const itemName = (item: OrderTrack["items"][number]) =>
    localizedText(locale, {
      en: item.product_name,
      fr: item.product_name_fr,
      ar: item.product_name_ar,
    });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {order && isNew && (
        <Alert
          tone="success"
          icon={<PartyPopperIcon className="text-success" />}
          title={t("thanksTitle")}
          className="mb-8 text-base"
        >
          {t("thanksText", { code: order.code })}
        </Alert>
      )}

      <h1 className="text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>

      <form
        method="get"
        className="mt-6 grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Field>
          <FieldLabel htmlFor="code">{t("code")}</FieldLabel>
          <Input
            id="code"
            name="code"
            defaultValue={code}
            placeholder="MJ-XXXXXX"
            required
            autoCapitalize="characters"
            dir="ltr"
            className="h-10 tracking-wide uppercase tabular-nums rtl:text-right"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="phone">{t("phone")}</FieldLabel>
          <Input
            id="phone"
            name="phone"
            type="tel"
            dir="ltr"
            defaultValue={phone}
            required
            autoComplete="tel"
            className="h-10 rtl:text-right"
          />
        </Field>
        <Button type="submit" className="h-10 rounded-full px-6">
          {t("submit")}
        </Button>
      </form>

      {searched && !order && (
        <Alert tone="destructive" icon={<SearchXIcon />} className="mt-6">
          {t("notFound")}
        </Alert>
      )}

      {order && (
        <section className="mt-8 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted p-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-wide tabular-nums">{order.code}</h2>
              <p className="text-sm text-muted-foreground">
                {t("placedOn", { date: formatDateTime(order.created_at, locale) })}
              </p>
              {area && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPinIcon className="size-4 shrink-0" />
                  {t("deliverTo")} <bdi className="font-medium text-foreground">{area}</bdi>
                </p>
              )}
            </div>
            <StatusBadge status={order.status} className="px-3 py-1 text-sm" />
          </header>
          <div className="grid gap-8 p-5 sm:grid-cols-2 sm:p-6">
            <div>
              <h3 className="mb-4 text-lg">{t("timeline")}</h3>
              <StatusTimeline status={order.status} events={order.events} />
            </div>
            <div>
              <h3 className="mb-4 text-lg">{t("items")}</h3>
              <ul className="flex flex-col gap-2 text-sm">
                {order.items.map((item, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {item.weight_grams
                        ? tCart("lineSummary", {
                            quantity: item.quantity,
                            name: itemName(item),
                            size: formatWeight(item.weight_grams, locale) ?? "",
                          })
                        : // Orders placed before sizes existed have no weight.
                          `${item.quantity} × ${itemName(item)}`}
                    </span>
                    <span className="tabular-nums">{formatPrice(item.line_total, locale)}</span>
                  </li>
                ))}
              </ul>
              <Separator className="my-4" />
              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{tCart("subtotal")}</dt>
                  <dd className="tabular-nums">{formatPrice(order.subtotal, locale)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{tCart("delivery")}</dt>
                  <dd className="tabular-nums">{formatPrice(order.delivery_fee, locale)}</dd>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <dt className="font-medium">{tCart("total")}</dt>
                  <dd className="price text-xl font-semibold">
                    {formatPrice(order.total, locale)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
