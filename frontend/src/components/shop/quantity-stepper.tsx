"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "default",
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "default";
  className?: string;
}) {
  const t = useTranslations("Product");
  const btn = size === "sm" ? "icon-xs" : "icon-sm";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border bg-background p-0.5",
        size === "sm" ? "gap-0.5" : "gap-1",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size={btn}
        className="rounded-full"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={t("decrease")}
      >
        <MinusIcon />
      </Button>
      <output
        aria-live="polite"
        aria-label={t("quantity")}
        className={cn("min-w-7 text-center font-medium tabular-nums", size === "sm" && "text-sm")}
      >
        {value}
      </output>
      <Button
        type="button"
        variant="ghost"
        size={btn}
        className="rounded-full"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={t("increase")}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
