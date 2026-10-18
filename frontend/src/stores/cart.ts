"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Pack, Product, StockProblem, Variant } from "@/lib/api";
import { localizedText } from "@/lib/format";
import { packContents, type PackContent } from "@/lib/packs";

export const MAX_QTY_PER_LINE = 99;

type LineBase = {
  /** "v:<size id>" or "p:<pack id>": one line per size and per pack. */
  key: string;
  slug: string;
  nameEn: string;
  nameFr: string;
  /** Missing on lines added before the shop spoke Arabic. */
  nameAr?: string | null;
  price: string;
  imageUrl: string | null;
  quantity: number;
  /** Known stock ceiling (from the product/pack page or a 409), if any. */
  maxQuantity?: number;
  /** Set when checkout was rejected for this line. */
  problem?: StockProblem;
};

/** One size of one product in the cart. */
export type SizeLine = LineBase & {
  kind: "size";
  variantId: number;
  productId: number;
  weightGrams: number;
  categorySlug?: string;
};

/** A pack (several sizes in one box) in the cart. */
export type PackLine = LineBase & {
  kind: "pack";
  packId: number;
  /** The items bought separately, shown struck through. */
  regularPrice: string;
  contents: PackContent[];
};

export type CartLine = SizeLine | PackLine;

export const sizeKey = (variantId: number) => `v:${variantId}`;
export const packKey = (packId: number) => `p:${packId}`;

type CartState = {
  lines: CartLine[];
  add: (
    product: Pick<Product, "id" | "slug" | "name_en" | "name_fr" | "name_ar" | "image_url">,
    variant: Variant & { stock?: number },
    quantity?: number,
    categorySlug?: string,
  ) => void;
  addPack: (pack: Pack, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  applyProblems: (problems: StockProblem[]) => void;
};

/** The line's product (or pack) name in the shop's language. */
export function lineName(line: Pick<LineBase, "nameEn" | "nameFr" | "nameAr">, locale: string) {
  return localizedText(locale, { en: line.nameEn, fr: line.nameFr, ar: line.nameAr });
}

/** Where the line's name links to. */
export function lineHref(line: CartLine): string {
  return line.kind === "pack" ? `/packs/${line.slug}` : `/products/${line.slug}`;
}

function clampQty(quantity: number, max?: number) {
  const ceiling = Math.min(MAX_QTY_PER_LINE, max ?? MAX_QTY_PER_LINE);
  return Math.max(1, Math.min(Math.floor(quantity), ceiling));
}

/** Adds to an existing line (refreshing what the shop just showed) or appends a new one. */
function upsert(lines: CartLine[], line: CartLine, quantity: number): CartLine[] {
  const existing = lines.find((l) => l.key === line.key);
  const maxQuantity = line.maxQuantity ?? existing?.maxQuantity;
  if (!existing) {
    return [...lines, { ...line, maxQuantity, quantity: clampQty(quantity, maxQuantity) }];
  }
  return lines.map((l) =>
    l.key === line.key
      ? {
          ...line,
          maxQuantity,
          problem: undefined,
          quantity: clampQty(l.quantity + quantity, maxQuantity),
        }
      : l,
  );
}

function problemFor(line: CartLine, problems: StockProblem[]) {
  return problems.find((p) =>
    line.kind === "pack" ? p.pack_id === line.packId : p.variant_id === line.variantId,
  );
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (product, variant, quantity = 1, categorySlug) =>
        set((state) => ({
          lines: upsert(
            state.lines,
            {
              kind: "size",
              key: sizeKey(variant.id),
              variantId: variant.id,
              productId: product.id,
              slug: product.slug,
              nameEn: product.name_en,
              nameFr: product.name_fr,
              nameAr: product.name_ar,
              weightGrams: variant.weight_grams,
              price: variant.price,
              // The size's own packshot, so the cart shows the jar or bucket being bought.
              imageUrl: variant.image_url ?? product.image_url,
              categorySlug,
              maxQuantity: variant.stock,
              quantity: 0,
            },
            quantity,
          ),
        })),
      addPack: (pack, quantity = 1) =>
        set((state) => ({
          lines: upsert(
            state.lines,
            {
              kind: "pack",
              key: packKey(pack.id),
              packId: pack.id,
              slug: pack.slug,
              nameEn: pack.name_en,
              nameFr: pack.name_fr,
              nameAr: pack.name_ar,
              price: pack.price,
              regularPrice: pack.regular_price,
              imageUrl: pack.image_url,
              contents: packContents(pack),
              maxQuantity: pack.boxes_left,
              quantity: 0,
            },
            quantity,
          ),
        })),
      setQuantity: (key, quantity) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.key === key
              ? { ...l, problem: undefined, quantity: clampQty(quantity, l.maxQuantity) }
              : l,
          ),
        })),
      remove: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
      applyProblems: (problems) =>
        set((state) => ({
          lines: state.lines.map((l) => {
            const problem = problemFor(l, problems);
            if (!problem) return { ...l, problem: undefined };
            const available = problem.available ?? 0;
            const shortOnly = problem.reason === "insufficient_stock" && available > 0;
            return {
              ...l,
              problem,
              maxQuantity: problem.reason === "insufficient_stock" ? available : 0,
              // Shrink to what's left so the customer can simply retry.
              quantity: shortOnly ? Math.min(l.quantity, available) : l.quantity,
            };
          }),
        })),
    }),
    {
      name: "mordjane-cart",
      // v3: lines are sizes or packs. v2 lines were all sizes and are kept as such; v1 carts
      // held whole products and can't be mapped to a size, so they start empty.
      version: 3,
      migrate: (persisted, version) => {
        if (version === 2) {
          const old = (persisted as { lines?: Omit<SizeLine, "kind" | "key">[] }).lines ?? [];
          return {
            lines: old.map((l) => ({ ...l, kind: "size" as const, key: sizeKey(l.variantId) })),
          };
        }
        return { lines: [] };
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

/** A line that can't be bought at all (gone, switched off, or zero left) must be removed first. */
export function isBlocked(line: CartLine): boolean {
  const p = line.problem;
  return !!p && (p.reason !== "insufficient_stock" || (p.available ?? 0) === 0);
}

export function hasBlockedLines(lines: CartLine[]): boolean {
  return lines.some(isBlocked);
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + Number(l.price) * l.quantity, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/**
 * The cart lives in localStorage, so the server render always sees an empty cart. Gate
 * cart-dependent UI on this to avoid hydration mismatches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useCart.persist.onFinishHydration(onChange),
    () => useCart.persist.hasHydrated(),
    () => false,
  );
}
