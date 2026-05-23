import type { ChangePasswordInput, UpdateEmailInput } from './schemas';

async function parseError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return (body && typeof body.error === 'string' && body.error) || fallback;
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  const res = await fetch('/api/account/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to change password'));
}

export async function updateEmail(
  input: UpdateEmailInput,
): Promise<{ email: string }> {
  const res = await fetch('/api/account/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to update email'));
  const json = await res.json();
  return json.data;
}
