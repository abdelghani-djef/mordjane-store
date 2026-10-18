"use client";

import { AlertTriangleIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/admin-shell";
import { ErrorState, errorMessage, LoadingRows } from "@/components/admin/common";
import { PackBox } from "@/components/shop/pack-box";
import { PackPrice } from "@/components/shop/pack-price";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { usePacks, useUpdatePack } from "@/lib/admin-api";
import type { PackAdmin } from "@/lib/api";
import { localizedName } from "@/lib/format";
import { contentsText, packContents, unitCount } from "@/lib/packs";

export default function PacksPage() {
  const t = useTranslations("Admin.packs");
  const packs = usePacks();

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <Button asChild className="rounded-full">
            <Link href="/admin/packs/new">
              <PlusIcon /> {t("new")}
            </Link>
          </Button>
        }
      />
      <Card className="overflow-hidden py-0">
        {packs.isError ? (
          <ErrorState error={packs.error} onRetry={() => packs.refetch()} />
        ) : packs.isPending ? (
          <LoadingRows />
        ) : packs.data.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-20 pl-4">
                  <span className="sr-only">{t("image")}</span>
                </TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("contents")}</TableHead>
                <TableHead>{t("price")}</TableHead>
                <TableHead className="text-center">{t("available")}</TableHead>
                <TableHead className="hidden text-center md:table-cell">{t("featured")}</TableHead>
                <TableHead className="w-12 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {packs.data.map((pack) => (
                <PackRow key={pack.id} pack={pack} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

function PackRow({ pack }: { pack: PackAdmin }) {
  const t = useTranslations("Admin.packs");
  const tCommon = useTranslations("Admin.common");
  const locale = useLocale();
  const update = useUpdatePack();
  const name = localizedName(pack, locale);
  const contents = packContents(pack);

  function patch(body: Parameters<typeof update.mutate>[0]) {
    update.mutate(body, {
      onSuccess: () => toast.success(t("saved")),
      onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
    });
  }

  return (
    <TableRow className={!pack.is_available ? "bg-muted/40" : undefined}>
      <TableCell className="pl-4">
        <PackBox
          imageUrl={pack.image_url}
          contents={contents}
          alt=""
          size="sm"
          sizes="64px"
          className="size-16 rounded-lg"
        />
      </TableCell>
      <TableCell>
        <Link href={`/admin/packs/${pack.id}`} className="font-medium hover:underline">
          {name}
        </Link>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{t("units", { count: unitCount(contents) })}</span>
          <span>{t("boxesLeft", { count: pack.boxes_left })}</span>
        </div>
        {pack.problem && (
          <Badge variant="outline" className="mt-1 border-honey/60 text-honey-ink">
            <AlertTriangleIcon /> {t(`problem.${pack.problem}`)}
          </Badge>
        )}
      </TableCell>
      <TableCell className="hidden max-w-sm text-sm whitespace-normal lg:table-cell">
        {contentsText(contents, locale)}
      </TableCell>
      <TableCell>
        <PackPrice
          price={pack.price}
          regularPrice={pack.regular_price}
          size="sm"
          showSaving={false}
        />
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={pack.is_available}
          onCheckedChange={(is_available) => patch({ id: pack.id, is_available })}
          disabled={update.isPending}
          aria-label={`${t("available")} — ${name}`}
        />
      </TableCell>
      <TableCell className="hidden text-center md:table-cell">
        <Switch
          checked={pack.is_featured}
          onCheckedChange={(is_featured) => patch({ id: pack.id, is_featured })}
          disabled={update.isPending}
          aria-label={`${t("featured")} — ${name}`}
        />
      </TableCell>
      <TableCell className="pr-4">
        <Button asChild variant="ghost" size="icon-sm" aria-label={`${t("edit")} — ${name}`}>
          <Link href={`/admin/packs/${pack.id}`}>
            <PencilIcon />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
