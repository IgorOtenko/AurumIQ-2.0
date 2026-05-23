import { auth } from '@/lib/auth';
import AddHoldingForm from '@/components/portfolio/AddHoldingForm';
import PortfolioTable from '@/components/portfolio/PortfolioTable';
import StockTickerBar from '@/components/portfolio/StockTickerBar';

export default async function DashboardPage() {
  const session = await auth();
  const displayName = session?.user?.name || session?.user?.email || 'User';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">AurumIQ</h1>
            <span className="text-sm text-muted-foreground">{displayName}</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-4">
          <StockTickerBar />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-3">Add Holding</h2>
          <AddHoldingForm />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Portfolio</h2>
          <PortfolioTable />
        </section>
      </main>
    </div>
  );
}
