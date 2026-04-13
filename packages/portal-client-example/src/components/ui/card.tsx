import { type ComponentProps } from 'react';

import { cn } from '../../lib/utils';

export const Card = ({ className, ...props }: ComponentProps<'div'>) => (
    <div
        className={cn('bg-card text-card-foreground flex flex-col gap-3 rounded-sm border py-3 shadow-sm', className)}
        {...props}
    />
);

export const CardContent = ({ className, ...props }: ComponentProps<'div'>) => (
    <div className={cn('px-3', className)} {...props} />
);
