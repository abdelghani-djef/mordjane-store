"use client";

import { SearchIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";

import { PageHeader } from "@/components/admin/admin-shell";
import { ErrorState, LoadingRows, Pager } from "@/components/admin/common";
import { StatusBadge } from "@/components/shop/status-timeline";
import { Card } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useOrders } from "@/lib/admin-api";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/api";
import { deliveryArea, formatDateTime, formatPrice } from "@/lib/format";

const PAGE_SIZE = 25;

export default function OrdersPage() {
  return (
    <Suspense fallback={<LoadingRows />}>
      <Orders />
    </Suspense>
  );
}

function Orders() {
  const t = useTranslations("Admin.orders");
  const tStatus = useTranslations("Status");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const statusParam = sp.get("status");
  const status = ORDER_STATUSES.includes(statusParam as OrderStatus)
    ? (statusParam as OrderStatus)
    : undefined;
  const q = sp.get("q") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const orders = useOrders({ status, q: q || undefined, page, page_size: PAGE_SIZE });

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
      <PageHeader title={t("title")} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={status ?? "all"}
          onValueChange={(v) => setParams({ status: v === "all" ? undefined : v })}
        >
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="all">{t("all")}</TabsTrigger>
            {ORDER_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s}>
                {tStatus(s)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <form
          role="search"
          className="w-full lg:max-w-xs"
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
      </div>

      <Card className="overflow-hidden py-0">
        {orders.isError ? (
          <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
        ) : orders.isPending ? (
          <LoadingRows />
        ) : orders.data.items.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="pl-4">{t("code")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("customer")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("area")}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{t("items")}</TableHead>
                <TableHead className="text-right">{t("total")}</TableHead>
                <TableHead className="pr-4">{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={orders.isPlaceholderData ? "opacity-60" : undefined}>
              {orders.data.items.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/orders/${o.id}`)}
                >
                  <TableCell className="pl-4 font-medium tabular-nums">
                    {/* Real link for keyboard / middle-click; the row click is a convenience. */}
                    <a
                      href={`/${locale}/admin/orders/${o.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                    >
                      {o.code}
                    </a>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(o.created_at, locale)}
                  </TableCell>
                  <TableCell>
                    <bdi className="block font-medium">{o.customer_name}</bdi>
                    <div className="text-xs text-muted-foreground">{o.phone}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{deliveryArea(o)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {o.item_count}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatPrice(o.total, locale)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <StatusBadge status={o.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {orders.data && (
        <Pager
          page={page}
          total={orders.data.total}
          pageSize={PAGE_SIZE}
          onChange={(p) => setParams({ page: String(p) })}
        />
      )}
    </>
  );
}
