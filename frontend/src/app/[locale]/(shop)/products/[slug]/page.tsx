import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ProductCard, ProductGrid } from "@/components/shop/product-card";
import { ProductView } from "@/components/shop/product-view";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { resolveLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import type { ProductDetail, ProductPage } from "@/lib/api";
import { localizedDescription, localizedName } from "@/lib/format";
import { serverApi, serverApiOrNull } from "@/lib/server-api";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/products/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await serverApiOrNull<ProductDetail>(`/products/${encodeURIComponent(slug)}`);
  if (!product) return {};
  return {
    title: localizedName(product, locale),
    description: localizedDescription(product, locale).slice(0, 160),
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/[locale]/products/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  // `?size=<id>` preselects a size (links from the home page's size story).
  const { size } = await searchParams;
  const sizeId = Number(Array.isArray(size) ? size[0] : size) || null;
  const t = await getTranslations("Product");

  const product = await serverApiOrNull<ProductDetail>(`/products/${encodeURIComponent(slug)}`);
  if (!product) notFound();

  const related = await serverApi<ProductPage>("/products", {
    category: product.category.slug,
    page_size: 5,
  });
  const relatedItems = related.items.filter((p) => p.id !== product.id).slice(0, 4);

  const name = localizedName(product, locale);
  const categoryName = localizedName(product.category, locale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">{t("home")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={{ pathname: "/products", query: { category: product.category.slug } }}>
                {categoryName}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="line-clamp-1">{name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-6">
        <ProductView product={product} initialSizeId={sizeId} />
      </div>

      {relatedItems.length > 0 && (
        <section className="mt-20">
          <h2 className="text-3xl">{t("related")}</h2>
          <div className="mt-6">
            <ProductGrid>
              {relatedItems.map((p) => (
                <ProductCard key={p.id} product={p} categorySlug={product.category.slug} />
              ))}
            </ProductGrid>
          </div>
        </section>
      )}
    </div>
  );
}
