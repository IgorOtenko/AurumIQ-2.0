import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateSection } from '@/lib/ai/generate';
import {
  SECTION_TYPES,
  type SectionType,
  type SerializedAnalysis,
  type SourcesData,
} from '@/lib/ai/types';
import { fetchAnalyst } from '@/lib/finance/adapters/analyst.adapter';
import { fetchEarnings } from '@/lib/finance/adapters/earnings.adapter';
import { fetchPrice } from '@/lib/finance/adapters/price.adapter';
import { fetchProfile } from '@/lib/finance/adapters/profile.adapter';
import { tickerSchema } from '@/lib/finance/schemas';
import { aiLogger } from '@/lib/logger';
import type { Analysis } from '@prisma/client';

export const runtime = 'nodejs';

function isSectionType(value: string): value is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(value);
}

function serializeAnalysis(row: Analysis): SerializedAnalysis {
  return {
    id: row.id,
    userId: row.userId,
    ticker: row.ticker,
    sectionType: row.sectionType as SectionType,
    status: row.status as SerializedAnalysis['status'],
    content: (row.content as SerializedAnalysis['content']) ?? null,
    sources: row.sources as unknown as SourcesData,
    model: row.model,
    errorMessage: row.errorMessage,
    generatedAt: row.generatedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { ticker: rawTicker } = await params;
  const parsedTicker = tickerSchema.safeParse(rawTicker);
  if (!parsedTicker.success) {
    return NextResponse.json(
      { error: 'Invalid ticker format' },
      { status: 400 },
    );
  }
  const ticker = parsedTicker.data;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sectionType =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).sectionType
      : undefined;
  if (typeof sectionType !== 'string' || !isSectionType(sectionType)) {
    return NextResponse.json(
      { error: 'Invalid or missing sectionType' },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(event, data)));

      // Phase-label the failure mode so the UI can show an actionable message:
      // fetch failures usually resolve themselves in a few minutes (Yahoo
      // Finance rate limits, transient DNS), while generation failures are
      // billing/quota/API-key issues that won't fix on retry.
      let phase: 'fetch' | 'generate' = 'fetch';
      try {
        send('progress', { step: 'fetching_data' });

        const [price, earnings, analyst, profile] = await Promise.all([
          fetchPrice(ticker),
          fetchEarnings(ticker),
          fetchAnalyst(ticker),
          fetchProfile(ticker),
        ]);

        const sources: SourcesData = {
          ticker,
          price: price.data,
          earnings: earnings.data,
          analyst: analyst.data,
          profile: profile.data,
        };

        phase = 'generate';
        send('progress', { step: 'generating' });

        const analysis = await generateSection({
          userId,
          ticker,
          sectionType,
          sources,
        });

        send('progress', { step: 'validating' });

        send('complete', { analysis: serializeAnalysis(analysis) });
      } catch (err) {
        aiLogger.error(
          { err, userId, ticker, sectionType, phase },
          'SSE stream error',
        );
        const message =
          phase === 'fetch'
            ? `Failed to fetch market data for ${ticker} — try again in a few minutes`
            : err instanceof Error
              ? err.message
              : 'Unexpected error';
        send('error', { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ticker: rawTicker } = await params;
  const parsedTicker = tickerSchema.safeParse(rawTicker);
  if (!parsedTicker.success) {
    return NextResponse.json(
      { error: 'Invalid ticker format' },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const rawSection = url.searchParams.get('sectionType');
  if (!rawSection || !isSectionType(rawSection)) {
    return NextResponse.json(
      { error: 'Invalid or missing sectionType' },
      { status: 400 },
    );
  }

  const row = await db.analysis.findUnique({
    where: {
      userId_ticker_sectionType: {
        userId: session.user.id,
        ticker: parsedTicker.data,
        sectionType: rawSection,
      },
    },
  });

  return NextResponse.json({
    data: row ? serializeAnalysis(row) : null,
  });
}
