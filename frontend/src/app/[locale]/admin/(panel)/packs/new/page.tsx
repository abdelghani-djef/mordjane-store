"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/admin/admin-shell";
import { PackForm } from "@/components/admin/pack-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NewPackPage() {
  const t = useTranslations("Admin.packs");
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/packs">
          <ArrowLeftIcon /> {t("back")}
        </Link>
      </Button>
      <PageHeader title={t("new")} description={t("intro")} />
      <PackForm />
    </>
  );
}
