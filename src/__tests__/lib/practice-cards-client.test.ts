import {
  practiceRequest,
  PracticeRequestError,
} from '@/lib/practice-cards-client';
import {
  CLIENT_READ_TIMEOUT_MS,
  CLIENT_WRITE_TIMEOUT_MS,
  ClientRequestTimeoutError,
} from '@/lib/client-fetch';

const mockFetch = fetch as jest.Mock;

describe('bounded practice requests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    mockFetch.mockReset();
  });
  afterEach(() => {
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('preserves legacy Bearer authentication, class selection and write bodies', async () => {
    sessionStorage.setItem('accessToken', 'legacy-token');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ saved: true }),
    });
    const body = { questionId: 6, answer: '选项', requestId: 'request-123' };
    expect(await practiceRequest('answer', body, 'class a')).toEqual({
      saved: true,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/practice/cards/answer?classId=class%20a',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Authorization: 'Bearer legacy-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...body, classId: 'class a' }),
      }),
    );
  });

  it.each(['headers', 'body', 'error body'])(
    'times out stalled response %s, even if fetch ignores abort',
    async (stage) => {
      const stalled = () => new Promise(() => {});
      mockFetch.mockImplementation(
        stage === 'headers'
          ? stalled
          : async () => ({
              ok: stage !== 'error body',
              status: 401,
              json: stalled,
            }),
      );
      const failure = expect(practiceRequest('me')).rejects.toBeInstanceOf(
        ClientRequestTimeoutError,
      );
      await jest.advanceTimersByTimeAsync(CLIENT_READ_TIMEOUT_MS);
      await failure;
      expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
    },
  );

  it('gives writes the configured deadline instead of the shorter read deadline', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    const failure = expect(
      practiceRequest('answer', { answer: 'A' }),
    ).rejects.toBeInstanceOf(ClientRequestTimeoutError);
    await jest.advanceTimersByTimeAsync(CLIENT_READ_TIMEOUT_MS);
    expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(
      CLIENT_WRITE_TIMEOUT_MS - CLIENT_READ_TIMEOUT_MS,
    );
    await failure;
    expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('preserves HTTP status and handles empty error bodies', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => {
        throw new SyntaxError();
      },
    });
    await expect(practiceRequest('me')).rejects.toEqual(
      new PracticeRequestError('网络暂不可用，请重试', 401),
    );
  });

  it('propagates network failures without leaving a timer running', async () => {
    mockFetch.mockRejectedValue(new TypeError('offline'));
    await expect(practiceRequest('me')).rejects.toThrow('offline');
  });
});
