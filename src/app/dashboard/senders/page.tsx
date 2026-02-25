"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClutterScoreBadge } from "@/components/shared/clutter-score-badge";
import { CategoryBadge } from "@/components/shared/category-badge";
import {
  ArrowUpDown,
  Loader2,
  MailMinus,
  Archive,
  Trash2,
  Search,
} from "lucide-react";
import { toast } from "sonner";

interface Sender {
  id: string;
  senderAddress: string;
  senderName: string | null;
  senderDomain: string;
  totalCount: number;
  readCount: number;
  openRate: number;
  clutterScore: number;
  category: string | null;
  hasListUnsubscribe: boolean;
  userAction: string | null;
  sampleSubjects: string[];
}

export default function SendersPage() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState("clutterScore");
  const [order, setOrder] = useState("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchSenders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      sort,
      order,
      page: String(page),
      limit: "50",
    });
    if (search) params.set("search", search);
    if (category !== "all") params.set("category", category);

    try {
      const res = await fetch(`/api/senders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSenders(data.senders);
        setTotal(data.total);
      }
    } catch {
      toast.error("Failed to fetch senders");
    } finally {
      setLoading(false);
    }
  }, [sort, order, search, category, page]);

  useEffect(() => {
    fetchSenders();
  }, [fetchSenders]);

  const toggleSort = (col: string) => {
    if (sort === col) {
      setOrder(order === "desc" ? "asc" : "desc");
    } else {
      setSort(col);
      setOrder("desc");
    }
  };

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

  const runAction = async (action: string) => {
    if (selected.size === 0) return;
    setActing(true);

    try {
      const res = await fetch(`/api/actions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderIds: Array.from(selected) }),
      });

      if (res.ok) {
        toast.success(
          `${action} completed for ${selected.size} sender(s)`
        );
        setSelected(new Set());
        fetchSenders();
      } else {
        toast.error(`Failed to ${action}`);
      }
    } catch {
      toast.error(`Failed to ${action}`);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Senders</h2>
        <p className="text-sm text-muted-foreground">
          All senders ranked by clutter score
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search senders..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="newsletter">Newsletter</SelectItem>
            <SelectItem value="promo">Promo</SelectItem>
            <SelectItem value="social">Social</SelectItem>
            <SelectItem value="transactional">Transactional</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="job_alert">Job Alert</SelectItem>
            <SelectItem value="automated">Automated</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              disabled={acting}
              onClick={() => runAction("unsubscribe")}
            >
              <MailMinus className="mr-1.5 h-3.5 w-3.5" />
              Unsubscribe
            </Button>
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
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    senders.length > 0 && selected.size === senders.length
                  }
                  onCheckedChange={selectAll}
                />
              </TableHead>
              <TableHead>Sender</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => toggleSort("totalCount")}
                >
                  Emails
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Category</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => toggleSort("openRate")}
                >
                  Open Rate
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => toggleSort("clutterScore")}
                >
                  Clutter
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : senders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-muted-foreground"
                >
                  No senders found. Run a scan first.
                </TableCell>
              </TableRow>
            ) : (
              senders.map((sender) => (
                <TableRow key={sender.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(sender.id)}
                      onCheckedChange={() => toggleSelect(sender.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[250px]">
                        {sender.senderName || sender.senderAddress}
                      </p>
                      {sender.senderName && (
                        <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {sender.senderAddress}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {sender.totalCount}
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={sender.category} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {Math.round(sender.openRate * 100)}%
                  </TableCell>
                  <TableCell>
                    <ClutterScoreBadge score={sender.clutterScore} />
                  </TableCell>
                  <TableCell>
                    {sender.userAction && (
                      <span className="text-xs text-muted-foreground capitalize">
                        {sender.userAction}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 50 + 1}-{Math.min(page * 50, total)} of{" "}
            {total}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page * 50 >= total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
