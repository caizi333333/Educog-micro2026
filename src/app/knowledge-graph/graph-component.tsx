'use client';

import React, { useState, useMemo, forwardRef, useImperativeHandle, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeProps,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { BookOpen, Cpu, HardDrive, Cable, Zap, Lightbulb, ArrowRight } from 'lucide-react';

/* ================================================================= */
/*  Category system                                                   */
/* ================================================================= */
type Category = 'core' | 'memory' | 'io' | 'interrupt' | 'application';

const CAT: Record<Category, {
  label: string;
  color: string;
  glow: string;
  bg: string;
  border: string;
  text: string;
  groupBg: string;
  groupBorder: string;
  minimap: string;
  gradient: string;
  icon: React.ElementType;
}> = {
  core: {
    label: 'CPU 核心',
    color: '#60a5fa',
    glow: 'rgba(96, 165, 250, 0.4)',
    bg: 'rgba(96, 165, 250, 0.08)',
    border: 'rgba(96, 165, 250, 0.3)',
    text: '#93bbfc',
    groupBg: 'rgba(96, 165, 250, 0.03)',
    groupBorder: 'rgba(96, 165, 250, 0.08)',
    minimap: '#60a5fa',
    gradient: 'linear-gradient(135deg, rgba(96,165,250,0.15) 0%, rgba(96,165,250,0.03) 100%)',
    icon: Cpu,
  },
  memory: {
    label: '存储系统',
    color: '#34d399',
    glow: 'rgba(52, 211, 153, 0.4)',
    bg: 'rgba(52, 211, 153, 0.08)',
    border: 'rgba(52, 211, 153, 0.3)',
    text: '#6ee7b7',
    groupBg: 'rgba(52, 211, 153, 0.03)',
    groupBorder: 'rgba(52, 211, 153, 0.08)',
    minimap: '#34d399',
    gradient: 'linear-gradient(135deg, rgba(52,211,153,0.15) 0%, rgba(52,211,153,0.03) 100%)',
    icon: HardDrive,
  },
  io: {
    label: 'I/O 与外设',
    color: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.35)',
    bg: 'rgba(251, 191, 36, 0.08)',
    border: 'rgba(251, 191, 36, 0.3)',
    text: '#fcd34d',
    groupBg: 'rgba(251, 191, 36, 0.03)',
    groupBorder: 'rgba(251, 191, 36, 0.08)',
    minimap: '#fbbf24',
    gradient: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(251,191,36,0.03) 100%)',
    icon: Cable,
  },
  interrupt: {
    label: '中断系统',
    color: '#f87171',
    glow: 'rgba(248, 113, 113, 0.4)',
    bg: 'rgba(248, 113, 113, 0.08)',
    border: 'rgba(248, 113, 113, 0.3)',
    text: '#fca5a5',
    groupBg: 'rgba(248, 113, 113, 0.03)',
    groupBorder: 'rgba(248, 113, 113, 0.08)',
    minimap: '#f87171',
    gradient: 'linear-gradient(135deg, rgba(248,113,113,0.15) 0%, rgba(248,113,113,0.03) 100%)',
    icon: Zap,
  },
  application: {
    label: '典型应用',
    color: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.4)',
    bg: 'rgba(192, 132, 252, 0.08)',
    border: 'rgba(192, 132, 252, 0.3)',
    text: '#d8b4fe',
    groupBg: 'rgba(192, 132, 252, 0.03)',
    groupBorder: 'rgba(192, 132, 252, 0.08)',
    minimap: '#c084fc',
    gradient: 'linear-gradient(135deg, rgba(192,132,252,0.15) 0%, rgba(192,132,252,0.03) 100%)',
    icon: Lightbulb,
  },
};

/* ================================================================= */
/*  Node definitions                                                   */
/* ================================================================= */
type NodeDef = { id: string; label: string; desc: string; cat: Category; x: number; y: number; level: 0|1|2|3 };

const W = 1200;
const CX = W / 2;

