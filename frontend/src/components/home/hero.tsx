import { BanknoteIcon, MapPinIcon } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { HeroScroll } from "@/components/home/hero-scroll";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { DEFAULT_HERO_IMAGE } from "@/lib/appearance";

/**
 * The headline beside the home photo (set under Admin → Appearance; a breakfast table by
 * default). Scrolling away, the text rises and fades and the photo comes forward.
 */
export async function HomeHero({
  spreads,
  rocher,
  image,
}: {
  spreads: string;
  rocher: string;
  /** The admin's photo; null shows the default one. */
  image: string | null;
}) {
  const t = await getTranslations("Home");
  return (
    <HeroScroll className="relative overflow-hidden bg-gradient-to-b from-soft via-soft/50 to-background">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 md:grid-cols-[1fr_1.1fr] md:gap-8 md:pt-16 md:pb-24">
        <div className="hero-text">
          <h1 className="home-rise max-w-[13ch] text-5xl leading-[1.02] text-balance sm:text-6xl lg:text-7xl xl:text-[5.25rem]">
            {t("title")}
          </h1>
          <p className="home-rise mt-6 max-w-[46ch] text-lg leading-relaxed text-pretty text-foreground/75 [--delay:120ms]">
            {t("subtitle")}
          </p>
          <div className="home-rise mt-8 flex flex-wrap gap-3 [--delay:220ms]">
            <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
              <Link href={`/products?category=${spreads}`}>{t("shopSpreads")}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-foreground/15 bg-card px-7 text-base"
            >
              <Link href={`/products?category=${rocher}`}>{t("shopRocher")}</Link>
            </Button>
          </div>
          <ul className="home-rise mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground/75 [--delay:300ms]">
            <li className="flex items-center gap-2">
              <MapPinIcon className="size-4 text-primary" /> {t("heroDelivery")}
            </li>
            <li className="flex items-center gap-2">
              <BanknoteIcon className="size-4 text-primary" /> {t("heroCod")}
            </li>
          </ul>
        </div>

        <div className="hero-arch">
          <div className="home-open relative aspect-[1376/768] overflow-hidden rounded-[2rem] shadow-[0_24px_48px_-24px_rgb(63_36_23/0.45)]">
            <Image
              src={image ?? DEFAULT_HERO_IMAGE}
              alt={t("heroPhoto")}
              fill
              preload
              sizes="(min-width: 1280px) 40rem, (min-width: 768px) 52vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </HeroScroll>
  );
}
