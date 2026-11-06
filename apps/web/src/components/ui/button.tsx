import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
        outline: "border border-input bg-surface hover:bg-muted text-foreground",
        secondary: "bg-muted text-foreground hover:bg-border",
        ghost: "hover:bg-muted text-foreground",
        destructive: "bg-danger text-danger-foreground hover:bg-danger/90 shadow-sm",
        success: "bg-success text-success-foreground hover:bg-success/90 shadow-sm",
        link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        // Phones get 40px controls (easier to hit with a thumb); laptops keep the tighter sizes.
        default: "h-10 px-4 md:h-9",
        sm: "h-9 px-3 text-xs md:h-8",
        lg: "h-11 px-5 md:h-10",
        icon: "size-10 md:size-9",
        "icon-sm": "size-10 md:size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
