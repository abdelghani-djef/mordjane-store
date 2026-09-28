import { useTranslations } from "next-intl";

import { ProductArt } from "@/components/brand/product-art";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <div className="size-40 overflow-hidden rounded-full shadow-sm">
        <ProductArt hint="bean" seed="404" />
      </div>
      <h1 className="mt-8 text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("text")}</p>
      <Button asChild className="mt-8 rounded-full" size="lg">
        <Link href="/">{t("back")}</Link>
      </Button>
    </section>
  );
}
