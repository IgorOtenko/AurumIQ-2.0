export type DataType =
  | 'price'
  | 'earnings'
  | 'analyst'
  | 'options'
  | 'profile'
  | 'news';

export const DATA_TYPES: readonly DataType[] = [
  'price',
  'earnings',
  'analyst',
  'options',
  'profile',
  'news',
] as const;

export interface AdapterResult<T> {
  data: T | null;
  fromCache: boolean;
  stale: boolean;
}

export interface PriceData {
  regularMarketPrice: number | null;
  regularMarketChange: number | null;
  regularMarketChangePercent: number | null;
  regularMarketVolume: number | null;
  marketCap: number | null;
  currency?: string | null;
  shortName?: string | null;
  longName?: string | null;
}

export interface EarningsData {
  earningsChart?: {
    quarterly: Array<{
      date: string;
      actual: number | null;
      estimate: number | null;
    }>;
    currentQuarterEstimate: number | null;
  };
  financialData?: {
    currentPrice?: number | null;
    targetMeanPrice?: number | null;
    revenueGrowth?: number | null;
  };
}

export interface AnalystData {
  recommendationTrend?: {
    trend: Array<{
      period: string;
      strongBuy: number;
      buy: number;
      hold: number;
      sell: number;
      strongSell: number;
    }>;
  };
}

export interface OptionsData {
  expirationDates?: number[];
  strikes?: number[];
  hasMiniOptions?: boolean;
}

export interface ProfileData {
  longBusinessSummary?: string | null;
  sector?: string | null;
  industry?: string | null;
  fullTimeEmployees?: number | null;
  website?: string | null;
}

export interface NewsData {
  articles: Array<{
    title: string;
    publisher: string | null;
    link: string;
    providerPublishTime: number | null;
  }>;
}
