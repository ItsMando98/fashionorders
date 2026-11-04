import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground border-border",
        warning: "border-amber-200 bg-amber-50 text-amber-800",
        info: "border-sky-200 bg-sky-50 text-sky-800",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
        // Custom Luxury Tokens (Projekt-Branding)
        mandarine: "border-mandarine-200 bg-mandarine-50 text-mandarine-700 font-bold",
        "mandarine-solid": "border-transparent bg-mandarine-500 text-white font-bold shadow-sm",
        forest: "border-forest-700 bg-forest-900 text-forest-100 font-medium",
        "forest-soft": "border-forest-200 bg-forest-50 text-forest-800 font-semibold",
        crest: "border-crest-300 bg-crest-100 text-crest-900 font-bold shadow-sm",
        "crest-solid": "border-transparent bg-crest-500 text-crest-950 font-bold shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
