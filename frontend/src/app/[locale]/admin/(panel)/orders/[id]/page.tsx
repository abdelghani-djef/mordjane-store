"use client";

import { ArrowLeftIcon, LanguagesIcon, MapPinIcon, PhoneIcon, UserIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { use, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/admin-shell";
import { ErrorState, errorMessage, LoadingRows } from "@/components/admin/common";
import { StatusBadge, StatusTimeline } from "@/components/shop/status-timeline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { useChangeStatus, useOrder } from "@/lib/admin-api";
import type { OrderAdmin, OrderStatus } from "@/lib/api";
import { deliveryArea, formatDateTime, formatPrice, formatWeight } from "@/lib/format";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const orderId = Number(id);
  const t = useTranslations("Admin.orders");
  const locale = useLocale();
  const order = useOrder(orderId);

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
      <Link href="/admin/orders">
        <ArrowLeftIcon /> {t("back")}
      </Link>
    </Button>
  );

  if (order.isError)
    return (
      <>
        {back}
        <ErrorState error={order.error} onRetry={() => order.refetch()} />
      </>
    );
  if (order.isPending)
    return (
      <>
        {back}
        <LoadingRows rows={8} />
      </>
    );

  const o = order.data;

  return (
    <>
      {back}
      <PageHeader
        title={<span className="tracking-wide tabular-nums">{o.code}</span>}
        description={formatDateTime(o.created_at, locale)}
        actions={<StatusBadge status={o.status} className="px-3 py-1 text-sm" />}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <StatusActions order={o} />

          <Card className="py-0">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="pl-4">{t("items")}</TableHead>
                  <TableHead className="text-right">×</TableHead>
                  <TableHead className="pr-4 text-right">{t("total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-4">
                      <div className="font-medium">
                        {locale === "fr" ? item.product_name_fr : item.product_name}
                        {item.weight_grams && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            {formatWeight(item.weight_grams, locale)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatPrice(item.unit_price, locale)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">
                      {formatPrice(item.line_total, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <dl className="flex flex-col gap-1.5 border-t bg-muted/50 p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("subtotal")}</dt>
                <dd className="tabular-nums">{formatPrice(o.subtotal, locale)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("deliveryFee")}</dt>
                <dd className="tabular-nums">{formatPrice(o.delivery_fee, locale)}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <dt className="font-medium">{t("total")}</dt>
                <dd className="price text-xl font-semibold">{formatPrice(o.total, locale)}</dd>
              </div>
            </dl>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">{t("customerInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="flex items-center gap-2">
                <UserIcon className="size-4 text-muted-foreground" /> <bdi>{o.customer_name}</bdi>
              </p>
              <p className="flex items-center gap-2">
                <PhoneIcon className="size-4 text-muted-foreground" />
                <a
                  href={`tel:${o.phone}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {o.phone}
                </a>
              </p>
              {o.email && <p className="pl-6 text-muted-foreground">{o.email}</p>}
              <p className="flex items-center gap-2 text-muted-foreground">
                <LanguagesIcon className="size-4" />
                {t(`orderedIn.${o.locale === "ar" || o.locale === "en" ? o.locale : "fr"}`)}
              </p>
              <Separator />
              <p className="flex items-start gap-2">
                <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {/* Customers on the Arabic shop type right to left. */}
                  <span dir="auto" className="block">
                    {o.address}
                  </span>
                  <span className="font-medium">{deliveryArea(o)}</span>
                </span>
              </p>
              {o.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1 text-sm font-medium text-muted-foreground">{t("notes")}</p>
                    <p dir="auto" className="rounded-md bg-muted p-2.5 whitespace-pre-line">
                      {o.notes}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline status={o.status} events={o.events} showNotes />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function StatusActions({ order }: { order: OrderAdmin }) {
  const t = useTranslations("Admin.orders");
  const tStatus = useTranslations("Status");
  const tCommon = useTranslations("Admin.common");
  const change = useChangeStatus(order.id);
  const [note, setNote] = useState("");
  const forward = order.allowed_transitions.filter((s) => s !== "cancelled");
  const canCancel = order.allowed_transitions.includes("cancelled");

  function submit(to: OrderStatus) {
    change.mutate(
      { to_status: to, note },
      {
        onSuccess: () => {
          setNote("");
          toast.success(t("updated", { status: tStatus(to) }));
        },
        onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
      },
    );
  }

  return (
    <Card className="border-honey/40">
      <CardHeader>
        <CardTitle className="font-heading text-lg">{t("actions")}</CardTitle>
      </CardHeader>
      <CardContent>
        {order.allowed_transitions.length === 0 ? (
          <p className="text-muted-foreground">{t("noActions")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="status-note">{t("note")}</FieldLabel>
              <Textarea
                id="status-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("notePlaceholder")}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {forward.map((s) => (
                <Button
                  key={s}
                  onClick={() => submit(s)}
                  disabled={change.isPending}
                  className="rounded-full"
                >
                  {change.isPending && change.variables?.to_status === s && <Spinner />}
                  {t("moveTo", { status: tStatus(s) })}
                </Button>
              ))}
              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      disabled={change.isPending}
                      className="rounded-full"
                    >
                      <XIcon /> {t("cancelOrder")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("cancelText")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("keepOrder")}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => submit("cancelled")}
                      >
                        {t("cancelOrder")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
