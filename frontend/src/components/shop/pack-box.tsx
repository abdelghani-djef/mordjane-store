import Image from "next/image";

import { ProductArt } from "@/components/brand/product-art";
import type { PackContent } from "@/lib/packs";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const GAP: Record<Size, string> = { sm: "gap-0.5 p-1", md: "gap-2 p-3", lg: "gap-3 p-4 sm:p-5" };
const WELL: Record<Size, string> = { sm: "rounded-md", md: "rounded-xl", lg: "rounded-2xl" };
// Each well is about half the picture wide.
const WELL_SIZES: Record<Size, string> = {
  sm: "64px",
  md: "(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 50vw",
  lg: "(min-width: 1024px) 25vw, 50vw",
};
const TAG: Record<Size, string> = {
  sm: "bottom-0.5 end-0.5 px-1 text-[0.6rem] leading-4",
  md: "bottom-1.5 end-1.5 px-1.5 py-0.5 text-xs",
  lg: "bottom-2.5 end-2.5 px-2 py-0.5 text-sm",
};

/**
 * A pack's picture. With an uploaded photo of the box, that photo; otherwise the box drawn
 * open: a praline-brown tray with one paper well per item, each holding the item's packshot
 * and, when there are several of it, a caramel "×2" tag. Big boxes show three wells and "+n".
 */
export function PackBox({
  imageUrl,
  contents,
  alt,
  size = "md",
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  preload,
  className,
}: {
  imageUrl: string | null | undefined;
  contents: PackContent[];
  /** Describes the box ("Box with 2 × …"); the wells themselves are decorative. */
  alt: string;
  size?: Size;
  /** `sizes` of the whole picture (the box photo, or a box with a single well). */
  sizes?: string;
  preload?: boolean;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <div className={cn("relative aspect-square overflow-hidden bg-white", className)}>
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes={sizes}
          preload={preload}
          className="object-contain p-[6%]"
        />
      </div>
    );
  }

  const overflow = contents.length > 4;
  const wells = overflow ? contents.slice(0, 3) : contents;
  const hidden = contents.length - wells.length;
  const cells = wells.length + (overflow ? 1 : 0);

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "relative aspect-square overflow-hidden bg-praline",
        // The tray's raised rim.
        "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_-6px_14px_rgb(0_0_0/0.35)]",
        className,
      )}
    >
      <div
        className={cn(
          "grid size-full",
          GAP[size],
          cells === 1 && "grid-cols-1",
          cells === 2 && "grid-cols-2",
          cells >= 3 && "grid-cols-2 grid-rows-2",
        )}
      >
        {wells.map((item, i) => (
          <div
            key={`${item.productId}-${item.weightGrams}`}
            className={cn(
              "relative overflow-hidden bg-niche",
              // A paper cup pressed into the tray.
              "shadow-[inset_0_2px_5px_rgb(63_36_23/0.28)]",
              WELL[size],
              cells === 3 && i === 0 && "row-span-2",
            )}
          >
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt=""
                fill
                sizes={cells === 1 ? sizes : WELL_SIZES[size]}
                preload={preload}
                // Packshots are shot on white: multiply blends them onto the paper.
                className="object-contain p-[5%] mix-blend-multiply"
              />
            ) : (
              <ProductArt hint={item.slug} grams={item.weightGrams} seed={item.productId} />
            )}
            {item.quantity > 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute rounded-full bg-honey font-heading font-semibold text-honey-foreground tabular-nums",
                  TAG[size],
                )}
              >
                ×{item.quantity}
              </span>
            )}
          </div>
        ))}
        {overflow && (
          <div
            aria-hidden
            className={cn(
              "grid place-items-center bg-niche/15 font-heading font-semibold text-praline-foreground tabular-nums",
              WELL[size],
              size === "sm" ? "text-xs" : size === "md" ? "text-xl" : "text-3xl",
            )}
          >
            +{hidden}
          </div>
        )}
      </div>
    </div>
  );
}
