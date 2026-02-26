"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClutterScoreBadge } from "@/components/shared/clutter-score-badge";
import { CategoryBadge } from "@/components/shared/category-badge";
import { Trash2 } from "lucide-react";

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
      <Card className="h-full">
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
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Top Clutter Senders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {senders.map((sender) => (
            <div
              key={sender.id}
              className="group flex items-center justify-between gap-3 transition-all duration-300 hover:bg-accent/50 hover:scale-[1.01] cursor-pointer rounded-xl p-2 -mx-2"
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
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
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
