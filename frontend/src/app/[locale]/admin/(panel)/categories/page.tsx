"use client";

import { ImageUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/admin-shell";
import { ARABIC_FIELD, ErrorState, errorMessage, LoadingRows } from "@/components/admin/common";
import { ProductArt } from "@/components/brand/product-art";
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
  useCategories,
  useDeleteCategory,
  useSaveCategory,
  useUploadCategoryImage,
} from "@/lib/admin-api";
import type { CategoryAdmin } from "@/lib/api";
import { localizedName, slugify } from "@/lib/format";

type Editing = CategoryAdmin | "new" | null;

export default function CategoriesPage() {
  const t = useTranslations("Admin.categories");
  const tCommon = useTranslations("Admin.common");
  const locale = useLocale();
  const categories = useCategories();
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <Button className="rounded-full" onClick={() => setEditing("new")}>
            <PlusIcon /> {t("new")}
          </Button>
        }
      />

      <Card className="overflow-hidden py-0">
        {categories.isError ? (
          <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
        ) : categories.isPending ? (
          <LoadingRows rows={5} />
        ) : categories.data.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-16 pl-4">
                  <span className="sr-only">{t("image")}</span>
                </TableHead>
                <TableHead>{t("nameEn")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("nameFr")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("slug")}</TableHead>
                <TableHead className="text-right">{t("products")}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{t("sortOrder")}</TableHead>
                <TableHead className="text-center">{t("active")}</TableHead>
                <TableHead className="w-24 pr-4">
                  <span className="sr-only">{tCommon("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.data.map((c) => (
                <TableRow key={c.id} className={!c.is_active ? "bg-muted/40" : undefined}>
                  <TableCell className="pl-4">
                    <div className="size-12 overflow-hidden rounded-lg border">
                      {c.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- tiny admin thumb
                        <img src={c.image_url} alt="" className="size-full object-cover" />
                      ) : (
                        <ProductArt hint={c.slug} seed={c.slug} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{c.name_en}</TableCell>
                  <TableCell className="hidden md:table-cell">{c.name_fr}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground tabular-nums sm:table-cell">
                    {c.slug}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.product_count}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {c.sort_order}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={c.is_active}
                      disabled={save.isPending}
                      aria-label={`${t("active")} — ${localizedName(c, locale)}`}
                      onCheckedChange={(is_active) =>
                        save.mutate(
                          { id: c.id, is_active },
                          {
                            onSuccess: () => toast.success(t("saved")),
                            onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
                          },
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditing(c)}
                        aria-label={`${t("edit")} — ${c.name_en}`}
                      >
                        <PencilIcon />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive"
                            aria-label={`${t("delete")} — ${c.name_en}`}
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
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CategoryDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        editing={editing}
        onClose={() => setEditing(null)}
        nextSortOrder={(categories.data?.length ?? 0) + 1}
      />
    </>
  );
}

function CategoryDialog({
  editing,
  onClose,
  nextSortOrder,
}: {
  editing: Editing;
  onClose: () => void;
  nextSortOrder: number;
}) {
  const t = useTranslations("Admin.categories");
  const tProducts = useTranslations("Admin.products");
  const tCommon = useTranslations("Admin.common");
  const save = useSaveCategory();
  const upload = useUploadCategoryImage();
  const fileRef = useRef<HTMLInputElement>(null);
  const existing = editing && editing !== "new" ? editing : null;

  const [values, setValues] = useState({
    name_en: existing?.name_en ?? "",
    name_fr: existing?.name_fr ?? "",
    name_ar: existing?.name_ar ?? "",
    slug: existing?.slug ?? "",
    sort_order: String(existing?.sort_order ?? nextSortOrder),
    is_active: existing?.is_active ?? true,
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(existing));

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({
        id: existing?.id,
        ...values,
        name_ar: values.name_ar.trim() || null,
        sort_order: Number(values.sort_order) || 0,
      });
      toast.success(t("saved"));
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, tCommon("error")));
    }
  }

  async function onFile(file: File | undefined) {
    if (!file || !existing) return;
    try {
      await upload.mutateAsync({ id: existing.id, file });
      toast.success(tProducts("imageUploaded"));
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
              <FieldLabel htmlFor="cat-name-en">{t("nameEn")}</FieldLabel>
              <Input
                id="cat-name-en"
                required
                value={values.name_en}
                onChange={(e) => {
                  set("name_en", e.target.value);
                  if (!slugTouched) set("slug", slugify(e.target.value));
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cat-name-fr">{t("nameFr")}</FieldLabel>
              <Input
                id="cat-name-fr"
                required
                value={values.name_fr}
                onChange={(e) => set("name_fr", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cat-name-ar">{t("nameAr")}</FieldLabel>
              <Input
                id="cat-name-ar"
                {...ARABIC_FIELD}
                value={values.name_ar}
                onChange={(e) => set("name_ar", e.target.value)}
              />
              <FieldDescription>{tProducts("arabicHint")}</FieldDescription>
            </Field>
            <div className="grid grid-cols-[2fr_1fr] gap-4">
              <Field>
                <FieldLabel htmlFor="cat-slug">{t("slug")}</FieldLabel>
                <Input
                  id="cat-slug"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={values.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value);
                  }}
                  className="tabular-nums"
                />
                <FieldDescription>{tProducts("slugHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="cat-sort">{t("sortOrder")}</FieldLabel>
                <Input
                  id="cat-sort"
                  type="number"
                  value={values.sort_order}
                  onChange={(e) => set("sort_order", e.target.value)}
                />
              </Field>
            </div>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="cat-active">{t("active")}</FieldLabel>
              <Switch
                id="cat-active"
                checked={values.is_active}
                onCheckedChange={(v) => set("is_active", v)}
              />
            </Field>
            {existing && (
              <Field>
                <FieldLabel>{t("image")}</FieldLabel>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={upload.isPending}
                  className="self-start"
                >
                  {upload.isPending ? <Spinner /> : <ImageUpIcon />}
                  {existing.image_url ? tProducts("replaceImage") : tProducts("uploadImage")}
                </Button>
                <FieldDescription>{tProducts("imageHint")}</FieldDescription>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spinner />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
