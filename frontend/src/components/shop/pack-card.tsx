import { useLocale, useTranslations } from "next-intl";

import { AddPackToCart } from "@/components/shop/add-pack-to-cart";
import { PackBox } from "@/components/shop/pack-box";
import { PackPrice } from "@/components/shop/pack-price";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { Pack } from "@/lib/api";
import { localizedName } from "@/lib/format";
import { contentsText, packContents } from "@/lib/packs";
import { cn } from "@/lib/utils";

export function PackCard({ pack, preload }: { pack: Pack; preload?: boolean }) {
  const t = useTranslations("Packs");
  const tProduct = useTranslations("Product");
  const locale = useLocale();
  const name = localizedName(pack, locale);
  const contents = packContents(pack);
  const listed = contentsText(contents, locale);

  return (
    <article className="group relative flex flex-col">
      <Link href={`/packs/${pack.slug}`} className="relative block" tabIndex={-1} aria-hidden>
        <PackBox
          imageUrl={pack.image_url}
          contents={contents}
          alt={t("boxAlt", { items: listed })}
          preload={preload}
          className={cn("rounded-3xl", !pack.in_stock && "opacity-60 grayscale-[35%]")}
        />
      </Link>
      {!pack.in_stock && (
        <Badge variant="secondary" className="absolute start-3 top-3">
          {tProduct("soldOut")}
        </Badge>
      )}
      <div className="flex flex-1 flex-col gap-1 pt-3">
        <h3 className="text-lg leading-snug sm:text-xl">
          <Link
            href={`/packs/${pack.slug}`}
            className="underline-offset-4 group-hover:underline after:absolute after:inset-0"
          >
            {name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{listed}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <PackPrice price={pack.price} regularPrice={pack.regular_price} />
          {/* relative z-10 keeps the button above the card-wide link overlay */}
          <AddPackToCart pack={pack} className="relative z-10" />
        </div>
      </div>
    </article>
  );
}

export function PackGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}
