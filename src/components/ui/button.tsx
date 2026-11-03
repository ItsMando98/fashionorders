import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-semibold tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#FF4D00] text-white shadow-[0_0_22px_rgba(255,77,0,0.28)] hover:bg-[#ff6a2a]",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline: "border border-white/15 bg-transparent text-zinc-100 hover:bg-white/5 font-medium",
        secondary: "bg-white/10 text-zinc-100 hover:bg-white/15 font-medium",
        ghost: "hover:bg-white/10 hover:text-white",
        link: "text-primary underline-offset-4 hover:underline",
        mandarine: "bg-[#FF4D00] text-white shadow-[0_0_22px_rgba(255,77,0,0.35)] hover:bg-[#ff6a2a] focus-visible:ring-[#FF4D00] font-bold",
        "mandarine-outline": "border border-[#FF4D00] bg-transparent text-[#FF4D00] hover:bg-[#FF4D00]/10 font-semibold",
        forest: "bg-[#12141c] text-white border border-white/10 hover:bg-[#1c1e28] font-semibold",
        crest: "bg-[#3ECFFF] text-[#071016] hover:bg-[#67dbff] font-bold focus-visible:ring-[#3ECFFF]",
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
