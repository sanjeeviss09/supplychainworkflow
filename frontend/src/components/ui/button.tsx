import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 ring-offset-ivory disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]',
  {
    variants: {
      variant: {
        default: 'bg-forest text-ivory-surface hover:bg-forest-deep shadow-warm-sm',
        copper: 'bg-copper text-white hover:bg-copper-hover shadow-warm-sm',
        destructive: 'bg-status-danger text-white hover:bg-red-700 shadow-warm-sm',
        outline: 'border border-divider bg-ivory-surface text-ink-primary hover:bg-ivory hover:text-forest hover:border-sage',
        secondary: 'bg-sage-pale text-forest hover:bg-sage/30 border border-sage/40',
        ghost: 'text-ink-primary hover:bg-sage-pale/50 hover:text-forest',
        link: 'text-forest underline-offset-4 hover:underline hover:text-forest-deep p-0 h-auto font-medium',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-6 text-sm font-semibold',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
