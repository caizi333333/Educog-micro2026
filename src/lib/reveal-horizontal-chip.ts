/**
 * Measurements for a horizontal chip strip.
 * `stripLeft` and `chip.left` are viewport coordinates from `getBoundingClientRect`.
 */
export type HorizontalStripMetrics = {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  stripLeft: number;
};

export type HorizontalChipBox = {
  left: number;
  width: number;
};

/**
 * Scroll offset that brings a chip fully inside a horizontal strip.
 *
 * Returns the current `scrollLeft` when the strip does not overflow or the chip
 * is already inside the padded viewport. Wider chips stay aligned to their start.
 *
 * @param strip - scrollport metrics
 * @param chip - chip box in the same viewport coordinates as `strip.stripLeft`
 * @param pad - pixels kept between the chip and the strip edge
 * @returns the next `scrollLeft`
 *
 * @example
 * scrollLeftForChip(
 *   { scrollLeft: 0, clientWidth: 200, scrollWidth: 800, stripLeft: 0 },
 *   { left: 480, width: 120 },
 * );
 */
export function scrollLeftForChip(
  strip: HorizontalStripMetrics,
  chip: HorizontalChipBox,
  pad = 12,
): number {
  const maxScroll = Math.max(0, strip.scrollWidth - strip.clientWidth);
  if (maxScroll <= 1 || chip.width <= 0 || strip.clientWidth <= 0) return strip.scrollLeft;

  const chipLeft = strip.scrollLeft + (chip.left - strip.stripLeft);
  const chipRight = chipLeft + chip.width;
  const viewLeft = strip.scrollLeft;
  const viewRight = strip.scrollLeft + strip.clientWidth;
  let next = strip.scrollLeft;
  if (chipLeft < viewLeft + pad) next = chipLeft - pad;
  else if (chipRight > viewRight - pad) next = chipRight - strip.clientWidth + pad;

  return Math.round(Math.min(maxScroll, Math.max(0, next)));
}
