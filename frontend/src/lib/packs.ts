import type { Pack } from "@/lib/api";
import { formatWeight, localizedText } from "@/lib/format";

/** One item inside a pack: what the box drawing, the cart and the contents lists need. */
export type PackContent = {
  productId: number;
  slug: string;
  nameEn: string;
  nameFr: string;
  nameAr?: string | null;
  weightGrams: number;
  imageUrl: string | null;
  quantity: number;
};

export function packContents(pack: Pack): PackContent[] {
  return pack.items.map((item) => ({
    productId: item.product.id,
    slug: item.product.slug,
    nameEn: item.product.name_en,
    nameFr: item.product.name_fr,
    nameAr: item.product.name_ar,
    weightGrams: item.variant.weight_grams,
    // The size's own packshot (the 200 g jar, the bucket…), else the product photo.
    imageUrl: item.variant.image_url ?? item.product.image_url,
    quantity: item.quantity,
  }));
}

export function contentName(content: PackContent, locale: string): string {
  return localizedText(locale, { en: content.nameEn, fr: content.nameFr, ar: content.nameAr });
}

/** Total number of jars, tubs and sachets in the box. */
export function unitCount(contents: readonly { quantity: number }[]): number {
  return contents.reduce((sum, c) => sum + c.quantity, 0);
}

export function listSeparator(locale: string): string {
  return locale === "ar" ? "، " : ", ";
}

/**
 * What's in the box on one line, "2 × Hazelnut cream, 350 g + Cocoa powder, 400 g": the plus
 * keeps items apart from the comma before each size, and a single unit needs no "1 ×".
 */
export function contentsText(contents: PackContent[], locale: string): string {
  return contents
    .map((c) => {
      const item = [contentName(c, locale), formatWeight(c.weightGrams, locale)]
        .filter(Boolean)
        .join(listSeparator(locale));
      return c.quantity > 1 ? `${c.quantity} × ${item}` : item;
    })
    .join(" + ");
}

/** The pack saves money only while the items cost more one by one (prices can change later). */
export function saving(price: string | number, regularPrice: string | number): number {
  return Math.max(0, Number(regularPrice) - Number(price));
}
