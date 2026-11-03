import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-card px-3.5 py-1 text-base text-foreground shadow-none transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-[#FF4D00] focus-visible:ring-2 focus-visible:ring-[#FF4D00]/30 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:text-xs",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
