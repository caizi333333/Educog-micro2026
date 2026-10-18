/**
 * 微控制器实验配置文件
 * 桂林航天工业学院 - 微控制器原理与应用课程
 */

import { z } from 'zod';

// ── 实验画布外设声明（HyperExperimentCanvas 据此渲染对应视图）──

export type PortName = 'P0' | 'P1' | 'P2' | 'P3';

/** 画布外设类型：led=LED阵列 segment=多位数码管 stepper=步进电机 buzzer=蜂鸣器 serial=串口终端 keys=按键面板 bitpanel=位状态面板 */
export type PeripheralKind = 'led' | 'segment' | 'stepper' | 'buzzer' | 'serial' | 'keys' | 'bitpanel';

/** BitPanel 中的一个状态位（端口位必须与实验代码注释对得上，对不上的宁可不列） */
export interface BitMapEntry {
  port: PortName;
  bit: number;            // 0-7
  icon: string;           // 图标名（画布内映射到 lucide 图标）
  label: string;          // 中文标签
  activeLow?: boolean;    // true=低电平有效，默认高电平有效
  onText?: string;        // 有效状态文案
  offText?: string;       // 无效状态文案
}

/** 可交互按键：映射到真实端口位，按下拉低、松开回高（经 Simulator.setPortBit 只改端口锁存值） */
export interface KeyMapEntry {
  port: PortName;
  bit: number;
  label: string;
  /**
   * true=瞬时键：单击产生固定时长（按指令数计）的低电平脉冲，短于代码消抖延时，
   * 避免帧粒度的"按住"跨过消抖循环导致重复触发；false/缺省=按住拉低、松开回高
   */
  momentary?: boolean;
}

export interface PeripheralConfig {
  kind: PeripheralKind;
  /** 画布底部标签，端口号须与实验代码一致（如 "P0/P2 · 四位数码管"） */
  label: string;
  /** led：LED 阵列所在端口（低电平点亮） */
  ledPort?: PortName;
  /** segment：段码端口 + 位选端口/位（低电平选通），digitBits 顺序即显示顺序（左→右） */
  segment?: { segPort: PortName; digitPort: PortName; digitBits: number[]; digitNames?: string[] };
  /** buzzer：输出引脚（如 'P2.0'），仿真器据此跟踪引脚翻转推算真实方波频率 */
  buzzerPin?: string;
  /** keys/stepper：交互按键清单（端口位取自实验代码） */
  keys?: KeyMapEntry[];
  /** keys：键值输出端口（exp05 把键值写到 P0 显示） */
  keyValuePort?: PortName;
  /** stepper：程序内部变量地址（步序/方向/运行标志，地址与实验代码开头的变量注释一致） */
  stepper?: { stepAddr: number; dirAddr: number; runAddr: number };
  /** bitpanel：状态位清单 */
  bitMap?: BitMapEntry[];
  /** bitpanel：按字节展示的总线值（如 ADC 数据输入口） */
  buses?: { port: PortName; label: string }[];
  /** bitpanel：显示串口上报数据尾部（读 uart.transmitBuffer） */
  showUartTail?: boolean;
  /** bitpanel：由 L298N 四路控制位推导小车行驶状态（映射关系=代码 FORWARD/BACKWARD/TURN_* 子程序） */
  motion?: { lf: [PortName, number]; lr: [PortName, number]; rf: [PortName, number]; rr: [PortName, number] };
}

export interface ExperimentConfig {
  id: string;
  title: string;
  description?: string;
  category: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  duration: number; // 预计完成时间（分钟）
  objectives: string[];
  prerequisites: string[];
  knowledgePoints: string[];
  hardwareRequirements: string[];
  /** 画布外设声明：缺省时画布回落到端口值启发式判断 */
  peripheral?: PeripheralConfig;
  code: string;
  expectedResults: string[];
  troubleshooting: {
    issue: string;
    solution: string;
  }[];
  extensions: string[];
}

/**
 * proj04 是持续循环的监控程序，不能用“执行到 END”作为完成条件。
 * 完成前至少要形成一段可复核的执行记录，并观察到一帧完整遥测数据。
 */
export const PROJ04_MIN_OBSERVATION_STEPS = 200;

export const PROJ04_MILESTONE_IDS = [
  'requirements',
  'interfaces',
  'implementation',
  'integration',
  'review',
] as const;

export type Proj04MilestoneId = typeof PROJ04_MILESTONE_IDS[number];

export interface Proj04MilestoneEvidence {
  id: Proj04MilestoneId;
  confirmed: boolean;
  /** 由服务端写入；前端不能自行认定确认时间。 */
  confirmedAt: string | null;
}

export interface Proj04CompletionEvidence {
  version: 1;
  milestones: Proj04MilestoneEvidence[];
  /** 最近一次服务端保存时间。 */
  updatedAt: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function emptyProj04CompletionEvidence(): Proj04CompletionEvidence {
  return {
    version: 1,
    milestones: PROJ04_MILESTONE_IDS.map((id) => ({ id, confirmed: false, confirmedAt: null })),
    updatedAt: null,
  };
}

/**
 * 兼容缺失或旧版 results：只接收五个正式里程碑，未知字段不会进入完成判定。
 */
export function normalizeProj04CompletionEvidence(value: unknown): Proj04CompletionEvidence {
  const empty = emptyProj04CompletionEvidence();
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.milestones)) return empty;
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of value.milestones) {
    if (isRecord(item) && typeof item.id === 'string' && !byId.has(item.id)) byId.set(item.id, item);
  }
  return {
    version: 1,
    milestones: PROJ04_MILESTONE_IDS.map((id) => {
      const item = byId.get(id);
      const confirmed = item?.confirmed === true;
      const confirmedAt = confirmed && typeof item?.confirmedAt === 'string' && !Number.isNaN(Date.parse(item.confirmedAt))
        ? item.confirmedAt
        : null;
      return { id, confirmed, confirmedAt };
    }),
    updatedAt: typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))
      ? value.updatedAt
      : null,
  };
}

export function isProj04MilestoneEvidenceComplete(value: unknown): boolean {
  const normalized = normalizeProj04CompletionEvidence(value);
  return normalized.milestones.every((item) => item.confirmed && item.confirmedAt !== null);
}

/** 接受 JSON 字段间的常见空格，但必须同时包含 temp 与 humi。 */
export function hasProj04TelemetryFrame(value: unknown): value is string {
  return typeof value === 'string'
    && /\{\s*"temp"\s*:\s*-?\d{1,3}\s*,\s*"humi"\s*:\s*\d{1,3}\s*\}/.test(value);
}

