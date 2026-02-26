"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Archive, Trash2, Paperclip, HardDrive } from "lucide-react";
import { toast } from "sonner";

interface AttachmentMessage {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  sizeEstimate: number;
  labelIds: string[];
}

type Threshold = "5" | "10" | "20" | "100";

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824)
    return (bytes / 1_073_741_824).toFixed(1) + " GB";
  return (bytes / 1_048_576).toFixed(1) + " MB";
}

function parseSenderDisplay(from: string): { name: string; email: string } {
  const match = from.match(/^"?(.+?)"?\s*<(.+?)>$/);
  if (match) return { name: match[1].trim(), email: match[2] };
  return { name: from, email: from };
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function AttachmentsPage() {
  const [messages, setMessages] = useState<AttachmentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);
  const [threshold, setThreshold] = useState<Threshold>("5");

  const fetchMessages = useCallback(async (minSize: string) => {
    setLoading(true);
    setSelected(new Set());

    try {
      const res = await fetch(`/api/attachments?minSize=${minSize}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      } else {
        toast.error("Failed to load attachments");
        setMessages([]);
      }
    } catch {
      toast.error("Failed to load attachments");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages(threshold);
  }, [threshold, fetchMessages]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === messages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(messages.map((m) => m.messageId)));
    }
  };

  const selectedSize = messages
    .filter((m) => selected.has(m.messageId))
    .reduce((sum, m) => sum + m.sizeEstimate, 0);

  const totalSize = messages.reduce((sum, m) => sum + m.sizeEstimate, 0);

  const runAction = async (action: "archive" | "trash") => {
    if (selected.size === 0) return;
    setActing(true);

    try {
      const res = await fetch(`/api/actions/${action}-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: Array.from(selected) }),
      });

      if (res.ok) {
        const data = await res.json();
        const count = data.archived || data.trashed || 0;
        toast.success(
          `${action === "archive" ? "Archived" : "Trashed"} ${count.toLocaleString()} messages (${formatSize(selectedSize)})`
        );
        // Remove actioned messages from UI
        setMessages((prev) =>
          prev.filter((m) => !selected.has(m.messageId))
        );
        setSelected(new Set());
      } else {
        toast.error(`Failed to ${action} messages`);
      }
    } catch {
      toast.error(`Failed to ${action} messages`);
    } finally {
      setActing(false);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Large Attachments
          </h2>
          <p className="text-sm text-muted-foreground">
            Find and remove emails with large attachments to reclaim storage
          </p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selected.size} selected ({formatSize(selectedSize)})
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={acting}
              onClick={() => runAction("archive")}
            >
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              Archive
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={acting}
              onClick={() => runAction("trash")}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Trash
            </Button>
          </div>
        )}
      </div>

      {/* Threshold selector */}
      <Tabs
        value={threshold}
        onValueChange={(v) => setThreshold(v as Threshold)}
      >
        <TabsList>
          <TabsTrigger value="5">&gt; 5 MB</TabsTrigger>
          <TabsTrigger value="10">&gt; 10 MB</TabsTrigger>
          <TabsTrigger value="20">&gt; 20 MB</TabsTrigger>
          <TabsTrigger value="100">&gt; 100 MB</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary */}
      {messages.length > 0 && (
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm">
              <span className="font-semibold">
                {messages.length.toLocaleString()}
              </span>{" "}
              messages using{" "}
              <span className="font-semibold">{formatSize(totalSize)}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Message list */}
      {messages.length > 0 && (
        <Card>
          <CardContent className="p-0">
            {/* Select all header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Checkbox
                checked={
                  selected.size === messages.length && messages.length > 0
                }
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground font-medium">
                Select all
              </span>
            </div>

            {/* Message rows */}
            {messages.map((msg) => {
              const sender = parseSenderDisplay(msg.from);
              return (
                <div
                  key={msg.messageId}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selected.has(msg.messageId)}
                    onCheckedChange={() => toggleSelect(msg.messageId)}
                  />
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {sender.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {msg.subject}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(msg.date)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap min-w-[70px] text-right">
                    {formatSize(msg.sizeEstimate)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {messages.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Paperclip className="h-10 w-10 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">
              No large attachments found
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No emails with attachments larger than {threshold} MB were found
              in your mailbox.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
