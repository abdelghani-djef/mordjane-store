"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImageMinusIcon, ImageUpIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ARABIC_FIELD, errorMessage } from "@/components/admin/common";
import { PRICE_PATTERN } from "@/components/admin/sizes-editor";
import { PackBox } from "@/components/shop/pack-box";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import {
  useCreatePack,
  useDeletePack,
  useDeletePackImage,
  useProducts,
  useUpdatePack,
  useUploadPackImage,
} from "@/lib/admin-api";
import type { PackAdmin, ProductAdmin } from "@/lib/api";
import { formatPrice, formatWeight, localizedName, slugify } from "@/lib/format";
import { unitCount, type PackContent } from "@/lib/packs";

const FORM_ID = "pack-form";

function makeSchema(t: ReturnType<typeof useTranslations<"Admin.packs">>) {
  const required = t("errors.required");
  const item = z.object({
    variant_id: z.string().min(1, t("errors.chooseItem")),
    quantity: z
      .string()
      .trim()
      .regex(/^[1-9]\d?$/, t("errors.quantity"))
      .refine((q) => Number(q) <= 50, t("errors.quantity")),
  });
  return z.object({
    slug: z
      .string()
      .trim()
      .min(1, required)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t("errors.slug")),
    name_en: z.string().trim().min(1, required).max(160),
    name_fr: z.string().trim().min(1, required).max(160),
    name_ar: z.string().trim().max(160),
    description_en: z.string(),
    description_fr: z.string(),
    description_ar: z.string(),
    price: z.string().trim().regex(PRICE_PATTERN, t("errors.price")),
    is_available: z.boolean(),
    is_featured: z.boolean(),
    items: z
      .array(item)
      .refine(
        (items) => new Set(items.map((i) => i.variant_id)).size === items.length,
        t("errors.duplicate"),
      )
      .refine(
        (items) => items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0) >= 2,
        t("errors.minItems"),
      ),
  });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

const EMPTY_ITEM = { variant_id: "", quantity: "1" };

function toFormValues(p?: PackAdmin): FormValues {
  return {
    slug: p?.slug ?? "",
    name_en: p?.name_en ?? "",
    name_fr: p?.name_fr ?? "",
    name_ar: p?.name_ar ?? "",
    description_en: p?.description_en ?? "",
    description_fr: p?.description_fr ?? "",
    description_ar: p?.description_ar ?? "",
    price: p ? Number(p.price).toFixed(3) : "",
    is_available: p?.is_available ?? true,
    is_featured: p?.is_featured ?? false,
    items: p
      ? p.items.map((i) => ({ variant_id: String(i.variant.id), quantity: String(i.quantity) }))
      : [EMPTY_ITEM, EMPTY_ITEM],
  };
}

/** Every size of every product, for the item picker and the live price. */
type SizeOption = {
  id: number;
  product: ProductAdmin;
  grams: number;
  price: number;
  imageUrl: string | null;
};

function sizeOptions(products: ProductAdmin[] | undefined): Map<number, SizeOption> {
  const options = new Map<number, SizeOption>();
  for (const product of products ?? []) {
    for (const v of product.variants) {
      options.set(v.id, {
        id: v.id,
        product,
        grams: v.weight_grams,
        price: Number(v.price),
        imageUrl: v.image_url ?? product.image_url,
      });
    }
  }
  return options;
}

