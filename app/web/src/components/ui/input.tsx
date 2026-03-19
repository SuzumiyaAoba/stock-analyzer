import * as React from "react";
import { cn } from "~/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full px-4 py-2 text-sm text-[color:var(--page-foreground)] file:border-0 file:text-sm file:font-medium file:text-[color:var(--page-foreground)] placeholder:text-[color:var(--muted-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