export const experimentConfigs: ExperimentConfig[] = [
  {
    id: 'exp01',
    title: '实验一：基础LED控制实验',
    description: '通过P1口控制8个LED实现流水灯效果，掌握基本IO操作和延时程序设计。',
    category: '基础入门',
    difficulty: 'basic',
    duration: 90,
    objectives: [
      '掌握8051单片机基本IO操作',
      '理解LED控制的基本原理',
      '学会使用P1口进行输出控制',
      '掌握基本的延时程序设计'
    ],
    prerequisites: [
      '了解8051单片机基本结构',
      '掌握二进制和十六进制数制转换',
      '理解LED的工作原理和连接方式'
    ],
    knowledgePoints: [
      'P1口的结构和功能',
      'LED控制原理（低电平点亮）',
      '基本输出指令MOV',
      '循环移位指令RL/RR',
      '延时程序设计',
      '循环程序结构'
    ],
    hardwareRequirements: [
      '8个LED发光二极管',
      '限流电阻（示例2kΩ；按LED压降和端口电流复核）',
      'P1口连接LED阵列'
    ],
    // 代码全程写 P1（MOV P1/RL/RR），低电平点亮
    peripheral: { kind: 'led', label: 'P1 · LED 流水灯', ledPort: 'P1' },
    code: `; 桂林航天工业学院 - 实验一：基础LED控制实验
; 功能: 发光二极管流水灯程序，8个LED逐一闪烁，往复循环
; 知识点: P1口输出控制, 循环移位指令, 延时子程序设计

ORG 0000H           ; 程序起始地址
MAIN:
    MOV P1, #0FEH    ; 立即寻址：初始化P1口，点亮第一个LED (P1.0)
                     ; 0FEH = 11111110B，P1.0为低电平(LED亮)
    ACALL DELAY      ; 延时，让P1.0 LED可见
    
LOOP1:               ; 从右到左流水灯循环
    MOV A, P1        ; 直接寻址：读取当前P1状态到累加器A
    RL A             ; 累加器循环左移，LED向左移动
                     ; 例：11111110B -> 11111101B (P1.1亮)
    MOV P1, A        ; 直接寻址：将A的值输出到P1口
    ACALL DELAY      ; 子程序调用：延时子程序
    CJNE A, #7FH, LOOP1  ; 比较跳转：判断是否移到最左端(P1.7)
                     ; 7FH = 01111111B，最左端LED亮的状态
    
LOOP2:               ; 从左到右流水灯循环
    MOV A, P1        ; 读取当前P1状态  
    RR A             ; 累加器循环右移，LED向右移动
                     ; 例：01111111B -> 10111111B (P1.6亮)
    MOV P1, A        ; 输出到P1口
    ACALL DELAY      ; 延时
    CJNE A, #0FEH, LOOP2  ; 判断是否移到最右端(P1.0)
                     ; 0FEH = 11111110B，最右端LED亮的状态
    
    SJMP MAIN        ; 无条件跳转：重新开始整个流水灯循环

; 延时子程序 - 演示子程序的定义和调用
DELAY:
    PUSH ACC         ; 保护现场：将累加器压入堆栈
    MOV R6, #50      ; 寄存器寻址：外层循环计数器
D1:
    MOV R7, #200     ; 内层循环计数器
D2:
    DJNZ R7, D2      ; 减1跳转指令：R7减1，不为0则跳转到D2
    DJNZ R6, D1      ; 外层循环控制
    POP ACC          ; 恢复现场：从堆栈弹出累加器
    RET              ; 子程序返回

END                  ; 程序结束标志`,
    expectedResults: [
      'LED从右向左依次点亮，形成流水效果',
      'LED从左向右依次点亮，形成回流效果',
      '整个过程循环进行，速度均匀',
      'P1口输出值按预期变化'
    ],
    troubleshooting: [
      {
        issue: 'LED不亮或全亮',
        solution: '检查P1口初始化值，确认LED连接的极性和限流电阻'
      },
      {
        issue: '流水速度过快或过慢',
        solution: '调整DELAY子程序中的R6和R7初值'
      },
      {
        issue: '流水方向不正确',
        solution: '检查RL和RR指令的使用，确认移位方向'
      }
    ],
    extensions: [
      '修改延时时间，观察流水灯速度变化',
      '改变流水灯方向（只向一个方向流动）',
      '实现双向同时流水的效果',
      '添加不同的流水灯模式（如跑马灯、呼吸灯等）'
    ]
  },
  {
    id: 'exp02',
    title: '实验二：指令系统实验',
    description: '三段式教学程序：五种寻址方式的数据传送、算术运算（含BCD修正与乘除法）、逻辑与移位运算。运行时内部RAM 30H-5FH被逐段填充，可在内存面板实时观察。',
    category: '基础指令',
    difficulty: 'basic',
    duration: 60,
    objectives: [
      '掌握立即、直接、寄存器、寄存器间接、变址五种寻址方式',
      '掌握ADD/ADDC多字节加法与CY/AC/OV标志位的产生规律',
      '理解DA A十进制调整指令与BCD运算的关系',
      '掌握MUL AB/DIV AB及ANL/ORL/XRL/移位类指令的用法',
      '学会用内存面板观察程序对RAM的逐段写入'
    ],
    prerequisites: [
      '8051存储器组织（内部RAM分区）',
      '二进制/十六进制/BCD数制转换',
      '实验一的基本IO与延时程序'
    ],
    knowledgePoints: [
      '五种寻址方式（立即/直接/寄存器/寄存器间接/变址）',
      'MOVC A,@A+DPTR查表技术',
      'ADD/ADDC/SUBB与CY、AC、OV标志',
      'DA A十进制调整（BCD修正）',
      'MUL AB/DIV AB乘除指令',
      'ANL/ORL/XRL/CPL/SWAP/RL/RRC逻辑与移位指令',
      '校验和的计算方法'
    ],
    hardwareRequirements: [
      '89C51最小系统',
      'P1口LED×8（阶段指示，低电平点亮）',
      '仿真器内存观察窗口'
    ],
    // P1 低位做阶段指示灯（低电平点亮），核心观察对象是内存面板 30H-5FH
    peripheral: { kind: 'led', label: 'P1 · 阶段指示灯', ledPort: 'P1' },
    code: `; 桂林航天工业学院 - 实验二：指令系统实验
; 功能: 三段式演示——①五种寻址方式搬数(30H-3FH) ②算术运算(40H-4FH) ③逻辑与移位(50H-5FH)
;       每段开始时 P1 低位阶段灯递进点亮，段间延时，便于在内存面板观察逐段填充；
;       结尾对 30H-5EH 求校验和，存入 5FH 并输出到 P1，然后清零重来
; 知识点: 寻址方式, 标志位(CY/AC/OV), DA A, MUL/DIV, 逻辑移位, 查表

ORG 0000H
    LJMP MAIN

; 源数据表（12字节，存放在程序存储器，由第一段查表搬入内部RAM）
SRC_TAB:
    DB 11H, 22H, 33H, 44H, 55H, 66H
    DB 77H, 88H, 99H, 0AAH, 0BBH, 0CCH

MAIN:
    MOV SP, #60H         ; 栈指针移到60H，避开30H-5FH数据区（复位后默认07H）

    ; 每轮开始先清零用户数据区30H-5FH——寄存器间接寻址的循环应用
    MOV R0, #30H         ; R0作地址指针（间接寻址）
    MOV R2, #30H         ; 清零48个单元（30H个）
    CLR A
CLR_LOOP:
    MOV @R0, A           ; 寄存器间接寻址：把0写入R0所指单元
    INC R0               ; 指针加1
    DJNZ R2, CLR_LOOP    ; 计数减1不为0则继续

; ═══ 第一段：数据传送与寻址方式（结果写30H-3FH）═══
STAGE1:
    MOV P1, #0FEH        ; 阶段1指示：P1.0亮（低电平点亮）
    ACALL DELAY          ; 段间延时，便于观察"清零后开始填充"

    ; (1) 立即寻址：操作数以#开头直接写在指令中
    MOV 30H, #5AH        ; 30H ← 立即数5AH

    ; (2) 直接寻址：源操作数是RAM字节地址
    MOV 31H, 30H         ; 31H ← (30H)，即复制5AH

    ; (3) 寄存器寻址：经工作寄存器R7中转
    MOV R7, #0A5H        ; R7 ← A5H（立即→寄存器）
    MOV 32H, R7          ; 32H ← R7（寄存器→直接）

    ; (4) 寄存器间接寻址：@R0以R0的内容为地址
    MOV R0, #33H         ; R0指向33H
    MOV A, #3CH
    MOV @R0, A           ; (R0所指的33H) ← A = 3CH

    ; (5) 变址寻址：MOVC A,@A+DPTR查表，把SRC_TAB12字节搬到34H-3FH
    MOV DPTR, #SRC_TAB   ; DPTR = 表首地址（基址）
    MOV R0, #34H         ; R0 = 目的指针
    MOV R2, #12          ; 12字节
    MOV R3, #0           ; R3 = 表内偏移（变址）
COPY_TAB:
    MOV A, R3
    MOVC A, @A+DPTR      ; 变址寻址：A ← 程序存储器[DPTR+A]
    MOV @R0, A           ; 间接寻址写入内部RAM
    INC R0
    INC R3
    DJNZ R2, COPY_TAB

; ═══ 第二段：算术运算（对30H区数据运算，结果写40H-4FH）═══
STAGE2:
    MOV P1, #0FCH        ; 阶段2指示：P1.0、P1.1亮
    ACALL DELAY

    ; (1) ADD不带进位加：11H+22H=33H（观察CY=0、AC=0）
    MOV A, 34H           ; A ← (34H)=11H
    ADD A, 35H           ; A = 11H+22H = 33H
    MOV 40H, A           ; 40H ← 33H

    ; (2) ADD/ADDC多字节加法：BB99H + CCAAH = 18843H
    MOV A, 3CH           ; 低字节99H
    ADD A, 3DH           ; 99H+AAH=143H → A=43H，CY=1（低字节产生进位）
    MOV 41H, A           ; 41H ← 43H（和的低字节）
    MOV A, 3EH           ; 高字节BBH
    ADDC A, 3FH          ; BBH+CCH+CY=188H → A=88H，CY=1（ADDC把低位进位加进来）
    MOV 42H, A           ; 42H ← 88H（和的高字节）
    CLR A
    ADDC A, #0           ; 收集最高进位 → A=01H
    MOV 43H, A           ; 43H ← 01H（第17位进位）

    ; (3) BCD加法与DA A修正：87+95=182（十进制）
    MOV A, #87H          ; BCD数87
    ADD A, #95H          ; 二进制加得1CH，CY=1——不是合法BCD
    DA A                 ; 十进制调整 → A=82H，CY=1（正确的BCD结果82，百位进1）
    MOV 44H, A           ; 44H ← 82H
    CLR A
    ADDC A, #0
    MOV 45H, A           ; 45H ← 01H（百位）

    ; (4) MUL AB乘法：11H×22H=0242H（17×34=578）
    MOV A, 34H
    MOV B, 35H
    MUL AB               ; 积低字节在A=42H，高字节在B=02H，OV=1（积>255）
    MOV 46H, A           ; 46H ← 42H
    MOV 47H, B           ; 47H ← 02H

    ; (5) DIV AB除法：CCH÷0AH（204÷10=20余4）
    MOV A, 3FH           ; A ← CCH = 204
    MOV B, #10
    DIV AB               ; 商在A=14H(20)，余数在B=04H
    MOV 48H, A           ; 48H ← 14H
    MOV 49H, B           ; 49H ← 04H

    ; (6) SUBB带借位减：33H-77H=BCH，借位CY=1
    CLR C                ; SUBB总是连CY一起减，先清零
    MOV A, #33H
    SUBB A, #77H         ; 33H-77H → A=BCH，CY=1（不够减产生借位）
    MOV 4AH, A           ; 4AH ← BCH
    CLR A
    ADDC A, #0
    MOV 4BH, A           ; 4BH ← 01H（借位标志）

    ; (7) INC/DEC加1减1（不影响CY）
    MOV A, #0FH
    INC A                ; A=10H
    MOV 4CH, A           ; 4CH ← 10H
    DEC A                ; A=0FH
    MOV 4DH, A           ; 4DH ← 0FH

; ═══ 第三段：逻辑运算与移位（结果写50H-5FH）═══
STAGE3:
    MOV P1, #0F8H        ; 阶段3指示：P1.0-P1.2亮
    ACALL DELAY

    ; (1) ANL逻辑与：3CH∧66H=24H
    MOV A, #3CH
    ANL A, #66H
    MOV 50H, A           ; 50H ← 24H

    ; (2) ORL逻辑或：3CH∨66H=7EH
    MOV A, #3CH
    ORL A, #66H
    MOV 51H, A           ; 51H ← 7EH

    ; (3) XRL逻辑异或：3CH⊕66H=5AH
    MOV A, #3CH
    XRL A, #66H
    MOV 52H, A           ; 52H ← 5AH

    ; (4) CPL按位取反：3CH → C3H
    MOV A, #3CH
    CPL A
    MOV 53H, A           ; 53H ← C3H

    ; (5) SWAP高低半字节交换：A7H → 7AH
    MOV A, #0A7H
    SWAP A
    MOV 54H, A           ; 54H ← 7AH

    ; (6) RL循环左移（不带CY）：81H → 03H（最高位绕回最低位）
    MOV A, #81H
    RL A
    MOV 55H, A           ; 55H ← 03H

    ; (7) RR循环右移：81H → C0H（最低位绕回最高位）
    MOV A, #81H
    RR A
    MOV 56H, A           ; 56H ← C0H

    ; (8) RLC带进位左移——CY串在移位链里
    CLR C
    MOV A, #81H
    RLC A                ; 第1次：A=02H，最高位1移入CY
    MOV 57H, A           ; 57H ← 02H
    RLC A                ; 第2次：CY的1从最低位移回 → A=05H，CY=0
    MOV 58H, A           ; 58H ← 05H

    ; (9) RRC带进位右移：CY=1、A=02H → A=81H，CY=0
    SETB C
    MOV A, #02H
    RRC A
    MOV 59H, A           ; 59H ← 81H

    ; (10) 逻辑指令的直接地址形式：ANL direct,#data
    MOV 5AH, #0FFH
    ANL 5AH, #0F0H       ; 5AH = FFH∧F0H = F0H

; ═══ 校验和：间接寻址遍历30H-5EH累加，结果存5FH并输出P1 ═══
CHECKSUM:
    MOV R0, #30H         ; 从30H开始
    MOV R2, #2FH         ; 共47个单元（30H-5EH）
    CLR A
SUM_LOOP:
    ADD A, @R0           ; 间接寻址逐字节累加（丢弃进位，取模256）
    INC R0
    DJNZ R2, SUM_LOOP
    MOV 5FH, A           ; 校验和 → 5FH（本程序数据的手算值为F1H）
    MOV P1, A            ; 校验和按位图样输出到P1全口
    ACALL DELAY
    LJMP MAIN            ; 清零后重新逐段填充，循环演示

; 段间延时子程序（约40ms模型时间，1条指令≈1μs）
DELAY:
    PUSH ACC             ; 保护现场
    MOV R6, #160         ; 外层160次
D1: MOV R7, #250         ; 内层250次
D2: DJNZ R7, D2
    DJNZ R6, D1
    POP ACC              ; 恢复现场
    RET

END`,
    expectedResults: [
      '第一段结束：30H=31H=5AH、32H=A5H、33H=3CH，34H-3FH依次为11H,22H,...,0CCH（与SRC_TAB一致）',
      '第二段结束：40H=33H；41H-43H=43H,88H,01H（BB99H+CCAAH=18843H）；44H-45H=82H,01H（87+95=182的BCD结果）；46H-47H=42H,02H（积0242H）；48H-49H=14H,04H（商20余4）',
      '第三段结束：50H-5AH依次为24H,7EH,5AH,C3H,7AH,03H,C0H,02H,05H,81H,F0H',
      '每轮末尾5FH=F1H（30H-5EH校验和），P1输出F1H；P1低位阶段灯按1盏→2盏→3盏递进',
      '内存面板可见30H-5FH三段式逐段填充，循环时先清零再重填'
    ],
    troubleshooting: [
      {
        issue: '30H-3FH数据与SRC_TAB不一致',
        solution: '检查DPTR是否指向SRC_TAB、R3偏移是否从0开始，MOVC前A中必须是表内偏移'
      },
      {
        issue: '多字节加法高字节少1',
        solution: '高字节必须用ADDC而不是ADD，且两次加法之间不能插入影响CY的指令'
      },
      {
        issue: 'DA A结果不是预期BCD值',
        solution: 'DA A只能跟在ADD/ADDC之后使用，且参与运算的两数必须都是合法BCD码'
      },
      {
        issue: '校验和与F1H不符',
        solution: '确认累加范围是30H-5EH共47字节（不含5FH自身），且每轮开始已把数据区清零'
      }
    ],
    extensions: [
      '把SRC_TAB改成自己的学号后手算三段结果，再与内存面板核对',
      '用SUBB实现16位减法，观察借位链',
      '把校验和改为异或校验（XRL），比较两种校验的差异',
      '用CJNE比较两个内存块是否相同，结果用P1指示'
    ]
  },
  {
    id: 'exp03',
    title: '实验三：定时/计数器实验',
    description: '配置TMOD和TCON寄存器，利用定时器实现精确延时和方波信号生成。',
    category: '定时器应用',
    difficulty: 'intermediate',
    duration: 120,
    objectives: [
      '掌握8051定时器/计数器的工作原理和配置方法',
      '理解TMOD寄存器各位的功能和设置',
      '学会计算定时器初值和定时时间',
      '掌握中断系统的使用和中断服务程序编写'
    ],
    prerequisites: [
      '掌握基本指令系统',
      '理解中断概念和处理流程',
      '熟悉寄存器操作'
    ],
    knowledgePoints: [
      'TMOD寄存器配置',
      '定时器初值计算',
      '中断向量表',
      '中断服务程序编写',
      'SETB/CLR位操作指令',
      '方波产生原理'
    ],
    hardwareRequirements: [
      '示波器或逻辑分析仪',
      'P0.0引脚连接LED或测试点',
      '12MHz晶振'
    ],
    // 中断服务程序 CPL P0.0 翻转方波，LED 挂在 P0（非 P1）
    peripheral: { kind: 'led', label: 'P0 · LED（P0.0 方波）', ledPort: 'P0' },
    code: `; 桂林航天工业学院 - 实验三：定时/计数器实验
; 功能: 用定时器T0定时，使P0.0引脚输出周期为2s的方波，控制LED闪烁
; 知识点: 定时器配置, TMOD寄存器, 中断处理, 计数初值计算
; 晶振频率: 12MHz

ORG 0000H
LJMP MAIN

ORG 000BH        ; 定时器T0中断向量地址(0BH)
LJMP T0_INT      ; 跳转到中断服务程序

MAIN:
    ; 定时器初始化配置
    MOV TMOD, #01H   ; 设置T0为模式1 (16位定时器)
                     ; TMOD = 00000001B
                     ; GATE=0, C/T=0, M1=0, M0=1 (模式1)
    MOV TH0, #3CH    ; 设置初值高8位，定时50ms
    MOV TL0, #0B0H   ; 设置初值低8位，定时50ms
                     ; 初值 = 3CB0H = 15536 (十进制)
    
    ; 中断系统配置
    SETB ET0         ; 允许T0中断 (IE.1 = 1)
    SETB EA          ; 开总中断开关 (IE.7 = 1)
    SETB TR0         ; 启动T0定时器 (TCON.4 = 1)
    
    MOV R0, #20      ; 设置软件计数器，20次中断=1秒
                     ; 50ms × 20 = 1000ms = 1秒

LOOP:
    SJMP LOOP        ; 主程序空循环，等待中断
                     ; CPU在此处等待定时器中断

; 定时器T0中断服务程序
T0_INT:
    ; 重新装载定时初值（模式1需要软件重装）
    MOV TH0, #3CH    ; 重装高8位
    MOV TL0, #0B0H   ; 重装低8位
    
    DJNZ R0, EXIT    ; 软件计数器减1，未到1秒则退出
                     ; R0 = R0 - 1，如果R0≠0则跳转
    
    ; 1秒时间到，执行方波翻转
    MOV R0, #20      ; 重新装载计数值
    CPL P0.0         ; 翻转P0.0输出状态，产生方波
                     ; 每1秒翻转一次，周期 = 2秒
    
EXIT:
    RETI             ; 中断返回，恢复主程序执行

END`,
    expectedResults: [
      'P0.0引脚输出周期为2秒的方波',
      '每1秒翻转一次输出电平',
      '定时精度符合计算值',
      '中断响应正常'
    ],
    troubleshooting: [
      {
        issue: '定时不准确',
        solution: '检查晶振频率和初值计算，确认TMOD配置正确'
      },
      {
        issue: '没有中断响应',
        solution: '检查EA和ET0位设置，确认中断向量地址正确'
      },
      {
        issue: '方波频率不对',
        solution: '检查软件计数器R0的初值和递减逻辑'
      }
    ],
    extensions: [
      '修改R0初值，改变方波频率',
      '使用定时器模式0或模式2，观察区别',
      '同时使用T0和T1产生不同频率的信号',
      '实现精确的秒表功能'
    ]
  },
  {
    id: 'exp04',
    title: '实验四：数码管显示实验',
    description: '定时器中断驱动四位数码管动态扫描显示，掌握段选码编码与查表技术，实现0000-9999计数器。',
    category: '显示控制',
    difficulty: 'intermediate',
    duration: 90,
    objectives: [
      '掌握7段数码管的工作原理和驱动方法',
      '理解共阴/共阳数码管的区别',
      '学会BCD到7段码的转换',
      '掌握动态扫描显示技术'
    ],
    prerequisites: [
      'P口输出控制',
      '查表程序设计',
      '定时器应用'
    ],
    knowledgePoints: [
      '7段数码管结构',
      'BCD译码原理',
      '动态扫描技术',
      '查表程序MOVC指令',
      '位选和段选控制'
    ],
    hardwareRequirements: [
      '4位共阴数码管',
      '74HC244驱动器',
      'P0口连接段选',
      'P2口连接位选'
    ],
    // P0 输出共阴段码；扫描位选 CLR P2.4~P2.7（低电平选通），千/百/十/个位
    peripheral: {
      kind: 'segment',
      label: 'P0/P2 · 四位数码管',
      segment: { segPort: 'P0', digitPort: 'P2', digitBits: [4, 5, 6, 7], digitNames: ['千位', '百位', '十位', '个位'] },
    },
    code: `; 桂林航天工业学院 - 实验四：数码管显示实验
; 功能: 4位数码管动态显示数字，实现计数器功能
; 知识点: 数码管驱动, 动态扫描, 查表程序, BCD译码

ORG 0000H
LJMP MAIN

ORG 001BH        ; 定时器T1中断向量
LJMP T1_INT

; 7段码查找表 (共阴数码管)
TAB_7SEG:
    DB 3FH, 06H, 5BH, 4FH, 66H  ; 0,1,2,3,4
    DB 6DH, 7DH, 07H, 7FH, 6FH  ; 5,6,7,8,9
    DB 77H, 7CH, 39H, 5EH, 79H, 71H  ; A,B,C,D,E,F

MAIN:
    ; 定时器T1初始化，用于动态扫描
    MOV TMOD, #10H   ; T1模式1，16位定时器
    MOV TH1, #0F8H   ; 定时2ms (65536-2000=63536)
    MOV TL1, #30H
    SETB ET1         ; 允许T1中断
    SETB EA          ; 开总中断
    SETB TR1         ; 启动T1
    
    ; 初始化变量
    MOV 20H, #0      ; 千位
    MOV 21H, #0      ; 百位  
    MOV 22H, #0      ; 十位
    MOV 23H, #0      ; 个位
    MOV 24H, #0      ; 当前扫描位 (0-3)
    MOV 25H, #0      ; 计数器低字节
    MOV 26H, #0      ; 计数器高字节

MAIN_LOOP:
    ; 主程序：实现0000-9999计数
    ACALL DELAY_1S   ; 延时1秒
    
    ; 计数器加1
    INC 25H
    MOV A, 25H
    CJNE A, #100, NO_CARRY  ; 检查是否到100
    MOV 25H, #0      ; 清零个位和十位计数
    INC 26H          ; 百位和千位计数器加1
    MOV A, 26H
    CJNE A, #100, NO_CARRY
    MOV 26H, #0      ; 清零所有计数
    
NO_CARRY:
    ; 分解数字到各位
    MOV A, 25H       ; 0-99 (个位十位)
    MOV B, #10
    DIV AB
    MOV 23H, B       ; 个位
    MOV 22H, A       ; 十位
    
    MOV A, 26H       ; 0-99 (百位千位)
    MOV B, #10  
    DIV AB
    MOV 21H, B       ; 百位
    MOV 20H, A       ; 千位
    
    SJMP MAIN_LOOP

; 定时器T1中断服务程序 - 动态扫描
T1_INT:
    PUSH ACC
    PUSH PSW
    
    ; 重装定时初值
    MOV TH1, #0F8H
    MOV TL1, #30H
    
    ; 关闭所有数码管
    MOV P2, #0F0H    ; 位选全部关闭
    
    ; 选择当前要显示的位
    MOV A, 24H       ; 当前扫描位
    CJNE A, #0, CHECK1
    ; 显示千位
    MOV A, 20H
    ACALL GET_7SEG_CODE
    MOV P0, A        ; 输出段码
    CLR P2.4         ; 选中千位
    SJMP SCAN_NEXT
    
CHECK1:
    CJNE A, #1, CHECK2
    ; 显示百位
    MOV A, 21H
    ACALL GET_7SEG_CODE
    MOV P0, A
    CLR P2.5         ; 选中百位
    SJMP SCAN_NEXT
    
CHECK2:
    CJNE A, #2, CHECK3  
    ; 显示十位
    MOV A, 22H
    ACALL GET_7SEG_CODE
    MOV P0, A
    CLR P2.6         ; 选中十位
    SJMP SCAN_NEXT
    
CHECK3:
    ; 显示个位
    MOV A, 23H
    ACALL GET_7SEG_CODE
    MOV P0, A
    CLR P2.7         ; 选中个位
    
SCAN_NEXT:
    ; 切换到下一位
    INC 24H
    MOV A, 24H
    CJNE A, #4, EXIT_INT
    MOV 24H, #0      ; 回到第一位
    
EXIT_INT:
    POP PSW
    POP ACC
    RETI

; 获取7段码子程序
GET_7SEG_CODE:
    PUSH DPH
    PUSH DPL
    MOV DPTR, #TAB_7SEG
    MOVC A, @A+DPTR  ; 查表获取7段码
    POP DPL
    POP DPH
    RET

; 1秒延时子程序
DELAY_1S:
    PUSH ACC
    MOV R6, #20      ; 20次50ms = 1秒
D1S_LOOP:
    ACALL DELAY_50MS
    DJNZ R6, D1S_LOOP
    POP ACC
    RET

; 50毫秒延时
DELAY_50MS:
    PUSH ACC
    MOV R7, #125
D50MS_LOOP:
    MOV R0, #200
    DJNZ R0, $
    DJNZ R7, D50MS_LOOP
    POP ACC
    RET

END`,
    expectedResults: [
      '4位数码管显示清晰，无闪烁',
      '数字从0000开始依次递增',
      '到达9999后自动回零',
      '各位数字显示正确无错位'
    ],
    troubleshooting: [
      {
        issue: '数码管闪烁严重',
        solution: '调整扫描频率，检查定时器设置'
      },
      {
        issue: '某些数字显示不完整',
        solution: '检查7段码表数据和段码连接'
      },
      {
        issue: '位选错误',
        solution: '确认P2口位选信号和硬件连接'
      }
    ],
    extensions: [
      '显示小数点和负号',
      '实现时钟显示功能',
      '添加数字闪烁效果',
      '实现多种显示模式切换'
    ]
  },
  {
    id: 'exp05',
    title: '实验五：按键输入与消抖处理',
    description: '轮询P3.0–P3.3四路独立低有效按键，两次同键确认后输出0–3，稳定释放后才接受下一次按键。',
    category: '输入处理',
    difficulty: 'intermediate',
    duration: 75,
    objectives: [
      '掌握四路独立按键的低有效输入与轮询检测',
      '实现两次同键确认与稳定释放判定',
      '将P3.0–P3.3单键输入编码为0–3并在P0观察',
      '区分仿真电平输入、实物消抖时间与矩阵键盘拓展'
    ],
    prerequisites: [
      'P口输入输出控制',
      '条件转移与子程序调用',
      '延时程序设计'
    ],
    knowledgePoints: [
      '独立按键电平检测',
      '软件消抖技术',
      '键值编码方法',
      '查询与等待释放',
      '准双向口读引脚前先写1'
    ],
    hardwareRequirements: [
      '四个独立常开按键，分别连接P3.0–P3.3与GND',
      '输入端按准双向口要求先写1；实物上拉配置按所用器件与板卡核实',
      'P0为键值输出；实物显示须另配合适的驱动与上拉'
    ],
    // 当前画布直接注入四路独立输入电平；没有行列联动或外中断模型。
    peripheral: {
      kind: 'keys',
      label: 'P3/P0 · 四路独立按键与键值',
      keys: [
        { port: 'P3', bit: 0, label: '键0' },
        { port: 'P3', bit: 1, label: '键1' },
        { port: 'P3', bit: 2, label: '键2' },
        { port: 'P3', bit: 3, label: '键3' },
      ],
      keyValuePort: 'P0',
    },
    code: `; 桂林航天工业学院 - 实验五：按键输入与消抖处理
; 功能: 四路独立低有效按键，查询、同键确认、等待稳定释放
; 输入: P3.0–P3.3；单键分别编码为0–3，同时多键不接受
; 输出: P0和20H保留最后有效键值；21H为8位有效按键次数
; 22H保存候选键值；计数超过255回到0
; 本预置程序不使用矩阵行扫描或外部中断

ORG 0000H
LJMP MAIN

MAIN:
    MOV IE, #00H     ; 本例仅用查询，关闭中断
    MOV SP, #2FH     ; 堆栈从30H起，避开20H–22H变量
    MOV PSW, #00H    ; 使用寄存器组0
    MOV P3, #0FFH    ; 输入前先写1，未使用的高4位也保持1
    MOV P0, #0FFH    ; 尚无有效键值
    MOV 20H, #0FFH   ; 最后有效键值
    MOV 21H, #0      ; 有效按键次数（8位）
    MOV 22H, #0FFH   ; 候选键值

MAIN_LOOP:
    ACALL READ_KEY
    CJNE A, #0FFH, KEY_CANDIDATE
    SJMP MAIN_LOOP

KEY_CANDIDATE:
    MOV 22H, A
    ACALL DELAY_20MS
    ACALL READ_KEY
    CJNE A, 22H, WAIT_RELEASE   ; 换键、释放或多键：本次不接受
    MOV 20H, A
    MOV P0, A
    INC 21H                    ; 仅在同键确认成功时记录一次

WAIT_RELEASE:
    MOV A, P3
    ANL A, #0FH
    CJNE A, #0FH, WAIT_RELEASE ; 必须四路均回高，不能把多键当释放
    ACALL DELAY_20MS
    MOV A, P3
    ANL A, #0FH
    CJNE A, #0FH, WAIT_RELEASE ; 两次全高才重新允许按键
    MOV 22H, #0FFH
    SJMP MAIN_LOOP

; 一次采样：A返回0–3；无键或同时多键返回FFH
; A和比较标志作为返回/临时结果；不使用其他寄存器
READ_KEY:
    MOV A, P3
    ANL A, #0FH
    CJNE A, #0EH, CHECK_KEY1
    MOV A, #0
    RET
CHECK_KEY1:
    CJNE A, #0DH, CHECK_KEY2
    MOV A, #1
    RET
CHECK_KEY2:
    CJNE A, #0BH, CHECK_KEY3
    MOV A, #2
    RET
CHECK_KEY3:
    CJNE A, #07H, NO_SINGLE_KEY
    MOV A, #3
    RET
NO_SINGLE_KEY:
    MOV A, #0FFH
    RET

; 理论延时：12MHz、每机器周期12个晶振周期时，含ACALL约20.313ms
; 当前仿真按指令推进，不以界面运行速度验证实物消抖时间
DELAY_20MS:
    PUSH 06H          ; 保存组0的R6、R7；A和其他寄存器不变
    PUSH 07H
    MOV R7, #100
D20_OUTER:
    MOV R6, #100
D20_INNER:
    DJNZ R6, D20_INNER
    DJNZ R7, D20_OUTER
    POP 07H
    POP 06H
    RET

END`,
    expectedResults: [
      '四路单键分别输出0、1、2、3，P0与20H保留最后有效键值',
      '持续按住一次只使21H计数增加一次',
      '确认期间换键、释放或同时多键时不接受原候选键',
      '两次全高确认释放后，再次按下可接受新键'
    ],
    troubleshooting: [
      {
        issue: '按键重复触发',
        solution: '检查是否保留等待四路全高及再次确认释放的逻辑；仅增加延时不能阻止长按重复'
      },
      {
        issue: '某些键无响应',
        solution: '一次只按一个键；换键被拒绝后须全部松开并等待释放确认，再重新按下'
      },
      {
        issue: '键值错误',
        solution: '核对P3.0–P3.3分别对应0–3；当前四路电平输入不能按16键矩阵操作'
      }
    ],
    extensions: [
      '实现长按和短按识别',
      '在实物或另建行列联动模型后实现4×4矩阵键盘扫描',
      '设计键盘密码锁',
      '实现按键音效'
    ]
  },
  {
    id: 'exp06',
    title: '实验六：定时器中断与计时功能',
    description: '双定时器中断协同实现数字时钟：T0负责1秒计时，T1负责数码管动态扫描，支持按键设置时间与显示模式切换。',
    category: '定时器应用',
    difficulty: 'intermediate',
    duration: 100,
    objectives: [
      '深入理解8051定时器的工作模式',
      '掌握定时器中断的配置和使用',
      '学会精确时间计算和校准',
      '实现实时时钟功能'
    ],
    prerequisites: [
      '中断系统原理',
      '定时器基础应用',
      '数码管显示技术'
    ],
    knowledgePoints: [
      '定时器工作模式分析',
      '双定时器分工（T0计时/T1扫描）',
      '软件计数器分频（50ms×20=1秒）',
      '实时时钟进位算法（秒→分→时）',
      '按键查询与消抖处理'
    ],
    hardwareRequirements: [
      '4位数码管显示器',
      '12MHz晶振',
      '按键设置时间',
      'LED指示灯'
    ],
    // 时钟显示走 P0 段码 + P2.4~P2.7 位选（与实验四同一套接线）；P1 全程未写，
    // 故不用 LED 视图；P3.2/3/4 为模式/时/分设置键（JNB 轮询，低电平触发）
    peripheral: {
      kind: 'segment',
      label: 'P0/P2 · 数码管时钟',
      segment: { segPort: 'P0', digitPort: 'P2', digitBits: [4, 5, 6, 7], digitNames: ['位1', '位2', '位3', '位4'] },
      keys: [
        { port: 'P3', bit: 2, label: '模式', momentary: true },
        { port: 'P3', bit: 3, label: '时+', momentary: true },
        { port: 'P3', bit: 4, label: '分+', momentary: true },
      ],
    },
    code: `; 桂林航天工业学院 - 实验六：定时器中断与计时功能
; 功能: 实现数字时钟，显示时分秒，可按键设置时间
; 知识点: 定时器中断, 实时时钟, 时间计算

ORG 0000H
LJMP MAIN

ORG 000BH        ; T0中断向量
LJMP T0_INT

ORG 001BH        ; T1中断向量  
LJMP T1_INT

ORG 0030H        ; 主程序起始地址
MAIN:
    ; 初始化定时器T0 - 用于1秒计时
    MOV TMOD, #11H   ; T0和T1都是模式1
    MOV TH0, #3CH    ; 50ms定时
    MOV TL0, #0B0H
    
    ; 初始化定时器T1 - 用于数码管扫描
    MOV TH1, #0F8H   ; 2ms定时 (65536-2000=63536=F830H)
    MOV TL1, #30H    ; 与中断内重装值保持一致
    
    ; 中断设置
    SETB ET0         ; 允许T0中断
    SETB ET1         ; 允许T1中断
    SETB EA          ; 开总中断
    SETB TR0         ; 启动T0
    SETB TR1         ; 启动T1
    
    ; 初始化时间变量
    MOV 20H, #12     ; 小时 (12)
    MOV 21H, #30     ; 分钟 (30)
    MOV 22H, #0      ; 秒 (00)
    MOV 23H, #0      ; 1秒计数器 (20次50ms = 1秒)
    MOV 24H, #0      ; 显示模式 (0=时分, 1=分秒)
    MOV 25H, #0      ; 扫描位计数器
    
MAIN_LOOP:
    ; 检查按键
    JNB P3.2, SET_MODE    ; 模式切换键
    JNB P3.3, SET_HOUR    ; 小时设置键
    JNB P3.4, SET_MIN     ; 分钟设置键
    SJMP MAIN_LOOP

SET_MODE:
    ACALL KEY_DELAY
    CPL 24H.0        ; 切换显示模式
    SJMP MAIN_LOOP

SET_HOUR:
    ACALL KEY_DELAY
    MOV A, 20H
    INC A
    CJNE A, #24, HOUR_OK
    MOV A, #0
HOUR_OK:
    MOV 20H, A
    SJMP MAIN_LOOP

SET_MIN:
    ACALL KEY_DELAY
    MOV A, 21H
    INC A
    CJNE A, #60, MIN_OK
    MOV A, #0
MIN_OK:
    MOV 21H, A
    SJMP MAIN_LOOP

; 定时器T0中断 - 1秒计时
T0_INT:
    PUSH ACC
    PUSH PSW
    
    ; 重装定时值
    MOV TH0, #3CH
    MOV TL0, #0B0H
    
    ; 1秒计数
    INC 23H
    MOV A, 23H
    CJNE A, #20, T0_EXIT  ; 20次50ms = 1秒
    
    ; 1秒到，更新时间
    MOV 23H, #0
    
    ; 秒加1
    INC 22H
    MOV A, 22H
    CJNE A, #60, T0_EXIT
    
    ; 分钟加1
    MOV 22H, #0
    INC 21H
    MOV A, 21H
    CJNE A, #60, T0_EXIT
    
    ; 小时加1
    MOV 21H, #0
    INC 20H
    MOV A, 20H
    CJNE A, #24, T0_EXIT
    MOV 20H, #0      ; 24小时制
    
T0_EXIT:
    POP PSW
    POP ACC
    RETI

; 定时器T1中断 - 数码管扫描
T1_INT:
    PUSH ACC
    PUSH PSW
    
    ; 重装定时值
    MOV TH1, #0F8H
    MOV TL1, #30H
    
    ; 关闭所有显示
    MOV P2, #0F0H
    
    ; 选择显示内容
    JB 24H.0, DISPLAY_MIN_SEC
    
DISPLAY_HOUR_MIN:
    ; 显示时:分
    MOV A, 25H
    CJNE A, #0, DISP1
    ; 显示小时十位
    MOV A, 20H
    MOV B, #10
    DIV AB
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.4
    SJMP SCAN_NEXT
    
DISP1:
    CJNE A, #1, DISP2
    ; 显示小时个位
    MOV A, 20H
    MOV B, #10
    DIV AB
    MOV A, B
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.5
    SJMP SCAN_NEXT
    
DISP2:
    CJNE A, #2, DISP3
    ; 显示分钟十位
    MOV A, 21H
    MOV B, #10
    DIV AB
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.6
    SJMP SCAN_NEXT
    
DISP3:
    ; 显示分钟个位
    MOV A, 21H
    MOV B, #10
    DIV AB
    MOV A, B
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.7
    SJMP SCAN_NEXT

DISPLAY_MIN_SEC:
    ; 显示分:秒
    MOV A, 25H
    CJNE A, #0, DISP1_MS
    ; 显示分钟十位
    MOV A, 21H
    MOV B, #10
    DIV AB
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.4
    SJMP SCAN_NEXT
    
DISP1_MS:
    CJNE A, #1, DISP2_MS
    ; 显示分钟个位
    MOV A, 21H
    MOV B, #10
    DIV AB
    MOV A, B
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.5
    SJMP SCAN_NEXT
    
DISP2_MS:
    CJNE A, #2, DISP3_MS
    ; 显示秒十位
    MOV A, 22H
    MOV B, #10
    DIV AB
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.6
    SJMP SCAN_NEXT
    
DISP3_MS:
    ; 显示秒个位
    MOV A, 22H
    MOV B, #10
    DIV AB
    MOV A, B
    ACALL GET_DIGIT_CODE
    MOV P0, A
    CLR P2.7
    
SCAN_NEXT:
    INC 25H
    MOV A, 25H
    CJNE A, #4, T1_EXIT
    MOV 25H, #0
    
T1_EXIT:
    POP PSW
    POP ACC
    RETI

; 获取数字段码
GET_DIGIT_CODE:
    PUSH DPH
    PUSH DPL
    MOV DPTR, #DIGIT_TAB
    MOVC A, @A+DPTR
    POP DPL
    POP DPH
    RET

; 数字段码表
DIGIT_TAB:
    DB 3FH, 06H, 5BH, 4FH, 66H  ; 0-4
    DB 6DH, 7DH, 07H, 7FH, 6FH  ; 5-9

; 按键延时
KEY_DELAY:
    PUSH ACC
    MOV R7, #50
KD_LOOP:
    MOV R0, #200
    DJNZ R0, $
    DJNZ R7, KD_LOOP
    POP ACC
    RET

END`,
    expectedResults: [
      '数字时钟正常计时运行',
      '时间显示准确无误',
      '按键设置功能正常',
      '显示模式切换正确'
    ],
    troubleshooting: [
      {
        issue: '时间走得快或慢',
        solution: '校准定时器初值，检查晶振频率'
      },
      {
        issue: '数码管闪烁',
        solution: '调整扫描频率，优化显示程序'
      },
      {
        issue: '按键无响应',
        solution: '检查按键消抖和中断设置'
      }
    ],
    extensions: [
      '添加闹钟功能',
      '实现12/24小时制切换',
      '增加日期显示',
      '设计秒表功能'
    ]
  },
  {
    id: 'exp07',
    title: '实验七：蜂鸣器音频控制',
    description: '通过定时器产生不同频率方波驱动蜂鸣器，实现简单音乐播放功能。',
    category: '音频控制',
    difficulty: 'intermediate',
    duration: 80,
    objectives: [
      '掌握蜂鸣器的工作原理和驱动方法',
      '理解音频频率与音调的关系',
      '学会程序控制音乐播放',
      '掌握定时器中断产生方波的技术'
    ],
    prerequisites: [
      '定时器应用',
      '端口输出控制',
      '中断编程'
    ],
    knowledgePoints: [
      '蜂鸣器驱动原理',
      '音频频率计算（定时器初值=65536-500000/f）',
      '音符编码方法',
      '定时器中断产生方波',
      '节拍控制算法'
    ],
    hardwareRequirements: [
      '有源蜂鸣器',
      '无源蜂鸣器',
      '三极管驱动电路',
      'P2.0连接蜂鸣器'
    ],
    // 中断服务程序 CPL P2.0 产生音频方波，仿真器按 P2.0 翻转间隔推算真实频率
    peripheral: { kind: 'buzzer', label: 'P2.0 · 蜂鸣器', buzzerPin: 'P2.0' },
    code: `; 桂林航天工业学院 - 实验七：蜂鸣器音频控制
; 功能: 蜂鸣器播放音乐，可控制音调和节拍
; 知识点: 音频控制, 频率产生, 音乐编程

ORG 0000H
LJMP MAIN

ORG 000BH        ; T0中断向量
LJMP T0_INT

; 音符频率表 (定时器初值，12MHz晶振)
; 初值 = 65536 - 500000/f（半周期计数，中断翻转引脚，两次翻转=1个周期）
; 例：低音1(do)=262Hz → 500000/262≈1908 → 65536-1908=63628=F88CH
FREQ_TAB:
    DW 0F88CH, 0F95BH, 0FA15H, 0FA67H  ; 低音 1234 (262/294/330/349Hz)
    DW 0FB04H, 0FB90H, 0FC0CH, 0FC44H  ; 低音 567+中音1 (392/440/494/523Hz)
    DW 0FC44H, 0FCACH, 0FD09H, 0FD34H  ; 中音 1234 (523/587/659/698Hz)
    DW 0FD82H, 0FDC8H, 0FE06H, 0FE22H  ; 中音 567+高音1 (784/880/988/1046Hz)
    DW 0FE22H, 0FE56H, 0FE85H, 0FE9AH  ; 高音 1234 (1046/1175/1319/1397Hz)
    DW 0FEC1H, 0FEE4H, 0FF03H, 0FF11H  ; 高音 567+倍高1 (1568/1760/1976/2093Hz)

; 简单音乐：《小星星》
MUSIC_DATA:
    DB 1, 4, 1, 4, 5, 4, 5, 4          ; 1155
    DB 6, 4, 6, 4, 5, 8, 0, 0          ; 6655
    DB 4, 4, 4, 4, 3, 4, 3, 4          ; 4433
    DB 2, 4, 2, 4, 1, 8, 0, 0          ; 2211
    DB 5, 4, 5, 4, 4, 4, 4, 4          ; 5544
    DB 3, 4, 3, 4, 2, 8, 0, 0          ; 3322
    DB 5, 4, 5, 4, 4, 4, 4, 4          ; 5544
    DB 3, 4, 3, 4, 2, 8, 0, 0          ; 3322
    DB 0FFH                             ; 结束标志

MAIN:
    ; 定时器T0初始化
    MOV TMOD, #01H   ; T0模式1
    SETB ET0         ; 允许T0中断
    SETB EA          ; 开总中断
    
    ; 初始化变量
    MOV 20H, #0      ; 音符指针
    MOV 21H, #0      ; 节拍计数器
    MOV 22H, #0      ; 当前音符
    MOV 23H, #0      ; 当前节拍
    MOV 24H, #0      ; 蜂鸣器状态 (0=关, 1=开)
    MOV 26H, #0      ; 定时器初值高字节备份
    MOV 27H, #0      ; 定时器初值低字节备份

PLAY_MUSIC:
    ; 获取音符和节拍
    MOV A, 20H
    MOV DPTR, #MUSIC_DATA
    MOVC A, @A+DPTR
    CJNE A, #0FFH, NOT_END
    MOV 20H, #0      ; 重新开始
    SJMP PLAY_MUSIC
    
NOT_END:
    MOV 22H, A       ; 保存音符
    INC 20H
    
    ; 获取节拍
    MOV A, 20H
    MOVC A, @A+DPTR
    MOV 23H, A       ; 保存节拍
    INC 20H
    
    ; 设置音符频率
    MOV A, 22H
    CJNE A, #0, PLAY_NOTE
    ; 休止符
    CLR TR0
    MOV 24H, #0
    SJMP SET_BEAT
    
PLAY_NOTE:
    ; 计算频率表偏移
    DEC A            ; 音符1对应索引0
    MOV B, #2        ; 每个频率值占2字节
    MUL AB
    
    ; 获取定时器初值
    MOV DPTR, #FREQ_TAB
    ADD A, DPL
    MOV DPL, A
    JNC NO_CARRY
    INC DPH
NO_CARRY:
    
    CLR A
    MOVC A, @A+DPTR  ; 获取高字节
    MOV TH0, A
    MOV A, #1
    MOVC A, @A+DPTR  ; 获取低字节
    MOV TL0, A
    
    ; 保存定时器初值到备份
    MOV 26H, TH0
    MOV 27H, TL0

    ; 启动发声
    SETB TR0
    MOV 24H, #1
    
SET_BEAT:
    ; 设置节拍延时
    MOV A, 23H
    MOV B, #25       ; 节拍基准25（最长节拍8×25=200，不超出8位积）
    MUL AB
    MOV 21H, A       ; 节拍计数器
    
WAIT_BEAT:
    ; 等待节拍结束
    MOV A, 21H
    JNZ WAIT_BEAT
    
    ; 音符间停顿
    CLR TR0
    MOV 24H, #0
    ACALL SHORT_DELAY
    
    SJMP PLAY_MUSIC

; 定时器T0中断 - 产生音频方波
T0_INT:
    PUSH ACC
    
    ; 从备份重装定时值
    MOV TH0, 26H
    MOV TL0, 27H
    
    ; 翻转蜂鸣器引脚
    JB 24H.0, BUZZ_ON
    SJMP T0_EXIT
    
BUZZ_ON:
    CPL P2.0         ; 翻转P2.0产生方波
    
T0_EXIT:
    ; 减少节拍计数
    MOV A, 21H
    JZ T0_END
    DEC 21H
    
T0_END:
    POP ACC
    RETI

; 短延时
SHORT_DELAY:
    PUSH ACC
    MOV R7, #20
SD_LOOP:
    MOV R0, #100
    DJNZ R0, $
    DJNZ R7, SD_LOOP
    POP ACC
    RET

END`,
    expectedResults: [
      '蜂鸣器正常发声',
      '音乐旋律清晰可辨',
      '音符节拍准确',
      '可循环播放音乐'
    ],
    troubleshooting: [
      {
        issue: '无声音输出',
        solution: '检查蜂鸣器连接和驱动电路'
      },
      {
        issue: '音调不准确',
        solution: '校准频率表数值，检查晶振频率'
      },
      {
        issue: '节拍不稳定',
        solution: '优化节拍计时算法'
      }
    ],
    extensions: [
      '录制和播放不同音乐',
      '实现音量调节功能',
      '添加音效库',
      '设计音乐游戏'
    ]
  },
  {
    id: 'exp08',
    title: '实验八：步进电机控制实验',
    description: '以四相五线步进电机模型练习正反转、半步相序与调速；课程四线双极型实物实验另需双H桥驱动。',
    category: '电机控制',
    difficulty: 'intermediate',
    duration: 110,
    objectives: [
      '掌握步进电机的工作原理和驱动方法',
      '理解步进电机的相序控制技术',
      '学会精确角度和速度控制',
      '掌握步进电机正反转控制'
    ],
    prerequisites: [
      '定时器中断应用',
      'P口输出控制',
      '数字逻辑电路'
    ],
    knowledgePoints: [
      '步进电机原理',
      '四相八拍控制',
      '相序表设计',
      '速度调节方法',
      '步数计数与定位控制'
    ],
    hardwareRequirements: [
      '平台模型：28BYJ-48四相五线单极型步进电机（课程四线双极型须另用双H桥）',
      'ULN2003驱动芯片',
      'P1口高4位连接驱动器',
      '按键控制方向和速度'
    ],
    // 相序输出在 P1；转子/相位取程序自身变量：20H=步序索引 21H.0=方向 22H.0=运行标志
    // （见代码 MAIN 段变量注释）。P3.2~P3.6 为启停/方向/加速/减速/步进模式键（JNB 轮询）
    peripheral: {
      kind: 'stepper',
      label: 'P1 · 步进电机',
      stepper: { stepAddr: 0x20, dirAddr: 0x21, runAddr: 0x22 },
      keys: [
        { port: 'P3', bit: 2, label: '启停', momentary: true },
        { port: 'P3', bit: 3, label: '方向', momentary: true },
        { port: 'P3', bit: 4, label: '加速', momentary: true },
        { port: 'P3', bit: 5, label: '减速', momentary: true },
        { port: 'P3', bit: 6, label: '步进100', momentary: true },
      ],
    },
    code: `; 桂林航天工业学院 - 实验八：步进电机控制实验
; 功能: 步进电机正反转控制，可调速度，精确定位
; 知识点: 步进电机驱动, 相序控制, 定时控制

ORG 0000H
LJMP MAIN

ORG 000BH        ; T0中断向量
LJMP T0_INT

; 四相八拍步进电机相序表
; 相位输出在P1高4位：A相=P1.4 B相=P1.5 C相=P1.6 D相=P1.7（1=励磁）
; 低4位留给状态指示，中断里用ANL/ORL只改高4位
STEP_TAB_CW:     ; 顺时针相序表
    DB 10H, 30H, 20H, 60H       ; A相 -> AB相 -> B相 -> BC相
    DB 40H, 0C0H, 80H, 90H      ; C相 -> CD相 -> D相 -> DA相

MAIN:
    ; 定时器T0初始化 - 控制步进速度
    MOV TMOD, #01H   ; T0模式1
    MOV TH0, #0F0H   ; 初始速度 (较慢)
    MOV TL0, #60H
    SETB ET0         ; 允许T0中断
    SETB EA          ; 开总中断
    
    ; 初始化变量
    MOV 20H, #0      ; 当前步序索引 (0-7)
    MOV 21H, #1      ; 方向标志 (1=顺时针, 0=逆时针)
    MOV 22H, #0      ; 运行状态 (1=运行, 0=停止)
    MOV 23H, #5      ; 速度级别 (1-9, 数字越大越快)
    MOV 24H, #0      ; 目标步数 (0=连续运行)
    MOV 25H, #0      ; 当前步数计数器
    MOV 26H, #0      ; 定时器初值高字节备份
    MOV 27H, #0      ; 定时器初值低字节备份
    ACALL UPDATE_SPEED ; 按速度5初始化定时器和重装备份

    ; P口初始化
    MOV P1, #00H     ; 高4位相线全部关断，低4位状态指示清零

MAIN_LOOP:
    ; 检查控制按键
    JNB P3.2, START_STOP    ; 启动/停止按键
    JNB P3.3, CHANGE_DIR    ; 方向切换按键
    JNB P3.4, SPEED_UP      ; 加速按键
    JNB P3.5, SPEED_DOWN    ; 减速按键
    JNB P3.6, STEP_MODE     ; 步进模式按键

    ; 显示当前状态（只刷新P1低4位，高4位相位输出留给中断维护）
    MOV A, 20H       ; 当前步序
    ANL A, #07H      ; 取低3位（0-7）
    MOV C, 21H.0     ; 读取方向位到进位标志
    MOV ACC.3, C     ; 方向显示在P1.3，不与步序低3位冲突
    ANL P1, #0F0H    ; 保留高4位相位
    ORL P1, A        ; 低4位写入状态指示

    SJMP MAIN_LOOP

START_STOP:
    ACALL KEY_DELAY
    CPL 22H.0        ; 切换运行状态
    JB 22H.0, START_MOTOR
    ; 停止电机
    CLR TR0
    ANL P1, #0FH     ; 高4位清零=关断所有相
    SJMP MAIN_LOOP
    
START_MOTOR:
    SETB TR0         ; 启动定时器
    SJMP MAIN_LOOP

CHANGE_DIR:
    ACALL KEY_DELAY
    CLR ET0          ; 原子更新方向与下一拍，避免中断读到一半状态
    CPL 21H.0        ; 切换方向
    JNB 22H.0, DIR_READY ; 未运行时保留初始/停机步序
    ; 20H已指向旧方向的下一拍，反向时调整两拍，得到所选方向的相邻拍
    MOV A, 20H
    JB 21H.0, DIR_FORWARD
    ADD A, #0FEH     ; 反向：旧预排索引减2
    SJMP DIR_WRAP
DIR_FORWARD:
    ADD A, #2        ; 正向：旧预排索引加2
DIR_WRAP:
    ANL A, #07H
    MOV 20H, A
DIR_READY:
    SETB ET0
    SJMP MAIN_LOOP

SPEED_UP:
    ACALL KEY_DELAY
    MOV A, 23H
    CJNE A, #9, SPEED_UP_OK
    SJMP MAIN_LOOP   ; 已经最快
SPEED_UP_OK:
    INC 23H
    ACALL UPDATE_SPEED
    SJMP MAIN_LOOP

SPEED_DOWN:
    ACALL KEY_DELAY
    MOV A, 23H
    CJNE A, #1, SPEED_DOWN_OK
    SJMP MAIN_LOOP   ; 已经最慢
SPEED_DOWN_OK:
    DEC 23H
    ACALL UPDATE_SPEED
    SJMP MAIN_LOOP

STEP_MODE:
    ACALL KEY_DELAY
    ; 设置步进模式 - 运行100步然后停止
    MOV 24H, #100
    MOV 25H, #0
    MOV 22H, #1      ; 启动运行
    SETB TR0
    SJMP MAIN_LOOP

; 更新速度设置
UPDATE_SPEED:
    PUSH ACC
    CLR TR0          ; 暂停定时器
    
    ; 根据速度级别设置定时器初值
    MOV A, 23H
    MOV DPTR, #SPEED_TAB
    DEC A            ; 速度1对应索引0
    MOV B, #2
    MUL AB
    ADD A, DPL
    MOV DPL, A
    JNC NO_CARRY_SPEED
    INC DPH
NO_CARRY_SPEED:
    
    CLR A
    MOVC A, @A+DPTR  ; 获取高字节
    MOV TH0, A
    MOV 26H, A       ; 备份高字节
    MOV A, #1
    MOVC A, @A+DPTR  ; 获取低字节
    MOV TL0, A
    MOV 27H, A       ; 备份低字节
    
    JNB 22H.0, UPDATE_SPEED_END
    SETB TR0         ; 重新启动定时器
    
UPDATE_SPEED_END:
    POP ACC
    RET

; 速度表 (定时器初值，数值越大、溢出间隔越短、速度越快)
SPEED_TAB:
    DW 0E000H, 0E800H, 0F000H, 0F400H, 0F600H  ; 速度1-5
    DW 0F800H, 0FA00H, 0FC00H, 0FE00H          ; 速度6-9

; 定时器T0中断 - 步进电机控制
T0_INT:
    PUSH ACC
    PUSH PSW
    PUSH DPH
    PUSH DPL
    
    ; 从备份重装定时值
    MOV TH0, 26H
    MOV TL0, 27H
    
    ; 检查是否需要步进
    JNB 22H.0, T0_EXIT  ; 未运行
    
    ; 统一使用正向相序表，后续通过索引递增/递减控制方向
    MOV DPTR, #STEP_TAB_CW
    
GET_STEP_DATA:
    ; 获取当前步序数据
    MOV A, 20H
    ANL A, #07H      ; 限制在0-7范围
    MOVC A, @A+DPTR
    
    ; 输出到电机驱动
    ANL P1, #0FH     ; 保留低4位状态
    ORL P1, A        ; 设置高4位电机控制
    
    ; 更新步序索引
    JB 21H.0, STEP_CW
    ; 逆时针 - 索引递减
    MOV A, 20H
    JZ STEP_CCW_WRAP
    DEC 20H
    SJMP CHECK_STEP_COUNT
STEP_CCW_WRAP:
    MOV 20H, #7
    SJMP CHECK_STEP_COUNT
    
STEP_CW:
    ; 顺时针 - 索引递增
    INC 20H
    MOV A, 20H
    CJNE A, #8, CHECK_STEP_COUNT
    MOV 20H, #0
    
CHECK_STEP_COUNT:
    ; 检查步数限制
    MOV A, 24H
    JZ T0_EXIT       ; 无限制运行
    
    INC 25H          ; 步数计数器加1
    MOV A, 25H
    CLR C
    SUBB A, 24H
    JC T0_EXIT       ; 未达到目标步数
    
    ; 达到目标步数，停止
    CLR 22H.0        ; 停止标志
    CLR TR0          ; 停止定时器
    MOV 24H, #0      ; 清除步数限制
    MOV 25H, #0      ; 清除计数器
    
T0_EXIT:
    POP DPL
    POP DPH
    POP PSW
    POP ACC
    RETI

; 按键消抖延时
KEY_DELAY:
    PUSH ACC
    MOV R7, #50
KD_LOOP:
    MOV R0, #100
    DJNZ R0, $
    DJNZ R7, KD_LOOP
    POP ACC
    RET

END`,
    expectedResults: [
      '步进电机平稳运行',
      '正反转切换正常',
      '速度调节有效',
      '步进定位准确'
    ],
    troubleshooting: [
      {
        issue: '电机不转或抖动',
        solution: '检查相序连接和驱动电路功率'
      },
      {
        issue: '转速不稳定',
        solution: '调整定时器参数，检查负载'
      },
      {
        issue: '方向控制错误',
        solution: '确认相序表和方向逻辑'
      }
    ],
    extensions: [
      '实现微步控制提高精度',
      '添加位置编码器反馈',
      '设计自动定位系统',
      '实现速度曲线控制'
    ]
  },
  {
    id: 'exp09',
    title: '实验九：串口通信实验',
    description: '配置UART实现异步串行通信，完成数据发送、接收和回显功能。',
    category: '通信接口',
    difficulty: 'intermediate',
    duration: 150,
    objectives: [
      '掌握8051串口通信的工作原理',
      '学会配置串口工作模式和波特率',
      '理解串口中断的使用方法',
      '实现简单的串口通信协议'
    ],
    prerequisites: [
      '掌握定时器配置',
      '熟悉中断系统',
      '理解字符编码和通信协议'
    ],
    knowledgePoints: [
      'SCON寄存器配置',
      '波特率计算和设置',
      '串口中断处理',
      'SBUF缓冲器使用',
      'TI/RI标志位操作',
      '字符串处理'
    ],
    hardwareRequirements: [
      'RS232接口或USB转串口模块',
      'PC端串口调试软件',
      '定时器T1用于波特率发生器',
      '经典12T内核、11.0592MHz晶振；SMOD=0，TH1=TL1=FDH'
    ],
    // UART 经 P3.0/P3.1（RXD/TXD），发送内容累积在 uart.transmitBuffer，终端直接渲染
    peripheral: { kind: 'serial', label: 'P3 · 串口终端' },
    code: `; 桂林航天工业学院 - 实验九：串口通信实验
; 功能: 串口发送"HELLO WORLD!"字符串，并实现回显功能
; 知识点: 串口配置, 波特率设置, 串口中断, 字符收发

ORG 0000H
LJMP MAIN

ORG 0023H        ; 串口中断向量地址
LJMP UART_INT    ; 跳转到串口中断服务程序

; 字符串数据
HELLO_MSG:
DB "HELLO WORLD!", 0DH, 0AH, 00H  ; 包含回车换行和结束符

MAIN:
    ; 串口初始化配置
    MOV SCON, #50H   ; 串口模式1，允许接收
                     ; SM0=0, SM1=1 (模式1，8位UART)
                     ; REN=1 (允许接收)
    
    ; 波特率配置 (使用定时器T1)
    MOV TMOD, #20H   ; T1模式2 (8位自动重装)
    ANL PCON, #7FH  ; SMOD=0；经典12T内核、11.0592MHz
    MOV TH1, #0FDH   ; 9600bit/s；12MHz时同一初值实际为10416.67bit/s
    MOV TL1, #0FDH   ; 自动重装值
    SETB TR1         ; 启动T1
    
    ; 中断配置
    SETB ES          ; 允许串口中断
    SETB EA          ; 开总中断
    
    ; 发送欢迎消息
    MOV DPTR, #HELLO_MSG
    ACALL SEND_STRING
    
    ; 主循环 - 等待串口中断
MAIN_LOOP:
    SJMP MAIN_LOOP

; 串口中断服务程序
UART_INT:
    PUSH ACC
    PUSH PSW
    
    JB RI, RECEIVE_CHAR  ; 检查是否为接收中断
    JB TI, SEND_COMPLETE ; 检查是否为发送中断
    SJMP UART_EXIT
    
RECEIVE_CHAR:
    CLR RI           ; 清除接收中断标志
    MOV A, SBUF      ; 读取接收到的字符
    
    ; 回显功能 - 将接收到的字符发送回去
    ACALL SEND_CHAR
    SJMP UART_EXIT
    
SEND_COMPLETE:
    CLR TI           ; 清除发送中断标志
    
UART_EXIT:
    POP PSW
    POP ACC
    RETI

; 发送字符串子程序
SEND_STRING:
    PUSH ACC
    CLR ES            ; 关闭串口中断，避免TI竞态
SEND_NEXT:
    CLR A
    MOVC A, @A+DPTR  ; 读取字符串中的字符
    JZ SEND_DONE      ; 如果是0，结束发送
    ACALL SEND_CHAR   ; 发送字符
    INC DPTR          ; 指向下一个字符
    SJMP SEND_NEXT
SEND_DONE:
    SETB ES           ; 重新开启串口中断
    POP ACC
    RET

; 发送单个字符子程序
SEND_CHAR:
    PUSH ACC
    MOV SBUF, A       ; 将字符送入发送缓冲器
WAIT_TX:
    JNB TI, WAIT_TX   ; 等待发送完成
    CLR TI            ; 清除发送中断标志
    POP ACC
    RET

END`,
    expectedResults: [
      '成功发送"HELLO WORLD!"字符串，串口终端实时显示',
      '发送子程序按"写SBUF→查询TI→清TI"的标准流程工作',
      '真机参考参数为经典12T内核、11.0592MHz、SMOD=0、TH1=FDH，对应9600bit/s',
      '平台终端用于观察字节与标志位；显示字符不代表已测得实物波特率或电气兼容性',
      '在画布输入一个可打印ASCII字符，继续执行后由RI中断处理并回显；实际串口连接另行验证'
    ],
    troubleshooting: [
      {
        issue: '无法发送数据',
        solution: '检查SCON配置和TI标志位设置'
      },
      {
        issue: '波特率不匹配',
        solution: '重新计算TH1值，确认晶振频率'
      },
      {
        issue: '接收数据乱码',
        solution: '检查波特率、数据位、停止位设置'
      }
    ],
    extensions: [
      '实现不同波特率的通信',
      '添加数据校验功能',
      '实现简单的命令解析器',
      '与PC端串口调试助手通信'
    ]
  },

  // ==========================================
  // 四大实践项目（对齐申报书）
  // ==========================================
  {
    id: 'proj01',
    title: '项目一：走进89C51的世界',
    description: '基础型项目：从认识芯片引脚到编写第一个程序，完成LED流水灯和数码管显示，建立单片机开发的基本能力。',
    category: '综合项目',
    difficulty: 'basic',
    duration: 180,
    objectives: [
      '认识89C51芯片引脚功能和最小系统',
      '掌握Keil开发环境和Proteus仿真工具的使用',
      '完成LED流水灯程序的编写与调试',
      '实现数码管静态/动态显示',
      '理解从需求分析到代码调试的完整开发流程'
    ],
    prerequisites: [
      '了解基本的数字电路知识',
      '掌握二进制和十六进制数制',
      '具备基本的计算机操作能力'
    ],
    knowledgePoints: [
      '89C51芯片引脚功能',
      '最小系统电路设计',
      'Keil μVision开发环境',
      'Proteus仿真软件',
      'P1口输出控制',
      'LED驱动电路',
      '数码管段选与位选',
      '延时子程序设计',
      '循环与分支程序结构'
    ],
    hardwareRequirements: [
      '89C51最小系统板',
      '8个LED发光二极管+限流电阻',
      '共阴数码管（静态段码显示）',
      '74HC245驱动芯片',
      'Proteus仿真环境'
    ],
    // 任务1流水灯在 P1（低电平点亮）；任务2数码管走 P0，画布与波形区均可观察
    peripheral: { kind: 'led', label: 'P1 · LED / P0 · 数码管', ledPort: 'P1' },
    code: `; 项目一：走进89C51的世界
; 任务1：LED流水灯 + 任务2：数码管显示
; 桂林航天工业学院 微控制器应用技术

ORG 0000H
    LJMP MAIN

ORG 0030H
MAIN:
    ; 任务1：LED流水灯
    MOV A, #0FEH       ; 初始值，点亮P1.0
LED_LOOP:
    MOV P1, A           ; 输出到LED
    ACALL DELAY_500MS   ; 教学循环延时，实际时长需按指令周期计算
    RL A                ; 循环左移
    CJNE A, #0FEH, LED_LOOP  ; 循环一轮

    ; 任务2：数码管显示0-9
    MOV R5, #0          ; 显示数字从0开始
NUM_LOOP:
    MOV A, R5
    MOV DPTR, #SEG_TAB  ; 段码表首地址
    MOVC A, @A+DPTR     ; 查表取段码
    MOV P0, A           ; 输出段码到P0
    ACALL DELAY_500MS   ; 延时
    INC R5
    CJNE R5, #10, NUM_LOOP  ; 显示0-9
    SJMP MAIN           ; 循环

; 延时子程序（名称沿用模板；经典12T/12MHz约1.006s，不含调用开销）
; 注意用R4作外层计数——R5在主程序里是数码管显示计数器，这里不能占用
DELAY_500MS:
    MOV R4, #10
D0: MOV R6, #200
D1: MOV R7, #250
D2: DJNZ R7, D2
    DJNZ R6, D1
    DJNZ R4, D0
    RET

; 共阴数码管段码表（0-9）
SEG_TAB:
    DB 3FH,06H,5BH,4FH,66H  ; 0,1,2,3,4
    DB 6DH,7DH,07H,7FH,6FH  ; 5,6,7,8,9

END`,
    expectedResults: [
      'LED从P1.0到P1.7依次点亮，形成流水效果',
      '数码管依次显示0-9数字',
      '先完成8灯流水循环，再开始P0数码管显示；可提高运行速度观察后半段',
      '程序循环执行，流水灯和数码管交替展示'
    ],
    troubleshooting: [
      { issue: 'LED不亮', solution: '检查LED极性和限流电阻连接，确认P1口输出低电平点亮' },
      { issue: '数码管显示乱码', solution: '核对段码表，检查共阴/共阳连接方式是否匹配' },
      { issue: '延时太快或太慢', solution: '调整R6/R7的初值，注意晶振频率对延时的影响' }
    ],
    extensions: [
      '实现LED花样灯效果（心跳、对称闪烁等）',
      '数码管显示自定义字符',
      '使用按键控制LED模式切换',
      '实现数码管动态扫描显示多位数字'
    ]
  },
  {
    id: 'proj02',
    title: '项目二：智慧路灯系统设计',
    description: '应用型项目：用模拟ADC输入观察光照值与PWM占空比的对应关系；当前约3.91Hz为便于观察的时序演示，实物照明需另设频率。LCD与定时开关为后续任务。',
    category: '综合项目',
    difficulty: 'intermediate',
    duration: 360,
    objectives: [
      '掌握ADC0809模数转换芯片的接口设计',
      '理解PWM调光原理并实现LED亮度控制',
      '实现基于光照强度的自动调光逻辑',
      '完成LCD1602液晶显示屏的驱动编程（项目后续任务）',
      '设计定时开关控制功能（项目拓展）'
    ],
    prerequisites: [
      '完成基础LED控制实验',
      '掌握定时器/计数器的使用',
      '了解A/D转换基本原理',
      '具备子程序设计能力'
    ],
    knowledgePoints: [
      'ADC0809工作原理与时序',
      '光敏电阻特性与应用',
      'PWM脉宽调制原理',
      '定时器生成PWM信号',
      'LCD1602接口与指令集',
      '阈值比较与自动控制',
      '定时器中断应用',
      '系统集成与调试方法'
    ],
    hardwareRequirements: [
      'ADC0809模数转换芯片',
      '光敏电阻传感器',
      '大功率LED灯珠',
      'MOSFET驱动电路',
      'LCD1602液晶显示屏',
      'Proteus仿真环境'
    ],
    // 端口位全部对自代码：P2.0=PWM 路灯输出（SETB 亮/CLR 灭），P3.6=ADC0809 启动脉冲，
    // P0=光照 ADC 数据读入（MOV A,P0）。代码没有独立的"光敏状态/自动模式"输出位，不硬造
    peripheral: {
      kind: 'bitpanel',
      label: 'P2/P3 · 智慧路灯',
      bitMap: [
        { port: 'P2', bit: 0, icon: 'lightbulb', label: '路灯 LED（PWM 调光）', onText: '点亮', offText: '熄灭' },
        { port: 'P3', bit: 6, icon: 'zap', label: 'ADC0809 启动脉冲', onText: '高电平', offText: '低电平' },
      ],
      buses: [{ port: 'P0', label: '光照 ADC 数据（输入）' }],
    },
    code: `; 项目二：智慧路灯系统设计
; 功能：光照采集 + PWM自动调光（核心控制回路；LCD显示为项目后续任务）
; 桂林航天工业学院 微控制器应用技术

ORG 0000H
    LJMP MAIN
ORG 000BH              ; 定时器0中断入口
    LJMP T0_ISR

ORG 0030H
MAIN:
    MOV SP, #60H
    ; 初始化定时器0（PWM生成）
    MOV TMOD, #01H      ; T0方式1
    MOV TH0, #0FCH      ; 1ms定时
    MOV TL0, #18H
    SETB ET0             ; 使能T0中断
    SETB EA              ; 开总中断
    SETB TR0             ; 启动T0

    MOV 30H, #128        ; PWM占空比（0-255）
    MOV 31H, #0          ; PWM计数器

MAIN_LOOP:
    ; 读取ADC0809
    ACALL READ_ADC       ; 返回值在A中
    MOV 32H, A           ; 保存光照值

    ; 根据光照自动调节PWM
    ; 光敏分压电路：光照越强ADC值越大；取反后环境越暗占空比越大
    CPL A                ; 取反：暗(值小)→大PWM，白天(值大)→灯灭
    MOV 30H, A           ; 更新占空比

    ACALL DELAY_100MS
    SJMP MAIN_LOOP

; 定时器0中断：PWM输出
T0_ISR:
    PUSH ACC             ; 保护现场——主循环的A随时可能被中断打断
    PUSH PSW
    MOV TH0, #0FCH      ; 重装1ms定时值
    MOV TL0, #18H
    INC 31H              ; PWM计数器+1
    MOV A, 31H
    CJNE A, 30H, PWM_CMP ; 比较只为产生CY标志（CY=1表示计数<占空比）
PWM_CMP:
    JC PWM_HIGH          ; 计数<占空比，输出高
    CLR P2.0             ; 输出低（LED灭）
    SJMP T0_EXIT
PWM_HIGH:
    SETB P2.0            ; 输出高（LED亮）
T0_EXIT:
    POP PSW              ; 恢复现场
    POP ACC
    RETI

READ_ADC:
    ; ADC0809读取（简化）
    CLR P3.6             ; 启动转换
    SETB P3.6
    NOP
    CLR P3.6
    ACALL DELAY_1MS      ; 等待转换
    MOV A, P0            ; 读取结果
    RET

DELAY_1MS:
    MOV R7, #250
    DJNZ R7, $
    RET

DELAY_100MS:
    MOV R6, #100
DL1: ACALL DELAY_1MS
    DJNZ R6, DL1
    RET

END`,
    expectedResults: [
      'ADC采集的光照值保存在32H，占空比（取反值）保存在30H，内存面板可实时观察',
      '环境越暗（模拟ADC值越小）输出占空比越大；本例低频会闪烁，不作为实物照明效果',
      'P2.0输出PWM：按12MHz计算，1ms×256档≈256ms周期，即约3.91Hz（未计中断开销）',
      'LCD1602数据显示属于项目后续任务，本程序聚焦"采集-决策-调光"核心回路'
    ],
    troubleshooting: [
      { issue: 'ADC读数不稳定', solution: '添加滤波算法（取平均值），检查参考电压' },
      { issue: 'LED出现可见闪烁', solution: '本例约3.91Hz用于观察时序；实物调光须重新设计PWM周期与分辨率，并测量实际频率及驱动电流' },
      { issue: 'LCD显示异常', solution: '检查初始化时序，确认RS/RW/E控制信号' }
    ],
    extensions: [
      '添加串口远程控制功能',
      '实现多段式亮度调节（夜间模式/节能模式）',
      '添加故障检测与报警功能',
      '设计基于RTC的定时开关灯功能'
    ]
  },
  {
    id: 'proj03',
    title: '项目三：智能小车运动控制系统设计',
    description: '综合型项目：以模拟串口命令和红外输入验证遥控、避障、循迹三种控制逻辑，观察L298N控制位；真实蓝牙连接、车速与循迹稳定性需在实物上验证。',
    category: '综合项目',
    difficulty: 'advanced',
    duration: 480,
    objectives: [
      '掌握L298N电机驱动模块的控制方法',
      '实现红外避障和红外循迹功能',
      '通过模拟串口命令验证遥控逻辑，再迁移至蓝牙模块',
      '设计多模式状态机实现模式切换',
      '综合运用定时器、中断和串口通信'
    ],
    prerequisites: [
      '完成定时器和中断实验',
      '掌握串口通信编程',
      '了解PWM调速原理',
      '具备模块化程序设计能力'
    ],
    knowledgePoints: [
      'L298N电机驱动原理',
      'PWM电机调速技术',
      '红外避障传感器接口',
      '红外循迹传感器应用',
      'HC-05蓝牙串口通信',
      '外部中断应用',
      '状态机编程方法',
      '系统综合调试技术'
    ],
    hardwareRequirements: [
      'L298N电机驱动模块',
      '2个直流减速电机',
      '红外避障传感器×2',
      '红外循迹传感器×3',
      'HC-05蓝牙模块',
      '小车底盘和轮子',
      'Proteus仿真环境'
    ],
    // 电机四路对自 FORWARD/BACKWARD/TURN_* 子程序：P2.0/P2.1=左电机正/反转，
    // P2.2/P2.3=右电机正/反转（SETB 导通）。循迹传感器读 P1 低3位（TRACK_MODE，
    // 低电平=检测到黑线）。代码没有蜂鸣器输出位，不列
    peripheral: {
      kind: 'bitpanel',
      label: 'P2/P1 · 智能小车',
      bitMap: [
        { port: 'P2', bit: 0, icon: 'arrow-up', label: '左电机正转 IN1', onText: '导通', offText: '关断' },
        { port: 'P2', bit: 1, icon: 'arrow-down', label: '左电机反转 IN2', onText: '导通', offText: '关断' },
        { port: 'P2', bit: 2, icon: 'arrow-up', label: '右电机正转 IN3', onText: '导通', offText: '关断' },
        { port: 'P2', bit: 3, icon: 'arrow-down', label: '右电机反转 IN4', onText: '导通', offText: '关断' },
        { port: 'P1', bit: 0, icon: 'radio', label: '循迹传感器·左', activeLow: true, onText: '检测到黑线', offText: '未检测' },
        { port: 'P1', bit: 1, icon: 'radio', label: '循迹传感器·中', activeLow: true, onText: '检测到黑线', offText: '未检测' },
        { port: 'P1', bit: 2, icon: 'radio', label: '循迹传感器·右', activeLow: true, onText: '检测到黑线', offText: '未检测' },
      ],
      motion: { lf: ['P2', 0], lr: ['P2', 1], rf: ['P2', 2], rr: ['P2', 3] },
    },
    code: `; 项目三：智能小车运动控制系统
; 功能：遥控模式 + 避障模式 + 循迹模式
; 桂林航天工业学院 微控制器应用技术

ORG 0000H
    LJMP MAIN
ORG 0003H              ; 外部中断0（左避障）
    LJMP EXT0_ISR
ORG 0013H              ; 外部中断1（右避障）
    LJMP EXT1_ISR
ORG 0023H              ; 串口中断（蓝牙）
    LJMP UART_ISR

ORG 0030H
MAIN:
    MOV SP, #60H
    ; 初始化串口（经典12T、11.0592MHz，9600bit/s）
    ANL PCON, #7FH      ; SMOD=0
    MOV TMOD, #21H      ; T1方式2，T0方式1
    MOV TH1, #0FDH      ; 9600bps@11.0592MHz
    MOV TL1, #0FDH
    MOV SCON, #50H      ; 串口方式1，允许接收
    SETB TR1             ; 启动T1

    MOV 30H, #0          ; 运行模式（0=遥控,1=避障,2=循迹）
    MOV 31H, #'S'        ; 初始停止命令
    ACALL STOP_CAR       ; 初始电机输出关断
    SETB IT0            ; 左避障下降沿触发
    SETB IT1            ; 右避障下降沿触发
    MOV IE, #95H         ; 初始化完成再使能 EA、ES、EX1、EX0

MAIN_LOOP:
    MOV A, 30H
    CJNE A, #0, CHK_MODE1
    ACALL REMOTE_MODE    ; 遥控模式
    SJMP MAIN_LOOP
CHK_MODE1:
    CJNE A, #1, CHK_MODE2
    ACALL AVOID_MODE     ; 避障模式
    SJMP MAIN_LOOP
CHK_MODE2:
    ACALL TRACK_MODE     ; 循迹模式
    SJMP MAIN_LOOP

; 遥控模式处理
REMOTE_MODE:
    MOV A, 31H           ; 读取蓝牙命令
    CJNE A, #'F', RC1
    ACALL FORWARD         ; 前进
    RET
RC1: CJNE A, #'B', RC2
    ACALL BACKWARD        ; 后退
    RET
RC2: CJNE A, #'L', RC3
    ACALL TURN_LEFT       ; 左转
    RET
RC3: CJNE A, #'R', RC4
    ACALL TURN_RIGHT      ; 右转
    RET
RC4: ACALL STOP_CAR       ; 停止
    RET

; 电机控制子程序
FORWARD:
    SETB P2.0            ; 左电机正转
    CLR P2.1
    SETB P2.2            ; 右电机正转
    CLR P2.3
    RET

BACKWARD:
    CLR P2.0
    SETB P2.1
    CLR P2.2
    SETB P2.3
    RET

TURN_LEFT:
    CLR P2.0             ; 左电机停
    CLR P2.1
    SETB P2.2            ; 右电机正转
    CLR P2.3
    RET

TURN_RIGHT:
    SETB P2.0            ; 左电机正转
    CLR P2.1
    CLR P2.2             ; 右电机停
    CLR P2.3
    RET

STOP_CAR:
    CLR P2.0
    CLR P2.1
    CLR P2.2
    CLR P2.3
    RET

; 避障模式
AVOID_MODE:
    ACALL FORWARD
    RET

; 循迹模式
TRACK_MODE:
    MOV A, P1            ; 读取循迹传感器
    ANL A, #07H          ; 取低3位
    CJNE A, #05H, TK1   ; 101=中传感器低电平，直行
    ACALL FORWARD
    RET
TK1: CJNE A, #06H, TK2  ; 110=左传感器检测到(偏右)，应左转修正
    ACALL TURN_LEFT
    RET
TK2: CJNE A, #03H, TK3  ; 011=右传感器检测到(偏左)，应右转修正
    ACALL TURN_RIGHT
    RET
TK3: ACALL STOP_CAR
    RET

; 外部中断0：左侧检测到障碍
EXT0_ISR:
    PUSH ACC
    PUSH PSW
    MOV A, 30H
    CJNE A, #1, EX0_EXIT ; 仅避障模式响应
    ACALL TURN_RIGHT
    ACALL DELAY_500MS
EX0_EXIT:
    POP PSW
    POP ACC
    RETI

; 外部中断1：右侧检测到障碍
EXT1_ISR:
    PUSH ACC
    PUSH PSW
    MOV A, 30H
    CJNE A, #1, EX1_EXIT
    ACALL TURN_LEFT
    ACALL DELAY_500MS
EX1_EXIT:
    POP PSW
    POP ACC
    RETI

; 串口中断：接收蓝牙命令
UART_ISR:
    PUSH ACC
    PUSH PSW
    JNB RI, UI_EXIT
    CLR RI
    MOV A, SBUF
    MOV 31H, A           ; 保存命令
    ; 检查模式切换命令
    CJNE A, #'0', UI1
    MOV 30H, #0          ; 切换遥控模式
    SJMP UI_EXIT
UI1: CJNE A, #'1', UI2
    MOV 30H, #1          ; 切换避障模式
    SJMP UI_EXIT
UI2: CJNE A, #'2', UI_EXIT
    MOV 30H, #2          ; 切换循迹模式
UI_EXIT:
    CLR TI
    POP PSW
    POP ACC
    RETI

; 名称沿用模板；本循环125753机器周期（不含ACALL），经典12T/11.0592MHz约136.451ms。
; 平台按指令推进，不能用播放速度判定实物避障响应时间。
DELAY_500MS:
    MOV R5, #250
DS1: MOV R6, #250
DS2: DJNZ R6, DS2
    DJNZ R5, DS1
    RET

END`,
    expectedResults: [
      '画布发送F/B/L/R/S模拟串口命令，观察前进、后退、左转、右转、停止控制位',
      '发送1进入避障模式，点击左右避障输入，观察相反方向转向后恢复直行',
      '发送2进入循迹模式，切换左/中/右或无黑线输入，核对转向、直行、停止',
      '发送0/1/2切换遥控、避障、循迹模式；实物运动和真实蓝牙连接另行验证'
    ],
    troubleshooting: [
      { issue: '电机不转', solution: '检查L298N使能引脚和电源供电，确认控制信号电平' },
      { issue: '避障反应迟钝', solution: '调整红外传感器灵敏度，优化中断响应时间' },
      { issue: '循迹偏移严重', solution: '调整传感器间距和阈值，增加PID调节算法' },
      { issue: '蓝牙连接不上', solution: '检查HC-05波特率设置，确认AT指令配置正确' }
    ],
    extensions: [
      '添加超声波测距避障',
      '实现PID循迹算法提高精度',
      '添加速度反馈闭环控制',
      '设计手机APP遥控界面'
    ]
  },
  {
    id: 'proj04',
    title: '项目四：智慧农业大棚监控系统设计',
    description: '综合项目：DS18B20/DHT11 虚拟传感器按真实总线协议应答，温湿度由大棚环境模型实时演化；完成采集、阈值报警和串口JSON上报，通风执行器可形成闭环。LCD仅保留未实现接口，EEPROM属于后续扩展，不计入本轮完成判定。',
    category: '综合项目',
    difficulty: 'advanced',
    duration: 240,
    objectives: [
      '掌握DS18B20单总线温度传感器的驱动编程',
      '实现DHT11温湿度传感器的数据采集',
      '识别LCD1602后续任务边界（UPDATE_LCD当前为空，不计入本轮完成）',
      '设计基于串口的JSON格式数据上传',
      '了解AT24C02 EEPROM扩展接口（当前程序未实现，不计入本轮完成）',
      '设计阈值报警系统'
    ],
    prerequisites: [
      '核心必备：完成exp09串口通信实验',
      '核心必备：能配置定时器/中断并解释周期采集流程',
      '核心必备：能说明DS18B20与DHT11在当前仿真中的模拟输入边界',
      '扩展准备（非完成前置）：了解I2C、LCD1602与AT24C02基础'
    ],
    knowledgePoints: [
      'DS18B20单总线协议',
      '温度数据转换与处理',
      'DHT11通信时序',
      '湿度数据解析',
      'LCD1602多行显示（后续任务）',
      'UART数据帧格式设计',
      'AT24C02 I2C读写（扩展项）',
      '阈值比较与蜂鸣器报警',
      '传感器异常的容错处理',
      '系统可靠性设计'
    ],
    hardwareRequirements: [
      'DS18B20温度传感器',
      'DHT11温湿度传感器',
      'LCD1602液晶显示屏（后续任务，非本轮必需）',
      'AT24C02 EEPROM存储芯片（扩展选配，非本轮必需）',
      '蜂鸣器报警模块',
      '继电器控制模块',
      'USB转TTL串口模块',
      'Proteus仿真环境'
    ],
    // 端口位对自代码 EQU 定义：BEEP=P3.5（SETB=报警），DQ=P3.7（DS18B20 单总线）。
    // 风机/水泵/补光仅出现在拓展方向、代码中无对应输出位，不硬造；串口 JSON 上报如实显示
    peripheral: {
      kind: 'bitpanel',
      label: 'P3 · 智慧大棚',
      bitMap: [
        { port: 'P3', bit: 3, icon: 'zap', label: '通风风机 FAN（扩展）', onText: '通风中', offText: '关闭' },
        { port: 'P3', bit: 4, icon: 'radio', label: 'DHT11 数据线', onText: '高电平', offText: '低电平' },
        { port: 'P3', bit: 5, icon: 'alert', label: '蜂鸣器报警 BEEP', onText: '报警中', offText: '静音' },
        { port: 'P3', bit: 7, icon: 'thermometer', label: 'DS18B20 单总线 DQ', onText: '高电平', offText: '低电平' },
      ],
      showUartTail: true,
    },
    code: `; 项目四：智慧农业大棚监控系统
; 功能：温湿度采集 + 串口JSON上报 + 阈值报警（LCD驱动为项目后续任务，UPDATE_LCD留出接口）
; 传感器：DS18B20(P3.7 1-Wire) + DHT11(P3.4 单总线)——仿真环境模型实时供电，
;         温度/湿度随大棚工况演化，环境面板可切换场景、通风(P3.3)可降温
; 桂林航天工业学院 微控制器应用技术

DQ    EQU P3.7           ; DS18B20数据线
DHT   EQU P3.4           ; DHT11数据线
FAN   EQU P3.3           ; 通风风机（扩展执行器，SETB=开启降温）
BEEP  EQU P3.5           ; 蜂鸣器
TEMP_H EQU 40H           ; 温度高字节
TEMP_L EQU 41H           ; 温度低字节
HUMI   EQU 42H           ; 湿度值
ALARM  EQU 43H           ; 报警标志
DTEMP  EQU 44H           ; DHT11回报温度（可与DS18B20读数对照）
DBUF   EQU 50H           ; DHT11接收缓冲 50H-54H

ORG 0000H
    LJMP MAIN
ORG 000BH
    LJMP T0_ISR          ; 定时器0：定时采集

ORG 0030H
MAIN:
    MOV SP, #60H
    ; 串口参考参数：经典12T、11.0592MHz、SMOD=0时9600bit/s
    ; 本示例传感器与T0延时另按12MHz演示，真机移植需统一晶振并重算
    ANL PCON, #7FH
    MOV TMOD, #21H
    MOV TH1, #0FDH
    MOV TL1, #0FDH
    MOV SCON, #50H
    SETB TR1

    ; 初始化定时器0（2s采集周期）
    MOV TH0, #3CH
    MOV TL0, #0B0H
    SETB ET0
    SETB EA
    SETB TR0

    MOV ALARM, #0

MAIN_LOOP:
    ACALL READ_DS18B20   ; 读取温度
    ACALL READ_DHT11     ; 读取湿度
    ACALL UPDATE_LCD     ; 后续接口：当前为空，不产生LCD显示
    ACALL CHECK_ALARM    ; 检查阈值报警
    ACALL SEND_DATA      ; 串口上报数据
    ACALL DELAY_2S       ; 等待下次采集
    SJMP MAIN_LOOP

; DS18B20温度读取
READ_DS18B20:
    ACALL OW_RESET       ; 复位总线
    MOV A, #0CCH         ; 跳过ROM
    ACALL OW_WRITE
    MOV A, #44H          ; 启动温度转换
    ACALL OW_WRITE
    ACALL DELAY_750MS    ; 等待转换完成

    ACALL OW_RESET
    MOV A, #0CCH
    ACALL OW_WRITE
    MOV A, #0BEH         ; 读暂存器
    ACALL OW_WRITE
    ACALL OW_READ        ; 读低字节
    MOV TEMP_L, A
    ACALL OW_READ        ; 读高字节
    MOV TEMP_H, A

    ; 仿真平台没有DS18B20实体，总线读回全1（FFFFH）；
    ; 此时代入模拟温度25.0°C（0190H=25×16），保证采集/上报链路可观察。
    ; 接入真实硬件时删除以下检测段即可
    MOV A, TEMP_H
    ANL A, TEMP_L
    CJNE A, #0FFH, READ_T_DONE
    MOV TEMP_H, #01H
    MOV TEMP_L, #90H
READ_T_DONE:
    RET

; 单总线复位（含存在检测）：复位低脉冲→释放→等器件存在脉冲结束
OW_RESET:
    CLR DQ
    MOV R7, #200         ; 480us低电平
    DJNZ R7, $
    SETB DQ
    MOV R7, #30          ; 等存在脉冲拉低（无器件则超时跳过）
OW_PRES_W:
    JNB DQ, OW_PRES_L
    DJNZ R7, OW_PRES_W
    SJMP OW_R_DONE       ; 无应答：兼容无传感器环境
OW_PRES_L:
    MOV R7, #250
OW_PRES_H:
    JB DQ, OW_PRES_END   ; 存在脉冲结束回高
    DJNZ R7, OW_PRES_H
    SJMP OW_R_DONE
OW_PRES_END:
    MOV R7, #10          ; 恢复间隔
    DJNZ R7, $
OW_R_DONE:
    RET

; 单总线写字节
OW_WRITE:
    MOV R6, #8
OW_WR_BIT:
    RRC A                ; 取最低位到CY
    CLR DQ               ; 拉低
    NOP
    MOV DQ, C            ; 写入位
    MOV R7, #25
    DJNZ R7, $           ; 60us时隙
    SETB DQ
    NOP
    DJNZ R6, OW_WR_BIT
    RET

; 单总线读字节
OW_READ:
    MOV R6, #8
OW_RD_BIT:
    CLR DQ
    NOP
    SETB DQ
    NOP
    NOP
    MOV C, DQ            ; 采样
    RRC A
    MOV R7, #25
    DJNZ R7, $
    DJNZ R6, OW_RD_BIT
    RET

; DHT11读取（真实单总线协议）：起始信号→80+80应答→40bit(湿度+温度+校验)
READ_DHT11:
    ; 主机起始信号：拉低约18ms
    CLR DHT
    MOV R5, #72
DHT_START_DLY:
    MOV R6, #250
    DJNZ R6, $
    DJNZ R5, DHT_START_DLY
    SETB DHT
    MOV R7, #20          ; 释放后等待器件应答
    DJNZ R7, $
    ; 等应答低电平(80us)
    MOV R6, #200
DHT_W_L:
    JNB DHT, DHT_GOT_L
    DJNZ R6, DHT_W_L
    SJMP DHT_FAIL        ; 超时无应答→容错
DHT_GOT_L:
    ; 等应答低电平结束（转高80us）
    MOV R6, #200
DHT_W_H:
    JB DHT, DHT_GOT_H
    DJNZ R6, DHT_W_H
    SJMP DHT_FAIL
DHT_GOT_H:
    ; 等应答高电平结束（首位数据的50us低电平开始）
    MOV R6, #200
DHT_W_D:
    JNB DHT, DHT_GOT_D
    DJNZ R6, DHT_W_D
    SJMP DHT_FAIL
DHT_GOT_D:
    MOV R2, #40          ; 40bit
    MOV R0, #DBUF        ; 接收缓冲 50H..54H
DHT_BIT:
    ; 等位周期低电平(50us)结束→转高
    MOV R6, #120
DHT_B_L:
    JB DHT, DHT_B_HI
    DJNZ R6, DHT_B_L
    SJMP DHT_FAIL
DHT_B_HI:
    ; 测高电平脉宽：0→28us(约14迭代) / 1→70us(约35迭代)；带超时保护
    MOV R3, #0
    MOV R5, #80
DHT_CNT:
    INC R3
    JNB DHT, DHT_CNT_END
    DJNZ R5, DHT_CNT
    SJMP DHT_FAIL        ; 高电平异常持续→容错
DHT_CNT_END:
    MOV A, R3
    CLR C
    SUBB A, #22          ; 阈值居中：>=22判1，否则0
    CPL C                ; C=1表示1位
    MOV A, @R0
    RLC A                ; MSB先，逐位左移入缓冲
    MOV @R0, A
    DJNZ R2, DHT_NEXT
    SJMP DHT_CHK
DHT_NEXT:
    MOV A, R2
    ANL A, #7
    JNZ DHT_BIT
    INC R0               ; 每收满8bit换下一字节
    SJMP DHT_BIT
DHT_CHK:
    ; 校验和 = 前4字节和 &0xFF（DBUF=50H..54H 直接寻址）
    MOV A, 50H
    ADD A, 51H
    ADD A, 52H
    ADD A, 53H
    CJNE A, 54H, DHT_FAIL
    MOV HUMI, 50H        ; 湿度整数位
    MOV DTEMP, 52H       ; DHT回报温度
    SJMP DHT_DONE
DHT_FAIL:
    ; 容错：保留上次有效湿度值（遥测帧标记由上层判断）
DHT_DONE:
    RET

; 检查报警阈值（30度 = 01E0H）
CHECK_ALARM:
    CLR C
    MOV A, TEMP_L
    SUBB A, #0E0H       ; 比较低字节
    MOV A, TEMP_H
    SUBB A, #01H        ; 比较高字节
    JNC HIGH_TEMP       ; 结果>=0 表示温度>=30度
    CLR BEEP             ; 温度正常，关闭蜂鸣器
    MOV ALARM, #0
    RET
HIGH_TEMP:
    SETB BEEP            ; 温度过高，蜂鸣器报警
    MOV ALARM, #1
    RET

; 串口发送数据（简化JSON格式）
SEND_DATA:
    MOV DPTR, #JSON_HEAD
    ACALL SEND_STR       ; 发送{"temp":
    ; 将DS18B20原始值转换为实际温度（除以16）
    MOV A, TEMP_L
    MOV B, #16
    DIV AB              ; TEMP_L / 16
    MOV R0, A           ; 保存商
    MOV A, TEMP_H
    MOV B, #16
    MUL AB              ; TEMP_H * 16
    ADD A, R0           ; 合并得到整数温度值
    ACALL SEND_NUM       ; 发送温度值
    MOV DPTR, #JSON_MID
    ACALL SEND_STR       ; 发送,"humi":
    MOV A, HUMI
    ACALL SEND_NUM       ; 发送湿度值
    MOV A, #'}'
    ACALL SEND_BYTE
    MOV A, #0DH          ; 回车
    ACALL SEND_BYTE
    MOV A, #0AH          ; 换行
    ACALL SEND_BYTE
    RET

SEND_STR:
    CLR A
    MOVC A, @A+DPTR
    JZ SEND_STR_END
    ACALL SEND_BYTE
    INC DPTR
    SJMP SEND_STR
SEND_STR_END:
    RET

SEND_BYTE:
    MOV SBUF, A
    JNB TI, $
    CLR TI
    RET

SEND_NUM:
    MOV B, #10
    DIV AB
    ADD A, #30H
    ACALL SEND_BYTE
    MOV A, B
    ADD A, #30H
    ACALL SEND_BYTE
    RET

UPDATE_LCD:
    ; 空接口：LCD驱动尚未集成，不计入本轮完成判定
    RET

T0_ISR:
    MOV TH0, #3CH
    MOV TL0, #0B0H
    RETI

DELAY_750MS:
    MOV R5, #3
DL3: MOV R6, #250
DL4: MOV R7, #250
DL5: DJNZ R7, DL5
    DJNZ R6, DL4
    DJNZ R5, DL3
    RET

DELAY_2S:
    MOV R4, #8
DL6: ACALL DELAY_750MS
    DJNZ R4, DL6
    RET

JSON_HEAD: DB '{"temp":', 0
JSON_MID:  DB ',"humi":', 0

END`,
    expectedResults: [
      'DS18B20单总线时序完整执行（复位-跳过ROM-启动转换-读暂存器），虚拟器件按真实协议应答存在脉冲并回送暂存器数据',
      'DHT11 单总线读取：主机起始信号→80+80应答→40bit湿度/温度/校验和，校验失败时保留上次有效值',
      '温度原始值在40H-41H（=环境模型温度×16）、DHT湿度在42H、DHT回报温度在44H，内存面板可观察；环境面板可切换大棚工况',
      '串口每2秒发送JSON格式数据：{"temp":<环境实时温度>,"humi":<环境实时湿度>}，数值随环境模型演化非固定',
      '默认工况约25°C低于30°C阈值蜂鸣器静音；将环境切换至"午间高温"场景后温度超阈，蜂鸣器置位报警（P3.5=1）',
      '程序持续循环且未出现故障属于正确状态；观察到完整遥测帧并手动停止后可提交本轮结果（LCD驱动尚未实现，EEPROM仅为扩展项）'
    ],
    troubleshooting: [
      { issue: 'DS18B20读取失败', solution: '检查4.7kΩ上拉电阻，验证单总线时序是否正确' },
      { issue: '温度数据不准确', solution: '检查温度转换公式，注意正负温度的处理' },
      { issue: '串口输出乱码', solution: '确认波特率设置匹配，检查晶振频率' },
      { issue: '扩展项：EEPROM读写错误', solution: '检查I2C时序，确认设备地址和ACK应答；该项不影响本轮完成判定' }
    ],
    extensions: [
      '添加WiFi模块实现远程监控',
      '设计上位机监控软件',
      '实现LCD1602显示并单独验证初始化与刷新时序',
      '实现AT24C02数据存储与历史趋势显示，并单独验证掉电恢复',
      '添加继电器控制风扇/加热器',
      '设计多节点组网监控系统'
    ]
  }
];

