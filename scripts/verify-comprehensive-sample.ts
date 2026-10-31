/**
 * 核对综合测评发布卷，并打印可复现的题号（不打印题干）。
 *
 * 复现：
 *   npx tsx scripts/verify-comprehensive-sample.ts
 * 同一命令重复执行应得到同一 id 列表。代码入口是
 * `selectComprehensiveQuestions(quizQuestions, { seed: COMPREHENSIVE_SAMPLE_SEED })`，
 * 与无参 `getComprehensiveQuestions()` 相同。
 */
import { getComprehensiveQuestions, quizQuestions } from '../src/lib/quiz-data';
import {
  COMPREHENSIVE_NEW_INTAKE_MIN_ID,
  COMPREHENSIVE_SAMPLE_SEED,
  comprehensiveQuestionWeight,
  selectComprehensiveQuestions,
} from '../src/lib/comprehensive-sample';

const LEGACY_PREFIX_IDS = [
  225, 226, 1, 2, 4, 13, 263, 264, 6, 8, 5, 9, 14, 28, 7, 25, 132, 186, 213, 214,
];

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

const published = getComprehensiveQuestions();
const again = selectComprehensiveQuestions(quizQuestions, { seed: COMPREHENSIVE_SAMPLE_SEED });
const ids = published.map((question) => question.id);
const againIds = again.map((question) => question.id);

if (ids.join(',') !== againIds.join(',')) {
  fail('发布种子两次抽样不一致');
}
if (ids.length !== 20) fail(`题量应为 20，实际 ${ids.length}`);
if (new Set(ids).size !== ids.length) fail('题号重复');

const counts = new Map<number, number>();
for (const question of published) {
  counts.set(question.chapter, (counts.get(question.chapter) ?? 0) + 1);
}
const chapters = [...counts.keys()].sort((left, right) => left - right);
if (chapters.join(',') !== '1,2,3,4,5,6,7,8,9,10') {
  fail(`章节覆盖应为 1-10，实际 ${chapters.join(',')}`);
}
for (const [chapter, count] of counts) {
  if (count !== 2) fail(`第 ${chapter} 章配额应为 2，实际 ${count}`);
}

const newIds = ids.filter((id) => id >= COMPREHENSIVE_NEW_INTAKE_MIN_ID);
if (newIds.length < 4) fail(`id>=${COMPREHENSIVE_NEW_INTAKE_MIN_ID} 的题应至少 4 道，实际 ${newIds.length}`);
if (ids.join(',') === LEGACY_PREFIX_IDS.join(',')) fail('抽样仍等于旧的每章前两题');

console.log(`seed: ${COMPREHENSIVE_SAMPLE_SEED}`);
console.log('strategy: published-seed');
console.log(`count: ${ids.length}`);
console.log(`ids: ${ids.join(',')}`);
console.log(`newIntake: ${newIds.length} (${newIds.join(',')})`);
for (const question of published) {
  const weight = comprehensiveQuestionWeight(question);
  console.log(
    `ch${question.chapter}\tid=${question.id}\t${question.type}\t${weight.sourceClass}\tweight=${weight.weight}`,
  );
}
console.log('ok');
