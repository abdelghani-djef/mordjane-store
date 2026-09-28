"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLowStockThreshold } from "@/lib/admin-api";

/** Edit stock in place: commits on Enter or blur, Escape reverts. */
export function StockInput({
  value,
  label,
  disabled,
  onCommit,
}: {
  value: number;
  label: string;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const t = useTranslations("Admin.products");
  const threshold = useLowStockThreshold();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);

  function commit() {
    if (draft === null) return;
    const next = Number.parseInt(draft, 10);
    setDraft(null);
    if (Number.isFinite(next) && next >= 0 && next !== value) onCommit(next);
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={shown}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDraft(null);
        }}
        className="h-8 w-20 tabular-nums"
      />
      {value <= threshold && (
        <Badge
          variant={value === 0 ? "destructive" : "outline"}
          className={value === 0 ? undefined : "text-honey-ink"}
        >
          {value === 0 ? t("outBadge") : t("lowBadge")}
        </Badge>
      )}
    </div>
  );
}
