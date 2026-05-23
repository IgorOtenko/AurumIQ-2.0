"use client";

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchFinanceData } from './api-client';
import type {
  AdapterResult,
  PriceData,
  EarningsData,
  AnalystData,
  OptionsData,
  ProfileData,
  NewsData,
} from './types';

const ONE_HOUR = 60 * 60 * 1000;

function useFinance<T>(
  ticker: string,
  type: 'price' | 'earnings' | 'analyst' | 'options' | 'profile' | 'news',
  enabled = true,
): UseQueryResult<AdapterResult<T>> {
  return useQuery({
    queryKey: ['finance', ticker, type],
    queryFn: () => fetchFinanceData(ticker, type) as Promise<AdapterResult<T>>,
    staleTime: ONE_HOUR,
    enabled: enabled && ticker.length > 0,
  });
}

export const usePrice = (ticker: string, enabled?: boolean) =>
  useFinance<PriceData>(ticker, 'price', enabled);
export const useEarnings = (ticker: string, enabled?: boolean) =>
  useFinance<EarningsData>(ticker, 'earnings', enabled);
export const useAnalyst = (ticker: string, enabled?: boolean) =>
  useFinance<AnalystData>(ticker, 'analyst', enabled);
export const useOptions = (ticker: string, enabled?: boolean) =>
  useFinance<OptionsData>(ticker, 'options', enabled);
export const useProfile = (ticker: string, enabled?: boolean) =>
  useFinance<ProfileData>(ticker, 'profile', enabled);
export const useNews = (ticker: string, enabled?: boolean) =>
  useFinance<NewsData>(ticker, 'news', enabled);
