export interface SenderProfile {
  id: string;
  userId: string;
  scanId: string;
  senderAddress: string;
  senderName: string | null;
  senderDomain: string;
  totalCount: number;
  readCount: number;
  unreadCount: number;
  starredCount: number;
  openRate: number;
  sampleSubjects: string[];
  hasListUnsubscribe: boolean;
  listUnsubscribeValue: string | null;
  listUnsubscribePostValue: string | null;
  oldestEmailAt: Date | null;
  newestEmailAt: Date | null;
  avgFrequencyDays: number | null;
  category: string | null;
  categoryConfidence: number | null;
  classifiedAt: Date | null;
  clutterScore: number;
  userAction: string | null;
  userLabel: string | null;
  actionExecutedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserAction =
  | "keep"
  | "unsubscribe"
  | "archive"
  | "trash"
  | null;

export type SenderCategory =
  | "newsletter"
  | "job_alert"
  | "promo"
  | "personal"
  | "social"
  | "transactional"
  | "automated"
  | "other"
  | null;