// 导出实验配置数组，用于测试和其他模块
export const experiments = experimentConfigs;

/**
 * 课程正式实验目录。统计、导出和种子数据只能使用这一份编号集，
 * 避免已下线或未实现的编号进入教学成效指标。
 */
export const OFFICIAL_EXPERIMENT_IDS = Object.freeze(
  experimentConfigs.map((experiment) => experiment.id),
);

/**
 * 根据实验ID获取实验配置
 */
export function getExperimentConfig(id: string): ExperimentConfig | undefined {
  return experimentConfigs.find(config => config.id === id);
}

/**
 * 根据分类获取实验列表
 */
export function getExperimentsByCategory(category: string): ExperimentConfig[] {
  return experimentConfigs.filter(config => config.category === category);
}

/**
 * 根据难度获取实验列表
 */
export function getExperimentsByDifficulty(difficulty: 'basic' | 'intermediate' | 'advanced'): ExperimentConfig[] {
  return experimentConfigs.filter(config => config.difficulty === difficulty);
}

/**
 * 获取所有实验分类
 */
export function getAllCategories(): string[] {
  const categories = experimentConfigs.map(config => config.category);
  return [...new Set(categories)];
}

/**
 * 获取实验的前置要求检查
 */
export function checkPrerequisites(experimentId: string, completedExperiments: string[]): {
  satisfied: boolean;
  missing: string[];
} {
  const config = getExperimentConfig(experimentId);
  if (!config) {
    return { satisfied: false, missing: ['实验不存在'] };
  }

  // 这里可以根据需要实现更复杂的前置条件检查逻辑
  // 目前简化为基础检查
  const missing: string[] = [];
  
  if (config.difficulty === 'intermediate' && !completedExperiments.includes('exp01')) {
    missing.push('需要先完成基础指令实验');
  }
  
  if (config.difficulty === 'advanced' && completedExperiments.length < 2) {
    missing.push('需要先完成至少2个基础实验');
  }

  return {
    satisfied: missing.length === 0,
    missing
  };
}

