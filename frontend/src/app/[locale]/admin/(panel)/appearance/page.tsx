"use client";

import { ImageUpIcon, RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/admin-shell";
import { ErrorState, errorMessage, LoadingRows } from "@/components/admin/common";
import { LogoMark } from "@/components/brand/logo";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import {
  type AppearanceSlot,
  useAppearance,
  useResetAppearanceImage,
  useUploadAppearanceImage,
} from "@/lib/admin-api";
import { DEFAULT_HERO_IMAGE } from "@/lib/appearance";

export default function AppearancePage() {
  const t = useTranslations("Admin.appearance");
  const appearance = useAppearance();

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {appearance.isError ? (
        <ErrorState error={appearance.error} onRetry={() => appearance.refetch()} />
      ) : appearance.isPending ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          <ImageSetting
            slot="logo"
            url={appearance.data.logo_image_url}
            preview={(src) =>
              src ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview
                <img
                  src={src}
                  alt={t("logo.preview")}
                  className="h-16 w-auto max-w-64 object-contain"
                />
              ) : (
                <span
                  className="inline-flex items-center gap-2"
                  role="img"
                  aria-label={t("logo.preview")}
                >
                  <LogoMark className="size-12" />
                  <span className="font-heading text-3xl font-semibold">Mordjane</span>
                </span>
              )
            }
          />
          <ImageSetting
            slot="hero"
            url={appearance.data.hero_image_url}
            preview={(src) => (
              <div className="aspect-[1376/768] w-full overflow-hidden rounded-2xl border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                <img
                  src={src ?? DEFAULT_HERO_IMAGE}
                  alt={t("hero.preview")}
                  className="size-full object-cover"
                />
              </div>
            )}
          />
        </div>
      )}
    </>
  );
}

/** One replaceable image: a preview of what the shop shows now, upload, and back to default. */
function ImageSetting({
  slot,
  url,
  preview,
}: {
  slot: AppearanceSlot;
  url: string | null;
  preview: (src: string | null) => React.ReactNode;
}) {
  const t = useTranslations("Admin.appearance");
  const tCommon = useTranslations("Admin.common");
  const router = useRouter();
  const upload = useUploadAppearanceImage();
  const reset = useResetAppearanceImage();
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = upload.isPending || reset.isPending;

  // The logo comes from the root layout: refresh it so this panel shows the new one too.
  const done = (message: string) => {
    toast.success(message);
    router.refresh();
  };

  async function onFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = ""; // picking the same file again still fires onChange
    if (!file) return;
    try {
      await upload.mutateAsync({ slot, file });
      done(t(`${slot}.uploaded`));
    } catch (err) {
      toast.error(errorMessage(err, tCommon("error")));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 font-heading text-lg">
          {t(`${slot}.title`)}
          <Badge variant={url ? "default" : "secondary"}>
            {url ? t("customBadge") : t("defaultBadge")}
          </Badge>
        </CardTitle>
        <CardDescription>{t(`${slot}.hint`)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="relative flex min-h-24 items-center justify-center rounded-2xl bg-muted/50 p-4">
          {preview(url)}
          {busy && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-background/60">
              <Spinner className="size-8 text-primary" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => onFile(e.target)}
          />
          <Button className="rounded-full" onClick={() => fileRef.current?.click()} disabled={busy}>
            {upload.isPending ? <Spinner /> : <ImageUpIcon />}
            {url ? t("replace") : t("upload")}
          </Button>
          {url && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="rounded-full" disabled={busy}>
                  <RotateCcwIcon /> {t("reset")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("resetTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t(`${slot}.resetBody`)}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      reset.mutate(slot, {
                        onSuccess: () => done(t("resetDone")),
                        onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
                      })
                    }
                  >
                    {t("reset")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
