"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { use } from "react";

import { PageHeader } from "@/components/admin/admin-shell";
import { ErrorState, LoadingRows } from "@/components/admin/common";
import { PackForm } from "@/components/admin/pack-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { usePack } from "@/lib/admin-api";
import { localizedName } from "@/lib/format";

export default function EditPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("Admin.packs");
  const locale = useLocale();
  const pack = usePack(Number(id));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/packs">
          <ArrowLeftIcon /> {t("back")}
        </Link>
      </Button>
      {pack.isError ? (
        <ErrorState error={pack.error} onRetry={() => pack.refetch()} />
      ) : pack.isPending ? (
        <LoadingRows rows={8} />
      ) : (
        <>
          <PageHeader title={localizedName(pack.data, locale)} description={t("edit")} />
          {/* key: re-mount the form with fresh defaults if a different pack loads */}
          <PackForm key={pack.data.id} pack={pack.data} />
        </>
      )}
    </>
  );
}
