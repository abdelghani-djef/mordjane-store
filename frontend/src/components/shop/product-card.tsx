import { useLocale, useTranslations } from "next-intl";

import { AddToCart } from "@/components/shop/add-to-cart";
import { listingPhoto, ProductImage } from "@/components/shop/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Product } from "@/lib/api";
import { formatPrice, formatWeight, localizedName } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProductCard({
  product,
  categorySlug,
  preload,
  showBadge = true,
}: {
  product: Product;
  categorySlug?: string;
  preload?: boolean;
  /** Off where the section title already says "Best sellers". */
  showBadge?: boolean;
}) {
  const t = useTranslations("Product");
  const locale = useLocale();
  const name = localizedName(product, locale);
  const sizes = product.variants;
  // Illustrate the smallest size; the product page switches with the size picked.
  const first = sizes[0];
  const onlySize = sizes.length === 1 ? sizes[0] : undefined;

  return (
    <article className="group relative flex flex-col">
      <Link href={`/products/${product.slug}`} className="relative block" tabIndex={-1} aria-hidden>
        <ProductImage
          imageUrl={listingPhoto(product)}
          alt={name}
          hint={`${categorySlug ?? ""} ${product.slug}`}
          grams={first?.weight_grams}
          seed={product.id}
          preload={preload}
          className={cn("rounded-2xl", !product.in_stock && "opacity-60 grayscale-[35%]")}
        />
      </Link>
      <div className="absolute start-3 top-3 flex gap-1.5">
        {showBadge && product.is_featured && (
          <Badge className="bg-honey text-honey-foreground">{t("bestSeller")}</Badge>
        )}
        {!product.in_stock && <Badge variant="secondary">{t("soldOut")}</Badge>}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 pt-3">
        <h3 className="text-base leading-snug sm:text-lg">
          <Link
            href={`/products/${product.slug}`}
            className="underline-offset-4 group-hover:underline after:absolute after:inset-0"
          >
            {name}
          </Link>
        </h3>
        {product.brand && <p className="text-sm text-muted-foreground">{product.brand}</p>}
        <ul className="mt-1.5 flex flex-wrap gap-1" aria-label={t("sizes")}>
          {sizes.slice(0, 3).map((v) => (
            <li
              key={v.id}
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs tabular-nums",
                !v.in_stock && "text-muted-foreground line-through",
              )}
            >
              {formatWeight(v.weight_grams, locale)}
            </li>
          ))}
          {sizes.length > 3 && (
            <li className="px-1 py-0.5 text-xs text-muted-foreground">+{sizes.length - 3}</li>
          )}
        </ul>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          {product.min_price !== null && (
            <span className="price text-lg sm:text-xl">
              {sizes.length > 1 && (
                <span className="me-1 text-sm font-normal text-muted-foreground">{t("from")}</span>
              )}
              {formatPrice(product.min_price, locale)}
            </span>
          )}
          {/* relative z-10 keeps the buttons above the card-wide link overlay */}
          {onlySize ? (
            <AddToCart
              product={product}
              size={onlySize}
              categorySlug={categorySlug}
              className="relative z-10"
            />
          ) : (
            <Button asChild variant="outline" className="relative z-10 rounded-full">
              <Link href={`/products/${product.slug}`}>{t("chooseSize")}</Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}
