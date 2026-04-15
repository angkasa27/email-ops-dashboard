"use client";

import { useEffect } from "react";
import { useRef } from "react";

export function LiveEvents({ onRefresh }: { onRefresh: () => void }) {
  const lastVersionRef = useRef<string | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onmessage = (event) => {
      const nextVersion = event.data;
      if (!nextVersion || nextVersion === lastVersionRef.current) {
        return;
      }

      lastVersionRef.current = nextVersion;
      onRefresh();
    };
    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [onRefresh]);

  return null;
}
