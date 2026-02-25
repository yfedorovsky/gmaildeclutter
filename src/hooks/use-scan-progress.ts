"use client";

import { useState, useEffect, useCallback } from "react";
import type { ScanProgress } from "@/types/scan";

export function useScanProgress(scanId: string | null) {
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const poll = useCallback(async () => {
    if (!scanId) return;

    try {
      const res = await fetch(`/api/scan/${scanId}/status`);
      if (!res.ok) return;

      const data = await res.json();
      setProgress(data);

      if (data.status === "complete" || data.status === "error") {
        setIsPolling(false);
      }
    } catch {
      // Ignore fetch errors during polling
    }
  }, [scanId]);

  useEffect(() => {
    if (!scanId) return;

    setIsPolling(true);
    poll();

    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [scanId, poll]);

  return { progress, isPolling };
}
