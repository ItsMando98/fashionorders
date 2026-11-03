import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#0D2218] text-white shadow-xs hover:bg-[#153426]",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline: "border border-zinc-200 bg-white text-zinc-800 shadow-2xs hover:bg-zinc-50 hover:text-zinc-950 font-medium",
        secondary: "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 font-medium",
        ghost: "hover:bg-zinc-100 hover:text-zinc-900",
        link: "text-primary underline-offset-4 hover:underline",
        // Luxury tokens matching UI kit images
        mandarine: "bg-[#FF5B00] text-white shadow-xs hover:bg-[#E55200] focus-visible:ring-[#FF5B00] font-bold",
        "mandarine-outline": "border border-[#FF5B00] bg-white text-[#FF5B00] hover:bg-orange-50 font-semibold",
        forest: "bg-[#0D2218] text-white shadow-xs hover:bg-[#153426] focus-visible:ring-[#153426] font-semibold",
        crest: "bg-[#F3C343] text-zinc-950 shadow-2xs hover:bg-[#E2B232] font-bold focus-visible:ring-[#F3C343]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6 font-bold text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
