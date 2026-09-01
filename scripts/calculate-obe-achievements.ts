/**
 * 批量计算达成度
 * 按有效班级为所有学生计算课程目标达成度和指标点达成度
 * 用法: npx tsx scripts/calculate-obe-achievements.ts
 */

import { PrismaClient } from '@prisma/client';
import { batchCalculateUserAchievement } from '../src/lib/achievement-evaluation';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Calculating OBE achievements...\n');

  const users = await prisma.user.findMany({
    where: { role: 'STUDENT', status: 'ACTIVE' },
    select: {
      id: true,
      username: true,
      name: true,
      classEnrollments: {
        where: {
          role: 'STUDENT',
          status: 'ACTIVE',
          classGroup: { status: 'ACTIVE', semester: { not: null } },
        },
        select: {
          classId: true,
          classGroup: { select: { name: true, semester: true } },
        },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });

  console.log(`Found ${users.length} students\n`);

  for (const user of users) {
    if (user.classEnrollments.length === 0) {
      console.log(`  - ${user.name || user.username}: skipped (no active class with a semester)`);
      continue;
    }
    for (const enrollment of user.classEnrollments) {
      const semester = enrollment.classGroup.semester?.trim();
      if (!semester) continue;
      try {
        const result = await batchCalculateUserAchievement(user.id, semester, enrollment.classId);
        console.log(`  ✓ ${user.name || user.username} / ${enrollment.classGroup.name}: ${result.coResults} CO + ${result.grResults} GR`);
      } catch (err) {
        console.error(`  ✗ ${user.name || user.username} / ${enrollment.classGroup.name}: ${err}`);
      }
    }
  }

  // Summary
  const coTotal = await prisma.courseObjectiveAchievement.count();
  const grTotal = await prisma.graduationRequirementAchievement.count();
  const coPassed = await prisma.courseObjectiveAchievement.count({ where: { passed: true } });
  const grPassed = await prisma.graduationRequirementAchievement.count({ where: { passed: true } });

  console.log('\n--- Summary ---');
  console.log(`Course Objective Achievements: ${coTotal} (${coPassed} passed)`);
  console.log(`Graduation Requirement Achievements: ${grTotal} (${grPassed} passed)`);
  console.log('\n✅ Calculation complete!');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Calculation failed:', e);
  process.exit(1);
});
