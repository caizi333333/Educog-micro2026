/**
 * 实验记录 ID 重映射 + 预警演示数据（先诊断、后应用）。
 *
 * 背景：prisma/seed.ts 的 EXPERIMENT_IDS 用的是 proj01~proj08，而实验目录
 * (src/lib/experiment-config.ts) 里"实验一~九"的 ID 是 exp01~exp09。教师仪表板
 * 按 experimentId 联表统计，导致"实验完成分布"里实验一~九恒为 0、项目行数字堆积，
 * 观感如同功能坏掉。本脚本把当年种子写错位置的记录搬回 exp 系列。
 *
 * 安全约束：仅操作 userExperiment / quizAttempt / userActivity 三表；全部幂等；
 * 默认只读诊断，加 --apply 才写库；ASSIGNED 状态（教师"布置课前"产生）一律不动；
 * 目标位置已有记录的跳过，避免唯一性冲突与覆盖。
 *
 * 用法：
 *   npx tsx scripts/backfill-experiment-id-remap.ts                     # 只读诊断（.env.local 库）
 *   DATABASE_URL=<生产串> npx tsx scripts/backfill-experiment-id-remap.ts             # 生产库诊断
 *   DATABASE_URL=<生产串> npx tsx scripts/backfill-experiment-id-remap.ts --apply     # 应用重映射
 *   DATABASE_URL=<生产串> npx tsx scripts/backfill-experiment-id-remap.ts --apply --low-score  # 另给最弱3名学生补低分测验，让预警中心有演示内容
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const LOW_SCORE = process.argv.includes('--low-score');

// 种子错位 → 目录真实 ID
const REMAP: Record<string, string> = {
  proj01: 'exp01', proj02: 'exp02', proj03: 'exp03', proj04: 'exp04',
  proj05: 'exp05', proj06: 'exp06', proj07: 'exp07', proj08: 'exp08',
};

async function diagnose() {
  const rows = await prisma.userExperiment.groupBy({
    by: ['experimentId', 'status'],
    _count: { _all: true },
    orderBy: { experimentId: 'asc' },
  });
  console.log('experimentId × status 分布：');
  for (const r of rows) console.log(`  ${r.experimentId.padEnd(8)} ${r.status.padEnd(12)} ${r._count._all}`);
  const remappable = await prisma.userExperiment.count({
    where: { experimentId: { in: Object.keys(REMAP) }, status: { not: 'ASSIGNED' } },
  });
  console.log(`\n可重映射（proj01~08 且非 ASSIGNED）：${remappable} 条`);
  return remappable;
}

async function applyRemap() {
  let moved = 0, skipped = 0;
  const rows = await prisma.userExperiment.findMany({
    where: { experimentId: { in: Object.keys(REMAP) }, status: { not: 'ASSIGNED' } },
  });
  for (const row of rows) {
    const target = REMAP[row.experimentId];
    const exists = await prisma.userExperiment.findFirst({
      where: { userId: row.userId, experimentId: target },
    });
    if (exists) { skipped++; continue; }
    await prisma.userExperiment.update({ where: { id: row.id }, data: { experimentId: target } });
    moved++;
  }
  console.log(`重映射完成：迁移 ${moved} 条，跳过（目标已存在）${skipped} 条`);
}

// 给平均分最低的 3 名学生各补 2 次低分测验（40~55 分，确定性），把平均分拉到 60 以下，
// 使"预警学生·干预中心"有真实可演示的内容。幂等：以 quizId 前缀 warmup-lowscore 标记。
async function applyLowScore() {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', username: { not: { startsWith: 'demo_' } } },
    select: { id: true, name: true, username: true },
  });
  const avgs: { id: string; name: string; avg: number; n: number }[] = [];
  for (const s of students) {
    const agg = await prisma.quizAttempt.aggregate({ where: { userId: s.id }, _avg: { score: true }, _count: { _all: true } });
    if (agg._count._all > 0) avgs.push({ id: s.id, name: s.name ?? s.username, avg: agg._avg.score ?? 0, n: agg._count._all });
  }
  avgs.sort((a, b) => a.avg - b.avg);
  const targets = avgs.slice(0, 3);
  for (const t of targets) {
    const marker = `warmup-lowscore-${t.id.slice(-6)}`;
    const already = await prisma.quizAttempt.findFirst({ where: { userId: t.id, quizId: { startsWith: 'warmup-lowscore' } } });
    if (already) { console.log(`  ${t.name} 已有低分补记录，跳过`); continue; }
    // 需要几次低分才能把均值压到 60 以下：avg*n + k*45 < 60*(n+k)
    const k = Math.max(2, Math.ceil((t.avg * t.n - 60 * t.n) / 15));
    for (let i = 0; i < k; i++) {
      const score = 40 + ((t.id.charCodeAt(3) + i * 7) % 16); // 40~55 确定性
      const when = new Date(Date.now() - (10 - i) * 86400000);
      await prisma.quizAttempt.create({
        data: {
          userId: t.id, quizId: `${marker}-${i}`, score, totalQuestions: 20,
          correctAnswers: Math.round((score / 100) * 20), timeSpent: 900 + i * 120,
          answers: JSON.stringify({}), startedAt: when, completedAt: new Date(when.getTime() + 900000),
        },
      });
    }
    console.log(`  ${t.name}（原均分 ${t.avg.toFixed(1)}，${t.n} 次）补 ${k} 次低分测验`);
  }
  console.log('低分补录完成。如需薄弱节点/学习路径联动，可再跑一次 backfill-seed-quiz-activities.ts（幂等）。');
}

async function main() {
  const n = await diagnose();
  if (!APPLY) { console.log('\n（只读诊断。确认无误后加 --apply 应用）'); return; }
  if (n > 0) await applyRemap();
  if (LOW_SCORE) await applyLowScore();
  console.log('\n应用后分布：'); await diagnose();
}

main().finally(() => prisma.$disconnect());
