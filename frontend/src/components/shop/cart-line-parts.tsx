import { useLocale, useTranslations } from "next-intl";

import { PackBox } from "@/components/shop/pack-box";
import { PackPrice } from "@/components/shop/pack-price";
import { ProductImage } from "@/components/shop/product-image";
import { formatPrice, formatWeight } from "@/lib/format";
import { contentsText } from "@/lib/packs";
import { lineName, type CartLine } from "@/stores/cart";

type Reason = "not_found" | "unavailable" | "insufficient_stock";

/** The line's picture: the size's packshot, or the pack's box. */
export function LineThumb({
  line,
  sizes,
  className,
}: {
  line: CartLine;
  sizes: string;
  className?: string;
}) {
  const locale = useLocale();
  const name = lineName(line, locale);
  if (line.kind === "pack") {
    return (
      <PackBox
        imageUrl={line.imageUrl}
        contents={line.contents}
        alt={name}
        size="sm"
        sizes={sizes}
        className={className}
      />
    );
  }
  return (
    <ProductImage
      imageUrl={line.imageUrl}
      alt={name}
      hint={`${line.categorySlug ?? ""} ${line.slug}`}
      seed={line.productId}
      grams={line.weightGrams}
      sizes={sizes}
      className={className}
    />
  );
}

/** Unit price under the name: "7.900 DT / 200 g", or the pack price and what's in the box. */
export function LineDetail({ line }: { line: CartLine }) {
  const locale = useLocale();
  if (line.kind === "pack") {
    return (
      <>
        <PackPrice
          price={line.price}
          regularPrice={line.regularPrice}
          size="sm"
          showSaving={false}
        />
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {contentsText(line.contents, locale)}
        </p>
      </>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      {formatPrice(line.price, locale)}
      {` / ${formatWeight(line.weightGrams, locale)}`}
    </p>
  );
}

/** Why checkout refused this line, in the shop's words. */
export function useProblemText() {
  const t = useTranslations("Cart");
  return (line: CartLine) => {
    if (!line.problem) return null;
    const reason = line.problem.reason as Reason;
    const values = { available: line.problem.available ?? 0 };
    return line.kind === "pack" ? t(`packProblem.${reason}`, values) : t(`problem.${reason}`, values);
  };
}

/** One line of the order summary: "2 × Hazelnut cream, 350 g" or "1 × Breakfast duo". */
export function useLineSummary() {
  const t = useTranslations("Cart");
  const locale = useLocale();
  return (line: CartLine) =>
    line.kind === "pack"
      ? t("packSummary", { quantity: line.quantity, name: lineName(line, locale) })
      : t("lineSummary", {
          quantity: line.quantity,
          name: lineName(line, locale),
          size: formatWeight(line.weightGrams, locale) ?? "",
        });
}
