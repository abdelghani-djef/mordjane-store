"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import {
  api,
  type AdminStats,
  type AdminUser,
  type CategoryAdmin,
  type CategoryIn,
  type CategoryPatch,
  type DelegationAdmin,
  type DelegationIn,
  type DelegationPatch,
  type DeliveryCityAdmin,
  type DeliveryCityIn,
  type DeliveryCityPatch,
  type NotificationSettings,
  type NotificationSettingsIn,
  type TestEmailResult,
  type OrderAdmin,
  type OrderStatus,
  type OrderSummaryPage,
  type ProductAdmin,
  type ProductAdminPage,
  type ProductIn,
  type ProductPatch,
  type VariantIn,
  type VariantPatch,
} from "@/lib/api";

export const adminKeys = {
  me: ["admin", "me"] as const,
  stats: ["admin", "stats"] as const,
  orders: (filters: object) => ["admin", "orders", filters] as const,
  order: (id: number) => ["admin", "order", id] as const,
  products: (filters: object) => ["admin", "products", filters] as const,
  product: (id: number) => ["admin", "product", id] as const,
  categories: ["admin", "categories"] as const,
  cities: ["admin", "delivery-cities"] as const,
  notifications: ["admin", "notifications"] as const,
};

// --- auth ---------------------------------------------------------------------------------

export function useMe() {
  return useQuery({
    queryKey: adminKeys.me,
    queryFn: () => api<AdminUser>("/admin/auth/me"),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<AdminUser>("/admin/auth/login", { method: "POST", json: body }),
    onSuccess: (user) => qc.setQueryData(adminKeys.me, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/admin/auth/logout", { method: "POST" }),
    onSettled: () => qc.clear(),
  });
}

// --- orders -------------------------------------------------------------------------------

export type OrderFilters = { status?: OrderStatus; q?: string; page: number; page_size?: number };

export function useStats() {
  return useQuery({
    queryKey: adminKeys.stats,
    queryFn: () => api<AdminStats>("/admin/stats"),
    refetchInterval: 60_000,
  });
}

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: adminKeys.orders(filters),
    queryFn: () => api<OrderSummaryPage>("/admin/orders", { query: filters }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: adminKeys.order(id),
    queryFn: () => api<OrderAdmin>(`/admin/orders/${id}`),
  });
}

export function useChangeStatus(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { to_status: OrderStatus; note?: string }) =>
      api<OrderAdmin>(`/admin/orders/${id}/status`, { method: "POST", json: body }),
    onSuccess: (order) => {
      qc.setQueryData(adminKeys.order(id), order);
      invalidate(qc, ["admin", "orders"], adminKeys.stats, ["admin", "products"]);
    },
  });
}

// --- products -----------------------------------------------------------------------------

export type ProductFilters = {
  q?: string;
  category_id?: number;
  available?: boolean;
  page: number;
  page_size?: number;
};

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: adminKeys.products(filters),
    queryFn: () => api<ProductAdminPage>("/admin/products", { query: filters }),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: number | null) {
  return useQuery({
    queryKey: adminKeys.product(id ?? 0),
    queryFn: () => api<ProductAdmin>(`/admin/products/${id}`),
    enabled: id !== null,
  });
}

function onProductChanged(qc: ReturnType<typeof useQueryClient>, product?: ProductAdmin) {
  if (product) qc.setQueryData(adminKeys.product(product.id), product);
  invalidate(qc, ["admin", "products"], adminKeys.stats, adminKeys.categories);
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductIn) =>
      api<ProductAdmin>("/admin/products", { method: "POST", json: body }),
    onSuccess: (p) => onProductChanged(qc, p),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ProductPatch & { id: number }) =>
      api<ProductAdmin>(`/admin/products/${id}`, { method: "PATCH", json: body }),
    onSuccess: (p) => onProductChanged(qc, p),
    // e.g. 409 "stock changed since you loaded it": pull the fresh figures.
    onError: (_error, { id }) => invalidate(qc, ["admin", "products"], adminKeys.product(id)),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => onProductChanged(qc),
  });
}

export function useUploadProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const body = new FormData();
      body.append("file", file);
      return api<ProductAdmin>(`/admin/products/${id}/image`, { method: "POST", body });
    },
    onSuccess: (p) => onProductChanged(qc, p),
  });
}

// --- sizes (variants) ---------------------------------------------------------------------

function onSizeChanged(qc: ReturnType<typeof useQueryClient>, product: ProductAdmin) {
  qc.setQueryData(adminKeys.product(product.id), product);
  invalidate(qc, ["admin", "products"], adminKeys.stats);
}

export function useAddSize(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VariantIn) =>
      api<ProductAdmin>(`/admin/products/${productId}/variants`, { method: "POST", json: body }),
    onSuccess: (p) => onSizeChanged(qc, p),
  });
}

