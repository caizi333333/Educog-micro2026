import { NextResponse } from 'next/server';
import { quizQuestions } from '@/lib/quiz-data';

export async function GET() {
  return NextResponse.json({ success: true, data: quizQuestions });
}
