/**
 * @fileoverview 智谱生成辅助函数。
 *
 * The application AI routes use SimpleAiClient directly. This helper is kept
 * for compatibility with local callers and deliberately has no embedded key.
 */
import { ZhipuClient, resolveZhipuModel, type ModelResponse } from './model-client';

export async function generateWithZhipu(
  prompt: string,
): Promise<{ text: string; usage: ModelResponse['usage'] }> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    throw new Error('ZHIPU_API_KEY is not configured');
  }

  const client = new ZhipuClient(apiKey);
  const response = await client.chat([
    { role: 'user', content: prompt }
  ], resolveZhipuModel());
  
  return {
    text: response.choices[0]?.message?.content ?? '',
    usage: response.usage
  };
}
