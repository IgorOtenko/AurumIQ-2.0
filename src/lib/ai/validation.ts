// Traceability check: every load-bearing number in the model's output must be
// findable in the source snapshot. The validator is intentionally permissive
// about formatting so legitimate unit conversions (decimal → percent, raw →
// "$740B" compact, comma separators, rounding) don't trigger false rejection.
// False negatives (genuinely hallucinated figures slipping through) are what
// matter — false positives (real figures rejected on a format mismatch) just
// force a refresh.

interface ExtractedNumber {
  raw: string;
  value: number;
  isPercent: boolean;
  isCurrency: boolean;
}

const NUMBER_RE = /\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?/g;

export function extractNumbers(text: string): ExtractedNumber[] {
  const matches = text.match(NUMBER_RE) ?? [];
  const result: ExtractedNumber[] = [];
  for (const raw of matches) {
    const isPercent = raw.endsWith('%');
    const isCurrency = raw.startsWith('$');
    const clean = raw.replace(/[$,%]/g, '');
    const value = Number(clean);
    if (Number.isFinite(value) && value > 0) {
      result.push({ raw, value, isPercent, isCurrency });
    }
  }
  return result;
}

function collectSourceNumbers(value: unknown, acc: number[] = []): number[] {
  if (typeof value === 'number' && Number.isFinite(value)) {
    acc.push(value);
  } else if (typeof value === 'string') {
    const matches = value.match(NUMBER_RE);
    if (matches) {
      for (const m of matches) {
        const n = Number(m.replace(/[$,%]/g, ''));
        if (Number.isFinite(n)) acc.push(n);
      }
    }
  } else if (Array.isArray(value)) {
    for (const item of value) collectSourceNumbers(item, acc);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectSourceNumbers(v, acc);
  }
  return acc;
}

// Within 0.5% relative tolerance, or 0.01 absolute (whichever is greater).
// Handles minor rounding the model performs when formatting figures.
function nearMatch(a: number, b: number): boolean {
  if (a === b) return true;
  const tolerance = Math.max(0.01, Math.abs(b) * 0.005);
  return Math.abs(a - b) <= tolerance;
}

function matchesAnySource(target: number, sources: number[]): boolean {
  for (const s of sources) {
    // direct
    if (nearMatch(target, s)) return true;
    // decimal ↔ percent (e.g., source 0.166 → model "16.6%")
    if (nearMatch(target, s * 100)) return true;
    if (nearMatch(target, s / 100)) return true;
    // compact scaling for billions/trillions (e.g., source 740_000_000_000 → "$740B")
    if (nearMatch(target * 1_000_000, s)) return true;
    if (nearMatch(target * 1_000_000_000, s)) return true;
    if (nearMatch(target * 1_000_000_000_000, s)) return true;
  }
  return false;
}

// Simple two-number derivations the model legitimately performs on source
// values — e.g. implied upside = (target - current) / current * 100, total =
// sum of segments, multiple = a / b. Catching these prevents rejecting
// honest analytical math while still flagging arbitrary invented figures.
function isDerivedFromSourcePair(target: number, sources: number[]): boolean {
  for (let i = 0; i < sources.length; i++) {
    const a = sources[i]!;
    for (let j = 0; j < sources.length; j++) {
      if (i === j) continue;
      const b = sources[j]!;
      // % change / implied upside: (b - a) / a, expressed as decimal or percent
      if (a !== 0) {
        const ratio = (b - a) / a;
        if (nearMatch(target, ratio)) return true;
        if (nearMatch(target, ratio * 100)) return true;
      }
      // ratio: b / a
      if (a !== 0 && nearMatch(target, b / a)) return true;
      // sum and signed difference
      if (nearMatch(target, a + b)) return true;
      if (nearMatch(target, Math.abs(a - b))) return true;
    }
  }
  return false;
}

// Numbers that don't need tracing: small bare counts (likely "3 quarters",
// "4 bullet points", section ordinals) where hallucination risk is minimal
// and false-positive rejection is high.
function requiresTraceability(n: ExtractedNumber): boolean {
  if (n.isCurrency || n.isPercent) return true;
  return n.value >= 100;
}

export function validateTraceability(
  output: unknown,
  sources: unknown,
): { valid: true } | { valid: false; missing: string[] } {
  const outputNumbers = extractNumbers(JSON.stringify(output));
  const sourceNumbers = collectSourceNumbers(sources);
  const missing: string[] = [];

  // Dedupe source numbers — derivation check is O(n²) and the same value
  // appearing 20 times under different keys would multiply the work.
  const uniqueSources = Array.from(new Set(sourceNumbers));

  for (const out of outputNumbers) {
    if (!requiresTraceability(out)) continue;
    if (matchesAnySource(out.value, uniqueSources)) continue;
    if (isDerivedFromSourcePair(out.value, uniqueSources)) continue;
    missing.push(out.raw);
  }
  return missing.length === 0 ? { valid: true } : { valid: false, missing };
}
