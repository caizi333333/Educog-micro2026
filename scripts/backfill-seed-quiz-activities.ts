/**
 * 一次性回填：为已存在的 QuizAttempt 记录补写缺失的 UserActivity(COMPLETE_QUIZ)。
 *
 * 背景：prisma/seed.ts 早期版本只生成了 QuizAttempt，没有同步生成真实提交路径
 * (/api/quiz/submit) 会写入的 UserActivity(action='COMPLETE_QUIZ', details含weakAreas)。
 * /weak-nodes 和 /learning-path 都靠读这条记录工作，缺了它就一直显示"还没有测验记录"。
 *
 * 安全约束：只用 quizAttempt.findMany / userActivity.findFirst / userActivity.create，
 * 不 import 任何 achievement-*.ts 或积分相关逻辑，避免触发不稳定的 WIP 副作用、
 * 避免积分/成就重复发放。幂等：已存在对应记录则跳过，可重复执行。
 *
 * 用法：
 *   npx tsx scripts/backfill-seed-quiz-activities.ts                 # 用 .env.local 指向的库
 *   DATABASE_URL=<生产连接串> npx tsx scripts/backfill-seed-quiz-activities.ts   # 显式指定生产库
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// 各章知识原子(KA)数量，需与 prisma/seed.ts 里的 KA_COUNT_BY_CHAPTER 保持一致
const KA_COUNT_BY_CHAPTER: Record<number, number> = {
  1: 5, 2: 6, 3: 6, 4: 6, 5: 6, 6: 4, 7: 4, 8: 5, 9: 4,
};

// 用 userId+score 做确定性种子生成每个 KA 的抖动，保证脚本重复运行时结果一致
function deterministicJitter(userId: string, k: number): number {
  const charSum = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return ((charSum + k * 7) % 21) - 10; // -10 ~ 10
}

async function main() {
  console.log('🔄 回填 QuizAttempt → UserActivity(COMPLETE_QUIZ)...\n');

  const attempts = await prisma.quizAttempt.findMany({
    orderBy: { createdAt: 'asc' },
    select: { userId: true, quizId: true, score: true, completedAt: true },
  });

  console.log(`共 ${attempts.length} 条 QuizAttempt 记录\n`);

  let inserted = 0;
  let skipped = 0;

  for (const at of attempts) {
    // 幂等判断：该用户在完成时间前后2秒内是否已有 COMPLETE_QUIZ 记录
    const exists = await prisma.userActivity.findFirst({
      where: {
        userId: at.userId,
        action: 'COMPLETE_QUIZ',
        createdAt: {
          gte: new Date(at.completedAt.getTime() - 2000),
          lte: new Date(at.completedAt.getTime() + 2000),
        },
      },
      select: { id: true },
    });

    if (exists) {
      skipped++;
      continue;
    }

    const chapterMatch = at.quizId.match(/(\d+)$/);
    const chapterNum = chapterMatch ? parseInt(chapterMatch[1], 10) : 1;
    const kaCount = KA_COUNT_BY_CHAPTER[chapterNum] ?? 5;

    const weakAreas: string[] = [];
    const scoresByKA: Record<string, { correct: number; total: number; score: number }> = {};
    for (let k = 1; k <= kaCount; k++) {
      const ka = `${chapterNum}.${k}`;
      const jitter = deterministicJitter(at.userId, k);
      const kaScore = Math.min(100, Math.max(0, Math.round(at.score + jitter)));
      scoresByKA[ka] = { correct: kaScore >= 50 ? 1 : 0, total: 1, score: kaScore };
      if (kaScore < 70) weakAreas.push(ka);
    }

    await prisma.userActivity.create({
      data: {
        userId: at.userId,
        action: 'COMPLETE_QUIZ',
        details: JSON.stringify({ quizId: at.quizId, score: at.score, weakAreas, scoresByKA }),
        createdAt: at.completedAt,
      },
    });
    inserted++;
  }

  console.log(`\n✅ 完成：inserted=${inserted}, skipped(已存在)=${skipped}, total=${attempts.length}`);
}

main()
  .catch((err) => {
    console.error('❌ 回填失败:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
