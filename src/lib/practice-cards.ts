import { isFinalObjectiveVariantExplanation } from '@/lib/comprehensive-sample';
import {
  quizQuestions,
  type Question,
  type PublicQuestion,
} from '@/lib/quiz-data';
import { knowledgePoints } from '@/lib/knowledge-points';

export type PracticeQuestion = PublicQuestion & {
  figure?: string | { src: string; alt: string; caption?: string };
};
export const practiceQuestions = quizQuestions.filter(
  (q) => !isFinalObjectiveVariantExplanation(q.explanation),
);
export const practiceBank = new Map(practiceQuestions.map((q) => [q.id, q]));
export const reviewIntervals = [600, 86400, 259200, 604800] as const;
export const practiceModes = [
  'all',
  'chapter',
  'random',
  'review',
  'wrong',
  'retry',
] as const;
export type PracticeMode = (typeof practiceModes)[number];
export type CardFeedback = {
  questionId: number;
  answer: string;
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  xp: number;
};

export function gradePractice(question: Question, answer: string): boolean {
  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/,\s+/g, ',');
  return normalize(answer) === normalize(question.correctAnswer);
}

export function scheduleReview(
  previousBox: number | null,
  correct: boolean,
  review: boolean,
  now: Date,
) {
  const box = correct
    ? previousBox === null
      ? 1
      : Math.min(previousBox + (review ? 1 : 0), 3)
    : 0;
  return { box, dueAt: new Date(now.getTime() + reviewIntervals[box] * 1000) };
}

export function chapterProgress(
  answers: { questionId: number; correct: boolean }[],
) {
  const latest = new Map(answers.map((a) => [a.questionId, a]));
  return Array.from({ length: 10 }, (_, index) => {
    const chapter = index + 1;
    const questions = practiceQuestions.filter((q) => q.chapter === chapter);
    const done = questions.flatMap((q) =>
      latest.has(q.id) ? [latest.get(q.id)!] : [],
    );
    const accuracy = done.length
      ? done.filter((a) => a.correct).length / done.length
      : 0;
    const coverage = questions.length ? done.length / questions.length : 0;
    return {
      chapter,
      title:
        knowledgePoints.find((k) => k.level === 1 && k.chapter === chapter)
          ?.name || `第 ${chapter} 章`,
      total: questions.length,
      answered: done.length,
      accuracy: Math.round(accuracy * 100),
      coverage: Math.round(coverage * 100),
      stars: [
        [0.1, 0.6],
        [0.5, 0.75],
        [0.9, 0.9],
      ].filter(([c, a]) => coverage >= c && accuracy >= a).length,
    };
  });
}

export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return (
    '"' +
    (/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""') +
    '"'
  );
}
