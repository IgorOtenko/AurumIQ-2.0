import Link from "next/link";
import SectionWrapper from "@/components/dashboard/SectionWrapper";
import SectionSkeleton from "@/components/dashboard/SectionSkeleton";
import StockTickerBar from "@/components/portfolio/StockTickerBar";

const TICKER_REGEX = /^[A-Z0-9.]{1,10}$/;

const SECTION_TITLES = [
  "Stock Header",
  "Numbers Going In",
  "QoQ / YoY Trend",
  "Segment Expectations",
  "Expected Move & Options",
  "Bull vs Bear",
  "Catalysts & Risks",
  "Live on the Call",
  "Analyst Setup",
  "Sources",
] as const;

// Stock Header spans the full grid width above the 2-column section grid.
const FULL_WIDTH_INDEXES = new Set<number>([0]);

export default async function TickerDashboardPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  if (!TICKER_REGEX.test(symbol)) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="bg-card border border-border rounded-lg p-6">
            <h1 className="text-xl font-semibold mb-2">Invalid ticker symbol</h1>
            <p className="text-sm text-muted-foreground mb-4">
              The ticker &quot;{ticker}&quot; is not a valid symbol. Tickers
              must be 1-10 characters using A-Z, 0-9, or a period.
            </p>
            <Link
              href="/dashboard"
              className="text-sm text-sky-400 hover:text-sky-300 underline underline-offset-2"
            >
              Back to Portfolio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link
            href="/dashboard"
            className="text-sm text-sky-400 hover:text-sky-300 underline underline-offset-2"
          >
            Back to Portfolio
          </Link>
          <h1 className="text-2xl font-semibold mt-2">{symbol} — Analysis</h1>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-4">
          <StockTickerBar />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {SECTION_TITLES.map((title, idx) => (
            <div
              key={title}
              className={FULL_WIDTH_INDEXES.has(idx) ? "lg:col-span-2" : ""}
            >
              <SectionWrapper title={title}>
                <SectionSkeleton title={title} />
              </SectionWrapper>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
