"use client";

import { useEffect, useMemo, useRef } from 'react';
import {
  createChart,
  LineStyle,
  type IChartApi,
  type Time,
} from 'lightweight-charts';
import { useEarnings } from '@/lib/finance/hooks';
import FreshnessIndicator from '@/components/dashboard/FreshnessIndicator';

interface Props {
  ticker: string;
}

type QuarterlyPoint = {
  date: string;
  actual: number | null;
  estimate: number | null;
};

type SeriesPoint = { time: Time; value: number };

// WHY: lightweight-charts requires a parseable Time value (ISO 'YYYY-MM-DD'
// or epoch seconds). Yahoo's earnings labels look like '4Q2024' or '1Q2025',
// so we map each quarter to the last day of that quarter for ordering.
const QUARTER_LABEL = /^([1-4])Q(\d{4})$/i;
const QUARTER_END_MMDD: Record<string, string> = {
  '1': '03-31',
  '2': '06-30',
  '3': '09-30',
  '4': '12-31',
};

function quarterLabelToDate(label: string | undefined | null): string | null {
  if (!label) return null;
  const match = QUARTER_LABEL.exec(label);
  if (match) {
    const q = match[1]!;
    const year = match[2]!;
    return `${year}-${QUARTER_END_MMDD[q]}`;
  }
  // Already an ISO-ish date? Validate via Date.parse.
  const parsed = Date.parse(label);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return null;
}

// Advance an ISO yyyy-mm-dd date by one quarter, returning the new
// quarter-end date string. Used to project the forward currentQuarterEstimate
// point when its own label is unavailable.
function nextQuarterEnd(iso: string): string | null {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  const d = new Date(parsed);
  // Bump into the next quarter: add ~95 days then normalise to quarter end.
  d.setUTCDate(d.getUTCDate() + 95);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-11
  const qIdx = Math.floor(month / 3); // 0..3
  const qKey = String(qIdx + 1);
  return `${year}-${QUARTER_END_MMDD[qKey]}`;
}

const COLOR_ACTUAL = '#10b981'; // emerald-500
const COLOR_ESTIMATE = '#38bdf8'; // sky-400
const COLOR_AXIS = '#94a3b8';

function Skeleton() {
  return (
    <section
      aria-label="Loading trend"
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="animate-pulse space-y-4">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-[220px] w-full rounded bg-muted" />
          <div className="h-[220px] w-full rounded bg-muted" />
        </div>
      </div>
    </section>
  );
}

function buildChart(container: HTMLDivElement): IChartApi {
  return createChart(container, {
    width: container.clientWidth,
    height: 200,
    layout: {
      background: { color: 'transparent' },
      textColor: COLOR_AXIS,
    },
    grid: {
      vertLines: { color: 'rgba(148, 163, 184, 0.1)' },
      horzLines: { color: 'rgba(148, 163, 184, 0.1)' },
    },
    timeScale: { visible: false, borderVisible: false },
    rightPriceScale: { borderVisible: false },
    handleScroll: false,
    handleScale: false,
  });
}

