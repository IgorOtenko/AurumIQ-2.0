import type {
  SectionContent,
  SectionType,
  SourcesData,
} from '@/lib/ai/types';

export interface SerializedSchedule {
  id: string;
  userId: string;
  ticker: string;
  sectionType: SectionType;
  hour: number;
  minute: number;
  timezone: string;
  active: boolean;
  lastRunAt: string | null;
  lastRunDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedAnalysisHistory {
  id: string;
  userId: string;
  ticker: string;
  sectionType: SectionType;
  content: SectionContent;
  sources: SourcesData;
  model: string;
  generatedAt: string;
}
