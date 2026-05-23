import { describe, it, expect } from 'vitest';
import { validateTraceability } from '../validation';

// Traceability validator: the model's load-bearing numbers must be findable
// in the snapshot sources, either directly or via common transformations
// (decimal ↔ percent, compact billions, pairwise derivation, rounding).
// These cases lock in the regressions we caught during Phase 5 verification.
describe('validateTraceability', () => {
  it('passes for a direct numeric match', () => {
    // Source value 0.062 with the model writing "$0.062" — the dollar sign
    // is incidental; the value itself is present in the source verbatim.
    const result = validateTraceability(
      { thesis: 'EPS came in at $0.062 for the quarter.' },
      { earnings: { eps: 0.062 } },
    );
    expect(result.valid).toBe(true);
  });

  it('accepts decimal-to-percent conversion (AAPL regression)', () => {
    // Phase 5 regression: source ships growth rates as decimals (0.166),
    // model legitimately formats them as percents ("16.6%"). Validator
    // must accept the × 100 conversion or every section fails.
    const result = validateTraceability(
      { thesis: 'Operating margin expanded to 16.6%.' },
      { financialData: { operatingMargin: 0.166 } },
    );
    expect(result.valid).toBe(true);
  });

  it('accepts compact billion scaling ($740B from raw)', () => {
    // Yahoo Finance returns market cap as 740_000_000_000; the model
    // writes "$740B". Validator must collapse the 1e9 multiplier.
    const result = validateTraceability(
      { thesis: 'Market cap stands at $740B.' },
      { price: { marketCap: 740_000_000_000 } },
    );
    expect(result.valid).toBe(true);
  });

  it('accepts pairwise-derived implied upside (NVDA regression)', () => {
    // Phase 5 regression: target price 294.22, current price 215.33,
    // model writes "36.6% upside" from (294.22 - 215.33) / 215.33 * 100.
    // Validator must recognise this as legitimate analytical math.
    const result = validateTraceability(
      { thesis: 'Implies 36.6% upside to the consensus target.' },
      {
        analyst: { targetMeanPrice: 294.22 },
        price: { regularMarketPrice: 215.33 },
      },
    );
    expect(result.valid).toBe(true);
  });

  it('does not require traceability for small bare integers', () => {
    // "4 quarters" and "12 months" are ordinals / counts. Forcing them
    // to appear in source would reject nearly every analysis paragraph.
    const result = validateTraceability(
      {
        thesis:
          'Over the past 4 quarters and 12 months, revenue has grown.',
      },
      { earnings: { eps: 1.23 } },
    );
    expect(result.valid).toBe(true);
  });

  it('catches currency hallucinations not present in source', () => {
    // Only 215.33 exists in source. "$500.00" is fabricated and must
    // surface in `missing` so the caller can retry / refresh.
    const result = validateTraceability(
      { thesis: 'Fair value sits at $500.00 per share.' },
      { price: { regularMarketPrice: 215.33 } },
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.missing).toContain('$500.00');
    }
  });

  it('catches percent hallucinations not derivable from source', () => {
    // 85.2% is neither in source nor a pairwise derivation of the
    // single available value (0.166). Must be flagged.
    const result = validateTraceability(
      { thesis: 'Gross margin reached 85.2% last quarter.' },
      { financialData: { operatingMargin: 0.166 } },
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.missing).toContain('85.2%');
    }
  });

  it('accepts numbers within rounding tolerance', () => {
    // Source 1.89541; model rounds to "$1.90". Delta is ~0.0046 — well
    // within the 0.5% relative tolerance (~0.0095). Rejecting this
    // would force callers to refresh on every rounding edge case.
    const result = validateTraceability(
      { thesis: 'Dividend yield is approximately $1.90.' },
      { profile: { dividendRate: 1.89541 } },
    );
    expect(result.valid).toBe(true);
  });
});
