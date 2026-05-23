"use client";

import { useQuery } from '@tanstack/react-query';
import type { SectionType } from '@/lib/ai/types';
import { listAnalysisHistory, listSchedules } from './api-client';

export function useSchedules() {
  return useQuery({
    queryKey: ['schedules'],
    queryFn: listSchedules,
    staleTime: 30 * 1000,
  });
}

export function useAnalysisHistory(ticker: string, sectionType: SectionType) {
  return useQuery({
    queryKey: ['analysis-history', ticker, sectionType],
    queryFn: () => listAnalysisHistory(ticker, sectionType),
    staleTime: 5 * 60 * 1000,
    enabled: ticker.length > 0,
  });
}