export function useUpdateSize(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: VariantPatch & { id: number }) =>
      api<ProductAdmin>(`/admin/variants/${id}`, { method: "PATCH", json: body }),
    onSuccess: (p) => onSizeChanged(qc, p),
    // e.g. 409 "stock changed since you loaded it": pull the fresh figures.
    onError: () => invalidate(qc, adminKeys.product(productId)),
  });
}

export function useDeleteSize(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<ProductAdmin>(`/admin/variants/${id}`, { method: "DELETE" }),
    onSuccess: (p) => onSizeChanged(qc, p),
    onError: () => invalidate(qc, adminKeys.product(productId)),
  });
}

/** Adds or replaces one size's own photo (the product photo stands in until then). */
export function useUploadSizeImage(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const body = new FormData();
      body.append("file", file);
      return api<ProductAdmin>(`/admin/variants/${id}/image`, { method: "POST", body });
    },
    onSuccess: (p) => onSizeChanged(qc, p),
    onError: () => invalidate(qc, adminKeys.product(productId)),
  });
}

export function useDeleteSizeImage(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<ProductAdmin>(`/admin/variants/${id}/image`, { method: "DELETE" }),
    onSuccess: (p) => onSizeChanged(qc, p),
    onError: () => invalidate(qc, adminKeys.product(productId)),
  });
}

// --- categories ---------------------------------------------------------------------------

export function useCategories() {
  return useQuery({
    queryKey: adminKeys.categories,
    queryFn: () => api<CategoryAdmin[]>("/admin/categories"),
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: (CategoryIn | CategoryPatch) & { id?: number }) =>
      id
        ? api<CategoryAdmin>(`/admin/categories/${id}`, { method: "PATCH", json: body })
        : api<CategoryAdmin>("/admin/categories", { method: "POST", json: body }),
    onSuccess: () => invalidate(qc, adminKeys.categories),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/admin/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(qc, adminKeys.categories),
  });
}

export function useUploadCategoryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const body = new FormData();
      body.append("file", file);
      return api<CategoryAdmin>(`/admin/categories/${id}/image`, { method: "POST", body });
    },
    onSuccess: () => invalidate(qc, adminKeys.categories),
  });
}

// --- delivery areas: governorates (the fee) and their delegations ------------------------

export function useDeliveryCities() {
  return useQuery({
    queryKey: adminKeys.cities,
    queryFn: () => api<DeliveryCityAdmin[]>("/admin/delivery-cities"),
  });
}

export function useSaveDeliveryCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: (DeliveryCityIn | DeliveryCityPatch) & { id?: number }) =>
      id
        ? api<DeliveryCityAdmin>(`/admin/delivery-cities/${id}`, { method: "PATCH", json: body })
        : api<DeliveryCityAdmin>("/admin/delivery-cities", { method: "POST", json: body }),
    onSuccess: () => invalidate(qc, adminKeys.cities),
  });
}

export function useDeleteDeliveryCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/admin/delivery-cities/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(qc, adminKeys.cities),
  });
}

// Delegations come back inside their governorate, so every change refetches the list. Waiting
// for it keeps the mutation pending (and the switch disabled) until the row shows the new state.

export function useSaveDelegation(cityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: (DelegationIn | DelegationPatch) & { id?: number }) =>
      id
        ? api<DelegationAdmin>(`/admin/delegations/${id}`, { method: "PATCH", json: body })
        : api<DelegationAdmin>(`/admin/delivery-cities/${cityId}/delegations`, {
            method: "POST",
            json: body,
          }),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.cities }),
  });
}

export function useDeleteDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/admin/delegations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.cities }),
  });
}

// --- notifications ------------------------------------------------------------------------

export function useNotificationSettings() {
  return useQuery({
    queryKey: adminKeys.notifications,
    queryFn: () => api<NotificationSettings>("/admin/notifications"),
  });
}

export function useSaveNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NotificationSettingsIn) =>
      api<NotificationSettings>("/admin/notifications", { method: "PUT", json: body }),
    onSuccess: (data) => {
      qc.setQueryData(adminKeys.notifications, data);
      // The low-stock threshold drives the dashboard and product lists.
      invalidate(qc, adminKeys.stats);
    },
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: (to?: string[]) =>
      api<TestEmailResult>("/admin/notifications/test", { method: "POST", json: { to } }),
  });
}

/** Stock at or below this is "low" (set on the Notifications page). */
export function useLowStockThreshold(): number {
  return useStats().data?.low_stock_threshold ?? 5;
}

function invalidate(qc: ReturnType<typeof useQueryClient>, ...keys: QueryKey[]) {
  for (const queryKey of keys) qc.invalidateQueries({ queryKey });
}
