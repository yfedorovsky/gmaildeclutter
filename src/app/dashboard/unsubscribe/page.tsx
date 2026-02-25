"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ClutterScoreBadge } from "@/components/shared/clutter-score-badge";
import { CategoryBadge } from "@/components/shared/category-badge";
import {
  Loader2,
  MailMinus,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Sender {
  id: string;
  senderAddress: string;
  senderName: string | null;
  totalCount: number;
  openRate: number;
  clutterScore: number;
  category: string | null;
  hasListUnsubscribe: boolean;
  userAction: string | null;
}

export default function UnsubscribePage() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<
    Record<string, { success: boolean; method: string }>
  >({});

  useEffect(() => {
    async function fetch_data() {
      try {
        const res = await fetch(
          "/api/senders?sort=clutterScore&order=desc&limit=200"
        );
        if (res.ok) {
          const data = await res.json();
          // Only show senders that have unsubscribe headers and haven't been unsubscribed
          setSenders(
            data.senders.filter(
              (s: Sender) =>
                s.hasListUnsubscribe && s.userAction !== "unsubscribe"
            )
          );
        }
      } catch {
        toast.error("Failed to load senders");
      } finally {
        setLoading(false);
      }
    }
    fetch_data();
  }, []);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === senders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(senders.map((s) => s.id)));
    }
  };

  const unsubscribe = async () => {
    if (selected.size === 0) return;

    const ids = Array.from(selected);
    setProcessing(new Set(ids));

    try {
      const res = await fetch("/api/actions/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderIds: ids }),
      });

      if (res.ok) {
        const data = await res.json();
        const newResults: Record<
          string,
          { success: boolean; method: string }
        > = {};
        for (const r of data.results) {
          newResults[r.senderId] = {
            success: r.success,
            method: r.method,
          };
        }
        setResults((prev) => ({ ...prev, ...newResults }));

        const successCount = data.results.filter(
          (r: any) => r.success
        ).length;
        toast.success(
          `Unsubscribed from ${successCount}/${ids.length} sender(s)`
        );
      }
    } catch {
      toast.error("Failed to unsubscribe");
    } finally {
      setProcessing(new Set());
      setSelected(new Set());
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Mass Unsubscribe
          </h2>
          <p className="text-sm text-muted-foreground">
            {senders.length} senders support one-click unsubscribe
          </p>
        </div>
        {selected.size > 0 && (
          <Button onClick={unsubscribe} disabled={processing.size > 0}>
            {processing.size > 0 ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MailMinus className="mr-2 h-4 w-4" />
            )}
            Unsubscribe ({selected.size})
          </Button>
        )}
      </div>

      {senders.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selected.size === senders.length}
            onCheckedChange={selectAll}
          />
          <span className="text-sm text-muted-foreground">Select all</span>
        </div>
      )}

      <div className="space-y-2">
        {senders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                No unsubscribe candidates
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Run a scan first, or all senders have already been processed.
              </p>
            </CardContent>
          </Card>
        ) : (
          senders.map((sender) => {
            const result = results[sender.id];
            const isProcessing = processing.has(sender.id);

            return (
              <div
                key={sender.id}
                className="flex items-center gap-4 p-4 rounded-lg border bg-card"
              >
                <Checkbox
                  checked={selected.has(sender.id)}
                  onCheckedChange={() => toggleSelect(sender.id)}
                  disabled={isProcessing || !!result}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {sender.senderName || sender.senderAddress}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {sender.senderAddress}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {sender.totalCount} emails
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(sender.openRate * 100)}% opened
                  </span>
                  <CategoryBadge category={sender.category} />
                  <ClutterScoreBadge score={sender.clutterScore} />

                  {isProcessing && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {result?.success && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {result && !result.success && (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
