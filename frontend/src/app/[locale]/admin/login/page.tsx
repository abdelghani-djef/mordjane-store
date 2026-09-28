"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { HeroSpreadArt } from "@/components/brand/product-art";
import { Alert } from "@/components/shop/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Link, useRouter } from "@/i18n/navigation";
import { useLogin, useMe } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export default function AdminLoginPage() {
  const t = useTranslations("Admin");
  const router = useRouter();
  const me = useMe();
  const login = useLogin();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me.data) router.replace("/admin");
  }, [me.data, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    try {
      await login.mutateAsync({
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      router.replace("/admin");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401 ? t("login.invalid") : t("common.error"),
      );
    }
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <Link href="/" className="self-start">
          <Logo tagline={t("title")} />
        </Link>
        <div className="flex flex-1 items-center justify-center">
          <form onSubmit={onSubmit} className="w-full max-w-sm">
            <h1 className="text-3xl font-semibold">{t("login.title")}</h1>
            <p className="mt-1 mb-8 text-muted-foreground">{t("login.subtitle")}</p>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">{t("login.email")}</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  className="h-10"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{t("login.password")}</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="h-10"
                />
              </Field>
              {error && (
                <Alert tone="destructive" icon={<AlertTriangleIcon />}>
                  {error}
                </Alert>
              )}
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-full"
                disabled={login.isPending}
              >
                {login.isPending && <Spinner />}
                {t("login.submit")}
              </Button>
            </FieldGroup>
          </form>
        </div>
      </div>
      <div className="hidden place-items-center bg-soft p-16 lg:grid">
        <HeroSpreadArt className="w-full max-w-md" />
      </div>
    </main>
  );
}
