"use client";

import { PencilIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/admin-shell";
import { ErrorState, errorMessage, LoadingRows, Pager } from "@/components/admin/common";
import { listingPhoto, ProductImage } from "@/components/shop/product-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  useCategories,
  useLowStockThreshold,
  useProducts,
  useUpdateProduct,
} from "@/lib/admin-api";
import type { ProductAdmin } from "@/lib/api";
import { formatPrice, formatWeight, localizedName } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingRows />}>
      <Products />
    </Suspense>
  );
}

function Products() {
  const t = useTranslations("Admin.products");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const categories = useCategories();

  const q = sp.get("q") ?? "";
  const categoryId = sp.get("category") ? Number(sp.get("category")) : undefined;
  const availability = sp.get("available");
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const products = useProducts({
    q: q || undefined,
    category_id: categoryId,
    available: availability === null ? undefined : availability === "true",
    page,
    page_size: PAGE_SIZE,
  });
  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]));

  function setParams(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <Button asChild className="rounded-full">
            <Link href="/admin/products/new">
              <PlusIcon /> {t("new")}
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <form
          role="search"
          className="flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({
              q: String(new FormData(e.currentTarget).get("q") ?? "").trim() || undefined,
            });
          }}
        >
          <InputGroup className="bg-card">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              key={q}
              name="q"
              type="search"
              defaultValue={q}
              placeholder={t("search")}
              aria-label={t("search")}
            />
          </InputGroup>
        </form>
        <Select
          value={categoryId ? String(categoryId) : "all"}
          onValueChange={(v) => setParams({ category: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-full bg-card md:w-56" aria-label={t("category")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            {categories.data?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {localizedName(c, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={availability ?? "any"}
          onValueChange={(v) => setParams({ available: v === "any" ? undefined : v })}
        >
          <SelectTrigger className="w-full bg-card md:w-48" aria-label={t("available")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("allAvailability")}</SelectItem>
            <SelectItem value="true">{t("availableOnly")}</SelectItem>
            <SelectItem value="false">{t("unavailableOnly")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden py-0">
        {products.isError ? (
          <ErrorState error={products.error} onRetry={() => products.refetch()} />
        ) : products.isPending ? (
          <LoadingRows />
        ) : products.data.items.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-16 pl-4">
                  <span className="sr-only">{t("image")}</span>
                </TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("category")}</TableHead>
                <TableHead>{t("sizesStock")}</TableHead>
                <TableHead className="text-center">{t("available")}</TableHead>
                <TableHead className="hidden text-center md:table-cell">{t("featured")}</TableHead>
                <TableHead className="w-12 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody className={products.isPlaceholderData ? "opacity-60" : undefined}>
              {products.data.items.map((p) => {
                const category = categoryById.get(p.category_id);
                return (
                  <ProductRow
                    key={p.id}
                    product={p}
                    categoryName={category ? localizedName(category, locale) : "—"}
                    categorySlug={category?.slug}
                  />
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      {products.data && (
        <Pager
          page={page}
          total={products.data.total}
          pageSize={PAGE_SIZE}
          onChange={(p) => setParams({ page: String(p) })}
        />
      )}
    </>
  );
}

function ProductRow({
  product: p,
  categoryName,
  categorySlug,
}: {
  product: ProductAdmin;
  categoryName: string;
  categorySlug?: string;
}) {
  const t = useTranslations("Admin.products");
  const tCommon = useTranslations("Admin.common");
  const locale = useLocale();
  const update = useUpdateProduct();
  const name = localizedName(p, locale);
  const lowStock = useLowStockThreshold();

  function patch(body: Parameters<typeof update.mutate>[0], success: string) {
    update.mutate(body, {
      onSuccess: () => toast.success(success),
      onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
    });
  }

  return (
    <TableRow className={!p.is_available ? "bg-muted/40" : undefined}>
      <TableCell className="pl-4">
        <ProductImage
          imageUrl={listingPhoto(p)}
          alt=""
          hint={`${categorySlug ?? ""} ${p.slug}`}
          grams={p.variants[0]?.weight_grams}
          seed={p.id}
          sizes="48px"
          className="size-12 rounded-lg border"
        />
      </TableCell>
      <TableCell>
        <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">
          {name}
        </Link>
        <div className="text-xs text-muted-foreground">{p.brand ?? p.slug}</div>
      </TableCell>
      <TableCell className="hidden lg:table-cell">{categoryName}</TableCell>
      <TableCell>
        <ul className="flex flex-wrap gap-1.5">
          {p.variants.map((v) => (
            <li
              key={v.id}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs whitespace-nowrap tabular-nums",
                !v.is_available && "text-muted-foreground line-through",
                v.is_available && v.stock === 0 && "border-destructive/40 text-destructive",
                v.is_available &&
                  v.stock > 0 &&
                  v.stock <= lowStock &&
                  "border-honey/60 text-honey-ink",
              )}
              title={formatPrice(v.price, locale)}
            >
              {formatWeight(v.weight_grams, locale)} · {v.stock}
            </li>
          ))}
        </ul>
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={p.is_available}
          onCheckedChange={(is_available) => patch({ id: p.id, is_available }, t("saved"))}
          disabled={update.isPending}
          aria-label={`${t("available")} — ${name}`}
        />
      </TableCell>
      <TableCell className="hidden text-center md:table-cell">
        <Switch
          checked={p.is_featured}
          onCheckedChange={(is_featured) => patch({ id: p.id, is_featured }, t("saved"))}
          disabled={update.isPending}
          aria-label={`${t("featured")} — ${name}`}
        />
      </TableCell>
      <TableCell className="pr-4">
        <Button asChild variant="ghost" size="icon-sm" aria-label={`${t("edit")} — ${name}`}>
          <Link href={`/admin/products/${p.id}`}>
            <PencilIcon />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
