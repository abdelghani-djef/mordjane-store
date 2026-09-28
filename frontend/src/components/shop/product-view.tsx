"use client";

import { BanknoteIcon, CheckCircle2Icon, CircleAlertIcon, XCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { AddToCart } from "@/components/shop/add-to-cart";
import { ProductImage } from "@/components/shop/product-image";
import { Badge } from "@/components/ui/badge";
import type { ProductDetail, VariantDetail } from "@/lib/api";
import {
  formatPrice,
  formatWeight,
  localizedDescription,
  localizedName,
  localizedText,
  pricePerKg,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const LOW_STOCK = 5;

/** Product page body: the picture, size picker and details follow the chosen size. */
export function ProductView({
  product,
  initialSizeId = null,
}: {
  product: ProductDetail;
  initialSizeId?: number | null;
}) {
  const t = useTranslations("Product");
  const locale = useLocale();
  const sizes = product.variants;
  const [sizeId, setSizeId] = useState(
    () =>
      (sizes.find((v) => v.id === initialSizeId) ?? sizes.find((v) => v.in_stock) ?? sizes[0])
        ?.id ?? null,
  );
  const size = sizes.find((v) => v.id === sizeId) ?? sizes[0];

  const name = localizedName(product, locale);
  const description = localizedDescription(product, locale);
  const ingredients = localizedText(locale, {
    en: product.ingredients_en,
    fr: product.ingredients_fr,
    ar: product.ingredients_ar,
  });
  const storage = localizedText(locale, {
    en: product.storage_en,
    fr: product.storage_fr,
    ar: product.storage_ar,
  });
  const perKg = size ? pricePerKg(size.price, size.weight_grams) : null;

  return (
    <div className="grid gap-10 md:grid-cols-2 lg:gap-16">
      <div className="relative md:sticky md:top-24 md:self-start">
        {/* Each size can have its own packshot; the product photo stands in for the rest. */}
        <ProductImage
          imageUrl={size?.image_url ?? product.image_url}
          alt={name}
          hint={`${product.category.slug} ${product.slug}`}
          grams={size?.weight_grams}
          seed={product.id}
          sizes="(min-width: 768px) 50vw, 100vw"
          preload
          className="rounded-3xl"
        />
        {product.is_featured && (
          <Badge className="absolute start-4 top-4 bg-honey px-3 py-1 text-sm text-honey-foreground">
            {t("bestSeller")}
          </Badge>
        )}
      </div>

      <div className="flex flex-col">
        {product.brand && <p className="font-medium text-primary">{product.brand}</p>}
        <h1 className="text-4xl leading-[1.05] sm:text-5xl">{name}</h1>

        {size && (
          <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="price text-3xl">{formatPrice(size.price, locale)}</span>
            {perKg !== null && sizes.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {t("perKg", { price: formatPrice(perKg, locale) })}
              </span>
            )}
          </div>
        )}

        <SizePicker sizes={sizes} value={size?.id ?? null} onChange={setSizeId} />

        {size && <StockLine size={size} />}

        {size && (
          <div className="mt-6">
            <AddToCart
              key={size.id}
              product={product}
              size={size}
              categorySlug={product.category.slug}
              layout="full"
            />
          </div>
        )}

        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <BanknoteIcon className="size-4" /> {t("codNote")}
        </p>

        {description && (
          <p className="mt-8 max-w-[60ch] text-lg leading-relaxed whitespace-pre-line text-foreground/85">
            {description}
          </p>
        )}

        <section className="mt-10 border-t pt-8">
          <h2 className="text-xl">{t("details")}</h2>
          <dl className="mt-4 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-3">
            {size && (
              <>
                <dt className="text-muted-foreground">{t("netWeight")}</dt>
                <dd>{formatWeight(size.weight_grams, locale)}</dd>
              </>
            )}
            {product.shelf_life_months && (
              <>
                <dt className="text-muted-foreground">{t("shelfLife")}</dt>
                <dd>{t("shelfLifeValue", { months: product.shelf_life_months })}</dd>
              </>
            )}
            {storage && (
              <>
                <dt className="text-muted-foreground">{t("storage")}</dt>
                <dd>{storage}</dd>
              </>
            )}
            {ingredients && (
              <>
                <dt className="text-muted-foreground">{t("ingredients")}</dt>
                <dd className="leading-relaxed">{ingredients}</dd>
              </>
            )}
          </dl>
        </section>
      </div>
    </div>
  );
}

function SizePicker({
  sizes,
  value,
  onChange,
}: {
  sizes: VariantDetail[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  const t = useTranslations("Product");
  const locale = useLocale();
  if (sizes.length === 0) return null;

  return (
    <fieldset className="mt-6">
      <legend className="mb-3 font-medium">{t("chooseSize")}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sizes.map((v) => (
          <label
            key={v.id}
            className={cn(
              "relative flex cursor-pointer flex-col rounded-xl border bg-card px-3 py-2.5 transition-colors",
              "hover:border-primary/50 has-checked:border-primary has-checked:bg-soft has-checked:ring-2 has-checked:ring-primary/20",
              "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              !v.in_stock && "opacity-60",
            )}
          >
            <input
              type="radio"
              name="size"
              value={v.id}
              checked={value === v.id}
              onChange={() => onChange(v.id)}
              className="sr-only"
            />
            <span className="font-heading text-lg leading-tight font-medium">
              {formatWeight(v.weight_grams, locale)}
            </span>
            <span className="mt-1 text-sm font-semibold tabular-nums">
              {v.in_stock ? formatPrice(v.price, locale) : t("soldOut")}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function StockLine({ size }: { size: VariantDetail }) {
  const t = useTranslations("Product");
  if (!size.in_stock) {
    return (
      <p className="mt-4 flex items-center gap-2 font-medium text-destructive">
        <XCircleIcon className="size-4" /> {t("soldOut")}
      </p>
    );
  }
  if (size.stock <= LOW_STOCK) {
    return (
      <p className="mt-4 flex items-center gap-2 font-medium text-honey-ink">
        <CircleAlertIcon className="size-4" /> {t("lowStock", { count: size.stock })}
      </p>
    );
  }
  return (
    <p className="mt-4 flex items-center gap-2 font-medium text-success">
      <CheckCircle2Icon className="size-4" /> {t("inStock")}
    </p>
  );
}
