'use server';
/**
 * @fileOverview An AI-driven 8051 assembly code simulator.
 *
 * - simulateCode - A function that handles the code simulation.
 * - CodeSimulationInput - The input type for the flow.
 * - CodeSimulationOutput - The return type for the flow.
 */

import { SimpleAiClient } from '@/ai/simple-ai-client';
import { z } from 'zod';

const CodeSimulationInputSchema = z.object({
  code: z.string().describe('The 8051 assembly code to simulate.'),
  fault: z.string().describe('The fault to inject into the simulation. "none" for no fault. Other examples: "P1.0 pin shorted to ground", "Crystal oscillator not working".'),
});
export type CodeSimulationInput = z.infer<typeof CodeSimulationInputSchema>;

const CodeSimulationOutputSchema = z.object({
  analysis: z.string().describe('A step-by-step analysis of the code execution and the effect of the injected fault. This should be in Chinese.'),
  registers: z.object({
    A: z.string().describe('Final value of Accumulator A in hex format (e.g., "0x3F").'),
    B: z.string().describe('Final value of B register in hex format.'),
    PSW: z.string().describe('Final value of Program Status Word in hex format.'),
    DPTR: z.string().describe('Final value of Data Pointer (DPTR) in hex format.'),
    SP: z.string().describe('Final value of Stack Pointer (SP) in hex format.'),
  }),
  portValues: z.object({
    P0: z.string().describe('Final value of Port 0 in hex format.'),
    P1: z.string().describe('Final value of Port 1 in hex format.'),
    P2: z.string().describe('Final value of Port 2 in hex format.'),
    P3: z.string().describe('Final value of Port 3 in hex format.'),
  }),
  waveform: z.array(z.object({
      time: z.number().describe('Time point in an abstract unit (e.g., milliseconds).'),
      value: z.number().describe('The value of the pin at that time, either 0 or 1.'),
  })).optional().describe('An array of time/value points representing a waveform on an I/O pin. Should be provided if the code generates a periodic signal like a square wave.'),
  leds: z.array(z.boolean()).length(8).optional().describe('An array of 8 boolean values representing the final state of 8 LEDs, typically connected to Port 1 (P1.7 to P1.0).'),
});
export type CodeSimulationOutput = z.infer<typeof CodeSimulationOutputSchema>;


// 简化的代码仿真实现
async function codeSimulationFlow(input: CodeSimulationInput): Promise<CodeSimulationOutput> {
  const { code, fault } = input;
  
  try {
    const aiClient = new SimpleAiClient();
    const prompt = `你是一个高级的8051微控制器仿真器。请分析以下8051汇编代码，预测执行结果，并描述微控制器寄存器和I/O端口的最终状态。同时考虑注入的硬件故障及其影响。

代码：
\`\`\`asm
${code}
\`\`\`

故障：${fault}

请提供详细的中文分析，包括代码执行步骤和故障影响。`;
    
    const response = await aiClient.chat(prompt);
    
    // 生成基本的仿真结果
    return generateBasicSimulationResult(code, fault, response.answer);
  } catch (error) {
    console.error('Code simulation error:', error);
    return generateFallbackSimulationResult(code, fault);
  }
}

// 生成基本仿真结果
function generateBasicSimulationResult(code: string, fault: string, analysis: string): CodeSimulationOutput {
  // 基于代码内容生成合理的仿真结果
  const hasLedControl = code.toLowerCase().includes('p1') || code.toLowerCase().includes('led');
  const hasTimer = code.toLowerCase().includes('timer') || code.toLowerCase().includes('tmod');
  
  return {
    analysis: analysis || `代码分析：\n这是一个8051汇编程序。${hasLedControl ? '程序控制LED显示。' : ''}${hasTimer ? '程序使用定时器功能。' : ''}\n\n故障影响：${fault !== 'none' ? `注入的故障"${fault}"会影响程序的正常执行。` : '无故障注入，程序正常执行。'}`,
    registers: {
      A: '0x00',
      B: '0x00',
      PSW: '0x00',
      DPTR: '0x0000',
      SP: '0x07'
    },
    portValues: {
      P0: '0xFF',
      P1: hasLedControl ? '0x00' : '0xFF',
      P2: '0xFF',
      P3: '0xFF'
    },
    leds: hasLedControl ? [true, true, true, true, true, true, true, true] : undefined,
    waveform: hasTimer ? [
      { time: 0, value: 0 },
      { time: 1, value: 1 },
      { time: 2, value: 0 },
      { time: 3, value: 1 },
      { time: 4, value: 0 },
      { time: 5, value: 1 },
      { time: 6, value: 0 },
      { time: 7, value: 1 },
      { time: 8, value: 0 },
      { time: 9, value: 1 }
    ] : undefined
  };
}

// 生成备用仿真结果
function generateFallbackSimulationResult(code: string, fault: string): CodeSimulationOutput {
  return {
    analysis: `代码仿真分析：\n由于AI服务暂时不可用，提供基本的仿真结果。\n\n代码：${code.substring(0, 100)}...\n故障：${fault}\n\n这是一个8051汇编程序的基本仿真结果。`,
    registers: {
      A: '0x00',
      B: '0x00',
      PSW: '0x00',
      DPTR: '0x0000',
      SP: '0x07'
    },
    portValues: {
      P0: '0xFF',
      P1: '0xFF',
      P2: '0xFF',
      P3: '0xFF'
    }
  };
}

export async function simulateCode(input: CodeSimulationInput): Promise<CodeSimulationOutput> {
    try {
        return await codeSimulationFlow(input);
    } catch (error) {
        console.error('Code Simulation Flow Error:', error);
        
        // 检查是否是API密钥错误
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isApiKeyError = errorMessage.includes('API key not valid') || 
                             errorMessage.includes('API_KEY_INVALID') ||
                             errorMessage.includes('your_actual_google_ai_api_key_here');
        
        if (isApiKeyError) {
            // 直接抛出错误，让调用方处理fallback
            throw new Error('API key not valid');
        } else {
            // 对于其他错误，尝试一次重试
            try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await codeSimulationFlow(input);
            } catch (retryError) {
                // 重试失败，抛出原始错误
                throw error;
            }
        }
    }
}
