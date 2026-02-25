export interface ClassificationInput {
  senderAddress: string;
  senderName: string | null;
  senderDomain: string;
  totalCount: number;
  openRate: number;
  sampleSubjects: string[];
}

export interface ClassificationResult {
  senderAddress: string;
  category: string;
  confidence: number;
}

export interface ClassificationResponse {
  classifications: ClassificationResult[];
}
