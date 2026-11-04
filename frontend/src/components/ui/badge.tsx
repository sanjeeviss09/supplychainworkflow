import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-forest text-ivory-surface',
        secondary: 'border-sage/40 bg-sage-pale text-forest',
        sage: 'border-sage/50 bg-sage/20 text-forest',
        copper: 'border-copper/30 bg-copper-pale text-copper-dark',
        success: 'border-emerald-300 bg-emerald-50 text-status-success',
        warning: 'border-amber-300 bg-amber-50 text-status-warning',
        destructive: 'border-red-300 bg-rose-50 text-status-danger',
        outline: 'border-divider bg-ivory-surface text-ink-secondary',
        super_admin: 'border-copper/40 bg-copper-pale text-copper-dark font-semibold',
        scm_admin: 'border-forest/30 bg-sage-pale text-forest font-semibold',
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
