/**
 * @fileoverview Legacy DeepSeek generation helper.
 *
 * The application AI routes use SimpleAiClient directly. This helper is kept
 * for compatibility with local callers and deliberately has no embedded key.
 */
import { DeepSeekClient, type DeepSeekResponse } from './deepseek-client';

export async function generateWithDeepSeek(
  prompt: string,
  model: 'chat' | 'coder' = 'chat'
): Promise<{ text: string; usage: DeepSeekResponse['usage'] }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

  const client = new DeepSeekClient(apiKey);
  const modelName = model === 'coder' ? 'deepseek-coder' : 'deepseek-chat';
  
  const response = await client.chat([
    { role: 'user', content: prompt }
  ], modelName);
  
  return {
    text: response.choices[0]?.message?.content ?? '',
    usage: response.usage
  };
}
