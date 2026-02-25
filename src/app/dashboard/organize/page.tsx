"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Tags, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Sender {
  id: string;
  senderAddress: string;
  senderName: string | null;
  totalCount: number;
  category: string | null;
  userLabel: string | null;
}

interface LabelSuggestion {
  labelName: string;
  category: string;
  senders: Sender[];
  totalEmails: number;
}

const SUGGESTED_LABELS: Record<string, string> = {
  newsletter: "Newsletters",
  promo: "Promotions",
  social: "Social Media",
  transactional: "Receipts & Notifications",
  job_alert: "Job Alerts",
  automated: "Automated / System",
};

export default function OrganizePage() {
  const [suggestions, setSuggestions] = useState<LabelSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState("");

  useEffect(() => {
    async function fetch_data() {
      try {
        const res = await fetch("/api/senders?sort=totalCount&order=desc&limit=500");
        if (res.ok) {
          const data = await res.json();
          // Group by category and create label suggestions
          const grouped: Record<string, Sender[]> = {};
          for (const sender of data.senders) {
            const cat = sender.category;
            if (!cat || cat === "personal" || cat === "other") continue;
            if (sender.userLabel) continue;
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(sender);
          }

          const suggestions = Object.entries(grouped)
            .filter(([_, senders]) => senders.length > 0)
            .map(([category, senders]) => ({
              labelName: SUGGESTED_LABELS[category] || category,
              category,
              senders,
              totalEmails: senders.reduce((s, v) => s + v.totalCount, 0),
            }))
            .sort((a, b) => b.totalEmails - a.totalEmails);

          setSuggestions(suggestions);
        }
      } catch {
        toast.error("Failed to load senders");
      } finally {
        setLoading(false);
      }
    }
    fetch_data();
  }, []);

  const applyLabel = async (suggestion: LabelSuggestion) => {
    setApplying(suggestion.category);

    try {
      const res = await fetch("/api/actions/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderIds: suggestion.senders.map((s) => s.id),
          labelName: suggestion.labelName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setApplied((prev) => new Set(prev).add(suggestion.category));
        toast.success(
          `Applied "${suggestion.labelName}" to ${data.labeled?.toLocaleString()} emails`
        );
      }
    } catch {
      toast.error("Failed to apply label");
    } finally {
      setApplying(null);
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Organize</h2>
        <p className="text-sm text-muted-foreground">
          Auto-label emails based on AI categories
        </p>
      </div>

      {suggestions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Tags className="h-10 w-10 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">
              Nothing to organize
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Run a scan and AI classification first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => {
            const isApplied = applied.has(suggestion.category);
            const isApplying = applying === suggestion.category;

            return (
              <Card key={suggestion.category}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Tags className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">
                        {suggestion.labelName}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.senders.length} senders
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {suggestion.totalEmails.toLocaleString()} emails
                      </span>
                    </div>

                    <Button
                      size="sm"
                      disabled={isApplied || isApplying}
                      onClick={() => applyLabel(suggestion)}
                    >
                      {isApplying ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : isApplied ? (
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <Tags className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {isApplied ? "Applied" : "Apply Label"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {suggestion.senders.slice(0, 8).map((s) => (
                      <Badge key={s.id} variant="outline" className="text-xs">
                        {s.senderName || s.senderAddress}
                      </Badge>
                    ))}
                    {suggestion.senders.length > 8 && (
                      <Badge variant="outline" className="text-xs">
                        +{suggestion.senders.length - 8} more
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
