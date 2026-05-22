import Link from 'next/link';
import { ArrowRight, TrendingUp, Sparkles, AlertTriangle, Shield, BarChart3, Database } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden selection:bg-primary/30 selection:text-primary">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <Link
            id="nav-logo"
            href="/"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
          >
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
              AurumIQ
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              id="nav-login"
              href="/login"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              Sign In
            </Link>
            <Link
              id="nav-signup"
              href="/signup"
              className={buttonVariants({ variant: 'default', size: 'sm' }) + " bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"}
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            <span>Now in Beta: AI-Powered Research Engine</span>
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl text-foreground">
            Institutional-Grade Stock Research.{' '}
            <span className="block mt-2 bg-gradient-to-r from-primary via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Powered by Claude AI.
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed">
            AurumIQ aggregates key financial data points and orchestrates advanced LLM reasoning to generate deep, refreshable stock analysis — replacing hours of manual parsing with a unified dashboard view.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              id="hero-get-started"
              href="/signup"
              className={buttonVariants({ variant: 'default', size: 'lg' }) + " h-11 px-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 group"}
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              id="hero-explore"
              href="/login"
              className={buttonVariants({ variant: 'outline', size: 'lg' }) + " h-11 px-8"}
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <section className="mt-32 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Engineered for Serious Investors
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Our structured approach combines raw financial APIs with validated LLM capabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <div className="group relative rounded-xl border border-border/50 bg-card/40 p-6 text-left backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/70">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 transition-colors group-hover:bg-primary/20">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Portfolio Tracking</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Add your holdings, monitor performance, and organize your stocks in a clean, state-of-the-art dashboard interface.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative rounded-xl border border-border/50 bg-card/40 p-6 text-left backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/70">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 mb-4 transition-colors group-hover:bg-emerald-500/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Bull & Bear Thesis</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Get balanced, objective summaries of both optimistic growth narratives and major downside risks for each ticker.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative rounded-xl border border-border/50 bg-card/40 p-6 text-left backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/70">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 mb-4 transition-colors group-hover:bg-cyan-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Catalysts & Risks</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Analyze near-term triggers, macroeconomic headwind exposure, and key metric trends influencing stock valuation.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group relative rounded-xl border border-border/50 bg-card/40 p-6 text-left backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/70">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 mb-4 transition-colors group-hover:bg-amber-500/20">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Hallucination Safeguards</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Strict post-generation validation checks verify all AI metrics against primary financial databases to prevent hallucinations.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group relative rounded-xl border border-border/50 bg-card/40 p-6 text-left backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/70">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 mb-4 transition-colors group-hover:bg-indigo-500/20">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Unified Data Layer</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Consolidated cache system handles rate limits and API schemas cleanly so your dashboards load instantly.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group relative rounded-xl border border-border/50 bg-card/40 p-6 text-left backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/70">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 mb-4 transition-colors group-hover:bg-rose-500/20">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Options Setup & Moves</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Expected volatility analysis, historic earnings move comparisons, and risk-managed options layout recommendations.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/20 py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} AurumIQ Financial Analysis. All rights reserved.</p>
      </footer>
    </div>
  );
}

