"use client";

import { AlertTriangleIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { ProductImage } from "@/components/shop/product-image";
import { QuantityStepper } from "@/components/shop/quantity-stepper";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatPrice, formatWeight } from "@/lib/format";
import {
  cartSubtotal,
  hasBlockedLines,
  lineName,
  useCart,
  useHydrated,
  type CartLine,
} from "@/stores/cart";

export function CartView() {
  const t = useTranslations("Cart");
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);

  if (!hydrated) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <Empty className="rounded-3xl border bg-muted py-20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingBagIcon />
          </EmptyMedia>
          <EmptyTitle className="font-heading text-2xl">{t("empty")}</EmptyTitle>
          <EmptyDescription>{t("emptyText")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild size="lg" className="rounded-full">
            <Link href="/products">{t("continueShopping")}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  // Lines that can't be bought at all must be removed before checking out.
  const blocked = hasBlockedLines(lines);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
      <ul className="divide-y rounded-2xl border bg-card">
        {lines.map((line) => (
          <CartLineRow key={line.variantId} line={line} />
        ))}
      </ul>
      <OrderSummary lines={lines} deliveryFee={null} deliveryNote={t("deliveryAtCheckout")}>
        <Button
          asChild={!blocked}
          size="lg"
          className="h-12 w-full rounded-full text-base"
          disabled={blocked}
        >
          {blocked ? <span>{t("checkout")}</span> : <Link href="/checkout">{t("checkout")}</Link>}
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/products">{t("continueShopping")}</Link>
        </Button>
      </OrderSummary>
    </div>
  );
}

function CartLineRow({ line }: { line: CartLine }) {
  const t = useTranslations("Cart");
  const locale = useLocale();
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const name = lineName(line, locale);

  return (
    <li className="flex gap-4 p-4 sm:p-5">
      <Link href={`/products/${line.slug}`} className="shrink-0" tabIndex={-1} aria-hidden>
        <ProductImage
          imageUrl={line.imageUrl}
          alt={name}
          hint={`${line.categorySlug ?? ""} ${line.slug}`}
          seed={line.productId}
          grams={line.weightGrams}
          sizes="112px"
          className="size-24 rounded-xl sm:size-28"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              href={`/products/${line.slug}`}
              className="font-heading text-lg leading-snug font-medium hover:underline"
            >
              {name}
            </Link>
            <p className="text-sm text-muted-foreground">
              {formatPrice(line.price, locale)}
              {` / ${formatWeight(line.weightGrams, locale)}`}
            </p>
          </div>
          <span className="price shrink-0 text-lg font-semibold">
            {formatPrice(Number(line.price) * line.quantity, locale)}
          </span>
        </div>
        {line.problem && (
          <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            {t(
              `problem.${line.problem.reason as "not_found" | "unavailable" | "insufficient_stock"}`,
              {
                available: line.problem.available ?? 0,
              },
            )}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between">
          <QuantityStepper
            value={line.quantity}
            max={Math.max(1, line.maxQuantity ?? 99)}
            onChange={(q) => setQuantity(line.variantId, q)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => remove(line.variantId)}
            className="text-muted-foreground"
          >
            <Trash2Icon /> {t("remove")}
          </Button>
        </div>
      </div>
    </li>
  );
}

export function OrderSummary({
  lines,
  deliveryFee,
  deliveryNote,
  children,
  compact,
}: {
  lines: CartLine[];
  /** Null until a governorate is chosen at checkout; the fee depends on it. */
  deliveryFee: number | null;
  deliveryNote?: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  const t = useTranslations("Cart");
  const locale = useLocale();
  const subtotal = cartSubtotal(lines);

  return (
    <aside className="flex flex-col gap-4 rounded-2xl border bg-muted p-5 shadow-xs lg:sticky lg:top-24">
      {compact && (
        <ul className="flex flex-col gap-2 text-sm">
          {lines.map((l) => (
            <li key={l.variantId} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-foreground/85">
                {t("lineSummary", {
                  quantity: l.quantity,
                  name: lineName(l, locale),
                  size: formatWeight(l.weightGrams, locale) ?? "",
                })}
              </span>
              <span className="tabular-nums">
                {formatPrice(Number(l.price) * l.quantity, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {compact && <Separator />}
      <dl className="flex flex-col gap-2">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("subtotal")}</dt>
          <dd className="tabular-nums">{formatPrice(subtotal, locale)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("delivery")}</dt>
          <dd className={deliveryFee === null ? "text-sm text-muted-foreground" : "tabular-nums"}>
            {deliveryFee === null ? deliveryNote : formatPrice(deliveryFee, locale)}
          </dd>
        </div>
        <Separator className="my-1" />
        <div className="flex items-baseline justify-between">
          <dt className="font-medium">{t("total")}</dt>
          <dd className="price text-2xl font-semibold">
            {formatPrice(subtotal + (deliveryFee ?? 0), locale)}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">{t("priceNote")}</p>
      {children}
    </aside>
  );
}
