import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        // Neutral / Default
        default: 'bg-mp-gray-100 text-mp-gray-700',
        // Primary Blue
        primary: 'bg-mp-blue-100 text-mp-blue-700',
        // Success Green
        success: 'bg-mp-green-100 text-mp-green-800',
        // Featured / Hot Pink
        featured: 'bg-mp-pink-100 text-mp-pink-700',
        hot: 'bg-mp-pink-500 text-white',
        // Warning
        warning: 'bg-amber-100 text-amber-800',
        // Destructive / Error
        destructive: 'bg-red-100 text-red-700',
        // Premium (gradient)
        premium: 'bg-gradient-to-r from-mp-blue-500 to-mp-pink-500 text-white',
        // New badge
        new: 'bg-mp-green-500 text-mp-green-900',
        // Limited
        limited: 'bg-mp-blue-900 text-white',

        // Outline variants
        'outline-default': 'border border-mp-gray-300 text-mp-gray-700 bg-transparent',
        'outline-primary': 'border border-mp-blue-500 text-mp-blue-600 bg-transparent',
        'outline-success': 'border border-mp-green-500 text-mp-green-700 bg-transparent',
        'outline-featured': 'border border-mp-pink-500 text-mp-pink-600 bg-transparent',

        // Skill category badges
        analytics: 'bg-violet-100 text-violet-700',
        marketing: 'bg-mp-blue-100 text-mp-blue-700',
        content: 'bg-emerald-100 text-emerald-700',
        operations: 'bg-amber-100 text-amber-700',
        finance: 'bg-mp-pink-100 text-mp-pink-700',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-[10px]',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
