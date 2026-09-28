"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUpIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ARABIC_FIELD, errorMessage } from "@/components/admin/common";
import { PRICE_PATTERN, SizesEditor } from "@/components/admin/sizes-editor";
import { ProductImage } from "@/components/shop/product-image";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import {
  useCategories,
  useCreateProduct,
  useDeleteProduct,
  useUpdateProduct,
  useUploadProductImage,
} from "@/lib/admin-api";
import type { ProductAdmin } from "@/lib/api";
import { localizedName, slugify } from "@/lib/format";

const FORM_ID = "product-form";

function makeSchema(t: ReturnType<typeof useTranslations<"Admin.products">>, isNew: boolean) {
  const required = t("errors.required");
  const size = z.object({
    weight_grams: z
      .string()
      .trim()
      .regex(/^[1-9]\d*$/, t("errors.weight")),
    price: z.string().trim().regex(PRICE_PATTERN, t("errors.price")),
    stock: z.string().trim().regex(/^\d+$/, t("errors.stock")),
  });
  return z.object({
    category_id: z.string().min(1, required),
    slug: z
      .string()
      .trim()
      .min(1, required)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t("errors.slug")),
    name_en: z.string().trim().min(1, required).max(160),
    name_fr: z.string().trim().min(1, required).max(160),
    name_ar: z.string().trim().max(160),
    brand: z.string().trim().max(80),
    description_en: z.string(),
    description_fr: z.string(),
    description_ar: z.string(),
    ingredients_en: z.string(),
    ingredients_fr: z.string(),
    ingredients_ar: z.string(),
    storage_en: z.string(),
    storage_fr: z.string(),
    storage_ar: z.string(),
    shelf_life_months: z
      .string()
      .trim()
      .regex(/^\d{0,3}$/, t("errors.shelfLife")),
    is_available: z.boolean(),
    is_featured: z.boolean(),
    // Sizes are part of the form only when creating; existing products edit them live.
    variants: (isNew ? z.array(size).min(1, t("errors.atLeastOneSize")) : z.array(size)).refine(
      (sizes) => new Set(sizes.map((s) => Number(s.weight_grams))).size === sizes.length,
      t("errors.duplicateWeight"),
    ),
  });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

const EMPTY_SIZE = { weight_grams: "", price: "", stock: "0" };

function toFormValues(p?: ProductAdmin): FormValues {
  return {
    category_id: p ? String(p.category_id) : "",
    slug: p?.slug ?? "",
    name_en: p?.name_en ?? "",
    name_fr: p?.name_fr ?? "",
    name_ar: p?.name_ar ?? "",
    brand: p?.brand ?? "",
    description_en: p?.description_en ?? "",
    description_fr: p?.description_fr ?? "",
    description_ar: p?.description_ar ?? "",
    ingredients_en: p?.ingredients_en ?? "",
    ingredients_fr: p?.ingredients_fr ?? "",
    ingredients_ar: p?.ingredients_ar ?? "",
    storage_en: p?.storage_en ?? "",
    storage_fr: p?.storage_fr ?? "",
    storage_ar: p?.storage_ar ?? "",
    shelf_life_months: p?.shelf_life_months ? String(p.shelf_life_months) : "",
    is_available: p?.is_available ?? true,
    is_featured: p?.is_featured ?? false,
    variants: p ? [] : [EMPTY_SIZE],
  };
}

