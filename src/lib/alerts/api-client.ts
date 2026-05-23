import type {
  AddEarningsAlertInput,
  AddPriceAlertInput,
  UpdateEarningsAlertInput,
  UpdatePriceAlertInput,
} from './schemas';
import type { SerializedEarningsAlert, SerializedPriceAlert } from './types';

async function parseError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return (body && typeof body.error === 'string' && body.error) || fallback;
}

export async function listPriceAlerts(): Promise<SerializedPriceAlert[]> {
  const res = await fetch('/api/alerts/price', { credentials: 'include' });
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to load price alerts'));
  const json = await res.json();
  return json.data;
}

export async function addPriceAlert(
  input: AddPriceAlertInput,
): Promise<SerializedPriceAlert> {
  const res = await fetch('/api/alerts/price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to create price alert'));
  const json = await res.json();
  return json.data;
}

export async function updatePriceAlert(
  id: string,
  input: UpdatePriceAlertInput,
): Promise<SerializedPriceAlert> {
  const res = await fetch(`/api/alerts/price/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to update price alert'));
  const json = await res.json();
  return json.data;
}

export async function deletePriceAlert(id: string): Promise<void> {
  const res = await fetch(`/api/alerts/price/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to delete price alert'));
}

export async function listEarningsAlerts(): Promise<SerializedEarningsAlert[]> {
  const res = await fetch('/api/alerts/earnings', { credentials: 'include' });
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to load earnings alerts'));
  const json = await res.json();
  return json.data;
}

export async function addEarningsAlert(
  input: AddEarningsAlertInput,
): Promise<SerializedEarningsAlert> {
  const res = await fetch('/api/alerts/earnings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to create earnings alert'));
  const json = await res.json();
  return json.data;
}

export async function updateEarningsAlert(
  id: string,
  input: UpdateEarningsAlertInput,
): Promise<SerializedEarningsAlert> {
  const res = await fetch(`/api/alerts/earnings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to update earnings alert'));
  const json = await res.json();
  return json.data;
}

export async function deleteEarningsAlert(id: string): Promise<void> {
  const res = await fetch(`/api/alerts/earnings/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to delete earnings alert'));
}
