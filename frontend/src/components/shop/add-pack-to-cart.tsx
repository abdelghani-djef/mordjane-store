"use client";

import { ShoppingBagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { QuantityStepper } from "@/components/shop/quantity-stepper";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { Pack } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MAX_QTY_PER_LINE, packKey, useCart } from "@/stores/cart";

/** Same behaviour as AddToCart, for a whole box: capped at the boxes the stock can fill. */
export function AddPackToCart({
  pack,
  layout = "card",
  className,
}: {
  pack: Pack;
  /** Compact button for pack cards; stepper + button on the pack page. */
  layout?: "card" | "full";
  className?: string;
}) {
  const t = useTranslations("Product");
  const router = useRouter();
  const addPack = useCart((s) => s.addPack);
  const inCart = useCart((s) => s.lines.find((l) => l.key === packKey(pack.id))?.quantity ?? 0);
  const [qty, setQty] = useState(1);

  const max = Math.min(MAX_QTY_PER_LINE, pack.boxes_left);
  const remaining = Math.max(0, max - inCart);

  if (!pack.in_stock) {
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
    addPack(pack, Math.min(quantity, remaining));
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
