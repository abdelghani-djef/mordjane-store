import { useLocale, useTranslations } from "next-intl";

import { formatPrice } from "@/lib/format";
import { saving } from "@/lib/packs";
import { cn } from "@/lib/utils";

const PRICE: Record<"sm" | "md" | "lg", string> = {
  sm: "text-base",
  md: "text-lg sm:text-xl",
  lg: "text-3xl",
};
const REGULAR: Record<"sm" | "md" | "lg", string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
};

/**
 * The pack price, then what the items cost one by one, struck through, and how much that
 * saves. The struck price only shows while it is actually higher.
 */
export function PackPrice({
  price,
  regularPrice,
  size = "md",
  showSaving = true,
  className,
}: {
  price: string;
  regularPrice: string;
  size?: "sm" | "md" | "lg";
  showSaving?: boolean;
  className?: string;
}) {
  const t = useTranslations("Packs");
  const locale = useLocale();
  const saved = saving(price, regularPrice);

  return (
    <div className={cn("flex flex-col", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("price text-primary", PRICE[size])}>{formatPrice(price, locale)}</span>
        {saved > 0 && (
          <s className={cn("text-muted-foreground tabular-nums", REGULAR[size])}>
            <span className="sr-only">{t("insteadOf")} </span>
            {formatPrice(regularPrice, locale)}
          </s>
        )}
      </p>
      {showSaving && saved > 0 && (
        <p className={cn("font-medium text-honey-ink", size === "lg" ? "text-base" : "text-sm")}>
          {t("youSave", { amount: formatPrice(saved, locale) })}
        </p>
      )}
    </div>
  );
}
