import React from "react";

export const Input = React.forwardRef(({ className = "", type = "text", ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
        placeholder:text-muted-foreground
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0
        disabled:cursor-not-allowed disabled:opacity-50
        ${className}`}
      {...props}
    />
  );
});

Input.displayName = "Input";