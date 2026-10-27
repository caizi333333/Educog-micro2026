'use client';

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Junction hue shared by student surfaces. Geometry stays the same; the hue marks which area you are in. */
export type CellTone = 'shell' | 'course' | 'task' | 'notes';

export type CellSurfaceOptions = {
  /** When true, drop the tall block size so the cell can sit in a list or switch. */
  compact?: boolean;
  /** When true, play the shared enter motion once. Duration comes from `--cell-duration`. */
  enter?: boolean;
  /** When true, the cell is the current choice inside a switch or tab list. */
  active?: boolean;
  /** When true, hover uses the junction hue. Pair with a real link or button. */
  interactive?: boolean;
  className?: string;
};

/**
 * Class string for a student-surface cell.
 *
 * Pages keep their own copy, links, and status colors. This only supplies
 * shared padding, radius, the junction stripe, and the 180ms ease.
 *
 * @param options - tone is applied separately via `data-tone`
 * @returns class names safe to pass through `cn`
 *
 * @example
 * <a data-tone="course" className={cellSurfaceClass({ interactive: true })} href="#item-3">单元 3</a>
 */
export function cellSurfaceClass(options: CellSurfaceOptions = {}): string {
  const { compact = false, enter = false, active = false, interactive = false, className } = options;
  return cn(
    'edu-cell',
    compact && 'edu-cell--compact',
    enter && 'edu-cell-enter',
    active && 'edu-cell--active',
    interactive && 'edu-cell--interactive',
    className,
  );
}

type CellProps = HTMLAttributes<HTMLDivElement> & CellSurfaceOptions & {
  tone?: CellTone;
  children?: ReactNode;
};

/**
 * Neutral cell container. Use `cellSurfaceClass` instead when the element must stay an anchor or button.
 *
 * @param props.tone - junction hue (`course`, `task`, `notes`, or `shell`)
 * @returns a padded block with the shared stripe
 */
export function Cell({
  tone = 'shell',
  compact = false,
  enter = false,
  active = false,
  interactive = false,
  className,
  children,
  ...rest
}: CellProps): React.JSX.Element {
  return (
    <div
      data-tone={tone}
      data-state={active ? 'active' : 'idle'}
      className={cellSurfaceClass({ compact, enter, active, interactive, className })}
      {...rest}
    >
      {children}
    </div>
  );
}

type CellGridProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

/**
 * Grid of cells. Column counts stay on the caller (`grid-cols-*`) so each page can wrap differently.
 *
 * @returns a grid whose gap is `--cell-gap`
 */
export function CellGrid({ className, children, ...rest }: CellGridProps): React.JSX.Element {
  return (
    <div className={cn('edu-cell-grid', className)} {...rest}>
      {children}
    </div>
  );
}

type CellSkeletonProps = {
  /** How many reserved blocks to paint. Defaults to 1. */
  count?: number;
  tone?: CellTone;
  /** Visible status text. Omit when a parent already announces loading. */
  label?: string;
  className?: string;
};

/**
 * Loading placeholder that holds the same block height as a cell, so content does not jump in.
 *
 * @param props.label - when set, the group is a single polite status
 * @returns skeleton blocks using the shared shimmer
 */
export function CellSkeleton({ count = 1, tone = 'shell', label, className }: CellSkeletonProps): React.JSX.Element {
  const blocks = Array.from({ length: count }, (_, index) => (
    <div key={index} className="edu-cell-skeleton" data-tone={tone} />
  ));
  const grid = (
    <div className={cn('edu-cell-grid', className)} aria-hidden="true">
      {blocks}
    </div>
  );
  if (!label) return grid;
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <p className="text-sm text-slate-400">{label}</p>
      {grid}
    </div>
  );
}

type CellSwitchProps = {
  /** Accessible name for the group, such as "选择单元". */
  label: string;
  children?: ReactNode;
  className?: string;
};

/**
 * Wrapped unit/tab switch. Items wrap onto the next line instead of adding another horizontal scroller.
 *
 * @param props.label - `aria-label` of the group
 */
export function CellSwitch({ label, children, className }: CellSwitchProps): React.JSX.Element {
  return (
    <div role="group" aria-label={label} className={cn('edu-cell-switch', className)}>
      {children}
    </div>
  );
}

type CellSwitchItemProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  pressed: boolean;
  tone?: CellTone;
};

/**
 * One choice inside a `CellSwitch`.
 *
 * @param props.pressed - mirrors `aria-pressed`
 * @param props.tone - junction hue for this choice
 */
export function CellSwitchItem({
  pressed,
  tone = 'shell',
  className,
  children,
  ...rest
}: CellSwitchItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-tone={tone}
      data-state={pressed ? 'active' : 'idle'}
      className={cellSurfaceClass({
        compact: true,
        active: pressed,
        interactive: true,
        className: cn('min-h-11 text-left', className),
      })}
      {...rest}
    >
      {children}
    </button>
  );
}

type SurfaceKickerProps = {
  tone: CellTone;
  children?: ReactNode;
  className?: string;
};

/**
 * Shared eyebrow at a surface boundary (home, tasks, lesson notes).
 * The tone changes; the chip geometry does not.
 *
 * @param props.tone - which area this heading belongs to
 */
export function SurfaceKicker({ tone, children, className }: SurfaceKickerProps): React.JSX.Element {
  return (
    <div className={cn('edu-surface-kicker', className)} data-tone={tone}>
      {children}
    </div>
  );
}

type CoursewareSeamProps = {
  /** True after the active iframe has fired `load`. */
  ready: boolean;
  /** Short status while the pane is still empty. */
  label: string;
  className?: string;
  children?: ReactNode;
};

/**
 * Boundary between the Next.js shell and a same-origin courseware iframe.
 * Reserves the pane height and covers the empty frame until load, without unmounting the iframe.
 *
 * @param props.ready - hides the skeleton and fades the frame in
 * @returns a labelled region whose minimum height matches the lesson pane
 */
export function CoursewareSeam({ ready, label, className, children }: CoursewareSeamProps): React.JSX.Element {
  return (
    <section aria-label="讲解课件" aria-busy={!ready} className={cn('edu-cell-seam', className)} data-tone="notes">
      {!ready && (
        <div className="edu-cell-seam__pending" role="status">
          <div className="edu-cell-grid" aria-hidden="true">
            <div className="edu-cell-skeleton" data-tone="notes" />
            <div className="edu-cell-skeleton" data-tone="course" />
          </div>
          <p className="edu-cell-seam__label">{label}</p>
        </div>
      )}
      <div className={cn('edu-cell-seam__frame', ready && 'is-ready')}>{children}</div>
    </section>
  );
}
