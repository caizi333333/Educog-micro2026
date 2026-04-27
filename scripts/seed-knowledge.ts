// One-shot seeder: mirror the canonical 270-node knowledgePoints array from
// src/lib/knowledge-points.ts into the Prisma KnowledgeNode table.
//
// Idempotent — uses upsert keyed by id, so re-running re-syncs source-of-truth
// edits made in TS back to the DB. The DB row is NOT yet authoritative; the
// next slice (teacher editor) will flip the read path to DB and add a write
// path that writes back here.
//
// Usage:
//   npx tsx scripts/seed-knowledge.ts
//
// Requires DATABASE_URL pointing at a Postgres instance with the schema pushed
// (npx prisma db push).

import { Prisma, PrismaClient } from '@prisma/client';
import { knowledgePoints } from '../src/lib/knowledge-points';

const prisma = new PrismaClient();

async function main() {
  let inserted = 0;
  let updated = 0;
  for (const point of knowledgePoints) {
    const data = {
      name: point.name,
      level: point.level,
      chapter: point.chapter,
      description: point.description ?? null,
      graphNodeId: point.graphNodeId ?? null,
      parentId: point.parentId ?? null,
      resources: point.resources
        ? (point.resources as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      prerequisites: point.prerequisites ?? [],
      appliedIn: point.appliedIn ?? [],
    };

    const existing = await prisma.knowledgeNode.findUnique({ where: { id: point.id } });
    if (existing) {
      await prisma.knowledgeNode.update({ where: { id: point.id }, data });
      updated++;
    } else {
      await prisma.knowledgeNode.create({ data: { id: point.id, ...data } });
      inserted++;
    }
  }
  const total = await prisma.knowledgeNode.count();
  console.log(`KnowledgeNode seed done: ${inserted} inserted, ${updated} updated, ${total} total in DB.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
