import type { SectionType } from '@/lib/ai/types';
import type { AddScheduleInput, UpdateScheduleInput } from './schemas';
import type {
  SerializedAnalysisHistory,
  SerializedSchedule,
} from './types';

async function parseError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return (body && typeof body.error === 'string' && body.error) || fallback;
}

export async function listSchedules(): Promise<SerializedSchedule[]> {
  const res = await fetch('/api/schedules', { credentials: 'include' });
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to load schedules'));
  const json = await res.json();
  return json.data;
}

export async function addSchedule(
  input: AddScheduleInput,
): Promise<SerializedSchedule> {
  const res = await fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to create schedule'));
  const json = await res.json();
  return json.data;
}

export async function updateSchedule(
  id: string,
  input: UpdateScheduleInput,
): Promise<SerializedSchedule> {
  const res = await fetch(`/api/schedules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to update schedule'));
  const json = await res.json();
  return json.data;
}

export async function deleteSchedule(id: string): Promise<void> {
  const res = await fetch(`/api/schedules/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to delete schedule'));
}

export async function listAnalysisHistory(
  ticker: string,
  sectionType: SectionType,
): Promise<SerializedAnalysisHistory[]> {
  const res = await fetch(
    `/api/analysis-history/${encodeURIComponent(ticker)}?sectionType=${encodeURIComponent(sectionType)}`,
    { credentials: 'include' },
  );
  if (!res.ok)
    throw new Error(await parseError(res, 'Failed to load analysis history'));
  const json = await res.json();
  return json.data;
}
