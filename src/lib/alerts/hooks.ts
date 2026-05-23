"use client";

import { useQuery } from '@tanstack/react-query';
import { listEarningsAlerts, listPriceAlerts } from './api-client';

export function usePriceAlerts() {
  return useQuery({
    queryKey: ['alerts', 'price'],
    queryFn: listPriceAlerts,
    staleTime: 30 * 1000,
  });
}

export function useEarningsAlerts() {
  return useQuery({
    queryKey: ['alerts', 'earnings'],
    queryFn: listEarningsAlerts,
    staleTime: 30 * 1000,
  });
}