const nodeDefs: NodeDef[] = [
  // ROOT
  { id: 'mcu', label: '8051 微控制器', desc: '单片微型计算机，集成CPU、存储器和外设。', cat: 'core', x: CX, y: 30, level: 0 },

  // LEVEL 1
  { id: 'cpu', label: 'CPU 核心', desc: '执行指令和处理数据的中央处理单元。', cat: 'core', x: 160, y: 140, level: 1 },
  { id: 'memory', label: '存储系统', desc: '存储程序代码和数据，哈佛结构。', cat: 'memory', x: 460, y: 140, level: 1 },
  { id: 'io', label: 'I/O 端口', desc: '与外部传感器、执行器交互的接口。', cat: 'io', x: 760, y: 140, level: 1 },
  { id: 'interrupts', label: '中断系统', desc: '响应紧急事件的硬件机制。', cat: 'interrupt', x: 1040, y: 140, level: 1 },

  // CPU cluster
  { id: 'alu', label: 'ALU', desc: '算术逻辑运算单元。', cat: 'core', x: 70, y: 260, level: 2 },
  { id: 'pc', label: 'PC', desc: '程序计数器，下一指令地址。', cat: 'core', x: 170, y: 260, level: 2 },
  { id: 'b_reg', label: 'B', desc: '辅助乘除法寄存器。', cat: 'core', x: 270, y: 260, level: 2 },
  { id: 'assembly', label: '汇编语言', desc: '低级编程语言。', cat: 'core', x: 70, y: 355, level: 2 },
  { id: 'acc', label: 'ACC', desc: '累加器，运算核心。', cat: 'core', x: 170, y: 355, level: 2 },
  { id: 'psw', label: 'PSW', desc: '状态标志字。', cat: 'core', x: 270, y: 355, level: 2 },

  { id: 'addressing_modes', label: '寻址方式', desc: '指令操作数的寻址方法。', cat: 'core', x: 120, y: 460, level: 2 },
  { id: 'immediate_addr', label: '立即寻址', desc: '#data 操作数在指令中。', cat: 'core', x: 40, y: 560, level: 3 },
  { id: 'direct_addr', label: '直接寻址', desc: '直接给出RAM/SFR地址。', cat: 'core', x: 140, y: 560, level: 3 },
  { id: 'register_addr', label: '寄存器寻址', desc: 'R0-R7寄存器寻址。', cat: 'core', x: 240, y: 560, level: 3 },
  { id: 'indirect_addr', label: '间接寻址', desc: '@R0/@R1间接寻址。', cat: 'core', x: 140, y: 650, level: 3 },

  // Memory cluster
  { id: 'harvard', label: '哈佛结构', desc: '程序和数据存储独立。', cat: 'memory', x: 390, y: 260, level: 2 },
  { id: 'program_mem', label: 'ROM', desc: '程序存储器。', cat: 'memory', x: 390, y: 355, level: 2 },
  { id: 'data_mem', label: 'RAM', desc: '数据存储器。', cat: 'memory', x: 520, y: 260, level: 2 },
  { id: 'internal_ram', label: '内部RAM', desc: '128字节内部数据RAM。', cat: 'memory', x: 440, y: 460, level: 2 },
  { id: 'sfr', label: 'SFR', desc: '特殊功能寄存器区。', cat: 'memory', x: 560, y: 355, level: 2 },
  { id: 'dptr', label: 'DPTR', desc: '16位数据指针。', cat: 'memory', x: 560, y: 460, level: 2 },

  { id: 'register_banks', label: '寄存器组', desc: '4组R0-R7工作寄存器。', cat: 'memory', x: 380, y: 560, level: 3 },
  { id: 'bit_addr_ram', label: '位寻址区', desc: '128位可独立操作。', cat: 'memory', x: 480, y: 560, level: 3 },
  { id: 'general_ram', label: '通用RAM', desc: '通用数据和堆栈。', cat: 'memory', x: 430, y: 650, level: 3 },

  // I/O cluster
  { id: 'p0', label: 'P0', desc: '漏极开路双向I/O口。', cat: 'io', x: 670, y: 260, level: 2 },
  { id: 'p1', label: 'P1', desc: '准双向I/O口。', cat: 'io', x: 730, y: 260, level: 2 },
  { id: 'p2', label: 'P2', desc: '准双向I/O口/地址线。', cat: 'io', x: 790, y: 260, level: 2 },
  { id: 'p3', label: 'P3', desc: '准双向I/O口/特殊功能。', cat: 'io', x: 850, y: 260, level: 2 },

  { id: 'timers', label: '定时器', desc: '定时/计数功能。', cat: 'io', x: 700, y: 370, level: 2 },
  { id: 'tmod', label: 'TMOD', desc: '定时器模式控制。', cat: 'io', x: 660, y: 470, level: 3 },
  { id: 'tcon', label: 'TCON', desc: '定时器控制。', cat: 'io', x: 740, y: 470, level: 3 },
  { id: 'timer_mode1', label: '模式1', desc: '16位定时模式。', cat: 'io', x: 660, y: 560, level: 3 },
  { id: 'timer_mode2', label: '模式2', desc: '8位自动重装。', cat: 'io', x: 760, y: 560, level: 3 },

  { id: 'uart', label: 'UART', desc: '异步串行通信。', cat: 'io', x: 860, y: 370, level: 2 },
  { id: 'scon', label: 'SCON', desc: '串口控制。', cat: 'io', x: 830, y: 470, level: 3 },
  { id: 'sbuf', label: 'SBUF', desc: '串口数据缓冲。', cat: 'io', x: 910, y: 470, level: 3 },

  // Interrupt cluster
  { id: 'ie', label: 'IE', desc: '中断使能寄存器。', cat: 'interrupt', x: 990, y: 260, level: 2 },
  { id: 'ip', label: 'IP', desc: '中断优先级。', cat: 'interrupt', x: 1090, y: 260, level: 2 },
  { id: 'isr', label: 'ISR', desc: '中断服务程序。', cat: 'interrupt', x: 1040, y: 355, level: 2 },
  { id: 'int_sources', label: '中断源', desc: '触发中断的事件。', cat: 'interrupt', x: 1040, y: 460, level: 2 },
  { id: 'ext_int0', label: 'INT0', desc: '外部中断0。', cat: 'interrupt', x: 960, y: 560, level: 3 },
  { id: 'ext_int1', label: 'INT1', desc: '外部中断1。', cat: 'interrupt', x: 1050, y: 560, level: 3 },
  { id: 'timer0_int', label: 'T0中断', desc: '定时器0溢出中断。', cat: 'interrupt', x: 960, y: 650, level: 3 },
  { id: 'timer1_int', label: 'T1中断', desc: '定时器1溢出中断。', cat: 'interrupt', x: 1050, y: 650, level: 3 },
  { id: 'serial_int', label: '串口中断', desc: 'TI/RI中断。', cat: 'interrupt', x: 1140, y: 560, level: 3 },

  // Application cluster
  { id: 'led_scan', label: 'LED扫描', desc: '动态扫描驱动LED。', cat: 'application', x: 660, y: 680, level: 2 },
  { id: 'adc_app', label: 'ADC采集', desc: '模数转换数据采集。', cat: 'application', x: 800, y: 680, level: 2 },
  { id: 'key_scan', label: '键盘扫描', desc: '矩阵键盘行列扫描。', cat: 'application', x: 940, y: 680, level: 2 },
];

