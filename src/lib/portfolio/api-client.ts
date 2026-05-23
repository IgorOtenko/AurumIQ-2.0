import type { AddHoldingInput, UpdateHoldingInput } from './schemas';
import type { EnrichedHolding } from './types';

async function parseError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return (body && typeof body.error === 'string' && body.error) || fallback;
}

export async function listHoldings(): Promise<EnrichedHolding[]> {
  const res = await fetch('/api/portfolio', { credentials: 'include' });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load portfolio'));
  const json = await res.json();
  return json.data;
}

export async function addHolding(
  input: AddHoldingInput,
): Promise<EnrichedHolding> {
  const res = await fetch('/api/portfolio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to add holding'));
  const json = await res.json();
  return json.data;
}

export async function updateHolding(
  id: string,
  input: UpdateHoldingInput,
): Promise<EnrichedHolding> {
  const res = await fetch(`/api/portfolio/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to update holding'));
  const json = await res.json();
  return json.data;
}

export async function deleteHolding(id: string): Promise<void> {
  const res = await fetch(`/api/portfolio/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to delete holding'));
}
