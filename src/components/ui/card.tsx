import * as React from "react";

import { cn } from "@/lib/ui/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl border border-stone-300 bg-white/95 p-6 shadow-sm", className)} {...props} />;
}
