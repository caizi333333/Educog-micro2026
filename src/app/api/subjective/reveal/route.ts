import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getSubjectiveQuestion } from '@/lib/subjective-data';

// 参考答案 + 评分细则：需要登录令牌，作为学生"先动笔再翻牌"的刻意揭示动作，
// 不包含在题目列表载荷中。
export async function GET(request: Request): Promise<NextResponse> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  const payload = await verifyToken(authorization.substring(7));
  if (!payload) {
    return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: '题目编号格式无效' }, { status: 400 });
  }
  const question = getSubjectiveQuestion(id);
  if (!question) {
    return NextResponse.json({ error: '题目不存在' }, { status: 404 });
  }
  return NextResponse.json(
    { success: true, id: question.id, correctAnswer: question.correctAnswer, rubric: question.rubric },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
