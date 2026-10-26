import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/**
 * The production client compiler fails with UnhandledSchemeError when a
 * lesson-notes page reaches node:crypto. Parse real import declarations so
 * comments cannot hide or fake that boundary.
 */
const ROOT = join(__dirname, '../../..');

function importedModules(relativePath: string): string[] {
  const fileName = join(ROOT, relativePath);
  const sourceFile = ts.createSourceFile(
    fileName,
    readFileSync(fileName, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const modules: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
    ) {
      modules.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return modules;
}

function leaksServerRuntime(modules: string[]): boolean {
  return modules.some((specifier) => (
    specifier === '@/lib/learning-presence'
    || specifier === '@/lib/prisma'
    || specifier === '@/lib/classroom'
    || specifier === 'crypto'
    || specifier.startsWith('node:')
  ));
}

describe('learning presence client boundary', () => {
  it('keeps node:crypto and Prisma out of the lesson-notes client chain', () => {
    const page = importedModules('src/app/lesson-notes/page.tsx');
    const layout = importedModules('src/components/layout/app-layout.tsx');
    const graph = importedModules('src/components/hyper/HyperKnowledgeGraphPage.tsx');
    const hook = importedModules('src/hooks/useLearningPresence.ts');
    const shared = importedModules('src/lib/learning-presence-shared.ts');
    const server = importedModules('src/lib/learning-presence.ts');

    for (const client of [page, layout, graph]) {
      expect(client).toContain('@/hooks/useLearningPresence');
      expect(leaksServerRuntime(client)).toBe(false);
    }

    expect(hook).toContain('@/lib/learning-presence-shared');
    expect(hook).not.toContain('@/lib/learning-presence');
    expect(leaksServerRuntime(hook)).toBe(false);

    expect(shared).toEqual([]);

    expect(server).toContain('node:crypto');
    expect(server).toContain('@/lib/prisma');
    expect(server).toContain('@/lib/classroom');
    expect(server).toContain('@/lib/learning-presence-shared');
    expect(server).not.toContain('@/hooks/useLearningPresence');
  });
});
