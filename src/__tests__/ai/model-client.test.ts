/**
 * @jest-environment node
 */
import {
  DEFAULT_ZHIPU_MODEL,
  ZhipuClient,
  resolveZhipuModel,
  zhipuClient,
} from '@/ai/model-client';

global.fetch = jest.fn();

describe('ZhipuClient', () => {
  const mockApiKey = 'test-api-key';
  const messages = [
    { role: 'system' as const, content: 'You are a helpful assistant' },
    { role: 'user' as const, content: 'Hello' },
  ];
  const response = {
    id: 'test-id',
    object: 'chat.completion',
    created: 1234567890,
    model: DEFAULT_ZHIPU_MODEL,
    choices: [{
      index: 0,
      message: { role: 'assistant' as const, content: 'Hello!' },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
  };
  let client: ZhipuClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ZhipuClient(mockApiKey);
  });

  it('sends an OpenAI-compatible non-streaming request to the configured free model', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => response });

    await expect(client.chat(messages)).resolves.toEqual(response);
    expect(fetch).toHaveBeenCalledWith(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockApiKey}`,
        },
        body: JSON.stringify({
          model: DEFAULT_ZHIPU_MODEL,
          messages,
          stream: false,
          thinking: { type: 'disabled' },
          temperature: 0.7,
          max_tokens: 1024,
        }),
        signal: expect.any(Object),
      }),
    );
  });

  it('accepts a valid configured model and falls back for an unsafe value', () => {
    expect(resolveZhipuModel(' GLM-4.5-FLASH ')).toBe('glm-4.5-flash');
    expect(resolveZhipuModel('bad model;value')).toBe(DEFAULT_ZHIPU_MODEL);
    expect(resolveZhipuModel('')).toBe(DEFAULT_ZHIPU_MODEL);
  });

  it('fails before making a request when the API key is missing', async () => {
    await expect(new ZhipuClient('  ').chat(messages))
      .rejects.toThrow('ZHIPU_API_KEY is not configured');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports provider status without reading a private error body', async () => {
    const readBody = jest.fn(() => Promise.resolve('private response'));
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429, text: readBody });

    await expect(client.chat(messages)).rejects.toThrow('Zhipu API error: 429');
    expect(readBody).not.toHaveBeenCalled();
  });

  it.each([true, false])('times out a stalled successful response body: %s', async (respectsAbort) => {
    jest.useFakeTimers();
    try {
      (fetch as jest.Mock).mockImplementationOnce(async (_url: string, init: RequestInit) => ({
        ok: true,
        status: 200,
        json: () => new Promise((_resolve, reject) => {
          if (respectsAbort) {
            init.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          }
        }),
      }));
      const pending = expect(client.chat(messages)).rejects.toThrow('Zhipu API request timeout');
      await jest.advanceTimersByTimeAsync(25_000);
      await pending;
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects an invalid success response', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [] }) });
    await expect(client.chat(messages)).rejects.toThrow('Zhipu API returned an invalid response');
  });

  it('generates text with optional system context', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => response });
    await expect(client.generateText('Hello', 'System')).resolves.toBe('Hello!');
    const request = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(request.messages).toEqual([
      { role: 'system', content: 'System' },
      { role: 'user', content: 'Hello' },
    ]);
  });

  it('exports a singleton client', () => {
    expect(zhipuClient).toBeInstanceOf(ZhipuClient);
  });
});
