"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ClutterScoreBadge } from "@/components/shared/clutter-score-badge";
import { ActionConfirmDialog } from "@/components/shared/action-confirm-dialog";
import { Loader2, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Sender {
  id: string;
  senderAddress: string;
  senderName: string | null;
  totalCount: number;
  clutterScore: number;
  category: string | null;
  userAction: string | null;
}

interface CategoryGroup {
  category: string;
  senders: Sender[];
  totalEmails: number;
}

export default function CleanupPage() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "archive" | "trash" | null
  >(null);

  useEffect(() => {
    async function fetch_data() {
      try {
        const res = await fetch(
          "/api/senders?sort=clutterScore&order=desc&limit=500"
        );
        if (res.ok) {
          const data = await res.json();
          // Group by category
          const grouped: Record<string, Sender[]> = {};
          for (const sender of data.senders) {
            if (sender.userAction) continue; // Skip already-actioned
            const cat = sender.category || "unclassified";
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(sender);
          }

          const categoryGroups = Object.entries(grouped)
            .map(([category, senders]) => ({
              category,
              senders,
              totalEmails: senders.reduce((s, v) => s + v.totalCount, 0),
            }))
            .sort((a, b) => b.totalEmails - a.totalEmails);

          setGroups(categoryGroups);
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

  const selectCategory = (senders: Sender[]) => {
    const ids = senders.map((s) => s.id);
    const allSelected = ids.every((id) => selected.has(id));
    const next = new Set(selected);

    if (allSelected) {
      ids.forEach((id) => next.delete(id));
    } else {
      ids.forEach((id) => next.add(id));
    }
    setSelected(next);
  };

  const runAction = async (action: "archive" | "trash") => {
    if (selected.size === 0) return;
    setConfirmAction(null);
    setActing(true);

    try {
      const res = await fetch(`/api/actions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderIds: Array.from(selected) }),
      });

      if (res.ok) {
        const data = await res.json();
        const count = data.archived || data.trashed || 0;
        toast.success(
          `${action === "archive" ? "Archived" : "Trashed"} ${count.toLocaleString()} emails`
        );
        // Remove actioned senders from UI
        const selectedSnapshot = new Set(selected);
        setSelected(new Set());
        setGroups((prev) =>
          prev
            .map((g) => ({
              ...g,
              senders: g.senders.filter((s) => !selectedSnapshot.has(s.id)),
              totalEmails: g.senders
                .filter((s) => !selectedSnapshot.has(s.id))
                .reduce((sum, s) => sum + s.totalCount, 0),
            }))
            .filter((g) => g.senders.length > 0)
        );
      }
    } catch {
      toast.error(`Failed to ${action}`);
    } finally {
      setActing(false);
    }
  };

  // Compute dialog data from selected senders
  const allSenders = groups.flatMap((g) => g.senders);
  const selectedSenders = allSenders.filter((s) => selected.has(s.id));
  const estimatedEmails = selectedSenders.reduce(
    (sum, s) => sum + s.totalCount,
    0
  );
  const topNames = selectedSenders
    .slice(0, 5)
    .map((s) => s.senderName || s.senderAddress);

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
          <h2 className="text-2xl font-bold tracking-tight">Cleanup</h2>
          <p className="text-sm text-muted-foreground">
            Batch archive or delete by category
          </p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selected.size} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={acting}
              onClick={() => setConfirmAction("archive")}
            >
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              Archive
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={acting}
              onClick={() => setConfirmAction("trash")}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Trash
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="archive">
        <TabsList>
          <TabsTrigger value="archive">Archive</TabsTrigger>
          <TabsTrigger value="delete">Delete</TabsTrigger>
        </TabsList>

        <TabsContent value="archive" className="space-y-4 mt-4">
          {groups.map((group) => (
            <CategoryGroupCard
              key={group.category}
              group={group}
              selected={selected}
              toggleSelect={toggleSelect}
              selectCategory={selectCategory}
            />
          ))}
        </TabsContent>

        <TabsContent value="delete" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
            Trashed emails can be recovered from Gmail Trash within 30 days.
          </p>
          {groups.map((group) => (
            <CategoryGroupCard
              key={group.category}
              group={group}
              selected={selected}
              toggleSelect={toggleSelect}
              selectCategory={selectCategory}
            />
          ))}
        </TabsContent>
      </Tabs>

      {groups.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Archive className="h-10 w-10 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nothing to clean up</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Run a scan first, or all senders have been handled.
            </p>
          </CardContent>
        </Card>
      )}

      {confirmAction && (
        <ActionConfirmDialog
          open={!!confirmAction}
          onOpenChange={(open) => {
            if (!open) setConfirmAction(null);
          }}
          actionType={confirmAction}
          senderCount={selected.size}
          estimatedEmails={estimatedEmails}
          topSenderNames={topNames}
          onConfirm={() => runAction(confirmAction)}
          loading={acting}
        />
      )}
    </div>
  );
}

function CategoryGroupCard({
  group,
  selected,
  toggleSelect,
  selectCategory,
}: {
  group: CategoryGroup;
  selected: Set<string>;
  toggleSelect: (id: string) => void;
  selectCategory: (senders: Sender[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const allSelected = group.senders.every((s) => selected.has(s.id));

  const categoryLabels: Record<string, string> = {
    newsletter: "Newsletters",
    promo: "Promotions",
    social: "Social",
    transactional: "Transactional",
    job_alert: "Job Alerts",
    automated: "Automated",
    personal: "Personal",
    other: "Other",
    unclassified: "Unclassified",
  };

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={() => {
                selectCategory(group.senders);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <CardTitle className="text-base capitalize">
              {categoryLabels[group.category] || group.category}
            </CardTitle>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{group.senders.length} senders</span>
            <span>{group.totalEmails.toLocaleString()} emails</span>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-1">
          {group.senders.map((sender) => (
            <div
              key={sender.id}
              className="flex items-center gap-3 py-2 px-1"
            >
              <Checkbox
                checked={selected.has(sender.id)}
                onCheckedChange={() => toggleSelect(sender.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {sender.senderName || sender.senderAddress}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {sender.totalCount} emails
              </span>
              <ClutterScoreBadge score={sender.clutterScore} />
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
