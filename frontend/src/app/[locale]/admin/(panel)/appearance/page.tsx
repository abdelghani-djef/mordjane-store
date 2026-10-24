"use client";

import { ImageUpIcon, RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/admin-shell";
import { ErrorState, errorMessage, LoadingRows } from "@/components/admin/common";
import { LogoView } from "@/components/brand/logo";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import {
  type AppearanceSlot,
  useAppearance,
  useResetAppearanceImage,
  useSaveAppearance,
  useUploadAppearanceImage,
} from "@/lib/admin-api";
import type { Appearance } from "@/lib/api";
import { DEFAULT_HERO_IMAGE } from "@/lib/appearance";

const MIN_HEIGHT = 24;
const MAX_HEIGHT = 96;

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
          {/* Re-mount with the saved size after each save. */}
          <LogoCard key={appearance.data.logo_height} appearance={appearance.data} />
          <HeroCard url={appearance.data.hero_image_url} />
        </div>
      )}
    </>
  );
}

function LogoCard({ appearance }: { appearance: Appearance }) {
  const t = useTranslations("Admin.appearance");
  const tCommon = useTranslations("Admin.common");
  const router = useRouter();
  const save = useSaveAppearance();
  const [height, setHeight] = useState(appearance.logo_height);
  const light = appearance.logo_image_url;
  const dark = appearance.logo_dark_image_url;

  function onSave() {
    save.mutate(
      { logo_height: height },
      {
        onSuccess: () => {
          toast.success(t("logo.sizeSaved"));
          router.refresh();
        },
        onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">{t("logo.title")}</CardTitle>
        <CardDescription>{t("logo.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <LogoTile
            slot="logo"
            label={t("logo.light")}
            url={light}
            note={light ? null : t("logo.lightDefault")}
            className="bg-[#FFFBF5] text-[#2b1d14]"
          >
            <LogoView light={light} dark={dark} height={height} theme="light" />
          </LogoTile>
          <LogoTile
            slot="logo-dark"
            label={t("logo.dark")}
            url={dark}
            note={dark ? null : light ? t("logo.darkSameAsLight") : t("logo.darkNeedsLight")}
            // Nothing to fall back from until there is a light logo to replace.
            disabled={!light}
            className="bg-[#1B130E] text-[#f6ead9]"
          >
            <LogoView light={light} dark={dark} height={height} theme="dark" />
          </LogoTile>
        </div>

        <Field>
          <FieldLabel htmlFor="logo-height">
            {t("logo.size")}
            <span className="ms-auto text-muted-foreground tabular-nums">{height} px</span>
          </FieldLabel>
          <input
            id="logo-height"
            type="range"
            min={MIN_HEIGHT}
            max={MAX_HEIGHT}
            step={2}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <FieldDescription>{t("logo.sizeHint")}</FieldDescription>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-full"
            onClick={onSave}
            disabled={height === appearance.logo_height || save.isPending}
          >
            {save.isPending && <Spinner />} {t("logo.saveSize")}
          </Button>
          {height !== appearance.logo_height && (
            <Button
              variant="ghost"
              className="rounded-full"
              onClick={() => setHeight(appearance.logo_height)}
            >
              {t("cancel")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** One theme's logo: a preview on that theme's background, then upload / back to default. */
function LogoTile({
  slot,
  label,
  url,
  note,
  disabled,
  className,
  children,
}: {
  slot: AppearanceSlot;
  label: string;
  url: string | null;
  note: string | null;
  disabled?: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("Admin.appearance");
  const image = useImageSlot(slot);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        {label}
        <Badge variant={url ? "default" : "secondary"}>
          {url ? t("customBadge") : t("defaultBadge")}
        </Badge>
      </div>
      <div
        className={`relative flex min-h-32 items-center justify-center overflow-hidden rounded-2xl border p-4 ${className}`}
      >
        {children}
        {image.busy && (
          <div className="absolute inset-0 grid place-items-center bg-black/30">
            <Spinner className="size-8 text-primary" />
          </div>
        )}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <div className="flex flex-wrap gap-2">
        {image.input}
        <Button
          size="sm"
          className="rounded-full"
          onClick={image.pick}
          disabled={image.busy || disabled}
        >
          {image.uploading ? <Spinner /> : <ImageUpIcon />}
          {url ? t("replace") : t("upload")}
        </Button>
        {url && (
          <ResetButton
            size="sm"
            body={t(`${slot}.resetBody`)}
            busy={image.busy}
            onConfirm={image.reset}
          />
        )}
      </div>
    </div>
  );
}

function HeroCard({ url }: { url: string | null }) {
  const t = useTranslations("Admin.appearance");
  const image = useImageSlot("hero");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 font-heading text-lg">
          {t("hero.title")}
          <Badge variant={url ? "default" : "secondary"}>
            {url ? t("customBadge") : t("defaultBadge")}
          </Badge>
        </CardTitle>
        <CardDescription>{t("hero.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="relative aspect-[1376/768] w-full overflow-hidden rounded-2xl border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
          <img
            src={url ?? DEFAULT_HERO_IMAGE}
            alt={t("hero.preview")}
            className="size-full object-cover"
          />
          {image.busy && (
            <div className="absolute inset-0 grid place-items-center bg-background/60">
              <Spinner className="size-8 text-primary" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {image.input}
          <Button className="rounded-full" onClick={image.pick} disabled={image.busy}>
            {image.uploading ? <Spinner /> : <ImageUpIcon />}
            {url ? t("replace") : t("upload")}
          </Button>
          {url && (
            <ResetButton body={t("hero.resetBody")} busy={image.busy} onConfirm={image.reset} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Upload and reset for one image, with the hidden file input to render next to its button. */
function useImageSlot(slot: AppearanceSlot) {
  const t = useTranslations("Admin.appearance");
  const tCommon = useTranslations("Admin.common");
  const router = useRouter();
  const upload = useUploadAppearanceImage();
  const reset = useResetAppearanceImage();
  const fileRef = useRef<HTMLInputElement>(null);

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

  return {
    input: (
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => onFile(e.target)}
      />
    ),
    pick: () => fileRef.current?.click(),
    reset: () =>
      reset.mutate(slot, {
        onSuccess: () => done(t("resetDone")),
        onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
      }),
    uploading: upload.isPending,
    busy: upload.isPending || reset.isPending,
  };
}

function ResetButton({
  body,
  busy,
  onConfirm,
  size,
}: {
  body: string;
  busy: boolean;
  onConfirm: () => void;
  size?: "sm";
}) {
  const t = useTranslations("Admin.appearance");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size={size} className="rounded-full" disabled={busy}>
          <RotateCcwIcon /> {t("reset")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("resetTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t("reset")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
