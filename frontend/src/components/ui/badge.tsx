import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-forest text-white',
        secondary: 'border-sage/40 bg-sage-pale text-forest',
        sage: 'border-sage/50 bg-sage-pale/70 text-forest',
        copper: 'border-copper/30 bg-copper-pale text-copper-dark',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        warning: 'border-amber-200 bg-amber-50 text-amber-700',
        destructive: 'border-rose-200 bg-rose-50 text-rose-700',
        outline: 'border-divider bg-white text-ink-secondary',
        super_admin: 'border-copper/30 bg-copper-pale text-copper-dark font-semibold',
        scm_admin: 'border-emerald-200 bg-sage-pale text-forest font-semibold',
        scm_team_user: 'border-divider bg-ivory text-ink-secondary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
