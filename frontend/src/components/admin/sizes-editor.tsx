"use client";

import { ImagePlusIcon, ImageUpIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { errorMessage } from "@/components/admin/common";
import { StockInput } from "@/components/admin/stock-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  useAddSize,
  useDeleteSize,
  useDeleteSizeImage,
  useUpdateSize,
  useUploadSizeImage,
} from "@/lib/admin-api";
import type { ProductAdmin, VariantAdmin, VariantPatch } from "@/lib/api";
import { formatWeight } from "@/lib/format";
import { cn } from "@/lib/utils";

export const PRICE_PATTERN = /^\d{1,9}(\.\d{1,3})?$/;

/**
 * Sizes of an existing product, edited live: each change saves on its own (price and stock
 * commit on Enter/blur). The weight identifies a size, so to change it add a new size and
 * switch the old one off.
 */
export function SizesEditor({ product }: { product: ProductAdmin }) {
  const t = useTranslations("Admin.products");
  const tCommon = useTranslations("Admin.common");
  const locale = useLocale();
  const update = useUpdateSize(product.id);
  const remove = useDeleteSize(product.id);

  function patch(size: VariantAdmin, body: VariantPatch, ok: string) {
    update.mutate(
      { ...body, id: size.id },
      {
        onSuccess: () => toast.success(ok),
        onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">{t("sizes")}</CardTitle>
        <CardDescription>
          {t("sizesHint")} {t("sizeImagesHint")}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">{t("photo")}</TableHead>
                <TableHead>{t("size")}</TableHead>
                <TableHead>{t("price")} (DT)</TableHead>
                <TableHead>{t("stock")}</TableHead>
                <TableHead className="text-center">{t("available")}</TableHead>
                <TableHead className="w-12 pr-(--card-spacing)">
                  <span className="sr-only">{tCommon("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.variants.map((v) => {
                const label = formatWeight(v.weight_grams, locale) ?? "";
                return (
                  <TableRow key={v.id} className={!v.is_available ? "bg-muted/40" : undefined}>
                    <TableCell className="pl-(--card-spacing)">
                      <SizePhoto
                        productId={product.id}
                        size={v}
                        fallbackUrl={product.image_url}
                        label={label}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="font-medium">{label}</span>
                    </TableCell>
                    <TableCell>
                      <InlineInput
                        value={v.price}
                        pattern={PRICE_PATTERN}
                        inputMode="decimal"
                        label={`${t("price")} — ${label}`}
                        disabled={update.isPending}
                        onCommit={(price) => patch(v, { price }, t("sizeSaved"))}
                      />
                    </TableCell>
                    <TableCell>
                      <StockInput
                        value={v.stock}
                        label={`${t("stock")} — ${label}`}
                        disabled={update.isPending}
                        onCommit={(stock) =>
                          patch(v, { stock, expected_stock: v.stock }, t("stockSaved"))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={v.is_available}
                        disabled={update.isPending}
                        aria-label={`${t("available")} — ${label}`}
                        onCheckedChange={(is_available) =>
                          patch(v, { is_available }, t("sizeSaved"))
                        }
                      />
                    </TableCell>
                    <TableCell className="pr-(--card-spacing)">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        aria-label={`${t("removeSize")} — ${label}`}
                        disabled={remove.isPending || product.variants.length <= 1}
                        onClick={() =>
                          remove.mutate(v.id, {
                            onSuccess: () => toast.success(t("sizeDeleted")),
                            onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
                          })
                        }
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <AddSizeForm productId={product.id} />
      </CardContent>
    </Card>
  );
}

/**
 * A size's packshot. The thumbnail opens the file picker; until the size has a photo of its
 * own, the shop shows the product photo, so it's drawn faded here.
 */
function SizePhoto({
  productId,
  size,
  fallbackUrl,
  label,
}: {
  productId: number;
  size: VariantAdmin;
  fallbackUrl: string | null;
  label: string;
}) {
  const t = useTranslations("Admin.products");
  const tCommon = useTranslations("Admin.common");
  const upload = useUploadSizeImage(productId);
  const remove = useDeleteSizeImage(productId);
  const fileRef = useRef<HTMLInputElement>(null);
  const own = size.image_url;
  const shown = own ?? fallbackUrl;
  const busy = upload.isPending || remove.isPending;
  const action = own ? t("replaceSizeImage") : t("uploadSizeImage");

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      await upload.mutateAsync({ id: size.id, file });
      toast.success(t("sizeImageUploaded"));
    } catch (e) {
      toast.error(errorMessage(e, tCommon("error")));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        aria-label={`${action} — ${label}`}
        title={!own && shown ? t("sizeImageInherited") : action}
        className={cn(
          "group/photo relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait",
          shown ? "bg-white" : "border-dashed bg-muted/50 text-muted-foreground",
        )}
      >
        {shown ? (
          <Image
            src={shown}
            alt=""
            fill
            sizes="48px"
            className={cn("object-contain p-[6%]", !own && "opacity-40")}
          />
        ) : (
          <ImagePlusIcon className="size-5" />
        )}
        <span
          className={cn(
            "absolute inset-0 grid place-items-center bg-foreground/55 text-background transition-opacity",
            busy
              ? "opacity-100"
              : "opacity-0 group-hover/photo:opacity-100 group-focus-visible/photo:opacity-100",
          )}
        >
          {busy ? <Spinner /> : <ImageUpIcon className="size-4" />}
        </span>
      </button>
      {own && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`${t("removeSizeImage")} — ${label}`}
          title={t("removeSizeImage")}
          disabled={busy}
          onClick={() =>
            remove.mutate(size.id, {
              onSuccess: () => toast.success(t("sizeImageRemoved")),
              onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
            })
          }
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}

function AddSizeForm({ productId }: { productId: number }) {
  const t = useTranslations("Admin.products");
  const tCommon = useTranslations("Admin.common");
  const add = useAddSize(productId);
  const [draft, setDraft] = useState({ weight: "", price: "", stock: "0" });
  const valid =
    /^\d+$/.test(draft.weight) &&
    Number(draft.weight) > 0 &&
    PRICE_PATTERN.test(draft.price) &&
    /^\d+$/.test(draft.stock);

  return (
    <form
      className="mt-2 grid grid-cols-2 items-end gap-3 border-t px-(--card-spacing) pt-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        add.mutate(
          {
            weight_grams: Number(draft.weight),
            price: draft.price,
            stock: Number(draft.stock),
            is_available: true,
            sort_order: 0,
          },
          {
            onSuccess: () => {
              toast.success(t("sizeAdded"));
              setDraft({ weight: "", price: "", stock: "0" });
            },
            onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
          },
        );
      }}
    >
      <Field>
        <FieldLabel htmlFor="new-size-weight">{t("weight")}</FieldLabel>
        <Input
          id="new-size-weight"
          inputMode="numeric"
          placeholder="200"
          value={draft.weight}
          onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="new-size-price">{t("price")} (DT)</FieldLabel>
        <Input
          id="new-size-price"
          inputMode="decimal"
          placeholder="7.900"
          value={draft.price}
          onChange={(e) => setDraft({ ...draft, price: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="new-size-stock">{t("stock")}</FieldLabel>
        <Input
          id="new-size-stock"
          inputMode="numeric"
          value={draft.stock}
          onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
        />
      </Field>
      <Button type="submit" variant="outline" disabled={!valid || add.isPending}>
        {add.isPending ? <Spinner /> : <PlusIcon />}
        {t("addSize")}
      </Button>
    </form>
  );
}

/** Text input that saves on Enter/blur when the value is valid and changed; Escape reverts. */
function InlineInput({
  value,
  pattern,
  label,
  disabled,
  onCommit,
  inputMode,
  className,
}: {
  value: string;
  pattern: RegExp;
  label: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
  inputMode?: "decimal" | "numeric";
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && !pattern.test(draft.trim());

  function commit() {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (!pattern.test(next)) return;
    // "" clears an optional field; otherwise compare numerically ("7.9" equals "7.900").
    const changed = next === "" ? value !== "" : Number(next) !== Number(value);
    if (changed) onCommit(next);
  }

  return (
    <Input
      value={draft ?? value}
      inputMode={inputMode}
      aria-label={label}
      aria-invalid={invalid}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") setDraft(null);
      }}
      className={className ?? "h-8 w-28 tabular-nums"}
    />
  );
}
