import { BanknoteIcon, MapPinIcon } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { HeroSpreadArt } from "@/components/brand/product-art";
import { HeroScroll } from "@/components/home/hero-scroll";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export type HeroPacks = { jar: string; bucket: string; label: string };

/**
 * The headline beside an arch holding the smallest and the biggest size of one spread. Scrolling
 * away, the text rises and fades, the arch comes forward and the small pack lifts out of it.
 */
export async function HomeHero({
  spreads,
  rocher,
  packs,
}: {
  spreads: string;
  rocher: string;
  packs: HeroPacks | null;
}) {
  const t = await getTranslations("Home");
  return (
    <HeroScroll className="relative overflow-hidden bg-gradient-to-b from-soft via-soft/50 to-background">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 md:grid-cols-[1.15fr_1fr] md:gap-8 md:pt-16 md:pb-24">
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

        {packs ? (
          <HeroArch packs={packs} />
        ) : (
          <div className="mx-auto w-full max-w-md">
            <HeroSpreadArt label={t("heroArtFallback")} />
          </div>
        )}
      </div>
    </HeroScroll>
  );
}

function HeroArch({ packs }: { packs: HeroPacks }) {
  return (
    <div
      role="img"
      aria-label={packs.label}
      className="hero-arch relative mx-auto w-full max-w-sm sm:max-w-md lg:max-w-[30rem]"
    >
      <div className="home-open niche aspect-[5/6]">
        {/* A second, inset arch line: the niche is carved, not drawn. */}
        <div className="pointer-events-none absolute inset-3 rounded-t-full border border-[#7a3f12]/10" />
        {/*
          Photos are shot on white and multiplied onto the niche. The blend sits on the outer
          (moving) wrapper: a transformed element is its own layer, so a blend inside it would
          only mix with that empty layer. Side by side, the packs never overlap each other.
        */}
        <div className="hero-large absolute start-[2%] bottom-[3%] aspect-square w-[68%] mix-blend-multiply">
          <div className="home-drop relative size-full [--delay:150ms]">
            <Image
              src={packs.bucket}
              alt=""
              fill
              preload
              sizes="(min-width: 768px) 20rem, 60vw"
              className="object-contain object-bottom"
            />
          </div>
        </div>
        <div className="hero-small absolute end-[2%] bottom-[3%] aspect-square w-[42%] mix-blend-multiply">
          <div className="home-drop relative size-full [--delay:340ms]">
            <Image
              src={packs.jar}
              alt=""
              fill
              preload
              sizes="(min-width: 768px) 12rem, 40vw"
              className="object-contain object-bottom"
            />
          </div>
        </div>
      </div>
      <div className="home-open -mx-[4%] h-3 rounded-full bg-plank shadow-[0_14px_18px_-12px_rgb(63_36_23/0.6)]" />
    </div>
  );
}
