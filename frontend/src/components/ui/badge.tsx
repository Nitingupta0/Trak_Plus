import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex min-h-5 max-w-full shrink-0 items-center justify-center gap-1 rounded-none border px-2 py-1.5 text-[11px] uppercase font-sans font-semibold tracking-[0.08em] leading-tight break-words transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&_svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-foreground/20 text-foreground/80",
        secondary: "border-foreground/10 text-foreground/60",
        destructive: "border-destructive/40 text-destructive",
        outline: "border-foreground/20 text-foreground/80",
        ghost: "border-transparent text-foreground/60",
        link: "border-transparent text-foreground underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
