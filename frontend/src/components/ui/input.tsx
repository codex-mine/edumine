import * as React from "react";
import { cn } from "@/lib/utils";

export interface AuthInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> { }

export const Input = React.forwardRef<HTMLInputElement, AuthInputProps>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={cn(
          "flex h-20 w-full rounded",
          "border-2 border-slate-200",
          "bg-white",
          "px-4",
          "text-[15px]",
          "text-slate-900",
          "placeholder:text-slate-400",
          "outline-none",
          "transition-all duration-200",
          "focus:border-indigo-500",
          "focus:ring-2 focus:ring-indigo-100",
          "disabled:bg-slate-100",
          "disabled:text-slate-400",
          "aria-invalid:border-red-500",
          "aria-invalid:ring-red-100",
          className
        )}
      />
    );
  }
);