import { scrollLeftForChip } from '@/lib/reveal-horizontal-chip';

const strip = {
  scrollLeft: 0,
  clientWidth: 200,
  scrollWidth: 800,
  stripLeft: 16,
};

describe('scrollLeftForChip', () => {
  it('leaves the offset alone when the chip is already inside the strip', () => {
    expect(scrollLeftForChip(strip, { left: 40, width: 80 })).toBe(0);
  });

  it('scrolls a chip that sits past the right edge into view', () => {
    expect(scrollLeftForChip(strip, { left: 480, width: 120 })).toBe(396);
  });

  it('scrolls a chip that sits past the left edge back into view', () => {
    expect(scrollLeftForChip({ ...strip, scrollLeft: 300 }, { left: 0, width: 90 })).toBe(272);
  });

  it('does not move a strip that is not overflowing', () => {
    expect(scrollLeftForChip({ ...strip, scrollWidth: 200 }, { left: 480, width: 120 })).toBe(0);
  });

  it('clamps to the scroll range', () => {
    expect(scrollLeftForChip(strip, { left: 900, width: 200 })).toBe(600);
    expect(scrollLeftForChip({ ...strip, scrollLeft: 40 }, { left: -80, width: 40 })).toBe(0);
  });
});
