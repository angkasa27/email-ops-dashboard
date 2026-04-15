"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";

import { LiveEvents } from "@/components/features/live-events";

export function AppLiveRefresh() {
  const router = useRouter();

  return (
    <LiveEvents
      onRefresh={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
    />
  );
}