// 为了兼容性，已在上面导出experiments，无需重复导出

const observedBytes = z.array(z.number().int().min(0).max(255)).max(256);
const experimentObservationSchema = z.object({
  version: z.literal(1),
  steps: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  portValues: z.object({ P0: observedBytes, P1: observedBytes, P2: observedBytes, P3: observedBytes }),
  ramValues: z.object({ '20': observedBytes, '21': observedBytes, '30': observedBytes, '32': observedBytes }),
  adcPwmPairs: z.array(z.object({ adc: z.number().int().min(0).max(255), duty: z.number().int().min(0).max(255) })).max(256),
  timerOverflows: z.object({ T0: z.number().int().nonnegative(), T1: z.number().int().nonnegative() }),
  uartText: z.string().max(512),
  buzzerFrequencyHz: z.number().finite().nonnegative(),
});

export type ExperimentObservationEvidence = z.infer<typeof experimentObservationSchema>;
type ExperimentObservationState = {
  portValues: Record<PortName, number>;
  ram: ArrayLike<number>;
  timers: { overflowCount0: number; overflowCount1: number };
  uart: { transmitBuffer: string };
  buzzer: { frequency: number };
};

export const EXPERIMENT_OBSERVATION_MIN_STEPS = 20;
// A small prime-sized batch limits skipped output states without storing an unbounded trace.
export const EXPERIMENT_OBSERVATION_SAMPLE_STEPS = 257;

