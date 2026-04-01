import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary px-4 py-2 text-white hover:bg-[#0b326f] focus-visible:ring-[#0d3b84]",
        secondary: "bg-white px-4 py-2 text-slate-700 ring-1 ring-[#dde1e6] hover:bg-slate-50 focus-visible:ring-[#0d3b84]",
        ghost: "px-3 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-[#0d3b84]",
        accent: "bg-accent px-4 py-2 text-white hover:bg-[#d68314] focus-visible:ring-[#f89a1c]",
      },
      size: {
        default: "h-10",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});

Button.displayName = "Button";

export { Button, buttonVariants };