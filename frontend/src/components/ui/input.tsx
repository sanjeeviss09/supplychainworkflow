import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-divider bg-ivory-surface px-3 py-1.5 text-sm text-ink-primary ring-offset-ivory file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-ink-muted/70 focus-visible:outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/25 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-ivory disabled:opacity-60 transition-colors',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
