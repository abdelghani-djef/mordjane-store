"use client";

import { ShoppingBagIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ProductImage } from "@/components/shop/product-image";
import { QuantityStepper } from "@/components/shop/quantity-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { isRtl } from "@/i18n/routing";
import { formatPrice, formatWeight } from "@/lib/format";
import {
  cartCount,
  cartSubtotal,
  hasBlockedLines,
  isBlocked,
  lineName,
  useCart,
  useHydrated,
} from "@/stores/cart";

export function CartSheet() {
  const t = useTranslations("Cart");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const [open, setOpen] = useState(false);

  const count = hydrated ? cartCount(lines) : 0;
  // Unbuyable lines are fixed on the cart page, which explains each problem.
  const blocked = hasBlockedLines(lines);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${tNav("cart")} (${count})`}
        >
          <ShoppingBagIcon className="size-5" />
          {count > 0 && (
            <Badge className="absolute -end-1 -top-1 h-5 min-w-5 rounded-full bg-honey px-1 text-[0.7rem] text-honey-foreground tabular-nums">
              {count}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side={isRtl(locale) ? "left" : "right"}
        className="flex w-full flex-col gap-0 sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="font-heading text-xl">{t("title")}</SheetTitle>
          <SheetDescription>{t("items", { count })}</SheetDescription>
        </SheetHeader>

        {count === 0 ? (
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShoppingBagIcon />
              </EmptyMedia>
              <EmptyTitle>{t("empty")}</EmptyTitle>
              <EmptyDescription>{t("emptyText")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild onClick={() => setOpen(false)}>
                <Link href="/products">{t("continueShopping")}</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <ScrollArea className="min-h-0 flex-1">
              <ul className="divide-y px-4">
                {lines.map((line) => {
                  const name = lineName(line, locale);
                  return (
                    <li key={line.variantId} className="flex gap-3 py-4">
                      <Link
                        href={`/products/${line.slug}`}
                        onClick={() => setOpen(false)}
                        className="shrink-0"
                        tabIndex={-1}
                        aria-hidden
                      >
                        <ProductImage
                          imageUrl={line.imageUrl}
                          alt={name}
                          hint={`${line.categorySlug ?? ""} ${line.slug}`}
                          seed={line.productId}
                          grams={line.weightGrams}
                          sizes="80px"
                          className="size-20 rounded-lg"
                        />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/products/${line.slug}`}
                            onClick={() => setOpen(false)}
                            className="line-clamp-2 leading-snug font-medium hover:underline"
                          >
                            {name}
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => remove(line.variantId)}
                            aria-label={`${t("remove")} ${name}`}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(line.price, locale)}
                          {` / ${formatWeight(line.weightGrams, locale)}`}
                        </p>
                        {isBlocked(line) && line.problem && (
                          <p className="text-xs text-destructive">
                            {t(
                              `problem.${line.problem.reason as "not_found" | "unavailable" | "insufficient_stock"}`,
                              { available: line.problem.available ?? 0 },
                            )}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between">
                          <QuantityStepper
                            size="sm"
                            value={line.quantity}
                            max={line.maxQuantity ?? 99}
                            onChange={(q) => setQuantity(line.variantId, q)}
                          />
                          <span className="price font-semibold">
                            {formatPrice(Number(line.price) * line.quantity, locale)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
            <SheetFooter className="border-t bg-muted/60">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span className="price text-xl font-semibold">
                  {formatPrice(cartSubtotal(lines), locale)}
                </span>
              </div>
              {blocked && (
                <p className="text-sm text-destructive" role="alert">
                  {t("blockedNotice")}
                </p>
              )}
              <Button
                asChild
                size="lg"
                className="h-11 rounded-full text-base"
                onClick={() => setOpen(false)}
              >
                <Link href={blocked ? "/cart" : "/checkout"}>
                  {blocked ? t("reviewCart") : t("checkout")}
                </Link>
              </Button>
              <Button asChild variant="ghost" onClick={() => setOpen(false)}>
                <Link href="/cart">{tNav("cart")}</Link>
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
