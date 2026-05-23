// Prisma's Decimal type does not survive JSON serialization — Holding rows
// are converted to number-typed shapes at the API boundary so React
// components and the wire format share a single representation.

export interface SerializedHolding {
  id: string;
  userId: string;
  ticker: string;
  quantity: number;
  costBasis: number | null;
  addedAt: string;
  updatedAt: string;
}

export type EnrichedHolding = SerializedHolding & {
  currentPrice: number | null;
  currentValue: number | null;
  gainLoss: number | null;
  gainLossPercent: number | null;
};
