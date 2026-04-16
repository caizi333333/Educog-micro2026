/**
 * @fileoverview This file initializes the Genkit AI instance.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Initialize Genkit with minimal configuration to avoid dependency issues
export const ai = genkit({
  plugins: [
    // Only include googleAI if API key is available
    ...(process.env.GOOGLE_GENAI_API_KEY ? [googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    })] : []),
  ],
});

// Export a custom generate function that can use DeepSeek
import { DeepSeekClient } from './deepseek-client';

export async function generateWithDeepSeek(prompt: string, model: 'chat' | 'coder' = 'chat') {
  const client = new DeepSeekClient(process.env.DEEPSEEK_API_KEY || 'sk-660f4af29d0049188eae9c8177c90fc2');
  const modelName = model === 'coder' ? 'deepseek-coder' : 'deepseek-chat';
  
  const response = await client.chat([
    { role: 'user', content: prompt }
  ], modelName);
  
  return {
    text: response.choices[0]?.message?.content || '',
    usage: response.usage
  };
}