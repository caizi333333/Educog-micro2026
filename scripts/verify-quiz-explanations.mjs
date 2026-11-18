import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file = 'src/lib/quiz-data.ts';
const base = process.argv[2] || 'origin/release/2026-09-20-production';
function parse(source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let array;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'quizQuestions') {
      assert(ts.isArrayLiteralExpression(node.initializer));
      array = node.initializer.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert(array, 'quizQuestions array not found');
  return JSON.parse(JSON.stringify(vm.runInNewContext(`(${array})`, {}, { timeout: 1000 })));
}
const before = parse(execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' }));
const after = parse(fs.readFileSync(file, 'utf8'));
const isPractice = (q) => !q.explanation?.startsWith('[source: 期末客观模拟变体');
const hasExplanation = (q) => Boolean(q.explanation?.trim());
const missing = before.filter((q) => isPractice(q) && !hasExplanation(q));
if (process.argv[3] === '--export') {
  const path = process.argv[4];
  assert(path, 'An export path is required');
  fs.writeFileSync(path, JSON.stringify(missing, null, 2) + '\n');
  console.log(`Exported ${missing.length} questions to ${path}`);
}
assert.equal(after.length, before.length);
const added = [];
for (let i = 0; i < before.length; i++) {
  const { explanation: oldExplanation, ...oldFields } = before[i];
  const { explanation: newExplanation, ...newFields } = after[i];
  assert.deepEqual(newFields, oldFields, `Non-explanation field changed at #${before[i].id}`);
  if (oldExplanation !== undefined || !isPractice(before[i])) {
    assert.equal(newExplanation, oldExplanation, `Existing explanation changed at #${before[i].id}`);
  } else if (newExplanation !== undefined) {
    assert.equal(typeof newExplanation, 'string');
    assert(newExplanation.trim(), `Empty addition at #${before[i].id}`);
    assert(newExplanation.length <= 120, `Explanation exceeds 120 characters at #${before[i].id}`);
    added.push(before[i].id);
  }
}
const pool = before.filter(isPractice);
const remaining = after.filter(isPractice).filter((q) => !hasExplanation(q)).map((q) => q.id);
const review = fs.readFileSync('docs/quiz-explanations-review.md', 'utf8');
const documented = [...review.matchAll(/^\| (\d+) \|/gm)].map((m) => Number(m[1]));
assert.deepEqual(remaining, documented, 'Every remaining gap must be documented, in bank order');
console.log(`Bank: ${before.length}; practice pool: ${pool.length}`);
console.log(`Practice explanations: ${pool.filter(hasExplanation).length} -> ${after.filter(isPractice).filter(hasExplanation).length}`);
console.log(`Added: ${added.length}; remaining missing: ${after.filter(isPractice).filter((q) => !hasExplanation(q)).length}`);
console.log('Invariant: only previously missing practice explanation fields changed; existing explanations and variants unchanged.');
console.log(`Generated IDs: ${added.join(', ')}`);
