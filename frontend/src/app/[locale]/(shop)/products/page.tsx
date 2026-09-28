import { ChevronLeftIcon, ChevronRightIcon, SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CatalogSearch, CatalogSort } from "@/components/shop/catalog-controls";
import { asLocale, resolveLocale } from "@/i18n/locale";
import { ProductCard, ProductGrid } from "@/components/shop/product-card";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Link } from "@/i18n/navigation";
import type { Category, ProductPage } from "@/lib/api";
import { SORT_KEYS, type SortKey } from "@/lib/catalog";
import { localizedName } from "@/lib/format";
import { serverApi } from "@/lib/server-api";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/products">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "Catalog" });
  return { title: t("title") };
}

export default async function ProductsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/products">) {
  const locale = await resolveLocale(params);
  const sp = await searchParams;
  const t = await getTranslations("Catalog");

  const category = first(sp.category);
  const q = first(sp.q)?.trim() || undefined;
  const sortParam = first(sp.sort);
  const sort: SortKey = SORT_KEYS.includes(sortParam as SortKey)
    ? (sortParam as SortKey)
    : "featured";
  const page = Math.max(1, Number.parseInt(first(sp.page) ?? "1", 10) || 1);

  const [categories, result] = await Promise.all([
    serverApi<Category[]>("/categories"),
    serverApi<ProductPage>("/products", { category, q, sort, page, page_size: PAGE_SIZE }),
  ]);
  const active = categories.find((c) => c.slug === category);
  const slugById = new Map(categories.map((c) => [c.id, c.slug]));
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  const hrefWith = (changes: Record<string, string | number | undefined>) => {
    const query: Record<string, string> = {};
    const merged = {
      category,
      q,
      sort: sort === "featured" ? undefined : sort,
      page: undefined,
      ...changes,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "" && !(key === "page" && String(value) === "1")) {
        query[key] = String(value);
      }
    }
    return { pathname: "/products" as const, query };
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold sm:text-5xl">
          {active ? localizedName(active, locale) : t("title")}
        </h1>
        <p className="text-muted-foreground" aria-live="polite">
          {t("results", { count: result.total })}
          {q && <> {t("resultsFor", { query: q })}</>}
        </p>
      </header>

      <nav aria-label={t("categories")} className="-mx-4 mt-6 overflow-x-auto px-4 pb-1">
        <ul className="flex w-max gap-2">
          <li>
            <CategoryChip href={hrefWith({ category: undefined })} active={!category}>
              {t("allCategories")}
            </CategoryChip>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <CategoryChip href={hrefWith({ category: c.slug })} active={c.slug === category}>
                {localizedName(c, locale)}
              </CategoryChip>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Suspense>
          <CatalogSearch />
          <CatalogSort value={sort} />
        </Suspense>
      </div>

      <div className="mt-8">
        {result.items.length === 0 ? (
          <Empty className="rounded-3xl border bg-muted py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon />
              </EmptyMedia>
              <EmptyTitle className="font-heading text-xl">{t("emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("emptyText")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/products">{t("clearFilters")}</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ProductGrid>
            {result.items.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                categorySlug={slugById.get(product.category_id)}
                preload={i < 4 && page === 1}
              />
            ))}
          </ProductGrid>
        )}
      </div>

      {pages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-3" aria-label={t("pagination")}>
          <PageLink href={page > 1 ? hrefWith({ page: page - 1 }) : null}>
            <ChevronLeftIcon className="rtl:rotate-180" /> {t("previous")}
          </PageLink>
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("pageOf", { page, pages })}
          </span>
          <PageLink href={page < pages ? hrefWith({ page: page + 1 }) : null}>
            {t("next")} <ChevronRightIcon className="rtl:rotate-180" />
          </PageLink>
        </nav>
      )}
    </div>
  );
}

type ProductsHref = { pathname: "/products"; query: Record<string, string> };

function PageLink({ href, children }: { href: ProductsHref | null; children: React.ReactNode }) {
  if (!href) {
    return (
      <Button variant="outline" className="rounded-full" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" className="rounded-full">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function CategoryChip({
  href,
  active,
  children,
}: {
  href: ProductsHref;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-foreground/80 hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}
