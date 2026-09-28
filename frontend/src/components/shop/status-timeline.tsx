import { CheckIcon, PackageCheckIcon, TruckIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { OrderStatus } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Event = {
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  /** Staff-only; absent on the public tracking page. */
  note?: string;
  created_at: string;
};

const HAPPY_PATH: OrderStatus[] = ["pending", "validated", "shipped", "delivered"];
const ICONS: Record<OrderStatus, React.ComponentType<{ className?: string }>> = {
  pending: CheckIcon,
  validated: PackageCheckIcon,
  shipped: TruckIcon,
  delivered: CheckIcon,
  cancelled: XIcon,
};

/**
 * Customer-facing progress: the four happy-path steps with timestamps from the event log.
 * A cancelled order shows the steps it reached, then the cancellation.
 */
export function StatusTimeline({
  status,
  events,
  showNotes = false,
}: {
  status: OrderStatus;
  events: Event[];
  showNotes?: boolean;
}) {
  const t = useTranslations("Status");
  const locale = useLocale();
  const reached = new Map(events.map((e) => [e.to_status, e]));
  const steps: OrderStatus[] =
    status === "cancelled"
      ? [...HAPPY_PATH.filter((s) => reached.has(s)), "cancelled"]
      : HAPPY_PATH;
  const currentIndex = steps.indexOf(status);

  return (
    <ol className="relative flex flex-col">
      {steps.map((step, index) => {
        const event = reached.get(step);
        const done = index <= currentIndex;
        const current = index === currentIndex;
        const cancelled = step === "cancelled";
        const Icon = ICONS[step];
        return (
          <li key={step} className="relative flex gap-4 pb-7 last:pb-0">
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute start-[17px] top-9 h-[calc(100%-2.25rem)] w-0.5 rounded-full",
                  index < currentIndex ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative grid size-9 shrink-0 place-items-center rounded-full border-2 transition-colors",
                done && !cancelled && "border-primary bg-primary text-primary-foreground",
                cancelled && "border-destructive bg-destructive text-white",
                !done && "border-border bg-card text-muted-foreground",
                current && !cancelled && "ring-4 ring-honey/40",
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="pt-1.5">
              <p className={cn("font-medium", !done && "text-muted-foreground")}>
                {t(step)}
                <span className="sr-only">{done ? " ✓" : ""}</span>
              </p>
              {/* Customer-facing explanation; staff (showNotes) get the notes instead. */}
              {current && !showNotes && (
                <p className="text-sm text-muted-foreground">{t(`describe.${step}`)}</p>
              )}
              {event && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(event.created_at, locale)}
                </p>
              )}
              {showNotes && event?.note && (
                <p className="mt-1.5 rounded-md bg-muted px-2.5 py-1.5 text-sm">{event.note}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const t = useTranslations("Status");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        status === "pending" && "border-honey/50 bg-honey/15 text-honey-ink",
        status === "validated" && "border-primary/25 bg-secondary text-secondary-foreground",
        status === "shipped" && "border-info/30 bg-info/10 text-info",
        status === "delivered" && "border-success/30 bg-success/10 text-success",
        status === "cancelled" && "border-destructive/30 bg-destructive/10 text-destructive",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status === "pending" && "bg-honey",
          status === "validated" && "bg-primary",
          status === "shipped" && "bg-info",
          status === "delivered" && "bg-success",
          status === "cancelled" && "bg-destructive",
        )}
      />
      {t(status)}
    </span>
  );
}