export function createExperimentObservation(): ExperimentObservationEvidence {
  return {
    version: 1, steps: 0,
    portValues: { P0: [], P1: [], P2: [], P3: [] },
    ramValues: { '20': [], '21': [], '30': [], '32': [] },
    adcPwmPairs: [], timerOverflows: { T0: 0, T1: 0 }, uartText: '', buzzerFrequencyHz: 0,
  };
}

/** Records only states reached after executed instructions; editing and reset begin a new observation. */
export function collectExperimentObservation(
  previous: ExperimentObservationEvidence,
  state: ExperimentObservationState,
  executed: number,
): ExperimentObservationEvidence {
  if (!Number.isSafeInteger(executed) || executed <= 0) return previous;
  const add = (values: number[], value: number): number[] => values.includes(value) ? values : [...values, value];
  const pair = { adc: state.ram[0x32] ?? 0, duty: state.ram[0x30] ?? 0 };
  const adcPwmPairs = previous.adcPwmPairs.some((item) => item.adc === pair.adc && item.duty === pair.duty)
    ? previous.adcPwmPairs : [...previous.adcPwmPairs.slice(-255), pair];
  return {
    version: 1,
    steps: previous.steps + executed,
    portValues: {
      P0: add(previous.portValues.P0, state.portValues.P0), P1: add(previous.portValues.P1, state.portValues.P1),
      P2: add(previous.portValues.P2, state.portValues.P2), P3: add(previous.portValues.P3, state.portValues.P3),
    },
    ramValues: {
      '20': add(previous.ramValues['20'], state.ram[0x20] ?? 0),
      '21': add(previous.ramValues['21'], state.ram[0x21] ?? 0),
      '30': add(previous.ramValues['30'], state.ram[0x30] ?? 0),
      '32': add(previous.ramValues['32'], state.ram[0x32] ?? 0),
    },
    adcPwmPairs,
    timerOverflows: {
      T0: Math.max(previous.timerOverflows.T0, state.timers.overflowCount0),
      T1: Math.max(previous.timerOverflows.T1, state.timers.overflowCount1),
    },
    uartText: state.uart.transmitBuffer.slice(-512),
    buzzerFrequencyHz: Math.max(previous.buzzerFrequencyHz, state.buzzer.frequency),
  };
}

