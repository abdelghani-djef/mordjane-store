"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/admin/admin-shell";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NewProductPage() {
  const t = useTranslations("Admin.products");
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/products">
          <ArrowLeftIcon /> {t("back")}
        </Link>
      </Button>
      <PageHeader title={t("new")} />
      <ProductForm />
    </>
  );
}
