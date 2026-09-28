"use client";

import {
  BellIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PackageIcon,
  ReceiptTextIcon,
  StoreIcon,
  TagsIcon,
  TruckIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useEffect } from "react";

import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher, ThemeToggle } from "@/components/shop/preferences";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { ADMIN_LOCALES } from "@/i18n/routing";
import { useLogout, useMe, useStats } from "@/lib/admin-api";

const NAV = [
  { href: "/admin", key: "dashboard", icon: LayoutDashboardIcon, exact: true },
  { href: "/admin/orders", key: "orders", icon: ReceiptTextIcon },
  { href: "/admin/products", key: "products", icon: PackageIcon },
  { href: "/admin/categories", key: "categories", icon: TagsIcon },
  { href: "/admin/delivery", key: "delivery", icon: TruckIcon },
  { href: "/admin/notifications", key: "notifications", icon: BellIcon },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const logout = useLogout();
  const stats = useStats();
  const pending = stats.data?.orders_by_status.pending ?? 0;

  // Client-side guard for UX; every admin API call is independently protected server-side.
  useEffect(() => {
    if (me.isError) router.replace("/admin/login");
  }, [me.isError, router]);

  if (!me.data) {
    return (
      <div className="grid min-h-svh place-items-center">
        <Spinner
          className="size-8 text-primary"
          role="status"
          aria-hidden={false}
          aria-label={t("common.loading")}
        />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-4">
          <Link href="/admin" className="overflow-hidden text-sidebar-foreground">
            <Logo />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((item) => {
                  const active =
                    "exact" in item ? pathname === item.href : pathname.startsWith(item.href);
                  const label = t(`nav.${item.key}`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={label}
                        className="h-10 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.key === "orders" && pending > 0 && (
                        <SidebarMenuBadge className="rounded-full bg-honey text-honey-foreground">
                          {pending}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={t("backToStore")}>
                <Link href="/" target="_blank">
                  <StoreIcon />
                  <span>{t("backToStore")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t("logout")}
                onClick={() =>
                  logout.mutate(undefined, { onSettled: () => router.replace("/admin/login") })
                }
              >
                <LogOutIcon />
                <span className="truncate">{t("logout")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <p className="truncate px-2 pb-1 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            {me.data.email}
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
          <SidebarTrigger aria-label={t("toggleSidebar")} />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <span className="font-heading text-lg font-medium">{t("title")}</span>
          <div className="ml-auto flex items-center gap-1">
            <Suspense>
              <LanguageSwitcher locales={ADMIN_LOCALES} />
            </Suspense>
            <ThemeToggle />
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
