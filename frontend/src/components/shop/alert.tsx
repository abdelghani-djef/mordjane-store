import { cn } from "@/lib/utils";

/** Small inline callout (the shadcn `alert` primitive isn't needed for these few cases). */
export function Alert({
  icon,
  tone = "default",
  title,
  children,
  className,
}: {
  icon?: React.ReactNode;
  tone?: "default" | "destructive" | "success";
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "destructive" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0",
        tone === "default" && "bg-card",
        tone === "destructive" && "border-destructive/30 bg-destructive/10 text-destructive",
        tone === "success" && "border-success/30 bg-success/10",
        className,
      )}
    >
      {icon}
      <div className="flex flex-col gap-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "text-foreground/80")}>{children}</div>}
      </div>
    </div>
  );
}
