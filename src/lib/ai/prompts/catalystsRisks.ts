import type Anthropic from '@anthropic-ai/sdk';
import type { SourcesData } from '../types';

export function buildCatalystsRisksMessages(
  sources: SourcesData,
): Anthropic.MessageParam[] {
  return [
    {
      role: 'user',
      content: `Here is the data for ${sources.ticker}:

${JSON.stringify(sources, null, 2)}

Now produce a Catalysts & Risks analysis. Output JSON matching this schema:
{
  "catalysts": [string, ...],
  "risks": [string, ...]
}

Provide 3-5 catalyst bullets (upcoming positive events) and 3-5 risk bullets (downside concerns rooted in the source data).`,
    },
  ];
}
