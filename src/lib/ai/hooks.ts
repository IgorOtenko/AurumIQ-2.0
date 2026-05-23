"use client";

import { useQuery } from '@tanstack/react-query';
import { fetchLatestAnalysis } from './api-client';
import type { SectionType } from './types';

export function useLatestAnalysis(ticker: string, sectionType: SectionType) {
  return useQuery({
    queryKey: ['analysis', ticker, sectionType],
    queryFn: () => fetchLatestAnalysis(ticker, sectionType),
    staleTime: 60 * 1000,
    enabled: ticker.length > 0,
  });
}
