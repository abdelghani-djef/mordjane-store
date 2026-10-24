import { PackageSearchIcon, PhoneIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SocialIcon } from "@/components/brand/social-icons";
import { asLocale, resolveLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { SHOP_PHONE, SHOP_PHONE_HREF, SOCIAL_LINKS } from "@/lib/contact";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "Contact" });
  return { title: t("title"), description: t("subtitle") };
}

const cardClass = "rounded-2xl border bg-card p-5 sm:p-6";

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  await resolveLocale(params);
  const t = await getTranslations("Contact");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl font-semibold sm:text-5xl">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className={cardClass}>
          <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
            <PhoneIcon className="size-5" />
          </span>
          <h2 className="mt-4 text-base font-medium">{t("phoneLabel")}</h2>
          <a
            href={SHOP_PHONE_HREF}
            dir="ltr"
            className="mt-1 inline-block text-2xl font-semibold tabular-nums hover:underline"
          >
            {SHOP_PHONE}
          </a>
          <p className="mt-1 text-sm text-muted-foreground">{t("phoneHours")}</p>
        </section>

        <section className={cardClass}>
          <h2 className="text-base font-medium">{t("socialLabel")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("socialText")}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {SOCIAL_LINKS.map((s) => (
              <li key={s.network}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted"
                >
                  <SocialIcon network={s.network} className="size-5 shrink-0 text-primary" />
                  <span className="font-medium">{s.label}</span>
                  {s.handle !== s.label && (
                    <span dir="ltr" className="ms-auto text-sm text-muted-foreground">
                      {s.handle}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-6 flex items-start gap-3 px-1 text-sm text-muted-foreground">
        <PackageSearchIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          {t.rich("orderHint", {
            track: (chunks) => (
              <Link href="/track" className="font-medium text-foreground underline">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </p>
    </div>
  );
}
