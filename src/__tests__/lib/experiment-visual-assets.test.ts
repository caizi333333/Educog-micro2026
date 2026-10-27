import { getExperimentVisualAssets } from '@/lib/experiment-visual-assets';

describe('course hardware figures', () => {
  it('spaces 80C51 pin labels and does not borrow the 52-subfamily T2 pins', () => {
    const svg = getExperimentVisualAssets('exp01').find((asset) => asset.id === 'at89c51-pinout')?.svg ?? '';
    expect(svg).toContain('80C51');
    expect(svg).toContain('AT89C51');
    expect(svg).not.toContain('P1.0/T2');
    expect(svg).not.toContain('T2EX');
    expect(svg).toContain('y1="108"');
    expect(svg).toContain('y1="128"');
    expect(svg).not.toContain('13.4');
  });

  it('draws the exp01 LED net as sink current through 2kΩ', () => {
    const asset = getExperimentVisualAssets('exp01').find((item) => item.id === 'exp01-led-wiring');
    expect(asset?.description).toContain('2kΩ');
    expect(asset?.svg).toContain('2kΩ');
    expect(asset?.svg).not.toContain('330');
    expect(asset?.svg).toContain('80C51');
    expect(asset?.svg).toContain('points="448,');
  });
});
