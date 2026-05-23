import type Anthropic from '@anthropic-ai/sdk';
import type { SourcesData } from '../types';

export function buildLiveOnCallMessages(
  sources: SourcesData,
): Anthropic.MessageParam[] {
  return [
    {
      role: 'user',
      content: `Here is the data for ${sources.ticker}:

${JSON.stringify(sources, null, 2)}

Now produce a Live on the Call watchlist for the next earnings call. Output JSON matching this schema:
{
  "items": [
    { "topic": string, "rationale": string },
    ...
  ]
}

Provide 5-8 items. Each topic is a specific thing to listen for; each rationale is one sentence explaining why this matters given the source data.`,
    },
  ];
}
