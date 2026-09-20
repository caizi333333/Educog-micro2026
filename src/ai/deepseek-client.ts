/**
 * DeepSeek API 客户端
 * 用于与 DeepSeek API 进行通信
 */
import { z } from 'zod';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: DeepSeekMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const responseMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']).default('assistant'),
  content: z.string().optional().default(''),
});

const deepSeekResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number(),
    message: responseMessageSchema.nullish().transform((message) => message ?? {
      role: 'assistant' as const,
      content: '',
    }),
    finish_reason: z.string(),
  })),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }).optional(),
});

const DEEPSEEK_REQUEST_TIMEOUT_MS = 25_000;

export class DeepSeekClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.deepseek.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: DeepSeekMessage[], model: string = 'deepseek-chat'): Promise<DeepSeekResponse> {
    if (!this.apiKey.trim()) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('DeepSeek API request timeout'));
      }, DEEPSEEK_REQUEST_TIMEOUT_MS);
    });

    try {
      const response = await Promise.race([fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1024, // 精炼回答，降低超时概率
        }),
        signal: controller.signal,
      }), deadline]);

      if (!response.ok) {
        // Provider error bodies may echo private prompts or submitted work.
        // Status is sufficient for recovery; do not read or log those bodies.
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data: unknown = await Promise.race([response.json(), deadline]);
      const parsed = deepSeekResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error('DeepSeek API returned an invalid response');
      }
      return parsed.data;
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new Error('DeepSeek API request timeout');
      }
      throw error;
    } finally {
      // Response headers may arrive long before the body has finished streaming.
      clearTimeout(timeoutId!);
    }
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: DeepSeekMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.chat(messages);
    return response.choices[0]?.message?.content ?? '';
  }
}

// 创建单例实例
export const deepseekClient = new DeepSeekClient(
  process.env.DEEPSEEK_API_KEY ?? ''
);
