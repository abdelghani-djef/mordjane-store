import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { CartSheet } from "@/components/shop/cart-sheet";
import { MobileNav } from "@/components/shop/mobile-nav";
import { LanguageSwitcher, ThemeToggle } from "@/components/shop/preferences";
import { Link } from "@/i18n/navigation";
import type { Category } from "@/lib/api";
import { localizedName } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SiteHeader({ categories }: { categories: Category[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const links = [
    { href: "/products", label: t("Nav.allProducts") },
    ...categories.slice(0, 4).map((c) => ({
      href: `/products?category=${c.slug}`,
      label: localizedName(c, locale),
    })),
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:start-2 focus:top-2"
      >
        {t("Nav.skipToContent")}
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <MobileNav links={[...links, { href: "/track", label: t("Nav.track") }]} />
        <Link href="/" className="shrink-0 rounded-md" aria-label="Mordjane">
          <Logo tagline={t("Brand.tagline")} />
        </Link>
        <nav aria-label={t("Nav.shop")} className="ms-6 hidden items-center gap-1 lg:flex">
          {links.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              // French labels run long: keep one line and drop the last category links first.
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap text-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
                i >= 3 && "hidden 2xl:inline-flex",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center sm:gap-1">
          <Link
            href="/track"
            className="me-1 hidden rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap text-foreground/80 transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
          >
            {t("Nav.track")}
          </Link>
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
          <ThemeToggle />
          <CartSheet />
        </div>
      </div>
    </header>
  );
}
