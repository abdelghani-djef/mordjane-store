"use client";

import {
  MapPinnedIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/admin-shell";
import { ARABIC_FIELD, ErrorState, errorMessage, LoadingRows } from "@/components/admin/common";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useDeleteDelegation,
  useDeleteDeliveryCity,
  useDeliveryCities,
  useSaveDelegation,
  useSaveDeliveryCity,
} from "@/lib/admin-api";
import { ApiError, type DelegationAdmin, type DeliveryCityAdmin } from "@/lib/api";
import { localizedName } from "@/lib/format";
import { cn } from "@/lib/utils";

type Editing = DeliveryCityAdmin | "new" | null;
type EditingDelegation = DelegationAdmin | "new" | null;

const FEE_PATTERN = /^\d{1,9}(\.\d{1,3})?$/;

function matches(item: { name_en: string; name_fr: string; name_ar: string | null }, q: string) {
  return [item.name_fr, item.name_en, item.name_ar].some((n) => n?.toLowerCase().includes(q));
}

/**
 * Delivery areas: the 24 governorates, each with its fee, and the delegations customers pick
 * within them at checkout.
 */
export default function DeliveryAreasPage() {
  const t = useTranslations("Admin.delivery");
  const tCommon = useTranslations("Admin.common");
  const locale = useLocale();
  const cities = useDeliveryCities();
  const save = useSaveDeliveryCity();
  const remove = useDeleteDeliveryCity();
  const [editing, setEditing] = useState<Editing>(null);
  const [managing, setManaging] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  // A delegation's name finds its governorate too ("Carthage" → Tunis).
  const visible = (cities.data ?? []).filter(
    (c) => !q || matches(c, q) || c.delegations.some((d) => matches(d, q)),
  );
  const managed = cities.data?.find((c) => c.id === managing) ?? null;

  function patch(city: DeliveryCityAdmin, body: Record<string, unknown>, success: string) {
    save.mutate(
      { id: city.id, ...body },
      {
        onSuccess: () => toast.success(success),
        onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
      },
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button className="rounded-full" onClick={() => setEditing("new")}>
            <PlusIcon /> {t("new")}
          </Button>
        }
      />

      <InputGroup className="mb-4 bg-card md:max-w-xs">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
        />
      </InputGroup>

      <Card className="overflow-hidden py-0">
        {cities.isError ? (
          <ErrorState error={cities.error} onRetry={() => cities.refetch()} />
        ) : cities.isPending ? (
          <LoadingRows rows={8} />
        ) : visible.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="pl-4">{t("nameFr")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("nameEn")}</TableHead>
                <TableHead>{t("delegations")}</TableHead>
                <TableHead className="w-44">{t("fee")}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{t("orders")}</TableHead>
                <TableHead className="text-center">{t("active")}</TableHead>
                <TableHead className="w-24 pr-4">
                  <span className="sr-only">{tCommon("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => {
                const name = localizedName(c, locale);
                const active = c.delegations.filter((d) => d.is_active).length;
                // Checkout needs a delegation, so such a governorate isn't offered to customers.
                const hidden = c.is_active && active === 0;
                return (
                  <TableRow key={c.id} className={!c.is_active ? "bg-muted/40" : undefined}>
                    <TableCell className="pl-4 font-medium">{c.name_fr}</TableCell>
                    <TableCell className="hidden md:table-cell">{c.name_en}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className={hidden ? "border-destructive/40 text-destructive" : undefined}
                        onClick={() => setManaging(c.id)}
                        title={hidden ? t("noActiveDelegations") : undefined}
                        aria-label={`${t("manageDelegations")} — ${name} (${t("delegationCount", {
                          active,
                          total: c.delegations.length,
                        })})`}
                      >
                        {hidden ? <TriangleAlertIcon /> : <MapPinnedIcon />}
                        <span className="tabular-nums">
                          {active}/{c.delegations.length}
                        </span>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <FeeInput
                        value={c.fee}
                        label={`${t("fee")} — ${name}`}
                        disabled={save.isPending}
                        onCommit={(fee) => patch(c, { fee }, t("feeSaved"))}
                      />
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {c.order_count}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={c.is_active}
                        disabled={save.isPending}
                        aria-label={`${t("active")} — ${name}`}
                        onCheckedChange={(is_active) => patch(c, { is_active }, t("saved"))}
                      />
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditing(c)}
                          aria-label={`${t("edit")} — ${name}`}
                        >
                          <PencilIcon />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              aria-label={`${t("delete")} — ${name}`}
                            >
                              <Trash2Icon />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-white hover:bg-destructive/90"
                                onClick={() =>
                                  remove.mutate(c.id, {
                                    onSuccess: () => toast.success(t("deleted")),
                                    onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
                                  })
                                }
                              >
                                {t("delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <CityDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        editing={editing}
        onClose={() => setEditing(null)}
        nextSortOrder={(cities.data?.length ?? 0) + 1}
      />

      <Sheet open={managed !== null} onOpenChange={(open) => !open && setManaging(null)}>
        <SheetContent className="flex w-full flex-col gap-0 data-[side=right]:sm:max-w-lg">
          {managed && <DelegationsPanel key={managed.id} city={managed} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Edit the fee in place: commits on Enter or blur, Escape reverts. */
function FeeInput({
  value,
  label,
  disabled,
  onCommit,
}: {
  value: string;
  label: string;
  disabled?: boolean;
  onCommit: (fee: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && !FEE_PATTERN.test(draft.trim());

  function commit() {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (FEE_PATTERN.test(next) && Number(next) !== Number(value)) onCommit(next);
  }

  return (
    <InputGroup className="h-8 w-36">
      <InputGroupInput
        inputMode="decimal"
        value={draft ?? value}
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalid}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDraft(null);
        }}
        className="tabular-nums"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>DT</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}

function CityDialog({
  editing,
  onClose,
  nextSortOrder,
}: {
  editing: Editing;
  onClose: () => void;
  nextSortOrder: number;
}) {
  const t = useTranslations("Admin.delivery");
  const tCommon = useTranslations("Admin.common");
  const save = useSaveDeliveryCity();
  const existing = editing && editing !== "new" ? editing : null;
  const [values, setValues] = useState({
    name_fr: existing?.name_fr ?? "",
    name_en: existing?.name_en ?? "",
    name_ar: existing?.name_ar ?? "",
    fee: existing?.fee ?? "",
    sort_order: String(existing?.sort_order ?? nextSortOrder),
    is_active: existing?.is_active ?? true,
  });
  const feeInvalid = values.fee !== "" && !FEE_PATTERN.test(values.fee.trim());

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (feeInvalid) return;
    try {
      await save.mutateAsync({
        id: existing?.id,
        ...values,
        name_en: values.name_en.trim() || values.name_fr.trim(),
        name_ar: values.name_ar.trim() || null,
        fee: values.fee.trim(),
        sort_order: Number(values.sort_order) || 0,
      });
      toast.success(t("saved"));
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, tCommon("error")));
    }
  }

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {existing ? t("edit") : t("new")}
            </DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="city-name-fr">{t("nameFr")}</FieldLabel>
              <Input
                id="city-name-fr"
                required
                value={values.name_fr}
                onChange={(e) => set("name_fr", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="city-name-en">{t("nameEn")}</FieldLabel>
              <Input
                id="city-name-en"
                value={values.name_en}
                placeholder={values.name_fr}
                onChange={(e) => set("name_en", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="city-name-ar">{t("nameAr")}</FieldLabel>
              <Input
                id="city-name-ar"
                {...ARABIC_FIELD}
                value={values.name_ar}
                onChange={(e) => set("name_ar", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={feeInvalid}>
                <FieldLabel htmlFor="city-fee">{t("fee")}</FieldLabel>
                <Input
                  id="city-fee"
                  required
                  inputMode="decimal"
                  placeholder="7.000"
                  value={values.fee}
                  aria-invalid={feeInvalid}
                  onChange={(e) => set("fee", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="city-sort">{t("sortOrder")}</FieldLabel>
                <Input
                  id="city-sort"
                  type="number"
                  value={values.sort_order}
                  onChange={(e) => set("sort_order", e.target.value)}
                />
              </Field>
            </div>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="city-active">{t("active")}</FieldLabel>
              <Switch
                id="city-active"
                checked={values.is_active}
                onCheckedChange={(v) => set("is_active", v)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending || feeInvalid}>
              {save.isPending && <Spinner />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A governorate's delegations: switch them on/off, rename, add and delete. */
function DelegationsPanel({ city }: { city: DeliveryCityAdmin }) {
  const t = useTranslations("Admin.delivery");
  const tCommon = useTranslations("Admin.common");
  const locale = useLocale();
  const save = useSaveDelegation(city.id);
  const remove = useDeleteDelegation();
  const [editing, setEditing] = useState<EditingDelegation>(null);
  const [query, setQuery] = useState("");

  const name = localizedName(city, locale);
  const collator = new Intl.Collator("fr");
  const delegations = [...city.delegations].sort((a, b) => collator.compare(a.name_fr, b.name_fr));
  const active = delegations.filter((d) => d.is_active).length;
  const q = query.trim().toLowerCase();
  const visible = delegations.filter((d) => !q || matches(d, q));

  function setActive(d: DelegationAdmin, is_active: boolean) {
    save.mutate(
      { id: d.id, is_active },
      {
        onSuccess: () => toast.success(t("delegationSaved")),
        onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
      },
    );
  }

  function onDelete(d: DelegationAdmin) {
    remove.mutate(d.id, {
      onSuccess: () => toast.success(t("delegationDeleted")),
      onError: (e) => {
        if (e instanceof ApiError && e.status === 409) {
          // Past orders point at it: the switch next to it hides it from checkout instead.
          // (No toast action: the sheet is modal, so a toast button can't be clicked.)
          toast.warning(t("delegationInUse", { name: d.name_fr }));
        } else toast.error(errorMessage(e, tCommon("error")));
      },
    });
  }

  return (
    <>
      <SheetHeader className="border-b pe-12">
        <SheetTitle className="font-heading text-xl">{t("delegationsOf", { name })}</SheetTitle>
        <SheetDescription>{t("delegationsText")}</SheetDescription>
        <Badge variant="secondary" className="mt-2 tabular-nums">
          {t("delegationCount", { active, total: delegations.length })}
        </Badge>
      </SheetHeader>

      <div className="flex flex-col gap-3 border-b p-4">
        {city.is_active && active === 0 && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-destructive"
          >
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            {t("noActiveDelegations")}
          </p>
        )}
        <div className="flex gap-2">
          <InputGroup className="flex-1">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchDelegations")}
              aria-label={t("searchDelegations")}
            />
          </InputGroup>
          <Button onClick={() => setEditing("new")}>
            <PlusIcon /> {t("newDelegation")}
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {visible.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">
            {delegations.length === 0 ? t("noDelegations") : t("noMatch")}
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map((d) => {
              const busy = save.isPending && save.variables?.id === d.id;
              return (
                <li
                  key={d.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5",
                    !d.is_active && "bg-muted/40",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate font-medium",
                        !d.is_active && "text-muted-foreground",
                      )}
                    >
                      {d.name_fr}
                    </p>
                    <p className="flex gap-2 truncate text-xs text-muted-foreground">
                      {d.name_en !== d.name_fr && <span>{d.name_en}</span>}
                      {d.name_ar && <span {...ARABIC_FIELD}>{d.name_ar}</span>}
                    </p>
                  </div>
                  <Switch
                    checked={d.is_active}
                    disabled={busy}
                    aria-label={`${t("delegationActive")} — ${d.name_fr}`}
                    onCheckedChange={(is_active) => setActive(d, is_active)}
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(d)}
                      aria-label={`${t("editDelegation")} — ${d.name_fr}`}
                    >
                      <PencilIcon />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          aria-label={`${t("delete")} — ${d.name_fr}`}
                        >
                          <Trash2Icon />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("deleteDelegationTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("deleteDelegationText")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => onDelete(d)}
                          >
                            {t("delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      <DelegationDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        cityId={city.id}
        editing={editing}
        onClose={() => setEditing(null)}
        nextSortOrder={Math.max(-1, ...city.delegations.map((d) => d.sort_order)) + 1}
      />
    </>
  );
}

function DelegationDialog({
  cityId,
  editing,
  onClose,
  nextSortOrder,
}: {
  cityId: number;
  editing: EditingDelegation;
  onClose: () => void;
  nextSortOrder: number;
}) {
  const t = useTranslations("Admin.delivery");
  const tCommon = useTranslations("Admin.common");
  const save = useSaveDelegation(cityId);
  const existing = editing && editing !== "new" ? editing : null;
  const [values, setValues] = useState({
    name_fr: existing?.name_fr ?? "",
    name_en: existing?.name_en ?? "",
    name_ar: existing?.name_ar ?? "",
    is_active: existing?.is_active ?? true,
  });

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nameFr = values.name_fr.trim();
    const body = {
      name_fr: nameFr,
      name_en: values.name_en.trim() || nameFr,
      name_ar: values.name_ar.trim() || null,
      is_active: values.is_active,
    };
    try {
      await save.mutateAsync(
        existing ? { id: existing.id, ...body } : { ...body, sort_order: nextSortOrder },
      );
      toast.success(existing ? t("delegationSaved") : t("delegationAdded", { name: nameFr }));
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, tCommon("error")));
    }
  }

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {existing ? t("editDelegation") : t("newDelegation")}
            </DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="delegation-name-fr">{t("nameFr")}</FieldLabel>
              <Input
                id="delegation-name-fr"
                required
                maxLength={120}
                value={values.name_fr}
                onChange={(e) => set("name_fr", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="delegation-name-en">{t("nameEn")}</FieldLabel>
              <Input
                id="delegation-name-en"
                maxLength={120}
                value={values.name_en}
                placeholder={values.name_fr}
                onChange={(e) => set("name_en", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="delegation-name-ar">{t("nameAr")}</FieldLabel>
              <Input
                id="delegation-name-ar"
                {...ARABIC_FIELD}
                maxLength={120}
                value={values.name_ar}
                onChange={(e) => set("name_ar", e.target.value)}
              />
              <FieldDescription>{t("nameArHint")}</FieldDescription>
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="delegation-active">{t("delegationActive")}</FieldLabel>
              <Switch
                id="delegation-active"
                checked={values.is_active}
                onCheckedChange={(v) => set("is_active", v)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending || !values.name_fr.trim()}>
              {save.isPending && <Spinner />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
