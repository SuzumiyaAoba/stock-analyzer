import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-[color,opacity,transform] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent)] hover:-translate-y-0.5 [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]",
        secondary: "text-[color:var(--page-foreground)] hover:text-[color:var(--accent)]",
        outline: "text-[color:var(--muted-foreground)] hover:text-[color:var(--page-foreground)]",
        ghost: "text-[color:var(--muted-foreground)] hover:text-[color:var(--page-foreground)]",
        destructive: "text-[color:var(--danger)] hover:opacity-80",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3.5",
        lg: "h-12 px-8 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
