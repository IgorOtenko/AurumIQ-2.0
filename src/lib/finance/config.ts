/**
 * Cache TTLs in milliseconds, tuned per data volatility.
 * Lower TTL = fresher data + more API calls; higher = fewer calls
 * but staler reads. Trade-off chosen per data class.
 */
export const CACHE_TTL = {
  /** Quotes move tick-by-tick during market hours. 15min keeps the dashboard usable without hammering Yahoo. */
  price: 15 * 60 * 1000,
  /** Earnings update quarterly; intra-day refresh is wasted. */
  earnings: 24 * 60 * 60 * 1000,
  /** Analyst notes drop on a rolling basis, mostly pre-market. */
  analyst: 12 * 60 * 60 * 1000,
  /** Options pricing breathes with implied vol — needs frequent refresh during trading. */
  options: 60 * 60 * 1000,
  /** Company profile / sector / employees rarely change. */
  profile: 7 * 24 * 60 * 60 * 1000,
  /** News is time-sensitive but not real-time; 30min is the sweet spot. */
  news: 30 * 60 * 1000,
} as const;

export type CacheTtlKey = keyof typeof CACHE_TTL;
