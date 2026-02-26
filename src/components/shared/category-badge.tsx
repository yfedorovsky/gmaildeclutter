"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const categoryColors: Record<string, string> = {
  newsletter: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  job_alert: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  promo: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  social: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  transactional: "bg-green-500/10 text-green-500 border-green-500/20",
  personal: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  automated: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  other: "bg-muted text-muted-foreground border-border",
  unclassified: "bg-muted text-muted-foreground border-border",
};

const categoryLabels: Record<string, string> = {
  newsletter: "Newsletter",
  job_alert: "Job Alert",
  promo: "Promo",
  social: "Social",
  transactional: "Transaction",
  personal: "Personal",
  automated: "Automated",
  other: "Other",
  unclassified: "Unclassified",
};

const LOW_CONFIDENCE_THRESHOLD = 0.6;

interface CategoryBadgeProps {
  category: string | null;
  confidence?: number | null;
}

export function CategoryBadge({ category, confidence }: CategoryBadgeProps) {
  const cat = category || "unclassified";
  const label = categoryLabels[cat] || cat;
  const isLowConfidence =
    confidence != null && confidence < LOW_CONFIDENCE_THRESHOLD;

  const badge = (
    <Badge
      variant="outline"
      className={cn("text-xs", categoryColors[cat] || categoryColors.other)}
    >
      {label}
      {isLowConfidence && (
        <span className="ml-0.5 opacity-60">?</span>
      )}
    </Badge>
  );

  if (isLowConfidence) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              Low AI confidence ({Math.round((confidence ?? 0) * 100)}%)
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
