"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HealthScoreCard } from "@/components/dashboard/health-score-card";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { TopClutterList } from "@/components/dashboard/top-clutter-list";
import { ScanProgress } from "@/components/shared/scan-progress";
import { useScanProgress } from "@/hooks/use-scan-progress";
import { Loader2, ScanSearch, Mail, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const { progress } = useScanProgress(scanId);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Auto-trigger classification when scan reaches "classifying" status
  useEffect(() => {
    if (progress?.status === "classifying") {
      startClassification();
    } else if (progress?.status === "complete") {
      setScanning(false);
      toast.success("Inbox scan complete!");
      fetchStats();
    } else if (progress?.status === "error") {
      setScanning(false);
      toast.error(progress.errorMessage || "Scan failed");
    }
  }, [progress?.status]);

  const startScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      if (!res.ok) throw new Error("Failed to start scan");
      const data = await res.json();
      setScanId(data.scanId);
      toast.info("Scanning your inbox...");
    } catch {
      setScanning(false);
      toast.error("Failed to start scan");
    }
  };

  const startClassification = async () => {
    try {
      await fetch("/api/classify", { method: "POST" });
      toast.info("AI classification started...");
    } catch {
      toast.error("Failed to start classification");
    }
  };

  const executeAiSuggestion = async () => {
    if (!stats?.topClutter?.[0]) return;
    try {
      const res = await fetch("/api/actions/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderIds: [stats.topClutter[0].id] }),
      });
      if (res.ok) {
        toast.success(
          `Trashed all emails from ${stats.topClutter[0].senderName || stats.topClutter[0].senderAddress}`
        );
        fetchStats();
      } else {
        toast.error("Failed to trash emails");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasScan = stats?.scan;
  const isClassifying = stats?.scan?.status === "classifying";

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Your inbox at a glance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isClassifying && (
            <Button size="sm" variant="outline" onClick={startClassification}>
              Run AI Classification
            </Button>
          )}
          <Button size="sm" onClick={startScan} disabled={scanning}>
            {scanning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ScanSearch className="mr-2 h-4 w-4" />
            )}
            {scanning ? "Scanning..." : hasScan ? "Re-scan" : "Scan Inbox"}
          </Button>
        </div>
      </div>

      {/* Scan progress */}
      {scanning && progress && (
        <ScanProgress
          status={progress.status}
          totalMessages={progress.totalMessages}
          processedMessages={progress.processedMessages}
          totalSenders={progress.totalSenders}
        />
      )}

      {/* Proactive AI Insight */}
      {stats?.healthScore != null &&
        stats.healthScore < 50 &&
        stats?.topClutter?.[0] && (
          <div className="bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">AI Suggestion</p>
              <p className="text-sm text-muted-foreground">
                Trashing{" "}
                {stats.topClutter[0].totalCount.toLocaleString()} emails from{" "}
                <span className="font-medium text-foreground">
                  {stats.topClutter[0].senderName ||
                    stats.topClutter[0].senderAddress}
                </span>{" "}
                will improve your health score instantly.
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="shrink-0"
              onClick={executeAiSuggestion}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              One-Click Trash
            </Button>
          </div>
        )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 auto-rows-[160px]">
        {/* Health Score — tall card spanning 2 rows */}
        <div className="md:col-span-2 lg:col-span-2 row-span-2">
          <HealthScoreCard
            score={stats?.healthScore ?? null}
            className="h-full"
          />
        </div>

        {/* Total Emails — single row */}
        <div className="md:col-span-2 lg:col-span-2 row-span-1">
          <Card className="h-full flex justify-center">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">
                Total Emails
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-3xl font-bold">
                  {stats?.totalEmails?.toLocaleString() || 0}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unique Senders — single row */}
        <div className="md:col-span-2 lg:col-span-2 row-span-1">
          <Card className="h-full flex justify-center">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">
                Unique Senders
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-3xl font-bold">
                  {stats?.totalSenders?.toLocaleString() || 0}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Clutter List — wide, tall card */}
        <div className="md:col-span-4 lg:col-span-4 row-span-3 h-full">
          <TopClutterList senders={stats?.topClutter || []} />
        </div>

        {/* Category Chart — tucked under Health Score */}
        <div className="md:col-span-4 lg:col-span-2 row-span-2 h-full">
          <CategoryChart categories={stats?.categories || {}} />
        </div>
      </div>

      {/* Empty state */}
      {!hasScan && !scanning && (
        <Card>
          <CardContent className="p-12 text-center">
            <ScanSearch className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No scans yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Scan your inbox to discover clutter, get AI-powered
              categorization, and take back control.
            </p>
            <Button className="mt-6" onClick={startScan}>
              <ScanSearch className="mr-2 h-4 w-4" />
              Scan My Inbox
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
