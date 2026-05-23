import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchAnalyst } from '@/lib/finance/adapters/analyst.adapter';
import { fetchEarnings } from '@/lib/finance/adapters/earnings.adapter';
import { fetchNews } from '@/lib/finance/adapters/news.adapter';
import { fetchOptions } from '@/lib/finance/adapters/options.adapter';
import { fetchPrice } from '@/lib/finance/adapters/price.adapter';
import { fetchProfile } from '@/lib/finance/adapters/profile.adapter';
import { financeLogger } from '@/lib/logger';
import { tickerSchema } from '@/lib/finance/schemas';
import {
  DATA_TYPES,
  type AdapterResult,
  type DataType,
} from '@/lib/finance/types';

const ADAPTERS: Record<
  DataType,
  (ticker: string) => Promise<AdapterResult<unknown>>
> = {
  price: fetchPrice,
  earnings: fetchEarnings,
  analyst: fetchAnalyst,
  options: fetchOptions,
  profile: fetchProfile,
  news: fetchNews,
};

function isDataType(value: string): value is DataType {
  return (DATA_TYPES as readonly string[]).includes(value);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticker } = await params;
    const parsedTicker = tickerSchema.safeParse(ticker);
    if (!parsedTicker.success) {
      return NextResponse.json(
        { error: 'Invalid ticker format' },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const rawType = url.searchParams.get('type') ?? 'price';
    if (!isDataType(rawType)) {
      return NextResponse.json(
        { error: 'Invalid data type' },
        { status: 400 },
      );
    }

    const result = await ADAPTERS[rawType](parsedTicker.data);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    financeLogger.error({ err: error }, 'finance route unhandled error');
    // Surface a user-actionable hint when the failure originates from the
    // upstream finance data source (Yahoo Finance rate limiting is the
    // dominant cause); generic 500 otherwise.
    const rawMessage =
      error instanceof Error ? error.message.toLowerCase() : '';
    const isUpstreamFailure =
      rawMessage.includes('yahoo') || rawMessage.includes('rate limit');
    return NextResponse.json(
      {
        error: isUpstreamFailure
          ? 'Market data temporarily unavailable — showing cached results when possible'
          : 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}
