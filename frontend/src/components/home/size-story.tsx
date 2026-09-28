"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatPrice, formatWeight, pricePerKg } from "@/lib/format";
import { cn } from "@/lib/utils";

export type StoryBand = "breakfast" | "week" | "family" | "baking" | "pro";
export type StoryStep = {
  id: number;
  grams: number;
  price: string;
  imageUrl: string;
  band: StoryBand;
};

/**
 * "From jar to bucket": one spread, size by size. The arch stays pinned while the steps scroll
 * past; the pack grows with its weight (log scale, so 200 g and 12 kg both read), and a giant
 * outlined weight sits behind it. Works without motion: the steps are plain content.
 */
export function SizeStory({
  slug,
  name,
  steps,
  bakingHref,
}: {
  slug: string;
  name: string;
  steps: StoryStep[];
  bakingHref: string | null;
}) {
  const t = useTranslations("Home.story");
  const tProduct = useTranslations("Product");
  const locale = useLocale();
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    // A step is "current" while it crosses a thin band just below the middle of the screen.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(Number((entry.target as HTMLElement).dataset.index));
          }
        }
      },
      { rootMargin: "-52% 0px -42% 0px" },
    );
    for (const el of stepRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [steps.length]);

  const low = Math.log(steps[0].grams);
  const high = Math.log(steps[steps.length - 1].grams);
  const scaleFor = (grams: number) =>
    high === low ? 1 : 0.52 + (0.48 * (Math.log(grams) - low)) / (high - low);

  function goTo(index: number) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    stepRefs.current[index]?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });
  }

  const current = steps[active];

  return (
    <>
      <SpreadEdge />
      <section className="bg-praline text-praline-foreground" aria-labelledby="size-story-title">
        <div className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 md:pt-28">
          <h2 id="size-story-title" className="text-4xl sm:text-5xl lg:text-6xl">
            {t("title")}
          </h2>
          <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-praline-foreground/75">
            {t("intro", { product: name, count: steps.length })}
          </p>
        </div>

        <div className="mx-auto grid max-w-7xl px-4 sm:px-6 md:grid-cols-2 md:gap-10">
          {/* The stage: pinned while the steps scroll by. */}
          {/* Clipped sideways so the giant weight never runs under the steps' text. */}
          <div className="sticky top-16 z-0 flex h-[52svh] flex-col items-center justify-center self-start overflow-x-clip md:h-[calc(100svh-4rem)]">
            <div className="relative flex w-full flex-1 items-center justify-center">
              <p
                key={current.id}
                aria-hidden="true"
                className="story-number pointer-events-none absolute font-heading text-[clamp(5rem,26vw,15rem)] leading-none font-semibold whitespace-nowrap text-transparent select-none [-webkit-text-stroke:2px_rgb(233_162_59/0.5)] md:text-[clamp(5rem,17vw,16rem)]"
              >
                {formatWeight(current.grams, locale)}
              </p>
              <div className="niche aspect-[4/5] h-[88%] max-h-[34rem]">
                <div className="pointer-events-none absolute inset-3 rounded-t-full border border-[#7a3f12]/10" />
                {steps.map((step, i) => (
                  <div
                    key={step.id}
                    aria-hidden={i !== active}
                    className="absolute inset-x-[7%] top-[12%] bottom-[3%] origin-bottom mix-blend-multiply transition-[opacity,scale] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                    style={{
                      opacity: i === active ? 1 : 0,
                      scale: String(scaleFor(step.grams) * (i === active ? 1 : 0.9)),
                    }}
                  >
                    <Image
                      src={step.imageUrl}
                      alt={`${name}, ${formatWeight(step.grams, locale)}`}
                      fill
                      sizes="(min-width: 768px) 26rem, 60vw"
                      className="object-contain object-bottom"
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* The sizes, smallest to largest: a real sequence, so it gets a rail. */}
            <ol aria-label={t("sizes")} className="flex flex-wrap justify-center gap-1.5 py-4">
              {steps.map((step, i) => (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === active ? "step" : undefined}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm tabular-nums transition-colors",
                      "focus-visible:ring-3 focus-visible:ring-honey/50 focus-visible:outline-none",
                      i === active
                        ? "border-honey bg-honey text-honey-foreground"
                        : "border-praline-foreground/20 text-praline-foreground/70 hover:border-praline-foreground/50",
                    )}
                  >
                    {formatWeight(step.grams, locale)}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="relative z-10 pb-[18svh] md:pt-[10svh]">
            {steps.map((step, i) => {
              const perKg = pricePerKg(step.price, step.grams);
              return (
                <article
                  key={step.id}
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  data-index={i}
                  // Phones: text sits low, under the pinned stage; wide screens: beside it.
                  className="flex min-h-[70svh] items-end pb-[4svh] md:min-h-[78svh] md:items-center md:pb-0"
                >
                  <div
                    className={cn(
                      "transition-opacity duration-500",
                      // Phones: the text scrolls over the pinned stage, so it gets a backing.
                      "max-md:rounded-2xl max-md:bg-praline/90 max-md:p-5 max-md:backdrop-blur-sm",
                      i === active ? "opacity-100" : "opacity-40",
                    )}
                  >
                    <h3 className="text-3xl sm:text-4xl">{t(`${step.band}.title`)}</h3>
                    <p className="mt-3 max-w-[38ch] text-lg leading-relaxed text-praline-foreground/75">
                      {t(`${step.band}.text`)}
                    </p>
                    <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="price text-2xl text-honey">
                        {formatPrice(step.price, locale)}
                      </span>
                      {perKg !== null && (
                        <span className="text-sm text-praline-foreground/60 tabular-nums">
                          {tProduct("perKg", { price: formatPrice(perKg, locale) })}
                        </span>
                      )}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                      <Button
                        asChild
                        variant="outline"
                        className="h-11 rounded-full border-praline-foreground/30 bg-transparent px-6 text-praline-foreground hover:bg-praline-foreground/10 hover:text-praline-foreground"
                      >
                        <Link href={{ pathname: `/products/${slug}`, query: { size: step.id } }}>
                          {t("choose", { size: formatWeight(step.grams, locale) ?? "" })}
                        </Link>
                      </Button>
                      {step.band === "pro" && bakingHref && (
                        <Link
                          href={bakingHref}
                          className="font-medium text-honey underline-offset-4 hover:underline"
                        >
                          {t("bakingLink")}
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <SpreadEdge flip />
    </>
  );
}

/** The praline section's edge: spread poured in (top) and scraped off (bottom). */
function SpreadEdge({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 64"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("-my-px block h-8 w-full text-praline md:h-14", flip && "rotate-180")}
    >
      <path
        d="M0 64 V38 C 160 10, 330 58, 520 34 S 880 2, 1060 30 S 1320 60, 1440 26 V64 Z"
        fill="currentColor"
      />
    </svg>
  );
}
