import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center px-3 py-1 text-[0.72rem] font-semibold tracking-[0.08em] uppercase transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]",
  {
    variants: {
      variant: {
        default: "text-[color:var(--accent)]",
        secondary: "text-[color:var(--page-foreground)]",
        outline: "text-[color:var(--muted-foreground)]",
        success: "text-[color:var(--success)]",
        destructive: "text-[color:var(--danger)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
