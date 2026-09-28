"use client";

import { ShoppingBagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { QuantityStepper } from "@/components/shop/quantity-stepper";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { Product, Variant } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MAX_QTY_PER_LINE, useCart } from "@/stores/cart";

type Props = {
  product: Pick<Product, "id" | "slug" | "name_en" | "name_fr" | "name_ar" | "image_url">;
  /** The size being bought. */
  size: Variant & { stock?: number };
  categorySlug?: string;
  /** Compact button for product cards; stepper + button on the product page. */
  layout?: "card" | "full";
  className?: string;
};

export function AddToCart({ product, size, categorySlug, layout = "card", className }: Props) {
  const t = useTranslations("Product");
  const router = useRouter();
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.lines.find((l) => l.variantId === size.id)?.quantity ?? 0);
  const [qty, setQty] = useState(1);

  const max = Math.min(MAX_QTY_PER_LINE, size.stock ?? MAX_QTY_PER_LINE);
  const remaining = Math.max(0, max - inCart);

  if (!size.in_stock) {
    return (
      <Button
        variant="secondary"
        disabled
        className={cn(layout === "full" && "h-12 px-6 text-base", className)}
      >
        {t("soldOut")}
      </Button>
    );
  }

  function handleAdd(quantity: number) {
    if (remaining <= 0) {
      toast.info(t("maxReached"));
      return;
    }
    add(product, size, Math.min(quantity, remaining), categorySlug);
    setQty(1);
    toast.success(t("added"), {
      action: { label: t("viewCart"), onClick: () => router.push("/cart") },
    });
  }

  if (layout === "card") {
    return (
      <Button
        onClick={() => handleAdd(1)}
        className={cn("rounded-full", className)}
        aria-label={t("addToCart")}
      >
        <ShoppingBagIcon />
        {/* Icon-only on phones; aria-label keeps the accessible name. */}
        <span className="hidden sm:inline">{t("addToCart")}</span>
      </Button>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, remaining)} />
      <Button
        onClick={() => handleAdd(qty)}
        className="h-12 flex-1 rounded-full px-7 text-base sm:flex-none"
      >
        <ShoppingBagIcon />
        {t("addToCart")}
      </Button>
    </div>
  );
}
