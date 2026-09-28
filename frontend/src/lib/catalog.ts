// Shared by the server-rendered catalog page and the client sort control. Plain values must
// not be exported from "use client" modules: server imports would receive client references.
export const SORT_KEYS = ["featured", "newest", "price_asc", "price_desc", "name"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
