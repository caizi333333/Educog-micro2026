import { NextResponse } from 'next/server';
import { getComprehensiveQuestions, quizQuestions, toPublicQuestion } from '@/lib/quiz-data';
import {
  ADDRESSING_QUESTION_SET_VERSION,
  ADDRESSING_TOPIC_ID,
  AI_LITERACY_TOPIC_ID,
  getAddressingQuestionIds,
  getAiLiteracyQuestionIds,
} from '@/lib/lesson-tasks';
import { getDataProvenance } from '@/lib/env';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const mode = searchParams.get('mode');
  const chapterRaw = searchParams.get('chapter');
  const chapter = chapterRaw === null ? null : Number(chapterRaw);

  if (topic !== null && topic !== ADDRESSING_TOPIC_ID && topic !== AI_LITERACY_TOPIC_ID) {
    return NextResponse.json({ error: '测评主题不存在' }, { status: 400 });
  }
  if (mode !== null && mode !== 'initial' && mode !== 'retest') {
    return NextResponse.json({ error: '测评阶段无效' }, { status: 400 });
  }
  if (mode !== null && topic !== ADDRESSING_TOPIC_ID) {
    return NextResponse.json({ error: '测评阶段必须与专项主题同时使用' }, { status: 400 });
  }
  if (topic !== null && chapterRaw !== null) {
    return NextResponse.json({ error: '专项测评与章节测评不能同时指定' }, { status: 400 });
  }
  if (chapterRaw !== null && (!Number.isInteger(chapter) || chapter === null || chapter < 1 || chapter > 10)) {
    return NextResponse.json({ error: '章节编号必须为 1-10' }, { status: 400 });
  }

  let selected = getComprehensiveQuestions();
  if (topic === ADDRESSING_TOPIC_ID) {
    const allowedIds = new Set(getAddressingQuestionIds(mode));
    selected = quizQuestions.filter((question) => allowedIds.has(question.id));
  } else if (topic === AI_LITERACY_TOPIC_ID) {
    const allowedIds = new Set(getAiLiteracyQuestionIds());
    selected = quizQuestions.filter((question) => allowedIds.has(question.id));
  } else if (chapter !== null) {
    selected = quizQuestions.filter((question) => question.chapter === chapter);
  }

  return NextResponse.json(
    {
      success: true,
      dataProvenance: getDataProvenance(),
      asOf: new Date().toISOString(),
      sampleSize: { questions: selected.length },
      questionSetVersion: topic === ADDRESSING_TOPIC_ID ? ADDRESSING_QUESTION_SET_VERSION : null,
      data: selected.map(toPublicQuestion),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
