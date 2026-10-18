import { GiftIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PackCard, PackGrid } from "@/components/shop/pack-card";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { asLocale, resolveLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import type { Pack } from "@/lib/api";
import { serverApi } from "@/lib/server-api";

export async function generateMetadata({ params }: PageProps<"/[locale]/packs">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "Packs" });
  return { title: t("title"), description: t("metaDescription") };
}

export default async function PacksPage({ params }: PageProps<"/[locale]/packs">) {
  await resolveLocale(params);
  const t = await getTranslations("Packs");
  const tCart = await getTranslations("Cart");
  const packs = await serverApi<Pack[]>("/packs");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("intro")}</p>
      </header>

      <div className="mt-10">
        {packs.length === 0 ? (
          <Empty className="rounded-3xl border bg-muted py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <GiftIcon />
              </EmptyMedia>
              <EmptyTitle className="font-heading text-xl">{t("emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("emptyText")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/products">{tCart("continueShopping")}</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <PackGrid>
            {packs.map((pack, i) => (
              <PackCard key={pack.id} pack={pack} preload={i < 3} />
            ))}
          </PackGrid>
        )}
      </div>
    </div>
  );
}
