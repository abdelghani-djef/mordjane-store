"use client";

import { AlertTriangleIcon, BanknoteIcon, ClockIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { PageHeader } from "@/components/admin/admin-shell";
import { ErrorState, LoadingRows } from "@/components/admin/common";
import { StatusBadge } from "@/components/shop/status-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { useOrders, useStats } from "@/lib/admin-api";
import { ORDER_STATUSES } from "@/lib/api";
import {
  deliveryArea,
  formatDateTime,
  formatPrice,
  formatWeight,
  localizedName,
} from "@/lib/format";

export default function DashboardPage() {
  const t = useTranslations("Admin");
  const tStatus = useTranslations("Status");
  const locale = useLocale();
  const stats = useStats();
  const pendingOrders = useOrders({ status: "pending", page: 1, page_size: 6 });

  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />;

  const counts = stats.data?.orders_by_status;

  return (
    <>
      <PageHeader title={t("nav.dashboard")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-none bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="font-sans text-sm font-medium text-primary-foreground/80">
              {t("dashboard.revenue")}
            </CardTitle>
            <CardAction>
              <BanknoteIcon className="size-5 text-honey" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="price text-3xl font-semibold">
              {stats.data ? formatPrice(stats.data.revenue_delivered, locale) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-honey/50 bg-accent/50">
          <CardHeader>
            <CardTitle className="font-sans text-sm font-medium">
              {t("dashboard.needsAction")}
            </CardTitle>
            <CardAction>
              <ClockIcon className="size-5 text-honey-ink" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-semibold tabular-nums">
              {counts?.pending ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="font-sans text-sm font-medium">{t("orders.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-5 gap-y-2">
            {ORDER_STATUSES.map((s) => (
              <Link
                key={s}
                href={{ pathname: "/admin/orders", query: { status: s } }}
                className="flex items-center gap-2 rounded-md hover:underline"
              >
                <StatusBadge status={s} />
                <span className="font-semibold tabular-nums">{counts?.[s] ?? 0}</span>
                <span className="sr-only">{tStatus(s)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">{t("dashboard.recentPending")}</CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/orders">{t("dashboard.viewOrders")}</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {pendingOrders.isPending ? (
              <LoadingRows rows={4} />
            ) : pendingOrders.data?.items.length ? (
              <ul className="divide-y">
                {pendingOrders.data.items.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="flex items-center gap-4 px-6 py-3 hover:bg-muted/60"
                    >
                      <span className="text-sm font-medium tabular-nums">{o.code}</span>
                      <span className="min-w-0 flex-1 truncate">
                        <bdi>{o.customer_name}</bdi> ·{" "}
                        <span className="text-muted-foreground">{deliveryArea(o)}</span>
                      </span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {formatDateTime(o.created_at, locale)}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatPrice(o.total, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-8 text-center text-muted-foreground">
                {t("dashboard.noPending")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">{t("dashboard.lowStock")}</CardTitle>
            <CardAction>
              <AlertTriangleIcon className="size-5 text-honey-ink" />
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {!stats.data ? (
              <LoadingRows rows={4} />
            ) : stats.data.low_stock.length ? (
              <ul className="divide-y">
                {stats.data.low_stock.map((p) => (
                  <li key={p.variant_id}>
                    <Link
                      href={`/admin/products/${p.product_id}`}
                      className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted/60"
                    >
                      <span className="min-w-0 truncate">
                        {localizedName(p, locale)}{" "}
                        <span className="text-muted-foreground">
                          {formatWeight(p.weight_grams, locale)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {!p.is_available && (
                          <Badge variant="secondary">{t("products.unavailableOnly")}</Badge>
                        )}
                        <Badge
                          variant={p.stock === 0 ? "destructive" : "outline"}
                          className="tabular-nums"
                        >
                          {p.stock}
                        </Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-8 text-center text-muted-foreground">
                {t("dashboard.lowStockEmpty")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
