"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { use } from "react";

import { PageHeader } from "@/components/admin/admin-shell";
import { ErrorState, LoadingRows } from "@/components/admin/common";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useProduct } from "@/lib/admin-api";
import { localizedName } from "@/lib/format";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("Admin.products");
  const locale = useLocale();
  const product = useProduct(Number(id));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/products">
          <ArrowLeftIcon /> {t("back")}
        </Link>
      </Button>
      {product.isError ? (
        <ErrorState error={product.error} onRetry={() => product.refetch()} />
      ) : product.isPending ? (
        <LoadingRows rows={8} />
      ) : (
        <>
          <PageHeader title={localizedName(product.data, locale)} description={t("edit")} />
          {/* key: re-mount the form with fresh defaults if a different product loads */}
          <ProductForm key={product.data.id} product={product.data} />
        </>
      )}
    </>
  );
}
