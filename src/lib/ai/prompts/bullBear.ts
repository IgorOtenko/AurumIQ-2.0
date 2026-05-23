import type Anthropic from '@anthropic-ai/sdk';
import type { SourcesData } from '../types';

export function buildBullBearMessages(
  sources: SourcesData,
): Anthropic.MessageParam[] {
  return [
    {
      role: 'user',
      content: `Here is the data for ${sources.ticker}:

${JSON.stringify(sources, null, 2)}

Now produce a Bull vs Bear analysis. Output JSON matching this schema:
{
  "bullCase": [string, string, string, string],
  "bearCase": [string, string, string, string],
  "oneLiner": string
}

Exactly 4 bull bullets, exactly 4 bear bullets, one one-liner synthesizing the central tension.`,
    },
  ];
}
