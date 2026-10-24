import { useLocale, useTranslations } from "next-intl";

import { PhoneIcon } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { SocialIcon } from "@/components/brand/social-icons";
import { Link } from "@/i18n/navigation";
import type { Category } from "@/lib/api";
import { SHOP_PHONE, SHOP_PHONE_HREF, SOCIAL_LINKS } from "@/lib/contact";
import { localizedName } from "@/lib/format";

const linkClass = "text-muted-foreground transition-colors hover:text-foreground";

export function SiteFooter({ categories }: { categories: Category[] }) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <footer className="mt-24 border-t bg-muted/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 leading-relaxed text-muted-foreground">{t("Footer.about")}</p>
          <a
            href={SHOP_PHONE_HREF}
            aria-label={`${t("Footer.call")}: ${SHOP_PHONE}`}
            className="mt-4 inline-flex items-center gap-2 font-medium tabular-nums hover:underline"
          >
            <PhoneIcon className="size-4 text-primary" />
            <span dir="ltr">{SHOP_PHONE}</span>
          </a>
          <ul aria-label={t("Footer.followUs")} className="mt-4 flex gap-2">
            {SOCIAL_LINKS.map((s) => (
              <li key={s.network}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="grid size-10 place-items-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-primary"
                >
                  <SocialIcon network={s.network} className="size-5" />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label={t("Footer.shop")}>
          <h2 className="mb-3 text-base">{t("Footer.shop")}</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/packs" className={linkClass}>
                {t("Nav.packs")}
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/products?category=${c.slug}`} className={linkClass}>
                  {localizedName(c, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={t("Footer.help")}>
          <h2 className="mb-3 text-base">{t("Footer.help")}</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/track" className={linkClass}>
                {t("Nav.track")}
              </Link>
            </li>
            <li>
              <Link href="/contact" className={linkClass}>
                {t("Footer.contact")}
              </Link>
            </li>
            <li>
              <Link href="/cart" className={linkClass}>
                {t("Nav.cart")}
              </Link>
            </li>
            <li>
              <Link href="/admin" className={linkClass}>
                {t("Footer.admin")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-5 text-sm text-muted-foreground sm:px-6">
          {t("Footer.rights", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
