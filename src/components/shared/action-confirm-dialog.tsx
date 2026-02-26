"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

interface ActionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: string;
  senderCount: number;
  estimatedEmails: number;
  topSenderNames: string[];
  onConfirm: () => void;
  loading?: boolean;
}

const actionLabels: Record<string, { verb: string; description: string }> = {
  archive: {
    verb: "Archive",
    description: "Move all emails from these senders out of your inbox.",
  },
  trash: {
    verb: "Trash",
    description:
      "Move all emails from these senders to trash. Recoverable within 30 days.",
  },
  unsubscribe: {
    verb: "Unsubscribe",
    description:
      "Send unsubscribe requests to these senders. This cannot be undone.",
  },
};

export function ActionConfirmDialog({
  open,
  onOpenChange,
  actionType,
  senderCount,
  estimatedEmails,
  topSenderNames,
  onConfirm,
  loading = false,
}: ActionConfirmDialogProps) {
  const action = actionLabels[actionType] || {
    verb: actionType,
    description: "",
  };
  const isDestructive = actionType === "trash" || actionType === "unsubscribe";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDestructive && (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            Confirm {action.verb}
          </DialogTitle>
          <DialogDescription>{action.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm">
            You are about to{" "}
            <span className="font-semibold lowercase">{action.verb}</span>{" "}
            <span className="font-semibold">{senderCount}</span> sender
            {senderCount !== 1 ? "s" : ""}
            {estimatedEmails > 0 && (
              <>
                {" "}
                (~
                <span className="font-semibold">
                  {estimatedEmails.toLocaleString()}
                </span>{" "}
                emails)
              </>
            )}
          </p>

          {topSenderNames.length > 0 && (
            <div className="rounded-md border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1.5">
                Including:
              </p>
              <ul className="space-y-0.5">
                {topSenderNames.slice(0, 5).map((name, i) => (
                  <li key={i} className="text-sm truncate">
                    {name}
                  </li>
                ))}
                {senderCount > 5 && (
                  <li className="text-xs text-muted-foreground">
                    +{senderCount - 5} more...
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {action.verb} {senderCount} sender{senderCount !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
