// AI tutor endpoint consumed by the in-app intelligent QA UI.
// Auth-gated (any logged-in user). Wraps the aiStudyAssistant flow which
// internally retrieves grounded course context (RAG) before calling DeepSeek.

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { aiStudyAssistant, type AiStudyAssistantInput } from '@/ai/flows/ai-study-assistant';

export const maxDuration = 30; // DeepSeek round-trip can be slow

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return NextResponse.json({ error: '令牌无效' }, { status: 401 });

    const body = (await request.json()) as Partial<AiStudyAssistantInput>;
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    if (!question) {
      return NextResponse.json({ error: '问题不能为空' }, { status: 400 });
    }
    const history = Array.isArray(body.history) ? body.history : undefined;

    const result = await aiStudyAssistant({ question, history });

    // Log AI interaction as a learning event
    await prisma.learningEvent.create({
      data: {
        userId: payload.userId,
        eventType: 'AI_CHAT',
        targetType: 'AI_ASSISTANT',
        targetId: 'ai-tutor',
        metadata: JSON.stringify({ questionLength: question.length }),
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('ai/chat POST error:', err);
    return NextResponse.json(
      { error: '服务器错误', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
