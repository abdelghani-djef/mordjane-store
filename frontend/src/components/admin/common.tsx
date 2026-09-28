"use client";

import { AlertTriangleIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Arabic copy is typed right to left, even inside the English/French admin. */
export const ARABIC_FIELD = { dir: "rtl", lang: "ar" } as const;

export function Pager({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const t = useTranslations("Admin.common");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 pt-4">
      <span className="mr-2 text-sm text-muted-foreground tabular-nums">
        {t("pageOf", { page, pages })}
      </span>
      <Button variant="outline" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        <ChevronLeftIcon /> {t("previous")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
      >
        {t("next")} <ChevronRightIcon />
      </Button>
    </div>
  );
}

export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations("Admin.common");
  return (
    <div
      className="flex flex-col items-center gap-3 p-10 text-center text-destructive"
      role="alert"
    >
      <AlertTriangleIcon className="size-6" />
      <p>{error instanceof Error ? error.message : t("error")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

/** Surface API errors (FastAPI `detail`) as a readable string for toasts. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
