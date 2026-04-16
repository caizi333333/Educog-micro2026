'use client';

import React, { Suspense, lazy } from 'react';

// Lazy-load animation components to avoid bloating initial bundle
const LEDShiftAnim = lazy(() => import('./LEDShiftAnim'));
const TimerCounterAnim = lazy(() => import('./TimerCounterAnim'));
const PWMWaveAnim = lazy(() => import('./PWMWaveAnim'));
const InterruptFlowAnim = lazy(() => import('./InterruptFlowAnim'));
const UARTFrameAnim = lazy(() => import('./UARTFrameAnim'));
const StackPushPopAnim = lazy(() => import('./StackPushPopAnim'));

/** Animation ID → component mapping */
const ANIMATION_MAP: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  'led-shift':       LEDShiftAnim,
  'timer-counter':   TimerCounterAnim,
  'pwm-wave':        PWMWaveAnim,
  'interrupt-flow':  InterruptFlowAnim,
  'uart-frame':      UARTFrameAnim,
  'stack-pushpop':   StackPushPopAnim,
};

function AnimationFallback() {
  return (
    <div className="h-20 flex items-center justify-center text-[10px] text-[#585b70]">
      加载动画...
    </div>
  );
}

interface Props {
  animationId: string;
}

export default function AnimationRenderer({ animationId }: Props) {
  const Component = ANIMATION_MAP[animationId];
  if (!Component) return null;

  return (
    <Suspense fallback={<AnimationFallback />}>
      <Component />
    </Suspense>
  );
}

/** All available animation IDs for type-checking */
export type AnimationId = keyof typeof ANIMATION_MAP;

export const AVAILABLE_ANIMATIONS = Object.keys(ANIMATION_MAP);
