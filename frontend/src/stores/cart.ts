"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Product, StockProblem, Variant } from "@/lib/api";
import { localizedText } from "@/lib/format";

export const MAX_QTY_PER_LINE = 99;

/** One size of one product in the cart. */
export type CartLine = {
  variantId: number;
  productId: number;
  slug: string;
  nameEn: string;
  nameFr: string;
  /** Missing on lines added before the shop spoke Arabic. */
  nameAr?: string | null;
  weightGrams: number;
  price: string;
  imageUrl: string | null;
  categorySlug?: string;
  quantity: number;
  /** Known stock ceiling (from the product page or a 409), if any. */
  maxQuantity?: number;
  /** Set when checkout was rejected for this line. */
  problem?: StockProblem;
};

type CartState = {
  lines: CartLine[];
  add: (
    product: Pick<Product, "id" | "slug" | "name_en" | "name_fr" | "name_ar" | "image_url">,
    variant: Variant & { stock?: number },
    quantity?: number,
    categorySlug?: string,
  ) => void;
  setQuantity: (variantId: number, quantity: number) => void;
  remove: (variantId: number) => void;
  clear: () => void;
  applyProblems: (problems: StockProblem[]) => void;
};

/** The line's product name in the shop's language. */
export function lineName(line: Pick<CartLine, "nameEn" | "nameFr" | "nameAr">, locale: string) {
  return localizedText(locale, { en: line.nameEn, fr: line.nameFr, ar: line.nameAr });
}

function clampQty(quantity: number, max?: number) {
  const ceiling = Math.min(MAX_QTY_PER_LINE, max ?? MAX_QTY_PER_LINE);
  return Math.max(1, Math.min(Math.floor(quantity), ceiling));
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (product, variant, quantity = 1, categorySlug) =>
        set((state) => {
          const existing = state.lines.find((l) => l.variantId === variant.id);
          const maxQuantity = variant.stock ?? existing?.maxQuantity;
          // The size's own packshot, so the cart shows the jar or bucket being bought.
          const imageUrl = variant.image_url ?? product.image_url;
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.variantId === variant.id
                  ? {
                      ...l,
                      price: variant.price,
                      imageUrl,
                      maxQuantity,
                      problem: undefined,
                      quantity: clampQty(l.quantity + quantity, maxQuantity),
                    }
                  : l,
              ),
            };
          }
          return {
            lines: [
              ...state.lines,
              {
                variantId: variant.id,
                productId: product.id,
                slug: product.slug,
                nameEn: product.name_en,
                nameFr: product.name_fr,
                nameAr: product.name_ar,
                weightGrams: variant.weight_grams,
                price: variant.price,
                imageUrl,
                categorySlug,
                maxQuantity,
                quantity: clampQty(quantity, maxQuantity),
              },
            ],
          };
        }),
      setQuantity: (variantId, quantity) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.variantId === variantId
              ? { ...l, problem: undefined, quantity: clampQty(quantity, l.maxQuantity) }
              : l,
          ),
        })),
      remove: (variantId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.variantId !== variantId) })),
      clear: () => set({ lines: [] }),
      applyProblems: (problems) =>
        set((state) => ({
          lines: state.lines.map((l) => {
            const problem = problems.find((p) => p.variant_id === l.variantId);
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
      // v2: lines are per size (variant). Older carts held whole products and can't be
      // mapped to a size, so they start empty.
      version: 2,
      migrate: () => ({ lines: [] }),
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
