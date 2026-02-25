"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClutterScoreBadge } from "@/components/shared/clutter-score-badge";
import { CategoryBadge } from "@/components/shared/category-badge";

interface ClutterSender {
  id: string;
  senderAddress: string;
  senderName: string | null;
  totalCount: number;
  openRate: number;
  clutterScore: number;
  category: string | null;
  hasListUnsubscribe: boolean;
}

export function TopClutterList({ senders }: { senders: ClutterSender[] }) {
  if (senders.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Top Clutter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Top Clutter Senders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {senders.map((sender) => (
            <div
              key={sender.id}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate text-foreground">
                  {sender.senderName || sender.senderAddress}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {sender.totalCount} emails
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(sender.openRate * 100)}% opened
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <CategoryBadge category={sender.category} />
                <ClutterScoreBadge score={sender.clutterScore} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
