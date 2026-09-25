export type EvidenceStatus = "VERIFIED" | "PROXY" | "UNKNOWN";

export interface DataProvenance {
  source: string;
  sourceDate: string;
  evidenceStatus: EvidenceStatus;
  datasetFile?: string;
  sourceUrl?: string;
  caveat?: string;
}
