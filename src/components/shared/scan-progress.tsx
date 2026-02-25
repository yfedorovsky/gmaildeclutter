"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ScanProgressProps {
  status: string;
  totalMessages: number;
  processedMessages: number;
  totalSenders: number;
}

const statusLabels: Record<string, string> = {
  pending: "Preparing scan...",
  scanning: "Fetching emails...",
  grouping: "Grouping by sender...",
  classifying: "AI classification...",
  complete: "Scan complete!",
  error: "Scan failed",
};

export function ScanProgress({
  status,
  totalMessages,
  processedMessages,
  totalSenders,
}: ScanProgressProps) {
  const progress =
    totalMessages > 0 ? (processedMessages / totalMessages) * 100 : 0;

  const isActive =
    status === "pending" ||
    status === "scanning" ||
    status === "grouping" ||
    status === "classifying";

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {isActive && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {statusLabels[status] || status}
            </span>
          </div>

          {status === "scanning" && totalMessages > 0 && (
            <>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {processedMessages.toLocaleString()} /{" "}
                {totalMessages.toLocaleString()} emails processed
              </p>
            </>
          )}

          {(status === "grouping" || status === "classifying") && (
            <p className="text-xs text-muted-foreground">
              {totalSenders > 0
                ? `Found ${totalSenders.toLocaleString()} unique senders`
                : "Processing..."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
