"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function ClutterScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-red-500/10 text-red-500 border-red-500/20"
      : score >= 50
        ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
        : score >= 30
          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
          : "bg-green-500/10 text-green-500 border-green-500/20";

  return (
    <Badge variant="outline" className={cn("font-mono text-xs", color)}>
      {score}
    </Badge>
  );
}
