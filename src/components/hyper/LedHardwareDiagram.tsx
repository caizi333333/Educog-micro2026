'use client';

import { useId } from 'react';
import type { PortName } from '@/lib/experiment-config';

/**
 * 80C51 LED 硬件图。
 *
 * 按 1 个 viewBox 单位 = 1 CSS 像素绘制，避免把大幅面 SVG 缩进侧栏后
 * 文字变成几像素。放大时只增加 SVG 的 CSS 宽度，笔画保持矢量。
 * 电路口径与教程一致：阳极接 +5V，阴极经 2kΩ 接到端口，端口为 0 时点亮。
 */

export type LedDiagramVariant = 'schematic' | 'board';

const VIEW_W = 320;
const VIEW_H = 392;
const ROW_0 = 86;
const ROW_PITCH = 34;
const CHIP_X = 10;
const CHIP_Y = 66;
const CHIP_W = 96;
const RES_X = 116;
const RES_W = 46;
const LED_X = 214;
const RAIL_X = 300;

const SANS = "ui-sans-serif, system-ui, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
const MONO = "ui-monospace, 'Source Code Pro', Menlo, Consolas, monospace";

const THEME = {
  schematic: {
    bg: '#0b1014',
    grid: '#173039',
    frame: '#101820',
    frameStroke: '#5eead4',
    title: '#e7f6f5',
    muted: '#a9bcc3',
    pinOn: '#e7fbff',
    wire: '#3d5560',
    wireOn: '#5eead4',
    resistor: '#152028',
    resistorStroke: '#b7c8ce',
    resistorText: '#f3fbfb',
    led: '#3a2428',
    ledOn: '#fb7185',
    rail: '#fbbf24',
  },
  board: {
    bg: '#0d332c',
    grid: '#145246',
    frame: '#14181c',
    frameStroke: '#d5e7de',
    title: '#e8f7f0',
    muted: '#c5ddd2',
    pinOn: '#f4fff9',
    wire: '#8d5d34',
    wireOn: '#ffd7a8',
    resistor: '#e4d2b0',
    resistorStroke: '#5c4632',
    resistorText: '#2a2118',
    led: '#3c1c22',
    ledOn: '#ff4d4d',
    rail: '#ef4444',
  },
} as const;

function rowY(pin: number): number {
  return ROW_0 + pin * ROW_PITCH;
}

