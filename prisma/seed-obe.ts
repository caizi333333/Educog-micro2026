/**
 * OBE 数据种子脚本
 * 填充毕业要求、指标点、课程目标及考核环节映射
 * 用法: npx tsx prisma/seed-obe.ts
 */

import { PrismaClient } from '@prisma/client';
import { GRADUATION_REQUIREMENTS, INDICATOR_POINTS, COURSE_OBJECTIVES } from '../src/lib/obe-data';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding OBE data...\n');

  const { coCount, linkCount } = await prisma.$transaction(async (tx) => {
    // 1. 毕业要求
    console.log('Creating graduation requirements...');
    for (const gr of GRADUATION_REQUIREMENTS) {
      await tx.graduationRequirement.upsert({
        where: { code: gr.code },
        update: { name: gr.name, description: gr.description, index: gr.index },
        create: { code: gr.code, index: gr.index, name: gr.name, description: gr.description },
      });
    }
    console.log(`  ✓ ${GRADUATION_REQUIREMENTS.length} graduation requirements`);

    // 2. 指标点
    console.log('Creating indicator points...');
    for (const ip of INDICATOR_POINTS) {
      const gr = await tx.graduationRequirement.findUnique({ where: { code: ip.graduationRequirementCode } });
      if (!gr) throw new Error(`GR ${ip.graduationRequirementCode} not found`);

      await tx.indicatorPoint.upsert({
        where: { code: ip.code },
        update: { description: ip.description, achievementThreshold: ip.threshold, subIndex: ip.subIndex },
        create: {
          code: ip.code,
          graduationRequirementId: gr.id,
          subIndex: ip.subIndex,
          description: ip.description,
          achievementThreshold: ip.threshold,
        },
      });
    }
    console.log(`  ✓ ${INDICATOR_POINTS.length} indicator points`);

    // 3. 课程目标 + 考核环节映射
    console.log('Creating course objectives + assessment links...');
    for (const co of COURSE_OBJECTIVES) {
      const ip = await tx.indicatorPoint.findUnique({ where: { code: co.indicatorPointCode } });
      if (!ip) throw new Error(`IP ${co.indicatorPointCode} not found`);

      const objective = await tx.courseObjective.upsert({
        where: { code: co.code },
        update: {
          name: co.name,
          description: co.description,
          indicatorPointId: ip.id,
          supportWeight: co.supportWeight,
          isActive: true,
          version: { increment: 1 },
        },
        create: {
          code: co.code,
          name: co.name,
          description: co.description,
          indicatorPointId: ip.id,
          supportWeight: co.supportWeight,
          isActive: true,
        },
      });

      const desiredLinks = co.assessmentLinks.map((link) => ({
        assessmentType: link.type,
        assessmentTargetId: link.targetId,
      }));
      await tx.assessmentLink.deleteMany({
        where: {
          courseObjectiveId: objective.id,
          ...(desiredLinks.length > 0 ? { NOT: { OR: desiredLinks } } : {}),
        },
      });

      for (const link of co.assessmentLinks) {
        await tx.assessmentLink.upsert({
          where: {
            courseObjectiveId_assessmentType_assessmentTargetId: {
              courseObjectiveId: objective.id,
              assessmentType: link.type,
              assessmentTargetId: link.targetId,
            },
          },
          update: {
            weight: link.weight,
            maxScore: link.maxScore,
            chapter: link.chapter,
            description: link.description,
          },
          create: {
            courseObjectiveId: objective.id,
            assessmentType: link.type,
            assessmentTargetId: link.targetId,
            weight: link.weight,
            maxScore: link.maxScore,
            chapter: link.chapter,
            description: link.description,
          },
        });
      }
    }

    return {
      coCount: await tx.courseObjective.count(),
      linkCount: await tx.assessmentLink.count(),
    };
  }, {
    isolationLevel: 'Serializable',
    maxWait: 10_000,
    timeout: 30_000,
  });

  console.log(`  ✓ ${coCount} course objectives, ${linkCount} assessment links`);

  console.log('\n✅ OBE data seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
