'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toaster component (shadcn/ui pattern) wrapping sonner.
 * Styled to match MPSTATS brand colors.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            'group bg-white text-gray-950 border border-gray-200 shadow-lg',
          description: 'text-gray-500',
          actionButton: 'bg-mp-blue-500 text-white',
          cancelButton: 'bg-gray-100 text-gray-500',
        },
      }}
      {...props}
    />
  );
}
