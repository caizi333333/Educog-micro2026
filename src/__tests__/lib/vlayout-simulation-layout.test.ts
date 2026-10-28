import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../..');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('simulation vLayout (#69)', () => {
  const globals = read(join(ROOT, 'src/app/globals.css'));
  const page = read(join(ROOT, 'src/app/simulation/page.tsx'));
  const canvas = read(join(ROOT, 'src/components/hyper/HyperExperimentCanvas.tsx'));

  it('defines a 960px simulation canvas cap separate from the 800px courseware column', () => {
    expect(globals).toContain('--simulation-canvas-max-width: 960px');
    expect(globals).toContain('--content-max-width: 800px');
  });

  it('marks the simulation shell and reads spacing tokens on the top toolbar', () => {
    expect(page).toContain('data-vlayout="simulation"');
    expect(page).toContain('gap-[var(--space-2)]');
    expect(page).toContain('px-[var(--space-3)]');
  });

  it('centers the diagram within min(100%, 960px) and keeps controls in a footer bar', () => {
    expect(canvas).toContain('data-vlayout="simulation-canvas"');
    expect(canvas).toContain('var(--simulation-canvas-max-width)');
    expect(canvas).toContain('data-vlayout="simulation-canvas-controls"');
    expect(canvas).toContain('px-[var(--space-3)]');
    expect(canvas).toContain('gap-[var(--space-4)]');
    expect(canvas).not.toContain('absolute bottom-3 right-3');
    expect(canvas).not.toContain('absolute bottom-3 left-3');
  });
});
