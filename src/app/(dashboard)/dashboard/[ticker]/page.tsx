import Link from "next/link";
import LazySection from "@/components/dashboard/LazySection";
import SectionSkeleton from "@/components/dashboard/SectionSkeleton";
import SectionWrapper from "@/components/dashboard/SectionWrapper";
import StockTickerBar from "@/components/portfolio/StockTickerBar";
import AnalystSetup from "@/components/sections/AnalystSetup";
import NumbersGoingIn from "@/components/sections/NumbersGoingIn";
import QoQYoYTrend from "@/components/sections/QoQYoYTrend";
import Sources from "@/components/sections/Sources";
import StockHeader from "@/components/sections/StockHeader";

const TICKER_REGEX = /^[A-Z0-9.]{1,10}$/;

// Sections not yet built — Phase 5 ships the 3 AI sections (Bull vs Bear,
// Catalysts & Risks, Live on the Call) and Phase 8 ships Segments + Options.
const PENDING_SECTIONS = [
  "Segment Expectations",
  "Expected Move & Options",
  "Bull vs Bear",
  "Catalysts & Risks",
  "Live on the Call",
] as const;

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

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <LazySection title="Stock Header" className="lg:col-span-2">
          <StockHeader ticker={symbol} />
        </LazySection>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <LazySection title="Numbers Going In">
            <NumbersGoingIn ticker={symbol} />
          </LazySection>

          <LazySection title="QoQ / YoY Trend">
            <QoQYoYTrend ticker={symbol} />
          </LazySection>

          {PENDING_SECTIONS.map((title) => (
            <SectionWrapper key={title} title={title}>
              <SectionSkeleton title={title} />
            </SectionWrapper>
          ))}

          <LazySection title="Analyst Setup">
            <AnalystSetup ticker={symbol} />
          </LazySection>

          <LazySection title="Sources" className="lg:col-span-2">
            <Sources ticker={symbol} />
          </LazySection>
        </div>
      </main>
    </div>
  );
}
