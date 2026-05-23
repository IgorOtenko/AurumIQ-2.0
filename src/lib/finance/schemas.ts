import { z } from 'zod';

export const tickerSchema = z
  .string()
  .regex(/^[A-Z0-9.]{1,10}$/, 'Invalid ticker format');

// Yahoo Finance returns NaN/null/missing for many fields depending on
// security type (ETFs lack earnings, ADRs lack analyst coverage, etc.).
// Every field is .nullable().optional() so partial responses survive
// validation and we can degrade gracefully instead of throwing.
const priceModuleSchema = z
  .object({
    regularMarketPrice: z.number().nullable().optional(),
    regularMarketChange: z.number().nullable().optional(),
    regularMarketChangePercent: z.number().nullable().optional(),
    regularMarketVolume: z.number().nullable().optional(),
    marketCap: z.number().nullable().optional(),
    currency: z.string().nullable().optional(),
    shortName: z.string().nullable().optional(),
    longName: z.string().nullable().optional(),
  })
  .passthrough();

const summaryDetailSchema = z
  .object({
    marketCap: z.number().nullable().optional(),
  })
  .passthrough();

export const PriceDataSchema = z
  .object({
    price: priceModuleSchema.optional(),
    summaryDetail: summaryDetailSchema.optional(),
  })
  .passthrough();

export type PriceDataRaw = z.infer<typeof PriceDataSchema>;

const earningsChartSchema = z
  .object({
    quarterly: z
      .array(
        z
          .object({
            date: z.union([z.string(), z.date()]).nullable().optional(),
            actual: z.number().nullable().optional(),
            estimate: z.number().nullable().optional(),
          })
          .passthrough(),
      )
      .optional(),
    currentQuarterEstimate: z.number().nullable().optional(),
  })
  .passthrough();

const financialDataSchema = z
  .object({
    currentPrice: z.number().nullable().optional(),
    targetMeanPrice: z.number().nullable().optional(),
    revenueGrowth: z.number().nullable().optional(),
    earningsGrowth: z.number().nullable().optional(),
    profitMargins: z.number().nullable().optional(),
  })
  .passthrough();

export const EarningsDataSchema = z
  .object({
    earnings: z
      .object({ earningsChart: earningsChartSchema.optional() })
      .passthrough()
      .optional(),
    earningsTrend: z
      .object({ trend: z.array(z.unknown()).optional() })
      .passthrough()
      .optional(),
    financialData: financialDataSchema.optional(),
  })
  .passthrough();

const recommendationTrendItemSchema = z
  .object({
    period: z.string().nullable().optional(),
    strongBuy: z.number().nullable().optional(),
    buy: z.number().nullable().optional(),
    hold: z.number().nullable().optional(),
    sell: z.number().nullable().optional(),
    strongSell: z.number().nullable().optional(),
  })
  .passthrough();

const upgradeDowngradeItemSchema = z
  .object({
    firm: z.string().nullable().optional(),
    toGrade: z.string().nullable().optional(),
    fromGrade: z.string().nullable().optional(),
    action: z.string().nullable().optional(),
    epochGradeDate: z
      .union([z.number(), z.string(), z.date()])
      .nullable()
      .optional(),
  })
  .passthrough();

export const AnalystDataSchema = z
  .object({
    recommendationTrend: z
      .object({ trend: z.array(recommendationTrendItemSchema).optional() })
      .passthrough()
      .optional(),
    upgradeDowngradeHistory: z
      .object({ history: z.array(upgradeDowngradeItemSchema).optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

const optionContractSchema = z
  .object({
    strike: z.number().nullable().optional(),
    lastPrice: z.number().nullable().optional(),
    impliedVolatility: z.number().nullable().optional(),
    openInterest: z.number().nullable().optional(),
    volume: z.number().nullable().optional(),
    expiration: z
      .union([z.number(), z.string(), z.date()])
      .nullable()
      .optional(),
  })
  .passthrough();

export const OptionsDataSchema = z
  .object({
    options: z
      .array(
        z
          .object({
            calls: z.array(optionContractSchema).optional(),
            puts: z.array(optionContractSchema).optional(),
            expirationDate: z
              .union([z.number(), z.string(), z.date()])
              .nullable()
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
    expirationDates: z
      .array(z.union([z.number(), z.string(), z.date()]))
      .optional(),
    strikes: z.array(z.number()).optional(),
    hasMiniOptions: z.boolean().optional(),
    underlyingSymbol: z.string().nullable().optional(),
  })
  .passthrough();

const assetProfileSchema = z
  .object({
    sector: z.string().nullable().optional(),
    industry: z.string().nullable().optional(),
    fullTimeEmployees: z.number().nullable().optional(),
    longBusinessSummary: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
  })
  .passthrough();

const defaultKeyStatisticsSchema = z
  .object({
    enterpriseValue: z.number().nullable().optional(),
    forwardPE: z.number().nullable().optional(),
    profitMargins: z.number().nullable().optional(),
    pegRatio: z.number().nullable().optional(),
    beta: z.number().nullable().optional(),
  })
  .passthrough();

export const ProfileDataSchema = z
  .object({
    assetProfile: assetProfileSchema.optional(),
    summaryProfile: assetProfileSchema.optional(),
    defaultKeyStatistics: defaultKeyStatisticsSchema.optional(),
  })
  .passthrough();

const newsItemSchema = z
  .object({
    title: z.string().nullable().optional(),
    publisher: z.string().nullable().optional(),
    link: z.string().nullable().optional(),
    providerPublishTime: z
      .union([z.number(), z.string(), z.date()])
      .nullable()
      .optional(),
    uuid: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    thumbnail: z
      .object({ resolutions: z.array(z.unknown()).optional() })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const NewsDataSchema = z
  .object({
    news: z.array(newsItemSchema).optional(),
  })
  .passthrough();

export type EarningsDataRaw = z.infer<typeof EarningsDataSchema>;
export type AnalystDataRaw = z.infer<typeof AnalystDataSchema>;
export type OptionsDataRaw = z.infer<typeof OptionsDataSchema>;
export type ProfileDataRaw = z.infer<typeof ProfileDataSchema>;
export type NewsDataRaw = z.infer<typeof NewsDataSchema>;
