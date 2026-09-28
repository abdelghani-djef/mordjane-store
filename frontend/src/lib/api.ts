import type { components } from "./api-types";

type Schemas = components["schemas"];

export type Category = Schemas["CategoryOut"];
export type CategoryAdmin = Schemas["CategoryAdminOut"];
export type CategoryIn = Schemas["CategoryIn"];
export type CategoryPatch = Schemas["CategoryPatch"];
export type Product = Schemas["ProductOut"];
export type Variant = Schemas["VariantOut"];
export type VariantDetail = Schemas["VariantDetailOut"];
export type VariantAdmin = Schemas["VariantAdminOut"];
export type VariantIn = Schemas["VariantIn"];
export type VariantPatch = Schemas["VariantPatch"];
export type ProductDetail = Schemas["ProductDetailOut"];
export type ProductAdmin = Schemas["ProductAdminOut"];
export type ProductIn = Schemas["ProductIn"];
export type ProductPatch = Schemas["ProductPatch"];
export type ProductPage = Schemas["Page_ProductOut_"];
export type ProductAdminPage = Schemas["Page_ProductAdminOut_"];
export type OrderIn = Schemas["OrderIn"];
export type OrderCreated = Schemas["OrderCreatedOut"];
export type OrderConflict = Schemas["OrderConflictOut"];
export type StockProblem = Schemas["StockProblem"];
export type OrderTrack = Schemas["OrderTrackOut"];
export type OrderAdmin = Schemas["OrderAdminOut"];
export type OrderSummary = Schemas["OrderSummaryOut"];
export type OrderSummaryPage = Schemas["Page_OrderSummaryOut_"];
export type OrderStatus = Schemas["OrderStatus"];
export type AdminStats = Schemas["AdminStatsOut"];
export type AdminUser = Schemas["AdminOut"];
export type NotificationSettings = Schemas["NotificationSettingsOut"];
export type NotificationSettingsIn = Schemas["NotificationSettingsIn"];
export type TestEmailResult = Schemas["TestEmailOut"];
export type DeliveryCity = Schemas["DeliveryCityOut"];
export type DeliveryCityAdmin = Schemas["DeliveryCityAdminOut"];
export type DeliveryCityIn = Schemas["DeliveryCityIn"];
export type DeliveryCityPatch = Schemas["DeliveryCityPatch"];
export type Delegation = Schemas["DelegationOut"];
export type DelegationAdmin = Schemas["DelegationAdminOut"];
export type DelegationIn = Schemas["DelegationIn"];
export type DelegationPatch = Schemas["DelegationPatch"];

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "validated",
  "shipped",
  "delivered",
  "cancelled",
];

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(ApiError.describe(status, body));
  }

  /** FastAPI returns `{detail: string}` or `{detail: [{msg, loc}]}` for validation errors. */
  static describe(status: number, body: unknown): string {
    const detail = (body as { detail?: unknown } | null)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((d: { msg?: string; loc?: unknown[] }) =>
          [d.loc?.slice(1).join("."), d.msg].filter(Boolean).join(": "),
        )
        .join("; ");
    }
    return `Request failed (${status})`;
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Browser-side call through the Next.js `/api` rewrite (same origin, so the admin cookie
 * travels automatically).
 */
export async function api<T>(
  path: string,
  init: Omit<RequestInit, "body"> & { query?: Query; json?: unknown; body?: BodyInit } = {},
): Promise<T> {
  const { query, json, headers, ...rest } = init;
  const res = await fetch(withQuery(`/api${path}`, query), {
    credentials: "same-origin",
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : init.body,
  });
  return parse<T>(res);
}