export function PackForm({ pack }: { pack?: PackAdmin }) {
  const t = useTranslations("Admin.packs");
  const tCommon = useTranslations("Admin.common");
  const locale = useLocale();
  const router = useRouter();
  // The whole catalogue fits in one page (a few dozen products).
  const products = useProducts({ page: 1, page_size: 100 });
  const create = useCreatePack();
  const update = useUpdatePack();
  const remove = useDeletePack();
  const upload = useUploadPackImage();
  const removeImage = useDeletePackImage();
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: toFormValues(pack),
  });
  const items = useFieldArray({ control: form.control, name: "items" });
  const [watchedItems, watchedPrice] = useWatch({
    control: form.control,
    name: ["items", "price"],
  });

  const options = sizeOptions(products.data?.items);
  const chosen = watchedItems
    .map((i) => ({ option: options.get(Number(i.variant_id)), quantity: Number(i.quantity) || 0 }))
    .filter((c): c is { option: SizeOption; quantity: number } => !!c.option && c.quantity > 0);
  const regular = chosen.reduce((sum, c) => sum + c.option.price * c.quantity, 0);
  const price = PRICE_PATTERN.test(watchedPrice?.trim() ?? "") ? Number(watchedPrice) : null;
  const saved = price !== null ? regular - price : 0;
  const tooExpensive = price !== null && chosen.length > 0 && saved <= 0;
  const preview: PackContent[] = chosen.map(({ option, quantity }) => ({
    productId: option.product.id,
    slug: option.product.slug,
    nameEn: option.product.name_en,
    nameFr: option.product.name_fr,
    nameAr: option.product.name_ar,
    weightGrams: option.grams,
    imageUrl: option.imageUrl,
    quantity,
  }));

  async function onSubmit(values: FormValues) {
    if (tooExpensive) {
      form.setError("price", {
        message: t("errors.noSaving", { amount: formatPrice(regular, locale) }),
      });
      return;
    }
    const body = {
      ...values,
      name_ar: values.name_ar || null,
      items: values.items.map((i) => ({
        variant_id: Number(i.variant_id),
        quantity: Number(i.quantity),
      })),
    };
    try {
      if (pack) {
        const saved = await update.mutateAsync({ id: pack.id, ...body });
        form.reset(toFormValues(saved));
        toast.success(t("saved"));
      } else {
        // Position 0: the shop lists it by name among the others.
        const created = await create.mutateAsync({ ...body, sort_order: 0 });
        toast.success(t("saved"));
        router.replace(`/admin/packs/${created.id}`);
      }
    } catch (e) {
      toast.error(errorMessage(e, tCommon("error")));
    }
  }

  async function onFile(file: File | undefined) {
    if (!file || !pack) return;
    try {
      await upload.mutateAsync({ id: pack.id, file });
      toast.success(t("imageUploaded"));
    } catch (e) {
      toast.error(errorMessage(e, tCommon("error")));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const submitting = form.formState.isSubmitting;
  const itemsError = form.formState.errors.items?.root ?? form.formState.errors.items;

  const text = (
    name: "slug" | "name_en" | "name_fr" | "name_ar",
    label: string,
    opts: { hint?: string; onChange?: (v: string) => void; arabic?: boolean } = {},
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            id={name}
            {...(opts.arabic && ARABIC_FIELD)}
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={field.value}
            onChange={(e) => {
              field.onChange(e.target.value);
              opts.onChange?.(e.target.value);
            }}
            aria-invalid={fieldState.invalid}
          />
          {opts.hint && !fieldState.invalid && <FieldDescription>{opts.hint}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );

  const area = (name: "description_en" | "description_fr" | "description_ar", label: string) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field }) => (
        <Field>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Textarea id={name} rows={3} {...(name.endsWith("_ar") && ARABIC_FIELD)} {...field} />
        </Field>
      )}
    />
  );

  const toggle = (name: "is_available" | "is_featured", label: string, hint: string) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field }) => (
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <FieldDescription>{hint}</FieldDescription>
          </FieldContent>
          <Switch id={name} checked={field.value} onCheckedChange={field.onChange} />
        </Field>
      )}
    />
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t("contents")}</CardTitle>
            <CardDescription>{t("contentsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {items.fields.map((row, i) => (
              <div key={row.id} className="grid grid-cols-[1fr_5rem_auto] items-end gap-3">
                <Controller
                  name={`items.${i}.variant_id`}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`items.${i}.variant_id`} className={i ? "sr-only" : ""}>
                        {t("item")}
                      </FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          id={`items.${i}.variant_id`}
                          className="w-full"
                          aria-invalid={fieldState.invalid}
                        >
                          <SelectValue placeholder={t("chooseItem")} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.data?.items.map((product) => (
                            <SelectGroup key={product.id}>
                              <SelectLabel>{localizedName(product, locale)}</SelectLabel>
                              {product.variants.map((v) => (
                                <SelectItem key={v.id} value={String(v.id)}>
                                  {localizedName(product, locale)} ·{" "}
                                  {formatWeight(v.weight_grams, locale)} ·{" "}
                                  {formatPrice(v.price, locale)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name={`items.${i}.quantity`}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`items.${i}.quantity`} className={i ? "sr-only" : ""}>
                        {t("quantity")}
                      </FieldLabel>
                      <Input
                        id={`items.${i}.quantity`}
                        inputMode="numeric"
                        aria-invalid={fieldState.invalid}
                        {...field}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeItem")}
                  disabled={items.fields.length <= 1}
                  onClick={() => items.remove(i)}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            {itemsError?.message && <p className="text-sm text-destructive">{itemsError.message}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={() => items.append(EMPTY_ITEM)}>
                <PlusIcon /> {t("addItem")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("units", { count: unitCount(chosen) })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t("pricing")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted px-4 py-3">
                <span className="text-muted-foreground">{t("separately")}</span>
                <span className="price text-lg">{formatPrice(regular, locale)}</span>
              </div>
              <Controller
                name="price"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || tooExpensive}>
                    <FieldLabel htmlFor="price">{t("packPrice")}</FieldLabel>
                    <Input
                      id="price"
                      inputMode="decimal"
                      placeholder="19.900"
                      className="sm:w-48"
                      aria-invalid={fieldState.invalid || tooExpensive}
                      {...field}
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : tooExpensive ? (
                      <FieldError>
                        {t("errors.noSaving", { amount: formatPrice(regular, locale) })}
                      </FieldError>
                    ) : (
                      saved > 0 && (
                        <FieldDescription className="font-medium text-honey-ink">
                          {t("savingLine", {
                            amount: formatPrice(saved, locale),
                            percent: Math.round((saved / regular) * 100),
                          })}
                        </FieldDescription>
                      )
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t("details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                {text("name_en", t("nameEn"), {
                  // Suggest a URL name for new packs until the admin edits it themselves.
                  onChange: (v) => {
                    if (!pack && !form.getFieldState("slug").isDirty) {
                      form.setValue("slug", slugify(v));
                    }
                  },
                })}
                {text("name_fr", t("nameFr"))}
              </div>
              {text("name_ar", t("nameAr"), { hint: t("arabicHint"), arabic: true })}
              {text("slug", t("slug"), { hint: t("slugHint") })}
              {area("description_en", t("descriptionEn"))}
              {area("description_fr", t("descriptionFr"))}
              {area("description_ar", t("descriptionAr"))}
            </FieldGroup>
          </CardContent>
        </Card>
      </form>

      <div className="flex flex-col gap-6 lg:sticky lg:top-20">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t("image")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <PackBox
              imageUrl={pack?.image_url}
              contents={preview}
              alt=""
              sizes="320px"
              className="rounded-2xl border"
            />
            {pack ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  id="pack-image"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={upload.isPending}
                  >
                    {upload.isPending ? <Spinner /> : <ImageUpIcon />}
                    {pack.image_url ? t("replaceImage") : t("uploadImage")}
                  </Button>
                  {pack.image_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={removeImage.isPending}
                      onClick={() =>
                        removeImage.mutate(pack.id, {
                          onSuccess: () => toast.success(t("imageRemoved")),
                          onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
                        })
                      }
                    >
                      <ImageMinusIcon /> {t("removeImage")}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t("imageHint")}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("saveFirst")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t("visibility")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {toggle("is_available", t("available"), t("availableHint"))}
              {toggle("is_featured", t("featured"), t("featuredHint"))}
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            form={FORM_ID}
            size="lg"
            className="rounded-full"
            disabled={submitting}
          >
            {submitting && <Spinner />}
            {pack ? t("save") : t("create")}
          </Button>
          {pack && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={remove.isPending}>
                  <Trash2Icon /> {t("delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tCommon("no")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={() =>
                      remove.mutate(pack.id, {
                        onSuccess: () => {
                          toast.success(t("deleted"));
                          router.replace("/admin/packs");
                        },
                        onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
                      })
                    }
                  >
                    {t("delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
