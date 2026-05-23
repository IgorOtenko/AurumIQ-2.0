import type { SectionType, SerializedAnalysis } from './types';

export interface ProgressEvent {
  step: 'fetching_data' | 'generating' | 'validating';
}
export interface CompleteEvent {
  analysis: SerializedAnalysis;
}
export interface ErrorEvent {
  message: string;
}

export type StreamYield =
  | { type: 'progress'; step: ProgressEvent['step'] }
  | { type: 'complete'; analysis: SerializedAnalysis }
  | { type: 'error'; message: string };

async function parseError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return (body && typeof body.error === 'string' && body.error) || fallback;
}

export async function fetchLatestAnalysis(
  ticker: string,
  sectionType: SectionType,
): Promise<SerializedAnalysis | null> {
  const res = await fetch(
    `/api/ai/${encodeURIComponent(ticker)}?sectionType=${encodeURIComponent(sectionType)}`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load analysis'));
  const json = await res.json();
  return json.data as SerializedAnalysis | null;
}

// Minimal SSE parser. SSE messages are `event: <name>\ndata: <json>\n\n` —
// we accumulate a buffer, split on the double-newline boundary, then pull
// out the event name and JSON payload from each block. Avoids an extra
// dependency for what amounts to a 30-line text protocol.
function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

export async function* generateAnalysisStream(
  ticker: string,
  sectionType: SectionType,
): AsyncGenerator<StreamYield> {
  const res = await fetch(`/api/ai/${encodeURIComponent(ticker)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sectionType }),
  });

  if (!res.ok || !res.body) {
    const message = await parseError(res, 'Failed to start generation');
    yield { type: 'error', message };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawBlock = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');

      const parsed = parseSseBlock(rawBlock);
      if (!parsed) continue;

      try {
        const payload = JSON.parse(parsed.data);
        if (parsed.event === 'progress') {
          yield { type: 'progress', step: (payload as ProgressEvent).step };
        } else if (parsed.event === 'complete') {
          yield {
            type: 'complete',
            analysis: (payload as CompleteEvent).analysis,
          };
        } else if (parsed.event === 'error') {
          yield {
            type: 'error',
            message: (payload as ErrorEvent).message,
          };
        }
      } catch {
        yield { type: 'error', message: 'Malformed SSE payload' };
      }
    }
  }
}
