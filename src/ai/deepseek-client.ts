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
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25秒超时，真实提问常超过10秒

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
      }

      const data: unknown = await response.json();
      const parsed = deepSeekResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error('DeepSeek API returned an invalid response');
      }
      return parsed.data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('DeepSeek API request timeout');
      }
      throw error;
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
