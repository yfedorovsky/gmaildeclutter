export interface GmailMessageHeader {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  labelIds: string[];
  listUnsubscribe: string | null;
  listUnsubscribePost: string | null;
}

export interface ParsedSender {
  name: string;
  address: string;
  domain: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: "system" | "user";
  color?: {
    textColor: string;
    backgroundColor: string;
  };
}

export interface GmailFilter {
  id: string;
  criteria: {
    from?: string;
    to?: string;
    subject?: string;
    query?: string;
  };
  action: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
    forward?: string;
  };
}