export type ExperimentObservationValidation = { ok: true; summary: string } | { ok: false; error: string };

/** Output observations are evidence of this simulation run, not proof of hardware performance or learning mastery. */
export function validateExperimentObservation(experimentId: string, input: unknown): ExperimentObservationValidation {
  const parsed = experimentObservationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: '本轮输出观测记录不完整，请重新运行并观察对应输出。' };
  const observation = parsed.data;
  const { portValues: ports, ramValues: ram, timerOverflows: timers } = observation;
  const distinct = (values: number[]): number[] => [...new Set(values)];
  const hasBothLevels = (port: PortName, bit: number): boolean => distinct(ports[port].map((value) => (value >> bit) & 1)).length === 2;
  const walkingLedCount = distinct(ports.P1.filter((value) => {
    const lit = (~value) & 0xff;
    return lit !== 0 && (lit & (lit - 1)) === 0;
  })).length;
  const digitSelections = distinct(ports.P2.map((value) => value & 0xf0).filter((value) => [0xe0, 0xd0, 0xb0, 0x70].includes(value)));
  const segmentCodes = distinct(ports.P0.filter((value) => [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f].includes(value)));
  let ready = false;
  let requirement = '';
  switch (experimentId) {
    case 'exp01':
      ready = walkingLedCount >= 8;
      requirement = '观察 P1 的 8 种单灯点亮图样；点亮顺序需结合运行过程另行核对';
      break;
    case 'exp03':
      ready = timers.T0 >= 2 && hasBothLevels('P0', 0);
      requirement = '观察 T0 至少两次溢出，以及 P0.0 实际出现高、低两种电平';
      break;
    case 'exp04':
      ready = digitSelections.length === 4 && segmentCodes.length > 0;
      requirement = '观察 P2.4–P2.7 四种位选状态，以及 P0 输出有效段码';
      break;
    case 'exp05':
      ready = ram['21'].some((value) => value > 0) && ram['20'].some((value) => value <= 3 && ports.P0.includes(value));
      requirement = '在画布按下一个独立按键，观察有效按键次数增加及 P0 输出对应的 0–3 键值；释放与再次按下需另行检查';
      break;
    case 'exp06':
      ready = timers.T0 >= 2 && timers.T1 >= 2 && digitSelections.length === 4 && segmentCodes.length > 0;
      requirement = '观察 T0、T1 均至少两次溢出，以及四个位选和有效段码输出';
      break;
    case 'exp07':
      ready = timers.T0 >= 2 && observation.buzzerFrequencyHz > 0;
      requirement = '观察定时器至少两次溢出，并由 P2.0 实际翻转形成非零蜂鸣器频率';
      break;
    case 'exp08': {
      const phases = distinct(ports.P1.map((value) => value & 0xf0).filter((value) => [0x10, 0x30, 0x20, 0x60, 0x40, 0xc0, 0x80, 0x90].includes(value)));
      ready = phases.length >= 4;
      requirement = '点击启停键启动电机，观察 P1 高四位至少四种有效励磁图样；相序和方向需另行核对';
      break;
    }
    case 'exp09':
      ready = observation.uartText.includes('HELLO WORLD!');
      requirement = '在串口终端观察完整的 HELLO WORLD! 发送结果';
      break;
    case 'proj01':
      ready = walkingLedCount >= 8 && segmentCodes.length >= 2;
      requirement = '观察 P1 的 8 种单灯图样和至少两种 P0 数码管段码';
      break;
    case 'proj02':
      ready = timers.T0 >= 2 && hasBothLevels('P2', 0) && observation.adcPwmPairs.some(({ adc, duty }) => adc + duty === 255 && duty > 0 && duty < 255);
      requirement = '调节模拟光照输入，使同次 ADC 值与占空比相加为 255 且占空比在 1–254 之间，观察 T0 溢出及 P2.0 高低 PWM 输出；0/255 边界仅作静态关/开观察';
      break;
    case 'proj03': {
      const motorStates = distinct(ports.P2.map((value) => value & 0x0f).filter((value) => [0, 1, 4, 5, 10].includes(value)));
      ready = motorStates.length >= 2 && motorStates.some((value) => value !== 0);
      requirement = '在画布发送 F、B、L、R 或 S 模拟串口命令，触发至少两种有效电机控制状态，并观察 P2.0–P2.3；仅等待命令尚不构成运动观测';
      break;
    }
    default:
      return { ok: false, error: '该实验使用独立的专题完成条件。' };
  }
  if (observation.steps < EXPERIMENT_OBSERVATION_MIN_STEPS || !ready) {
    return { ok: false, error: `请先无故障执行至少 ${EXPERIMENT_OBSERVATION_MIN_STEPS} 条指令，并${requirement}。` };
  }
  return { ok: true, summary: '本轮仿真输出观测已满足，可保存运行记录；学习目标与实物性能仍需另行评价。' };
}
