export const CLIENT_READ_TIMEOUT_MS = 15_000;
export const CLIENT_WRITE_TIMEOUT_MS = 20_000;

export class ClientRequestTimeoutError extends Error {
  constructor(message = '请求超时') {
    super(message);
    this.name = 'ClientRequestTimeoutError';
  }
}

export async function fetchClientRequest(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = CLIENT_READ_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const parentSignal = init.signal;
  let timedOut = false;
  const abortFromParent = (): void => controller.abort();

  if (parentSignal?.aborted) controller.abort();
  else parentSignal?.addEventListener('abort', abortFromParent, { once: true });

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      cache: init.cache ?? 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new ClientRequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeoutId);
    parentSignal?.removeEventListener('abort', abortFromParent);
  }
}

export function isAmbiguousClientFailure(error: unknown): boolean {
  return error instanceof ClientRequestTimeoutError || error instanceof TypeError;
}
