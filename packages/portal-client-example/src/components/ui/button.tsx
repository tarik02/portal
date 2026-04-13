import { forwardRef, type ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm text-sm font-medium transition-[color,box-shadow,background-color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 enabled:cursor-pointer [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
    {
        defaultVariants: {
            size: 'default',
            variant: 'default',
        },
        variants: {
            size: {
                default: 'h-8 px-3 py-1.5',
                icon: 'size-8',
                sm: 'h-7 rounded-sm gap-1 px-2.5 text-xs',
            },
            variant: {
                default:
                    'bg-primary text-primary-foreground shadow-xs enabled:hover:bg-primary/92 enabled:hover:shadow-md enabled:active:bg-primary/88',
                ghost: 'enabled:hover:bg-accent enabled:hover:text-accent-foreground enabled:active:bg-accent/80',
                secondary:
                    'bg-secondary text-secondary-foreground shadow-xs enabled:hover:bg-secondary/88 enabled:hover:shadow-sm enabled:active:bg-secondary/78',
            },
        },
    },
);

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, size, variant, ...props }, ref) => (
        <button ref={ref} className={cn(buttonVariants({ className, size, variant }))} {...props} />
    ),
);

Button.displayName = 'Button';
