import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-1 text-xs shadow-2xs transition-all placeholder:text-zinc-400 focus-visible:outline-none focus-visible:border-[#FF5B00] focus-visible:ring-2 focus-visible:ring-[#FF5B00]/20 disabled:cursor-not-allowed disabled:opacity-50",
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