function EpsBarChart({ points }: { points: QuarterlyPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pre-compute the histogram series data so the effect stays small.
  const { actualData, estimateData } = useMemo(() => {
    const actual: SeriesPoint[] = [];
    const estimate: SeriesPoint[] = [];
    for (const p of points) {
      const iso = quarterLabelToDate(p.date);
      if (!iso) continue;
      if (p.actual != null) actual.push({ time: iso as Time, value: p.actual });
      if (p.estimate != null)
        estimate.push({ time: iso as Time, value: p.estimate });
    }
    actual.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    estimate.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    return { actualData: actual, estimateData: estimate };
  }, [points]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = buildChart(container);
    const actualSeries = chart.addHistogramSeries({
      color: COLOR_ACTUAL,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    const estimateSeries = chart.addHistogramSeries({
      color: COLOR_ESTIMATE,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    actualSeries.setData(actualData);
    estimateSeries.setData(estimateData);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [actualData, estimateData]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          EPS — Actual vs Estimate
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: COLOR_ACTUAL }}
            />
            Actual
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: COLOR_ESTIMATE }}
            />
            Estimate
          </span>
        </div>
      </div>
      <div ref={containerRef} className="h-[200px] w-full" />
    </div>
  );
}

function EpsTrendChart({
  points,
  currentQuarterEstimate,
}: {
  points: QuarterlyPoint[];
  currentQuarterEstimate: number | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { actualData, forwardData } = useMemo(() => {
    const actual: SeriesPoint[] = [];
    for (const p of points) {
      const iso = quarterLabelToDate(p.date);
      if (!iso || p.actual == null) continue;
      actual.push({ time: iso as Time, value: p.actual });
    }
    actual.sort((a, b) => String(a.time).localeCompare(String(b.time)));

    const forward: SeriesPoint[] = [];
    if (currentQuarterEstimate != null && actual.length > 0) {
      const lastIso = String(actual[actual.length - 1]!.time);
      const projected = nextQuarterEnd(lastIso);
      if (projected) {
        // Bridge from last actual to forward estimate so the dashed segment
        // connects visually rather than floating alone.
        forward.push(actual[actual.length - 1]!);
        forward.push({
          time: projected as Time,
          value: currentQuarterEstimate,
        });
      }
    }
    return { actualData: actual, forwardData: forward };
  }, [points, currentQuarterEstimate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = buildChart(container);
    const trendSeries = chart.addLineSeries({
      color: COLOR_ACTUAL,
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    trendSeries.setData(actualData);

    if (forwardData.length >= 2) {
      const forwardSeries = chart.addLineSeries({
        color: COLOR_ESTIMATE,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      });
      forwardSeries.setData(forwardData);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [actualData, forwardData]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">EPS Trend</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-0.5 w-3"
              style={{ backgroundColor: COLOR_ACTUAL }}
            />
            Actual
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-0.5 w-3 border-t border-dashed"
              style={{ borderColor: COLOR_ESTIMATE }}
            />
            Forward estimate
          </span>
        </div>
      </div>
      <div ref={containerRef} className="h-[200px] w-full" />
    </div>
  );
}

export default function QoQYoYTrend({ ticker }: Props) {
  const earnings = useEarnings(ticker);

  if (earnings.isLoading) {
    return <Skeleton />;
  }

  if (earnings.isError) {
    return (
      <section
        aria-label="QoQ / YoY Trend"
        className="rounded-lg border border-border bg-card p-6"
      >
        <h2 className="mb-2 text-base font-semibold text-foreground">
          QoQ / YoY Trend
        </h2>
        <p className="text-sm text-muted-foreground">
          Failed to load trend data
        </p>
      </section>
    );
  }

  const earningsData = earnings.data?.data ?? null;
  const quarterly = earningsData?.earningsChart?.quarterly ?? [];
  const currentQuarterEstimate =
    earningsData?.earningsChart?.currentQuarterEstimate ?? null;
  const isStale = earnings.data?.stale === true;

  const hasAnyPoint = quarterly.some(
    (q) => q.actual != null || q.estimate != null,
  );

  return (
    <section
      aria-label="QoQ / YoY Trend"
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-foreground">
          QoQ / YoY Trend
        </h2>
        <FreshnessIndicator
          updatedAt={earnings.dataUpdatedAt || null}
          fromCache={earnings.data?.fromCache ?? false}
          forceStale={isStale}
        />
      </div>

      {!hasAnyPoint ? (
        <p className="text-sm text-muted-foreground">
          No trend data available
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <EpsBarChart points={quarterly} />
          <EpsTrendChart
            points={quarterly}
            currentQuarterEstimate={currentQuarterEstimate}
          />
        </div>
      )}
    </section>
  );
}
