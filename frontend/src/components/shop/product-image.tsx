import Image from "next/image";

import { ProductArt } from "@/components/brand/product-art";
import { cn } from "@/lib/utils";

type WithPhotos = {
  image_url: string | null;
  variants: readonly { image_url: string | null }[];
};

/** Photo for a product listing: the product's own, else the first size that has one. */
export function listingPhoto(product: WithPhotos): string | null {
  return product.image_url ?? product.variants.find((v) => v.image_url)?.image_url ?? null;
}

export function ProductImage({
  imageUrl,
  alt,
  hint,
  grams,
  seed,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
  preload,
  className,
}: {
  imageUrl: string | null | undefined;
  alt: string;
  /** Category + product slug; picks the illustration when there's no photo. */
  hint: string;
  /** Weight of the size shown; the illustration draws bigger sizes in bigger containers. */
  grams?: number | null;
  seed?: string | number;
  sizes?: string;
  preload?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden",
        // Photos are packshots on pure white: show them whole on a white tile (in both
        // themes) so the photo's own background blends in instead of boxing the pack.
        imageUrl ? "bg-white" : "bg-muted",
        className,
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes={sizes}
          preload={preload}
          className="object-contain p-[6%]"
        />
      ) : (
        <ProductArt hint={hint} grams={grams} seed={seed} label={alt} />
      )}
    </div>
  );
}
