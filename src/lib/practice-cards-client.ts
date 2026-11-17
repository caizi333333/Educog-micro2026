import { getStoredAccessToken } from '@/lib/auth-storage';

export async function practiceRequest<T>(
  path: string,
  body?: Record<string, unknown>,
  classId?: string | null,
): Promise<T> {
  const token = getStoredAccessToken();
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(
    '/api/practice/cards/' +
      path +
      (classId ? separator + 'classId=' + encodeURIComponent(classId) : ''),
    {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body
        ? { body: JSON.stringify({ ...body, ...(classId ? { classId } : {}) }) }
        : {}),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || '网络暂不可用，请重试');
  }
  return response.json() as Promise<T>;
}
