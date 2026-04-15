import * as React from "react";

import { cn } from "@/lib/ui/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 outline-none ring-teal-500 focus:ring-2",
        className
      )}
      {...props}
    />
  );
}
