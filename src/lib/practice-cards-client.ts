import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  CLIENT_READ_TIMEOUT_MS,
  CLIENT_WRITE_TIMEOUT_MS,
  ClientRequestTimeoutError,
} from '@/lib/client-fetch';

export class PracticeRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'PracticeRequestError';
  }
}

export async function practiceRequest<T>(
  path: string,
  body?: Record<string, unknown>,
  classId?: string | null,
): Promise<T> {
  const token = getStoredAccessToken();
  const separator = path.includes('?') ? '&' : '?';
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => {
        reject(new ClientRequestTimeoutError());
        controller.abort();
      },
      body ? CLIENT_WRITE_TIMEOUT_MS : CLIENT_READ_TIMEOUT_MS,
    );
  });
  const send = async (): Promise<T> => {
    const response = await fetch(
      '/api/practice/cards/' +
        path +
        (classId ? separator + 'classId=' + encodeURIComponent(classId) : ''),
      {
        method: body ? 'POST' : 'GET',
        credentials: 'same-origin',
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body
          ? {
              body: JSON.stringify({
                ...body,
                ...(classId ? { classId } : {}),
              }),
            }
          : {}),
      },
    );
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new PracticeRequestError(
        error?.error || '网络暂不可用，请重试',
        response.status,
      );
    }
    return response.json() as Promise<T>;
  };
  try {
    return await Promise.race([send(), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}
