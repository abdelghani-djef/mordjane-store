import { getTranslations } from "next-intl/server";

import { PackCard } from "@/components/shop/pack-card";
import { Link } from "@/i18n/navigation";
import type { Pack } from "@/lib/api";

/** The packs the admin featured, right under the hero: swipeable on phones, a row on desktop. */
export async function FeaturedPacks({ packs }: { packs: Pack[] }) {
  if (packs.length === 0) return null;
  const t = await getTranslations("Home");
  const tPacks = await getTranslations("Packs");

  return (
    <section
      aria-labelledby="featured-packs"
      className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-24"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 id="featured-packs" className="text-3xl sm:text-4xl">
            {t("packsTitle")}
          </h2>
          <p className="mt-1 text-muted-foreground">{t("packsText")}</p>
        </div>
        <Link
          href="/packs"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {tPacks("seeAll")}
        </Link>
      </div>
      <ul className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
        {packs.slice(0, 3).map((pack) => (
          <li key={pack.id} className="flex w-[80%] shrink-0 snap-start *:min-w-0 *:flex-1 sm:w-auto">
            <PackCard pack={pack} />
          </li>
        ))}
      </ul>
    </section>
  );
}
