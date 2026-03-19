import * as React from "react";
import { cn } from "~/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-24 w-full px-4 py-3 text-sm text-[color:var(--page-foreground)] placeholder:text-[color:var(--muted-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