const edgeDefs = [
  { s: 'mcu', t: 'cpu' }, { s: 'mcu', t: 'memory' }, { s: 'mcu', t: 'io' }, { s: 'mcu', t: 'interrupts' },
  { s: 'cpu', t: 'alu' }, { s: 'cpu', t: 'pc' }, { s: 'cpu', t: 'b_reg' },
  { s: 'cpu', t: 'assembly' }, { s: 'alu', t: 'acc' }, { s: 'cpu', t: 'psw' },
  { s: 'assembly', t: 'addressing_modes' },
  { s: 'addressing_modes', t: 'immediate_addr' }, { s: 'addressing_modes', t: 'direct_addr' },
  { s: 'addressing_modes', t: 'register_addr' }, { s: 'addressing_modes', t: 'indirect_addr' },
  { s: 'memory', t: 'harvard' }, { s: 'memory', t: 'data_mem' }, { s: 'memory', t: 'program_mem' },
  { s: 'data_mem', t: 'internal_ram' }, { s: 'data_mem', t: 'sfr' },
  { s: 'sfr', t: 'dptr' }, { s: 'sfr', t: 'tmod' }, { s: 'sfr', t: 'tcon' },
  { s: 'sfr', t: 'scon' }, { s: 'sfr', t: 'sbuf' },
  { s: 'sfr', t: 'ie' }, { s: 'sfr', t: 'ip' },
  { s: 'sfr', t: 'acc' }, { s: 'sfr', t: 'psw' }, { s: 'sfr', t: 'b_reg' },
  { s: 'internal_ram', t: 'register_banks' }, { s: 'internal_ram', t: 'bit_addr_ram' },
  { s: 'internal_ram', t: 'general_ram' },
  { s: 'io', t: 'p0' }, { s: 'io', t: 'p1' }, { s: 'io', t: 'p2' }, { s: 'io', t: 'p3' },
  { s: 'io', t: 'timers' }, { s: 'io', t: 'uart' },
  { s: 'timers', t: 'tmod' }, { s: 'timers', t: 'tcon' },
  { s: 'tmod', t: 'timer_mode1' }, { s: 'tmod', t: 'timer_mode2' },
  { s: 'uart', t: 'scon' }, { s: 'uart', t: 'sbuf' },
  { s: 'interrupts', t: 'ie' }, { s: 'interrupts', t: 'ip' },
  { s: 'interrupts', t: 'isr' }, { s: 'interrupts', t: 'int_sources' },
  { s: 'int_sources', t: 'ext_int0' }, { s: 'int_sources', t: 'ext_int1' },
  { s: 'int_sources', t: 'timer0_int' }, { s: 'int_sources', t: 'timer1_int' },
  { s: 'int_sources', t: 'serial_int' },
  { s: 'p3', t: 'ext_int0' }, { s: 'p3', t: 'ext_int1' },
  { s: 'timers', t: 'timer0_int' }, { s: 'timers', t: 'timer1_int' },
  { s: 'uart', t: 'serial_int' },
  { s: 'io', t: 'led_scan' }, { s: 'timers', t: 'led_scan' },
  { s: 'io', t: 'adc_app' }, { s: 'io', t: 'key_scan' },
];

