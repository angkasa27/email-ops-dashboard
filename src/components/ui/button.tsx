import * as React from "react";

import { cn } from "@/lib/ui/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "danger";
};

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition",
        variant === "default" && "bg-teal-700 text-white hover:bg-teal-600",
        variant === "outline" && "border border-stone-400 bg-white text-stone-800 hover:bg-stone-100",
        variant === "danger" && "bg-rose-700 text-white hover:bg-rose-600",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
