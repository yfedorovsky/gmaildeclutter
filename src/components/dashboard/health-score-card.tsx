"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HealthScoreCard({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  if (score === null) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Inbox Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-muted-foreground">--</p>
          <p className="text-xs text-muted-foreground mt-1">
            Scan your inbox to see your score
          </p>
        </CardContent>
      </Card>
    );
  }

  const color =
    score >= 80
      ? "text-green-500"
      : score >= 50
        ? "text-yellow-500"
        : "text-red-500";

  const label =
    score >= 80 ? "Healthy" : score >= 50 ? "Needs attention" : "Critical";

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Inbox Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <p className={`text-4xl font-bold ${color}`}>{score}</p>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <p className={`text-xs mt-1 ${color}`}>{label}</p>
      </CardContent>
    </Card>
  );
}