const nodeMap: Record<string, NodeDef> = {};
nodeDefs.forEach(n => { nodeMap[n.id] = n; });

/* ================================================================= */
/*  Group backgrounds                                                  */
/* ================================================================= */
type GroupDef = { id: string; cat: Category; label: string; x: number; y: number; w: number; h: number };
const groupDefs: GroupDef[] = [
  { id: 'g-core', cat: 'core', label: 'CPU 核心与指令', x: 10, y: 220, w: 320, h: 470 },
  { id: 'g-mem', cat: 'memory', label: '存储体系', x: 350, y: 220, w: 260, h: 470 },
  { id: 'g-io', cat: 'io', label: 'I/O · 定时器 · 串口', x: 630, y: 220, w: 330, h: 390 },
  { id: 'g-int', cat: 'interrupt', label: '中断系统', x: 925, y: 220, w: 260, h: 470 },
  { id: 'g-app', cat: 'application', label: '典型应用', x: 630, y: 645, w: 360, h: 75 },
];

/* ================================================================= */
/*  Custom: Group node                                                 */
/* ================================================================= */
type GroupNodeData = { label: string; cat: Category; w: number; h: number; [k: string]: unknown };

function GroupNode({ data }: NodeProps<RFNode<GroupNodeData>>) {
  const c = CAT[data.cat];
  return (
    <div
      style={{
        width: data.w, height: data.h,
        background: c.groupBg,
        border: `1px dashed ${c.groupBorder}`,
        borderRadius: 20,
        padding: '10px 16px',
        pointerEvents: 'none',
      }}
    >
      <div className="flex items-center gap-1.5" style={{ opacity: 0.5 }}>
        <c.icon size={11} style={{ color: c.color }} />
        <span style={{ color: c.color, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {data.label}
        </span>
      </div>
    </div>
  );
}

/* ================================================================= */
/*  Custom: Knowledge node                                             */
/* ================================================================= */
type KNodeData = {
  label: string; desc: string; cat: Category; level: 0|1|2|3;
  isDimmed: boolean; isHighlighted: boolean; isSelected: boolean;
  chapterMap: Record<string, string>;
  onNodeSelect: (nodeId: string) => void;
  [k: string]: unknown;
};

function KnowledgeNode({ data, id }: NodeProps<RFNode<KNodeData>>) {
  const c = CAT[data.cat];
  const isRoot = data.level === 0;
  const isL1 = data.level === 1;

  const size = isRoot ? 'px-5 py-3' : isL1 ? 'px-3.5 py-2' : 'px-2.5 py-1.5';
  const textSize = isRoot ? 'text-[13px] font-bold' : isL1 ? 'text-[11px] font-bold' : 'text-[10px] font-semibold';
  const radius = isRoot ? 'rounded-2xl' : isL1 ? 'rounded-xl' : 'rounded-lg';

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-1 !h-1 !bg-transparent !border-0" />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-pressed={data.isSelected}
            onClick={(event) => {
              event.stopPropagation();
              data.onNodeSelect(id);
            }}
            className={cn('relative flex items-center justify-center cursor-pointer transition-all duration-300', size, radius)}
            style={{
              background: data.isSelected ? c.gradient : data.isDimmed ? 'rgba(30,30,46,0.6)' : c.bg,
              border: data.isSelected ? `2px solid ${c.color}` : `1px solid ${data.isDimmed ? 'rgba(69,71,90,0.3)' : c.border}`,
              opacity: data.isDimmed ? 0.34 : 1,
              transform: data.isSelected ? 'scale(1.15)' : 'scale(1)',
              boxShadow: data.isSelected
                ? `0 0 20px ${c.glow}, 0 0 40px ${c.glow.replace('0.4', '0.15')}, inset 0 1px 0 rgba(255,255,255,0.1)`
                : isRoot && !data.isDimmed
                  ? `0 0 12px ${c.glow.replace('0.4', '0.15')}, 0 4px 16px rgba(0,0,0,0.2)`
                  : isL1 && !data.isDimmed
                    ? `0 2px 8px rgba(0,0,0,0.15)`
                    : 'none',
              backdropFilter: 'blur(12px)',
              zIndex: data.isSelected ? 50 : isRoot ? 30 : isL1 ? 20 : 10,
            }}
          >
            {/* Glow ring for root */}
            {isRoot && !data.isDimmed && (
              <div
                className="absolute inset-0 rounded-2xl animate-pulse"
                style={{
                  background: `radial-gradient(ellipse at center, ${c.glow.replace('0.4', '0.1')} 0%, transparent 70%)`,
                  transform: 'scale(1.5)',
                  pointerEvents: 'none',
                  zIndex: -1,
                }}
              />
            )}

            {isRoot && <c.icon size={15} className="mr-1.5 flex-shrink-0" style={{ color: c.color }} />}

            <span className={cn(textSize, 'text-center whitespace-nowrap')} style={{ color: data.isDimmed ? '#585b70' : c.text }}>
              {data.label}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 bg-[#1e1e2e]/95 backdrop-blur-xl border-[#313244] shadow-2xl"
          side="right"
          sideOffset={12}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color, boxShadow: `0 0 6px ${c.glow}` }} />
              <h4 className="font-bold text-sm" style={{ color: c.text }}>{data.label}</h4>
            </div>
            <span
              className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
            >
              {c.label}
            </span>
            <p className="text-xs text-[#a6adc8] leading-relaxed">{data.desc}</p>
            {data.chapterMap[id] && (
              <Button asChild variant="outline" size="sm" className="w-full gap-1.5 h-7 text-xs border-[#313244] hover:bg-[#313244]">
                <Link href={`/knowledge-graph?chapter=${data.chapterMap[id]}&node=${encodeURIComponent(id)}`} prefetch={false}>
                  <BookOpen className="h-3 w-3" />
                  查看第 {data.chapterMap[id]} 章
                </Link>
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <Handle type="source" position={Position.Bottom} className="!w-1 !h-1 !bg-transparent !border-0" />
    </>
  );
}

const nodeTypes = { knowledgeNode: KnowledgeNode, groupNode: GroupNode };

/* ================================================================= */
/*  Legend & Stats                                                     */
/* ================================================================= */
function Legend() {
  return (
    <div className="absolute top-3 left-3 z-[100] bg-[#1e1e2e]/90 backdrop-blur-xl rounded-xl shadow-2xl border border-[#313244] px-3.5 py-2.5">
      <p className="text-[9px] font-bold text-[#585b70] mb-2 uppercase tracking-[0.15em]">知识模块</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {(Object.keys(CAT) as Category[]).map((cat) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CAT[cat].color, boxShadow: `0 0 4px ${CAT[cat].glow}` }} />
            <span className="text-[10px] text-[#a6adc8] font-medium">{CAT[cat].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsBadge() {
  return (
    <div className="absolute bottom-3 left-3 z-[100] bg-[#1e1e2e]/90 backdrop-blur-xl rounded-lg shadow-xl border border-[#313244] px-3 py-2 flex gap-4">
      {[
        { val: nodeDefs.length, lab: '知识点' },
        { val: edgeDefs.length, lab: '关联' },
        { val: '5', lab: '模块' },
      ].map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div className="w-px bg-[#313244]" />}
          <div className="text-center">
            <div className="text-sm font-bold text-[#cdd6f4] tabular-nums">{s.val}</div>
            <div className="text-[8px] text-[#585b70] font-semibold uppercase tracking-wider">{s.lab}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ================================================================= */
/*  Main Component                                                     */
/* ================================================================= */
export type KnowledgeGraphRef = { reset: () => void };

type Props = {
  filterHighlightIds?: Set<string> | null;
  initialSelectedNodeId?: string | null;
  nodeToChapterMap: Record<string, string>;
  onSelectNodeId?: (nodeId: string | null) => void;
};

export const KnowledgeGraphComponent = forwardRef<KnowledgeGraphRef, Props>(
  ({ filterHighlightIds = null, initialSelectedNodeId = null, nodeToChapterMap, onSelectNodeId }, ref) => {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialSelectedNodeId);

    useEffect(() => { setSelectedNodeId(initialSelectedNodeId); }, [initialSelectedNodeId]);
    useImperativeHandle(ref, () => ({ reset() { setSelectedNodeId(null); } }));

    const selectNode = useCallback((nodeId: string) => {
      const next = selectedNodeId === nodeId ? null : nodeId;
      setSelectedNodeId(next);
      onSelectNodeId?.(next);
    }, [onSelectNodeId, selectedNodeId]);

    const { activeNodeIds, activeEdgeKeys } = useMemo(() => {
      if (selectedNodeId) {
        const nids = new Set<string>([selectedNodeId]);
        const eids = new Set<string>();
        edgeDefs.forEach(e => {
          if (e.s === selectedNodeId) { nids.add(e.t); eids.add(`${e.s}-${e.t}`); }
          if (e.t === selectedNodeId) { nids.add(e.s); eids.add(`${e.s}-${e.t}`); }
        });
        return { activeNodeIds: nids, activeEdgeKeys: eids };
      }
      if (filterHighlightIds) {
        const nids = new Set<string>(filterHighlightIds);
        const eids = new Set<string>();
        edgeDefs.forEach(e => {
          if (filterHighlightIds.has(e.s) || filterHighlightIds.has(e.t)) {
            nids.add(e.s);
            nids.add(e.t);
            eids.add(`${e.s}-${e.t}`);
          }
        });
        return { activeNodeIds: nids, activeEdgeKeys: eids };
      }
      return { activeNodeIds: null, activeEdgeKeys: null };
    }, [selectedNodeId, filterHighlightIds]);

    const rfNodes = useMemo<RFNode[]>(() => {
      const groups: RFNode<GroupNodeData>[] = groupDefs.map(g => ({
        id: g.id, type: 'groupNode',
        position: { x: g.x, y: g.y },
        data: { label: g.label, cat: g.cat, w: g.w, h: g.h },
        draggable: false, selectable: false, style: { zIndex: 0 },
      }));

      const knodes: RFNode<KNodeData>[] = nodeDefs.map(n => ({
        id: n.id, type: 'knowledgeNode',
        position: { x: n.x - 50, y: n.y },
        data: {
          label: n.label, desc: n.desc, cat: n.cat, level: n.level,
          isDimmed: activeNodeIds ? !activeNodeIds.has(n.id) : false,
          isHighlighted: activeNodeIds ? activeNodeIds.has(n.id) : true,
          isSelected: selectedNodeId === n.id,
          chapterMap: nodeToChapterMap,
          onNodeSelect: selectNode,
        },
        style: { zIndex: n.level === 0 ? 30 : n.level === 1 ? 20 : 10 },
      }));

      return [...groups, ...knodes];
    }, [activeNodeIds, selectNode, selectedNodeId, nodeToChapterMap]);

    const rfEdges = useMemo<RFEdge[]>(() => {
      return edgeDefs.map(e => {
        const key = `${e.s}-${e.t}`;
        const isActive = activeEdgeKeys ? activeEdgeKeys.has(key) : true;
        const srcCat = nodeMap[e.s]?.cat || 'core';
        const c = CAT[srcCat];
        const color = isActive ? c.color : 'rgba(69,71,90,0.15)';

        return {
          id: key, source: e.s, target: e.t,
          type: 'smoothstep',
          animated: isActive && !!selectedNodeId,
          style: {
            stroke: color,
            strokeWidth: isActive ? (selectedNodeId ? 2 : 1.5) : 0.5,
            opacity: isActive ? (selectedNodeId ? 0.9 : 0.62) : 0.1,
            filter: isActive && selectedNodeId ? `drop-shadow(0 0 3px ${c.glow})` : 'none',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: isActive ? 14 : 8,
            height: isActive ? 14 : 8,
            color,
          },
        };
      });
    }, [activeEdgeKeys, selectedNodeId]);

    const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

    useEffect(() => { setNodes(rfNodes); }, [rfNodes, setNodes]);
    useEffect(() => { setEdges(rfEdges); }, [rfEdges, setEdges]);

    const onNodeClick = useCallback((_e: React.MouseEvent, node: RFNode) => {
      if (node.type === 'groupNode') return;
      selectNode(node.id);
    }, [selectNode]);

    const onPaneClick = useCallback(() => {
      setSelectedNodeId(null);
      onSelectNodeId?.(null);
    }, [onSelectNodeId]);

    const minimapColor = useCallback((node: RFNode) => {
      if (node.type === 'groupNode') return 'transparent';
      const cat = (node.data as KNodeData)?.cat;
      return cat ? CAT[cat]?.minimap || '#888' : '#888';
    }, []);

    return (
      <div className="w-full h-full relative" style={{ background: '#0d0d14' }}>
        <Legend />
        <StatsBadge />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.08, maxZoom: 1.1 }}
          minZoom={0.3}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={0.8} color="rgba(148,163,184,0.06)" />
          <Controls
            showInteractive={false}
            className="!bg-[#1e1e2e]/90 !backdrop-blur-xl !border-[#313244] !rounded-xl !shadow-xl"
          />
          <MiniMap
            nodeColor={minimapColor}
            maskColor="rgba(0,0,0,0.3)"
            className="!bg-[#1e1e2e]/80 !backdrop-blur-xl !rounded-xl !shadow-xl !border-[#313244]"
            pannable
            zoomable
            style={{ width: 150, height: 90 }}
          />
        </ReactFlow>
      </div>
    );
  }
);

KnowledgeGraphComponent.displayName = 'KnowledgeGraphComponent';
