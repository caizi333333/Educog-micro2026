import { NextResponse } from 'next/server';
import { subjectiveQuestions, toPublicSubjectiveQuestion } from '@/lib/subjective-data';
import { getDataProvenance } from '@/lib/env';

// 3084 主观题库列表：题干可公开浏览，参考答案与评分细则由
// /api/subjective/reveal 在学生主动"翻牌"时单独下发，不走本接口。
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const chapterRaw = searchParams.get('chapter');
  const chapter = chapterRaw === null ? null : Number(chapterRaw);
  if (chapterRaw !== null && (!Number.isInteger(chapter) || chapter === null || chapter < 1 || chapter > 11)) {
    return NextResponse.json({ error: '章节编号必须为 1-11' }, { status: 400 });
  }

  const selected = chapter === null
    ? subjectiveQuestions
    : subjectiveQuestions.filter((question) => question.chapter === chapter);

  return NextResponse.json(
    {
      success: true,
      dataProvenance: getDataProvenance(),
      asOf: new Date().toISOString(),
      sampleSize: { questions: selected.length },
      data: selected.map(toPublicSubjectiveQuestion),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
