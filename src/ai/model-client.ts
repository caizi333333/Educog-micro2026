/**
 * 智谱开放平台对话客户端。
 *
 * 智谱的对话接口兼容 OpenAI Chat Completions。客户端只记录有界状态，
 * 不读取或输出错误响应正文，避免外部服务回显课程问题或匿名作业内容。
 */
import { z } from 'zod';

export const DEFAULT_ZHIPU_MODEL = 'glm-4.5-flash';
export const ZHIPU_PROVIDER_NAME = '智谱AI';

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ModelMessage;
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

const modelResponseSchema = z.object({
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

const ZHIPU_REQUEST_TIMEOUT_MS = 25_000;
const MODEL_NAME_PATTERN = /^[a-z0-9][a-z0-9.-]{1,63}$/;

export function resolveZhipuModel(value = process.env.ZHIPU_MODEL): string {
  const model = value?.trim().toLowerCase();
  return model && MODEL_NAME_PATTERN.test(model) ? model : DEFAULT_ZHIPU_MODEL;
}

export class ZhipuClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://open.bigmodel.cn/api/paas/v4';

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim();
  }

  async chat(
    messages: ModelMessage[],
    model: string = resolveZhipuModel(),
  ): Promise<ModelResponse> {
    if (!this.apiKey) {
      throw new Error('ZHIPU_API_KEY is not configured');
    }
    const resolvedModel = resolveZhipuModel(model);
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Zhipu API request timeout'));
      }, ZHIPU_REQUEST_TIMEOUT_MS);
    });

    try {
      const response = await Promise.race([fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages,
          stream: false,
          thinking: { type: 'disabled' },
          temperature: 0.7,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      }), deadline]);

      if (!response.ok) {
        throw new Error(`Zhipu API error: ${response.status}`);
      }

      const data: unknown = await Promise.race([response.json(), deadline]);
      const parsed = modelResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error('Zhipu API returned an invalid response');
      }
      return parsed.data;
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new Error('Zhipu API request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: ModelMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    const response = await this.chat(messages);
    return response.choices[0]?.message?.content ?? '';
  }
}

export const zhipuClient = new ZhipuClient(process.env.ZHIPU_API_KEY ?? '');
