import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em]", {
  variants: {
    variant: {
      default: "bg-slate-100 text-slate-600",
      success: "bg-emerald-50 text-emerald-700",
      warning: "bg-amber-50 text-amber-700",
      danger: "bg-rose-50 text-rose-700",
      info: "bg-blue-50 text-[#0d3b84]",
      accent: "bg-orange-50 text-[#f89a1c]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}