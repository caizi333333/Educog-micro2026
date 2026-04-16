import { NextRequest, NextResponse } from 'next/server';
import { DeepSeekClient } from '@/ai/deepseek-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, runFullTest } = body;

    if (runFullTest) {
      // 运行完整测试套件
      const testResults = {
        directClient: false,
        genkitIntegration: false,
        codeGeneration: false,
      };
      
      let summary = '';

      // 测试 1: 直接客户端
      try {
        const client = new DeepSeekClient(process.env.DEEPSEEK_API_KEY || 'sk-660f4af29d0049188eae9c8177c90fc2');
        const response = await client.chat([
          { role: 'user', content: '你好，请介绍一下自己' }
        ]);
        if (response.choices?.[0]?.message?.content) {
          testResults.directClient = true;
          summary += '✅ 直接客户端测试通过\n';
        }
      } catch (error) {
        summary += `❌ 直接客户端测试失败: ${error}\n`;
      }

      // 测试 2: AI 学习助手集成
      try {
        const { aiStudyAssistant } = await import('@/ai/flows/ai-study-assistant');
        const result = await aiStudyAssistant({
          question: '8051单片机的定时器有哪些工作模式？'
        });
        if (result.answer) {
          testResults.genkitIntegration = true;
          summary += '✅ AI 学习助手集成测试通过\n';
        }
      } catch (error) {
        summary += `❌ AI 学习助手集成测试失败: ${error}\n`;
      }

      // 测试 3: 代码生成
      try {
        const client = new DeepSeekClient(process.env.DEEPSEEK_API_KEY || 'sk-660f4af29d0049188eae9c8177c90fc2');
        const response = await client.chat([
          { role: 'user', content: '请写一个8051单片机LED闪烁的汇编代码' }
        ], 'deepseek-coder');
        if (response.choices?.[0]?.message?.content) {
          testResults.codeGeneration = true;
          summary += '✅ 代码生成测试通过\n';
        }
      } catch (error) {
        summary += `❌ 代码生成测试失败: ${error}\n`;
      }

      return NextResponse.json({
        testResults,
        summary: summary.trim() || '测试完成',
      });
    } else {
      // 单个测试请求
      const client = new DeepSeekClient(process.env.DEEPSEEK_API_KEY || 'sk-660f4af29d0049188eae9c8177c90fc2');
      const response = await client.chat([
        { role: 'user', content: prompt }
      ]);
      
      const content = response.choices?.[0]?.message?.content || '无响应';
      
      return NextResponse.json({
        response: content,
        testResults: {
          directClient: true,
          genkitIntegration: null,
          codeGeneration: null,
        }
      });
    }
  } catch (error) {
    console.error('DeepSeek API test error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}