export function ProductForm({ product }: { product?: ProductAdmin }) {
  const t = useTranslations("Admin.products");
  const tCommon = useTranslations("Admin.common");
  const locale = useLocale();
  const router = useRouter();
  const categories = useCategories();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const remove = useDeleteProduct();
  const upload = useUploadProductImage();
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(t, !product)),
    defaultValues: toFormValues(product),
  });
  const sizes = useFieldArray({ control: form.control, name: "variants" });

  async function onSubmit(values: FormValues) {
    const { variants, ...fields } = values;
    const body = {
      ...fields,
      category_id: Number(fields.category_id),
      brand: fields.brand || null,
      name_ar: fields.name_ar || null,
      shelf_life_months: fields.shelf_life_months ? Number(fields.shelf_life_months) : null,
    };
    try {
      if (product) {
        const saved = await update.mutateAsync({ id: product.id, ...body });
        form.reset(toFormValues(saved));
        toast.success(t("saved"));
      } else {
        const created = await create.mutateAsync({
          ...body,
          variants: variants.map((v, i) => ({
            weight_grams: Number(v.weight_grams),
            price: v.price,
            stock: Number(v.stock),
            is_available: true,
            sort_order: i,
          })),
        });
        toast.success(t("saved"));
        router.replace(`/admin/products/${created.id}`);
      }
    } catch (e) {
      toast.error(errorMessage(e, tCommon("error")));
    }
  }

  async function onFile(file: File | undefined) {
    if (!file || !product) return;
    try {
      await upload.mutateAsync({ id: product.id, file });
      toast.success(t("imageUploaded"));
    } catch (e) {
      toast.error(errorMessage(e, tCommon("error")));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const saving = form.formState.isSubmitting;
  const [watchedCategory, watchedSlug] = useWatch({
    control: form.control,
    name: ["category_id", "slug"],
  });
  const categorySlug = categories.data?.find((c) => String(c.id) === watchedCategory)?.slug;

  const text = (
    name: Exclude<keyof FormValues, "variants" | "is_available" | "is_featured">,
    label: string,
    opts: {
      hint?: string;
      onChange?: (v: string) => void;
      inputMode?: "numeric";
      arabic?: boolean;
    } = {},
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            id={name}
            inputMode={opts.inputMode}
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

  const area = (
    name:
      | "description_en"
      | "description_fr"
      | "description_ar"
      | "ingredients_en"
      | "ingredients_fr"
      | "ingredients_ar"
      | "storage_en"
      | "storage_fr"
      | "storage_ar",
    label: string,
    rows = 3,
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field }) => (
        <Field>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Textarea id={name} rows={rows} {...(name.endsWith("_ar") && ARABIC_FIELD)} {...field} />
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

  const sizesError = form.formState.errors.variants?.root ?? form.formState.errors.variants;

  return (
    // The <form> wraps only the product fields; the live sizes editor has its own forms and
    // the save button targets the product form by id.
    <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-6">
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} noValidate className="contents">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">{t("details")}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  {text("name_en", t("nameEn"), {
                    // Suggest a slug for new products until the admin edits it themselves.
                    onChange: (v) => {
                      if (!product && !form.getFieldState("slug").isDirty) {
                        form.setValue("slug", slugify(v));
                      }
                    },
                  })}
                  {text("name_fr", t("nameFr"))}
                </div>
                {text("name_ar", t("nameAr"), { hint: t("arabicHint"), arabic: true })}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Controller
                    name="category_id"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="category_id">{t("category")}</FieldLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            id="category_id"
                            className="w-full"
                            aria-invalid={fieldState.invalid}
                          >
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.data?.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {localizedName(c, locale)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                  {text("brand", t("brand"), { hint: t("brandHint") })}
                </div>
                {text("slug", t("slug"), { hint: t("slugHint") })}
                {area("description_en", t("descriptionEn"))}
                {area("description_fr", t("descriptionFr"))}
                {area("description_ar", t("descriptionAr"))}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">{t("productInfo")}</CardTitle>
              <CardDescription>{t("productInfoHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {area("ingredients_en", t("ingredientsEn"))}
                {area("ingredients_fr", t("ingredientsFr"))}
                {area("ingredients_ar", t("ingredientsAr"))}
                <div className="grid gap-4 sm:grid-cols-3">
                  {area("storage_en", t("storageEn"), 2)}
                  {area("storage_fr", t("storageFr"), 2)}
                  {area("storage_ar", t("storageAr"), 2)}
                </div>
                <div className="sm:w-1/2">
                  {text("shelf_life_months", t("shelfLife"), {
                    hint: t("shelfLifeHint"),
                    inputMode: "numeric",
                  })}
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          {!product && (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">{t("sizes")}</CardTitle>
                <CardDescription>{t("sizesNewHint")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {sizes.fields.map((row, i) => (
                  <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3">
                    <SizeField
                      form={form}
                      name={`variants.${i}.weight_grams`}
                      label={t("weight")}
                      placeholder="200"
                    />
                    <SizeField
                      form={form}
                      name={`variants.${i}.price`}
                      label={`${t("price")} (DT)`}
                      placeholder="7.900"
                    />
                    <SizeField form={form} name={`variants.${i}.stock`} label={t("stock")} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("removeSize")}
                      disabled={sizes.fields.length <= 1}
                      onClick={() => sizes.remove(i)}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
                {sizesError?.message && (
                  <p className="text-sm text-destructive">{sizesError.message}</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() => sizes.append(EMPTY_SIZE)}
                >
                  <PlusIcon /> {t("addSize")}
                </Button>
              </CardContent>
            </Card>
          )}
        </form>

        {product && <SizesEditor product={product} />}
      </div>

      <div className="flex flex-col gap-6 lg:sticky lg:top-20">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t("image")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ProductImage
              imageUrl={product?.image_url}
              alt=""
              hint={`${categorySlug ?? ""} ${watchedSlug}`}
              grams={product?.variants[0]?.weight_grams}
              seed={product?.id ?? watchedSlug}
              sizes="320px"
              className="rounded-xl border"
            />
            {product ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  id="product-image"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={upload.isPending}
                >
                  {upload.isPending ? <Spinner /> : <ImageUpIcon />}
                  {product.image_url ? t("replaceImage") : t("uploadImage")}
                </Button>
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
          <Button type="submit" form={FORM_ID} size="lg" className="rounded-full" disabled={saving}>
            {saving && <Spinner />}
            {product ? t("save") : t("create")}
          </Button>
          {product && (
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
                      remove.mutate(product.id, {
                        onSuccess: () => {
                          toast.success(t("deleted"));
                          router.replace("/admin/products");
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

type SizeFieldName = `variants.${number}.${"weight_grams" | "price" | "stock"}`;

function SizeField({
  form,
  name,
  label,
  placeholder,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  name: SizeFieldName;
  label: string;
  placeholder?: string;
}) {
  return (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            id={name}
            inputMode={name.endsWith("price") ? "decimal" : "numeric"}
            placeholder={placeholder}
            aria-invalid={fieldState.invalid}
            {...field}
          />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}
