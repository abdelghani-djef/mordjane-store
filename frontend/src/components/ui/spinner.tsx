import { cn } from "cn"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    // Decorative by default: spinners sit next to visible (translated) text. A standalone
    // spinner should pass role="status", a translated aria-label and aria-hidden={false}.
    <Loader2Icon data-slot="spinner" aria-hidden className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
