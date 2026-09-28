import { BanknoteIcon, MapPinnedIcon, PackageSearchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { HomeHero, type HeroPacks } from "@/components/home/hero";
import { HomeShelves } from "@/components/home/shelves";
import { SizeStory, type StoryBand, type StoryStep } from "@/components/home/size-story";
import { resolveLocale } from "@/i18n/locale";
import type { Category, Product, ProductPage } from "@/lib/api";
import { formatWeight, localizedName } from "@/lib/format";
import { serverApi } from "@/lib/server-api";

function findSlug(categories: Category[], pattern: RegExp, fallback: string) {
  return categories.find((c) => pattern.test(c.slug))?.slug ?? fallback;
}

/** Who a size is for, by weight: picks the copy of each step of the size story. */
function bandFor(grams: number): StoryBand {
  if (grams <= 250) return "breakfast";
  if (grams <= 500) return "week";
  if (grams <= 1000) return "family";
  if (grams <= 5000) return "baking";
  return "pro";
}

/** Sizes that have their own photo, smallest first. */
function photographedSizes(product: Product) {
  return product.variants
    .filter((v) => v.image_url)
    .toSorted((a, b) => a.weight_grams - b.weight_grams);
}

/**
 * The spread the size story follows: the featured product with the most photographed sizes
 * (ties go to the one reaching the biggest bucket). Needs at least three sizes to tell a story.
 */
function storyProduct(products: Product[]) {
  const candidates = products
    .map((product) => ({ product, sizes: photographedSizes(product) }))
    .filter(({ sizes }) => sizes.length >= 3)
    .toSorted(
      (a, b) =>
        Number(b.product.is_featured) - Number(a.product.is_featured) ||
        b.sizes.length - a.sizes.length ||
        (b.sizes.at(-1)?.weight_grams ?? 0) - (a.sizes.at(-1)?.weight_grams ?? 0),
    );
  return candidates[0] ?? null;
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Home");

  const [categories, catalog] = await Promise.all([
    serverApi<Category[]>("/categories"),
    serverApi<ProductPage>("/products", { page_size: 60 }),
  ]);
  const spreads = findSlug(categories, /spread|tartin/, "spreads");
  const rocher = findSlug(categories, /rocher|crunch/, "rocher");
  const baking = categories.find((c) => /baking|patis/.test(c.slug))?.slug;

  const story = storyProduct(catalog.items);
  const storyName = story ? localizedName(story.product, locale) : "";
  const steps: StoryStep[] =
    story?.sizes.map((size) => ({
      id: size.id,
      grams: size.weight_grams,
      price: size.price,
      imageUrl: size.image_url!,
      band: bandFor(size.weight_grams),
    })) ?? [];

  const smallest = story?.sizes[0];
  const largest = story?.sizes.at(-1);
  const packs: HeroPacks | null =
    smallest && largest
      ? {
          jar: smallest.image_url!,
          bucket: largest.image_url!,
          label: t("heroArt", {
            product: storyName,
            small: formatWeight(smallest.weight_grams, locale) ?? "",
            large: formatWeight(largest.weight_grams, locale) ?? "",
          }),
        }
      : null;

  return (
    <>
      <HomeHero spreads={spreads} rocher={rocher} packs={packs} />
      <HomeShelves categories={categories} products={catalog.items} locale={locale} />
      {story && (
        <div className="mt-24">
          <SizeStory
            slug={story.product.slug}
            name={storyName}
            steps={steps}
            bakingHref={baking ? `/products?category=${baking}` : null}
          />
        </div>
      )}
      <Assurances />
    </>
  );
}

async function Assurances() {
  const t = await getTranslations("Home");
  const items = [
    { icon: BanknoteIcon, title: t("trustCod"), text: t("trustCodText") },
    { icon: MapPinnedIcon, title: t("trustDelivery"), text: t("trustDeliveryText") },
    { icon: PackageSearchIcon, title: t("trustTrack"), text: t("trustTrackText") },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
      <ul className="grid gap-8 sm:grid-cols-3">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-soft text-soft-foreground">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="font-heading text-lg font-medium">{title}</p>
              <p className="text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
