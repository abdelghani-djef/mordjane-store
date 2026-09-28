"use client";

import { SearchIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/navigation";
import { SORT_KEYS, type SortKey } from "@/lib/catalog";

function useUpdateParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return { update, pending, searchParams };
}

export function CatalogSearch() {
  const t = useTranslations("Catalog");
  const { update, searchParams } = useUpdateParams();

  return (
    <form
      role="search"
      className="w-full sm:max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q")?.toString().trim() ?? "";
        update({ q: q || null });
      }}
    >
      <InputGroup className="h-10 rounded-full bg-card">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          key={searchParams.get("q") ?? ""}
          name="q"
          type="search"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
        />
      </InputGroup>
    </form>
  );
}

export function CatalogSort({ value }: { value: SortKey }) {
  const t = useTranslations("Catalog");
  const { update, pending } = useUpdateParams();

  return (
    <Select
      value={value}
      onValueChange={(v) => update({ sort: v === "featured" ? null : v })}
      disabled={pending}
    >
      <SelectTrigger className="h-10 w-48 rounded-full bg-card" aria-label={t("sortLabel")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {SORT_KEYS.map((key) => (
          <SelectItem key={key} value={key}>
            {t(`sort.${key}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
