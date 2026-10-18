import { BanknoteIcon, CheckCircle2Icon, CircleAlertIcon, XCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AddPackToCart } from "@/components/shop/add-pack-to-cart";
import { PackBox } from "@/components/shop/pack-box";
import { PackCard, PackGrid } from "@/components/shop/pack-card";
import { PackPrice } from "@/components/shop/pack-price";
import { ProductImage } from "@/components/shop/product-image";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { resolveLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import type { Pack } from "@/lib/api";
import { formatPrice, formatWeight, localizedDescription, localizedName } from "@/lib/format";
import { contentsText, listSeparator, packContents, unitCount } from "@/lib/packs";
import { serverApi, serverApiOrNull } from "@/lib/server-api";

const LOW_STOCK = 5;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/packs/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const pack = await serverApiOrNull<Pack>(`/packs/${encodeURIComponent(slug)}`);
  if (!pack) return {};
  return {
    title: localizedName(pack, locale),
    description: localizedDescription(pack, locale).slice(0, 160),
  };
}

export default async function PackPage({ params }: PageProps<"/[locale]/packs/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const t = await getTranslations("Packs");
  const tProduct = await getTranslations("Product");

  const pack = await serverApiOrNull<Pack>(`/packs/${encodeURIComponent(slug)}`);
  if (!pack) notFound();
  const others = (await serverApi<Pack[]>("/packs")).filter((p) => p.id !== pack.id).slice(0, 3);

  const name = localizedName(pack, locale);
  const description = localizedDescription(pack, locale);
  const contents = packContents(pack);
  const listed = contentsText(contents, locale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">{tProduct("home")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/packs">{t("title")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="line-clamp-1">{name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-6 grid gap-10 md:grid-cols-2 lg:gap-16">
        <div className="md:sticky md:top-24 md:self-start">
          <PackBox
            imageUrl={pack.image_url}
            contents={contents}
            alt={t("boxAlt", { items: listed })}
            size="lg"
            sizes="(min-width: 768px) 50vw, 100vw"
            preload
            className="rounded-[2rem]"
          />
        </div>

        <div className="flex flex-col">
          <p className="font-medium text-primary">
            {t("itemCount", { count: unitCount(contents) })}
          </p>
          <h1 className="text-4xl leading-[1.05] sm:text-5xl">{name}</h1>

          <PackPrice
            price={pack.price}
            regularPrice={pack.regular_price}
            size="lg"
            className="mt-5 gap-1"
          />

          <StockLine pack={pack} />

          <div className="mt-6">
            <AddPackToCart pack={pack} layout="full" />
          </div>

          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <BanknoteIcon className="size-4" /> {tProduct("codNote")}
          </p>

          {description && (
            <p className="mt-8 max-w-[60ch] text-lg leading-relaxed whitespace-pre-line text-foreground/85">
              {description}
            </p>
          )}

          <section className="mt-10 border-t pt-8">
            <h2 className="text-xl">{t("inTheBox")}</h2>
            <ul className="mt-4 divide-y">
              {pack.items.map((item) => {
                const itemName = localizedName(item.product, locale);
                return (
                  <li key={item.variant.id} className="flex items-center gap-4 py-3">
                    <ProductImage
                      imageUrl={item.variant.image_url ?? item.product.image_url}
                      alt=""
                      hint={item.product.slug}
                      grams={item.variant.weight_grams}
                      seed={item.product.id}
                      sizes="64px"
                      className="size-16 shrink-0 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${item.product.slug}?size=${item.variant.id}`}
                        className="leading-snug font-medium underline-offset-4 hover:underline"
                      >
                        {itemName}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {formatWeight(item.variant.weight_grams, locale)}
                        {listSeparator(locale)}
                        {t("itemPrice", { price: formatPrice(item.variant.price, locale) })}
                      </p>
                    </div>
                    <span className="font-heading text-lg font-semibold tabular-nums">
                      ×{item.quantity}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>

      {others.length > 0 && (
        <section className="mt-20">
          <h2 className="text-3xl">{t("seeAll")}</h2>
          <div className="mt-6">
            <PackGrid>
              {others.map((p) => (
                <PackCard key={p.id} pack={p} />
              ))}
            </PackGrid>
          </div>
        </section>
      )}
    </div>
  );
}

async function StockLine({ pack }: { pack: Pack }) {
  const t = await getTranslations("Packs");
  const tProduct = await getTranslations("Product");
  if (!pack.in_stock) {
    return (
      <p className="mt-4 flex items-center gap-2 font-medium text-destructive">
        <XCircleIcon className="size-4" /> {tProduct("soldOut")}
      </p>
    );
  }
  if (pack.boxes_left <= LOW_STOCK) {
    return (
      <p className="mt-4 flex items-center gap-2 font-medium text-honey-ink">
        <CircleAlertIcon className="size-4" /> {t("boxesLeft", { count: pack.boxes_left })}
      </p>
    );
  }
  return (
    <p className="mt-4 flex items-center gap-2 font-medium text-success">
      <CheckCircle2Icon className="size-4" /> {tProduct("inStock")}
    </p>
  );
}
