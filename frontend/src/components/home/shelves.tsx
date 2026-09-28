import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { listingPhoto } from "@/components/shop/product-image";
import { ProductArt } from "@/components/brand/product-art";
import { Link } from "@/i18n/navigation";
import type { Category, Product } from "@/lib/api";
import { formatPrice, localizedName } from "@/lib/format";
import { cn } from "@/lib/utils";

type Aisle = { category: Category; products: Product[] };

/** Short aisles (a few products) share a row on wide screens; long ones get a shelf each. */
const SHORT_AISLE = 4;

/**
 * Every product on its aisle's shelf, with a shelf-edge tag (name and starting price)
 * underneath, the way an épicerie shows its stock.
 */
export async function HomeShelves({
  categories,
  products,
  locale,
}: {
  categories: Category[];
  products: Product[];
  locale: string;
}) {
  const t = await getTranslations("Home");
  const aisles: Aisle[] = categories
    .map((category) => ({
      category,
      products: products.filter((p) => p.category_id === category.id),
    }))
    .filter((aisle) => aisle.products.length > 0);
  if (aisles.length === 0) return null;

  // Pair consecutive short aisles into one row.
  const rows: Aisle[][] = [];
  for (const aisle of aisles) {
    const last = rows.at(-1);
    if (
      last?.length === 1 &&
      last[0].products.length <= SHORT_AISLE &&
      aisle.products.length <= SHORT_AISLE
    ) {
      last.push(aisle);
    } else {
      rows.push([aisle]);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="text-3xl sm:text-4xl">{t("categoriesTitle")}</h2>
        <Link
          href="/products"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("viewAll")}
        </Link>
      </div>
      <div className="mt-10 flex flex-col gap-14">
        {rows.map((row) => (
          <div
            key={row.map((a) => a.category.id).join("-")}
            className={cn("grid gap-14", row.length === 2 && "lg:grid-cols-2 lg:gap-10")}
          >
            {row.map((aisle) => (
              <Shelf key={aisle.category.id} aisle={aisle} locale={locale} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

async function Shelf({ aisle, locale }: { aisle: Aisle; locale: string }) {
  const t = await getTranslations("Home");
  const tCatalog = await getTranslations("Catalog");
  const { category, products } = aisle;
  const href = `/products?category=${category.slug}`;
  return (
    <section aria-labelledby={`aisle-${category.id}`} className="shelf min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 id={`aisle-${category.id}`} className="text-2xl">
          <Link href={href} className="underline-offset-4 hover:underline">
            {localizedName(category, locale)}
          </Link>
        </h3>
        <span className="text-sm text-muted-foreground">
          {tCatalog("results", { count: products.length })}
        </span>
        <Link
          href={href}
          className="ms-auto text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("shelfLink")}
        </Link>
      </div>
      {/* The shelf scrolls sideways when it holds more packs than the screen is wide. */}
      <ul className="-mx-4 mt-5 flex snap-x [scrollbar-width:thin] overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {products.map((product, i) => (
          <li key={product.id} className="w-36 shrink-0 snap-start sm:w-40">
            <ShelfItem product={product} locale={locale} index={i} />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function ShelfItem({
  product,
  locale,
  index,
}: {
  product: Product;
  locale: string;
  index: number;
}) {
  const tProduct = await getTranslations("Product");
  const name = localizedName(product, locale);
  const photo = listingPhoto(product);
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="px-1.5">
        {/*
          The pack stands straight on the shelf. Photos are shot on white: multiplied onto the
          light page they lose their white box; on the dark theme they get a white tile instead.
        */}
        <div className="relative aspect-square">
          <div
            className="shelf-pack absolute inset-x-0 top-0 bottom-0 mix-blend-multiply dark:mix-blend-normal"
            style={{ "--i": Math.min(index, 6) } as React.CSSProperties}
          >
            <div className="relative size-full transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-hover:scale-[1.04] dark:rounded-2xl dark:bg-white">
              {photo ? (
                <Image
                  src={photo}
                  alt=""
                  fill
                  sizes="10rem"
                  className="object-contain object-bottom dark:rounded-2xl"
                />
              ) : (
                <ProductArt hint={product.slug} seed={product.id} className="rounded-2xl" />
              )}
            </div>
          </div>
        </div>
      </div>
      {/* One plank segment per pack: side by side they make one continuous shelf. */}
      <div className="h-2.5 bg-plank shadow-[0_10px_12px_-9px_rgb(63_36_23/0.55)]" />
      <div className="px-2 pt-3">
        <p className="line-clamp-2 text-sm leading-snug font-medium group-hover:underline group-hover:underline-offset-4">
          {name}
        </p>
        {product.min_price && (
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {tProduct("from")} {formatPrice(product.min_price, locale)}
          </p>
        )}
      </div>
    </Link>
  );
}
