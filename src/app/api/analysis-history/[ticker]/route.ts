import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  SECTION_TYPES,
  type SectionContent,
  type SectionType,
  type SourcesData,
} from '@/lib/ai/types';
import { tickerSchema } from '@/lib/finance/schemas';
import { aiLogger } from '@/lib/logger';
import type { SerializedAnalysisHistory } from '@/lib/scheduling/types';
import type { AnalysisHistory } from '@prisma/client';

export const runtime = 'nodejs';

function isSectionType(value: string): value is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(value);
}

function serialize(row: AnalysisHistory): SerializedAnalysisHistory {
  return {
    id: row.id,
    userId: row.userId,
    ticker: row.ticker,
    sectionType: row.sectionType as SectionType,
    content: row.content as unknown as SectionContent,
    sources: row.sources as unknown as SourcesData,
    model: row.model,
    generatedAt: row.generatedAt.toISOString(),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
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

    const rows = await db.analysisHistory.findMany({
      where: {
        userId: session.user.id,
        ticker: parsedTicker.data,
        sectionType: rawSection,
      },
      orderBy: { generatedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ data: rows.map(serialize) });
  } catch (err) {
    aiLogger.error({ err }, 'Failed to list analysis history');
    return NextResponse.json(
      { error: 'Failed to load analysis history' },
      { status: 500 },
    );
  }
}