export function LedHardwareDiagram({
  bits,
  portName,
  variant,
  width,
}: {
  bits: number[];
  portName: PortName;
  variant: LedDiagramVariant;
  width: number;
}) {
  const theme = THEME[variant];
  const gridId = `led-grid-${useId().replace(/:/g, '')}`;
  const titleId = `led-title-${useId().replace(/:/g, '')}`;
  const rows = Array.from({ length: 8 }, (_, pin) => ({
    pin,
    // bits[0] 是端口 bit7。DIP 从上到下画 P1.0→P1.7，与引脚 1 起的顺序一致。
    on: bits[7 - pin] === 1,
    y: rowY(pin),
  }));
  const onCount = rows.filter((row) => row.on).length;
  const lastY = rowY(7);
  const chipBottom = lastY + 16;
  const height = Math.round(width * VIEW_H / VIEW_W);
  const variantLabel = variant === 'board' ? '板级连线' : '接线图';

  return (
    <svg
      data-testid="led-hardware-diagram"
      data-variant={variant}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={width}
      height={height}
      role="img"
      aria-labelledby={titleId}
      textRendering="optimizeLegibility"
      shapeRendering="geometricPrecision"
      style={{ display: 'block', maxWidth: 'none' }}
    >
      <title id={titleId}>
        {`80C51 ${portName} LED ${variantLabel}。${portName}.x 为 0 时点亮，阳极接 +5V，串联 2kΩ。`}
      </title>
      <defs>
        <pattern id={gridId} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0V16" fill="none" stroke={theme.grid} strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width={VIEW_W} height={VIEW_H} rx="10" fill={theme.bg} />
      <rect width={VIEW_W} height={VIEW_H} rx="10" fill={`url(#${gridId})`} opacity={variant === 'board' ? 0.45 : 0.7} />

      <text x="12" y="24" fill={theme.title} fontFamily={SANS} fontSize="18" fontWeight="700">80C51</text>
      <text x="108" y="24" fill={theme.muted} fontFamily={SANS} fontSize="12">{variantLabel}</text>
      <text x="308" y="24" textAnchor="end" fill={theme.title} fontFamily={MONO} fontSize="12">{onCount}/8 亮</text>
      <text x="12" y="46" fill={theme.muted} fontFamily={SANS} fontSize="12">
        {`${portName}.x = 0 点亮 · 阳极接 +5V · 2kΩ`}
      </text>

      <rect
        x={CHIP_X}
        y={CHIP_Y}
        width={CHIP_W}
        height={chipBottom - CHIP_Y}
        rx="8"
        fill={theme.frame}
        stroke={theme.frameStroke}
        strokeWidth="1.6"
      />
      <path
        d={`M ${CHIP_X + CHIP_W / 2 - 8} ${CHIP_Y} a 8 8 0 0 1 16 0`}
        fill="none"
        stroke={theme.frameStroke}
        strokeWidth="1.4"
      />
      {variant === 'board' && Array.from({ length: 8 }, (_, pin) => (
        <rect key={`leg-${pin}`} x={CHIP_X - 5} y={rowY(pin) - 1.5} width="6" height="3" rx="0.5" fill="#c5cdd4" />
      ))}

      <text
        x={RAIL_X}
        y={ROW_0 - 16}
        textAnchor="middle"
        fill={theme.rail}
        fontFamily={MONO}
        fontSize="12"
        fontWeight="700"
      >
        +5V
      </text>
      <line
        x1={RAIL_X}
        y1={ROW_0 - 8}
        x2={RAIL_X}
        y2={lastY}
        stroke={theme.rail}
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {rows.map((row) => (
        <g key={row.pin} data-testid={`led-lamp-${portName}.${row.pin}`} data-on={row.on ? 'true' : 'false'}>
          <text
            x={CHIP_X + CHIP_W - 8}
            y={row.y}
            textAnchor="end"
            dominantBaseline="central"
            fill={row.on ? theme.pinOn : theme.muted}
            fontFamily={MONO}
            fontSize="12"
            fontWeight={row.on ? 700 : 500}
          >
            {`${portName}.${row.pin}`}
          </text>
          <rect x={CHIP_X + CHIP_W - 1} y={row.y - 1.5} width="6" height="3" rx="0.5" fill={row.on ? theme.wireOn : '#9aa8b2'} />
          <line
            x1={CHIP_X + CHIP_W + 5}
            y1={row.y}
            x2={RES_X}
            y2={row.y}
            stroke={row.on ? theme.wireOn : theme.wire}
            strokeWidth={row.on ? 2.2 : 1.5}
            strokeLinecap="round"
          />
          <rect
            x={RES_X}
            y={row.y - 8}
            width={RES_W}
            height="16"
            rx="2"
            fill={theme.resistor}
            stroke={theme.resistorStroke}
            strokeWidth="1"
          />
          <text
            x={RES_X + RES_W / 2}
            y={row.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill={theme.resistorText}
            fontFamily={MONO}
            fontSize="11"
          >
            2kΩ
          </text>
          <line
            x1={RES_X + RES_W}
            y1={row.y}
            x2={LED_X - (variant === 'schematic' ? 12 : 9)}
            y2={row.y}
            stroke={row.on ? theme.wireOn : theme.wire}
            strokeWidth={row.on ? 2.2 : 1.5}
            strokeLinecap="round"
          />
          {variant === 'schematic' ? (
            <SchematicLamp x={LED_X} y={row.y} on={row.on} lit={theme.ledOn} idle={theme.led} muted={theme.muted} />
          ) : (
            <BoardLamp x={LED_X} y={row.y} on={row.on} lit={theme.ledOn} idle={theme.led} />
          )}
          <line
            x1={LED_X + (variant === 'schematic' ? 10 : 9)}
            y1={row.y}
            x2={RAIL_X}
            y2={row.y}
            stroke={row.on ? theme.wireOn : theme.wire}
            strokeWidth={row.on ? 2.2 : 1.5}
            strokeLinecap="round"
          />
          <circle cx={RAIL_X} cy={row.y} r="2.3" fill={theme.rail} />
        </g>
      ))}

      <text x="12" y="376" fill={theme.muted} fontFamily={SANS} fontSize="11">
        电流从 +5V 经 LED 和 2kΩ 流入引脚
      </text>
    </svg>
  );
}

/** 阴极在左（靠电阻和引脚），阳极在右（靠 +5V）。 */
function SchematicLamp({
  x, y, on, lit, idle, muted,
}: {
  x: number;
  y: number;
  on: boolean;
  lit: string;
  idle: string;
  muted: string;
}) {
  const stroke = on ? lit : muted;
  return (
    <g>
      {on && <circle cx={x} cy={y} r="13" fill={lit} opacity="0.22" />}
      <line x1={x - 12} y1={y - 7} x2={x - 12} y2={y + 7} stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <polygon
        points={`${x + 10},${y - 7} ${x + 10},${y + 7} ${x - 10},${y}`}
        fill={on ? lit : idle}
        stroke={stroke}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {on && (
        <g stroke={lit} strokeWidth="1.3" strokeLinecap="round">
          <line x1={x + 4} y1={y - 12} x2={x + 8} y2={y - 16} />
          <line x1={x + 8} y1={y - 10} x2={x + 13} y2={y - 12} />
        </g>
      )}
    </g>
  );
}

function BoardLamp({
  x, y, on, lit, idle,
}: {
  x: number;
  y: number;
  on: boolean;
  lit: string;
  idle: string;
}) {
  return (
    <g>
      {on && <circle cx={x} cy={y} r="14" fill={lit} opacity="0.28" />}
      <circle cx={x} cy={y} r="8" fill={on ? lit : idle} stroke={on ? '#ffe4e6' : '#7f1d1d'} strokeWidth="1.3" />
      {on && <circle cx={x - 2.2} cy={y - 2.4} r="2" fill="#fff" opacity="0.85" />}
      <line x1={x - 3} y1={y + 5} x2={x + 3} y2={y + 5} stroke={on ? '#fff' : '#6b7280'} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
    </g>
  );
}
