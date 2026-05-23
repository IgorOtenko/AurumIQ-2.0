// Wire shapes for alerts. Prisma's Decimal/Date types do not survive
// JSON serialization — every API boundary converts to number/string.

export type AlertDirection = 'above' | 'below';

export interface SerializedPriceAlert {
  id: string;
  userId: string;
  ticker: string;
  direction: AlertDirection;
  threshold: number;
  triggeredAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedEarningsAlert {
  id: string;
  userId: string;
  ticker: string;
  daysBefore: number;
  lastNotifiedDate: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
