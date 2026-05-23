import type {
  AnalystData,
  EarningsData,
  PriceData,
  ProfileData,
} from '@/lib/finance/types';

export const SECTION_TYPES = [
  'bullBear',
  'catalystsRisks',
  'liveOnCall',
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const ANALYSIS_STATUSES = [
  'generating',
  'completed',
  'validation_failed',
  'failed',
] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export interface BullBearContent {
  bullCase: string[];
  bearCase: string[];
  oneLiner: string;
}

export interface CatalystsRisksContent {
  catalysts: string[];
  risks: string[];
}

export interface LiveOnCallContent {
  items: Array<{
    topic: string;
    rationale: string;
  }>;
}

export type SectionContent =
  | BullBearContent
  | CatalystsRisksContent
  | LiveOnCallContent;

// Snapshot of the finance data passed into the prompt. Persisted on the
// Analysis row so we can later validate the model's output against the
// exact inputs it saw, even as the live finance cache evolves.
export interface SourcesData {
  ticker: string;
  price?: PriceData | null;
  earnings?: EarningsData | null;
  analyst?: AnalystData | null;
  profile?: ProfileData | null;
}

// Wire shape of the Analysis row. `generatedAt`/`updatedAt` are ISO strings
// (the Prisma Date objects don't survive JSON serialization unchanged).
export interface SerializedAnalysis {
  id: string;
  userId: string;
  ticker: string;
  sectionType: SectionType;
  status: AnalysisStatus;
  content: SectionContent | null;
  sources: SourcesData;
  model: string;
  errorMessage: string | null;
  generatedAt: string;
  updatedAt: string;
}
