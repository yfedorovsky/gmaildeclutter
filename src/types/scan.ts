export type ScanStatus =
  | "pending"
  | "scanning"
  | "grouping"
  | "classifying"
  | "complete"
  | "error";

export interface ScanProgress {
  id: string;
  status: ScanStatus;
  totalMessages: number;
  processedMessages: number;
  totalSenders: number;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}
