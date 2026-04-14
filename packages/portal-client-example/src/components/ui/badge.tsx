import { forwardRef, type ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva(
    'inline-flex items-center justify-center rounded-sm border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] overflow-hidden',
    {
        defaultVariants: {
            variant: 'default',
        },
        variants: {
            variant: {
                default: 'border-transparent bg-primary text-primary-foreground',
                destructive: 'border-transparent bg-destructive text-white',
                outline: 'text-foreground',
                secondary: 'border-transparent bg-secondary text-secondary-foreground',
            },
        },
    },
);

type BadgeProps = ComponentProps<'div'> & VariantProps<typeof badgeVariants>;

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ className, variant }))} {...props} />
));

Badge.displayName = 'Badge';
