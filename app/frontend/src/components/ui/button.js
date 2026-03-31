import React from "react";

export const Button = React.forwardRef(
  ({ className = "", variant = "default", size = "default", children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
      default: "bg-primary text-white hover:bg-primary/90",
      outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
    };

    const sizes = {
      default: "h-10 py-2 px-4 rounded-md text-sm",
      sm: "h-8 px-3 rounded-md text-xs",
      lg: "h-12 px-8 rounded-md text-base",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";