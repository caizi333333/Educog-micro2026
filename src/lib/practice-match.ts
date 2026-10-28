/**
 * Reusable drag-or-tap match boards for courseware practice.
 *
 * The shell is the same for every chapter: chips on one side, fixed slots
 * on the other, graded by pair id. A board with `zones` draws those slots
 * as a structure puzzle; grading, cooldown, and medals stay on this path.
 * Boards shipped so far:
 * - unit 2 memory regions (note `u2-memory`, anchor `#memory`)
 * - unit 2 CPU structure puzzle (note `u2-cpu-structure`, anchor `#cpu`)
 * - unit 2 external bus roles (note `u2-bus`, anchor `#bus`)
 * - unit 5 `SRC` table (overview pane ③ and the classroom page)
 * - unit 5 interrupt vectors (overview `#int-2`; addresses from the 入口地址 line)
 * - unit 5 IE source enables (overview `#int-5`; EX0/ET0/EX1/ET1/ES, not EA)
 * - unit 5 TCON run, overflow, and trigger bits (overview `#int-4`; not IE0/IE1)
 * - unit 5 IP priority bits (overview `#int-6`; PX0/PT0/PX1/PT1/PS, not D7–D5)
 * - unit 5 timer `TMOD` fields (overview `#tmr-hand`, 动手练③)
 * - unit 3 overview `#addressing` tab ①, the seven `var DZ` reveals
 * - unit 4 instruction teams (note `u4-classroom`, anchor `#s-map`)
 * A later chapter adds another `MatchBoard` and a catalog row whose
 * criteria.type is `practice_clears:<board id>`. 「连对三次」and「今天练过了」
 * already apply to every board; they do not need a new row.
 *
 * Grading stays in this module so the browser and the API share one answer
 * key. Points, cooldown, and medals are decided here and written by
 * `practice-match-record.ts`.
 */
import { POINTS_CONFIG } from '@/lib/points-system';

export const MATCH_CLEAR_EVENT = 'PRACTICE_CLEAR';

export interface MatchPair {
  id: string;
  /** Student-facing chip, for example 外部中断 0. */
  prompt: string;
  promptHint: string;
  /** Slot label, the request flag or the empty place on a diagram. */
  target: string;
  targetDetail: string;
}

/** One region of a structure puzzle. Slot ids are pair ids. */
export interface PuzzleZone {
  id: string;
  title: string;
  slotIds: readonly string[];
}

/** Student-facing words for the shared cell. Each board fills these in. */
export interface MatchBoardShell {
  ariaLabel: string;
  sectionLink: string;
  expandClosed: string;
  promptSide: string;
  targetSide: string;
  /** Follows `prompt`. The cell appends the first-clear point sentence. */
  actionHint: string;
  emptyTray: string;
  /** Slot button name: `${slotName} ${target}，${detail}，空位`. */
  slotName: string;
  /** Caption on a structure puzzle. Column boards leave this unset. */
  diagramTitle?: string;
}

export interface MatchBoard {
  id: string;
  title: string;
  prompt: string;
  /** Shown after a miss. Does not list the full mapping. */
  hint: string;
  chapterId: string;
  knowledgePointId: string;
  sectionId: string;
  moduleId: string;
  medalId: string;
  firstClearPoints: number;
  cooldownMs: number;
  shell: MatchBoardShell;
  pairs: readonly MatchPair[];
  /** When set, the cell draws a diagram instead of two columns. */
  zones?: readonly PuzzleZone[];
}

/**
 * 80C51 interrupt source → request flag.
 * Order matches the courseware: 外0、定0、外1、定1、串口.
 * IE0 is the flag bit; IE is the register name. Serial flags live in SCON.
 */
export const INTERRUPT_SOURCE_FLAG_BOARD: MatchBoard = {
  id: 'u5-interrupt-source-flags',
  title: '中断源 ↔ 请求标志',
  prompt: '把 80C51 的 5 个中断源对上各自的请求标志。',
  hint: '串口的标志 RI、TI 在 SCON，其余 4 个在 TCON。IE0 是标志位，IE 是寄存器名。',
  chapterId: '5',
  knowledgePointId: '5.2',
  sectionId: 'int-3',
  moduleId: 'u5-overview',
  medalId: 'interrupt_source_flags',
  firstClearPoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
  cooldownMs: 10 * 60 * 1000,
  shell: {
    ariaLabel: '练一练：中断源对请求标志',
    sectionLink: '对照课件③',
    expandClosed: '展开练一练：中断源对请求标志',
    promptSide: '中断源',
    targetSide: '请求标志',
    actionHint: '先点中断源，再点请求标志。鼠标也可以直接拖过去。',
    emptyTray: '5 个源都放好了。',
    slotName: '请求标志',
  },
  pairs: [
    { id: 'int0', prompt: '外部中断 0', promptHint: 'INT0 · P3.2 引脚', target: 'IE0', targetDetail: 'TCON.1' },
    { id: 't0', prompt: '定时器 T0', promptHint: 'T0 溢出', target: 'TF0', targetDetail: 'TCON.5' },
    { id: 'int1', prompt: '外部中断 1', promptHint: 'INT1 · P3.3 引脚', target: 'IE1', targetDetail: 'TCON.3' },
    { id: 't1', prompt: '定时器 T1', promptHint: 'T1 溢出', target: 'TF1', targetDetail: 'TCON.7' },
    { id: 'uart', prompt: '串行口', promptHint: '串口 · 收完或发完一帧', target: 'RI / TI', targetDetail: 'SCON' },
  ],
};

/**
 * 80C51 interrupt vector addresses, mounted on overview `#int-2`.
 * The five addresses are the courseware line on the response pane and the
 * classroom page: INT0 0003H · T0 000BH · INT1 0013H · T1 001BH · 串口 0023H.
 * Source names and hints are the same `SRC` rows as the flag board.
 * `#int-3` keeps that flag board as its expanded cell. Spacing is 8 bytes;
 * the vector cell only holds a jump. No baud rate or chip-variant facts.
 */
export const INTERRUPT_VECTOR_BOARD: MatchBoard = {
  id: 'u5-interrupt-vectors',
  title: '中断源 ↔ 向量地址',
  prompt: '把 80C51 的 5 个中断源对上各自的入口地址。',
  hint: '五入口各隔 8 字节，向量处只放 LJMP。断点地址不是向量入口。',
  chapterId: '5',
  knowledgePointId: '5.2',
  sectionId: 'int-2',
  moduleId: 'u5-overview',
  medalId: 'interrupt_vectors',
  firstClearPoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
  cooldownMs: 10 * 60 * 1000,
  shell: {
    ariaLabel: '练一练：中断源对向量地址',
    sectionLink: '对照课件②',
    expandClosed: '展开练一练：中断源对向量地址',
    promptSide: '中断源',
    targetSide: '向量地址',
    actionHint: '先点中断源，再点向量地址。鼠标也可以直接拖过去。',
    emptyTray: '5 个源都放好了。',
    slotName: '向量地址',
  },
  pairs: [
    { id: 'int0', prompt: '外部中断 0', promptHint: 'INT0 · P3.2 引脚', target: '0003H', targetDetail: '入口地址' },
    { id: 't0', prompt: '定时器 T0', promptHint: 'T0 溢出', target: '000BH', targetDetail: '入口地址' },
    { id: 'int1', prompt: '外部中断 1', promptHint: 'INT1 · P3.3 引脚', target: '0013H', targetDetail: '入口地址' },
    { id: 't1', prompt: '定时器 T1', promptHint: 'T1 溢出', target: '001BH', targetDetail: '入口地址' },
    { id: 'uart', prompt: '串行口', promptHint: '串口 · 收完或发完一帧', target: '0023H', targetDetail: '入口地址' },
  ],
};

/**
 * 80C51 IE bits that open one source, mounted on overview `#int-5`.
 * Pane ⑤ says EA is the master switch and the other five bits are the
 * per-source switches. Those five are the pairs, low bit first, in the
 * same order as `SRC`: D0 EX0, D1 ET0, D2 EX1, D3 ET1, D4 ES.
 * `IE.n` is the lesson-2 term table. EA is not a source, so it stays in
 * the hint. D6 and D5 are undefined on 80C51 and are not pairs.
 * No baud-rate or chip-variant facts.
 */
export const INTERRUPT_IE_ENABLE_BOARD: MatchBoard = {
  id: 'u5-interrupt-ie-enables',
  title: 'IE 允许位 ↔ 中断源',
  prompt: '把 80C51 的 IE 里 5 个分开关对上各自的中断源。',
  hint: 'IE 里 EA 是总开关，另外 5 位是分开关，两个都打开 CPU 才理。',
  chapterId: '5',
  knowledgePointId: '5.2',
  sectionId: 'int-5',
  moduleId: 'u5-overview',
  medalId: 'interrupt_ie_enables',
  firstClearPoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
  cooldownMs: 10 * 60 * 1000,
  shell: {
    ariaLabel: '练一练：IE 允许位对中断源',
    sectionLink: '对照课件⑤',
    expandClosed: '展开练一练：IE 允许位对中断源',
    promptSide: '允许位',
    targetSide: '中断源',
    actionHint: '先点允许位，再点中断源。鼠标也可以直接拖过去。',
    emptyTray: '5 个分开关都放好了。',
    slotName: '中断源',
  },
  pairs: [
    { id: 'ex0', prompt: 'EX0', promptHint: 'D0 · IE.0', target: '外部中断 0', targetDetail: 'INT0 · P3.2 引脚' },
    { id: 'et0', prompt: 'ET0', promptHint: 'D1 · IE.1', target: '定时器 T0', targetDetail: 'T0 溢出' },
    { id: 'ex1', prompt: 'EX1', promptHint: 'D2 · IE.2', target: '外部中断 1', targetDetail: 'INT1 · P3.3 引脚' },
    { id: 'et1', prompt: 'ET1', promptHint: 'D3 · IE.3', target: '定时器 T1', targetDetail: 'T1 溢出' },
    { id: 'es', prompt: 'ES', promptHint: 'D4 · IE.4', target: '串行口', targetDetail: '串口 · 收完或发完一帧' },
  ],
};

/**
 * 80C51 TCON run, overflow, and trigger bits, mounted on overview `#int-4`.
 * Pane ④ is trigger and clear. The lesson-2 glossary on the same overview
 * names TR0/TR1 as run or stop, TF0/TF1 as overflow, and IT0/IT1 as the
 * external trigger type (0 level, 1 falling edge). IE0 and IE1 stay on
 * `u5-interrupt-source-flags`, which already maps those request flags to
 * sources. `GATE=0：只看 TR` is the timer-pane sentence; GATE itself stays
 * on the TMOD board. No baud-rate or chip-variant facts.
 */
export const TCON_CONTROL_BITS_BOARD: MatchBoard = {
  id: 'u5-tcon-control-bits',
  title: 'TCON 位 ↔ 含义',
  prompt: '把 80C51 的 TCON 里 TR、TF 和 IT 对上各自的含义。',
  hint: 'TF 是满了，TR 是开跑。写 0 是低电平触发，写 1 是下降沿触发。GATE=0：只看 TR。',
  chapterId: '5',
  knowledgePointId: '5.2',
  sectionId: 'int-4',
  moduleId: 'u5-overview',
  medalId: 'tcon_control_bits',
  firstClearPoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
  cooldownMs: 10 * 60 * 1000,
  shell: {
    ariaLabel: '练一练：TCON 位对含义',
    sectionLink: '对照课件④',
    expandClosed: '展开练一练：TCON 位对含义',
    promptSide: 'TCON 位',
    targetSide: '含义',
    actionHint: '先点 TCON 位，再点含义。鼠标也可以直接拖过去。',
    emptyTray: '6 个位都放好了。',
    slotName: '含义',
  },
  pairs: [
    { id: 'tr0', prompt: 'TR0', promptHint: 'TCON.4 · SETB TR0 开跑', target: 'T0 运行控制（开数/停数）', targetDetail: 'Timer Run 0' },
    { id: 'tr1', prompt: 'TR1', promptHint: 'TCON.6', target: 'T1 运行控制', targetDetail: 'Timer Run 1' },
    { id: 'tf0', prompt: 'TF0', promptHint: 'TCON.5 · 响应可硬件清', target: 'T0 溢出标志（满了）', targetDetail: 'Timer Flag 0' },
    { id: 'tf1', prompt: 'TF1', promptHint: 'TCON.7', target: 'T1 溢出标志', targetDetail: 'Timer Flag 1' },
    { id: 'it0', prompt: 'IT0', promptHint: 'TCON.0 · 0电平 / 1下降沿', target: 'INT0 触发方式', targetDetail: 'Interrupt Type 0' },
    { id: 'it1', prompt: 'IT1', promptHint: 'TCON.2', target: 'INT1 触发方式', targetDetail: 'Interrupt Type 1' },
  ],
};

/**
 * 80C51 IP priority bits, mounted on overview `#int-6`.
 * Pane ⑥ names the five defined bits, low bit last in the note:
 * D4 PS, D3 PT1, D2 PX1, D1 PT0, D0 PX0. Setting a bit to 1 is high
 * priority. The same note's natural order is INT0, T0, INT1, T1, 串口,
 * and the pane script lines those sources up with PX0 PT0 PX1 PT1 PS.
 * D7–D5 are undefined on 80C51 and are not pairs. The hint is the pane's
 * key sentence, so a miss does not list the mapping. No baud-rate or
 * chip-variant facts.
 */
export const INTERRUPT_PRIORITY_BOARD: MatchBoard = {
  id: 'u5-interrupt-priority',
  title: 'IP 优先级位 ↔ 中断源',
  prompt: '把 80C51 的 IP 里 5 个优先级位对上各自的中断源。',
  hint: '先看 IP 分高低两级，同级再按“外0、定0、外1、定1、串”排；高级能打断低级，同级不能打断同级。',
  chapterId: '5',
  knowledgePointId: '5.2',
  sectionId: 'int-6',
  moduleId: 'u5-overview',
  medalId: 'interrupt_priority',
  firstClearPoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
  cooldownMs: 10 * 60 * 1000,
  shell: {
    ariaLabel: '练一练：IP 优先级位对中断源',
    sectionLink: '对照课件⑥',
    expandClosed: '展开练一练：IP 优先级位对中断源',
    promptSide: '优先级位',
    targetSide: '中断源',
    actionHint: '先点优先级位，再点中断源。鼠标也可以直接拖过去。',
    emptyTray: '5 个优先级位都放好了。',
    slotName: '中断源',
  },
  pairs: [
    { id: 'px0', prompt: 'PX0', promptHint: 'D0', target: 'INT0', targetDetail: '置 1 为高优先级' },
    { id: 'pt0', prompt: 'PT0', promptHint: 'D1', target: 'T0', targetDetail: '置 1 为高优先级' },
    { id: 'px1', prompt: 'PX1', promptHint: 'D2', target: 'INT1', targetDetail: '置 1 为高优先级' },
    { id: 'pt1', prompt: 'PT1', promptHint: 'D3', target: 'T1', targetDetail: '置 1 为高优先级' },
    { id: 'ps', prompt: 'PS', promptHint: 'D4', target: '串口', targetDetail: '置 1 为高优先级' },
  ],
};

/**
 * 80C51 timer/counter TMOD, mounted on the unit 5 overview timer door.
 * Mode widths, the reload sentence, and GATE / C/T wording come from the
 * timer pane (`var DATA.tmr`). M1 M0 codes 00/01/10/11 → 方式 0–3 are the
 * classroom row for those two bits. 方式 3 stops T1; only T0 splits.
 * GATE=0 still counts whenever TR=1; that sentence is on the classroom
 * GATE pane the overview links. No baud-rate or chip-variant facts.
 */
export const TIMER_TMOD_BOARD: MatchBoard = {
  id: 'u5-timer-tmod-modes',
  title: 'TMOD 字段 ↔ 含义',
  prompt: '把 80C51 定时器 TMOD 的四种方式和 GATE、C/T 对上各自的含义。',
  hint: '高 4 位管 T1，低 4 位管 T0。C/T 管数什么，GATE 管许不许数。',
  chapterId: '5',
  knowledgePointId: '6.2',
  sectionId: 'tmr-hand',
  moduleId: 'u5-overview',
  medalId: 'timer_tmod_modes',
  firstClearPoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
  cooldownMs: 10 * 60 * 1000,
  shell: {
    ariaLabel: '练一练：TMOD 字段对含义',
    sectionLink: '对照动手练③',
    expandClosed: '展开练一练：TMOD 字段对含义',
    promptSide: 'TMOD 字段',
    targetSide: '含义',
    actionHint: '先点字段，再点含义。鼠标也可以直接拖过去。',
    emptyTray: '8 个字段都放好了。',
    slotName: '含义',
  },
  pairs: [
    { id: 'mode0', prompt: 'M1 M0 = 00', promptHint: '方式位', target: '方式 0', targetDetail: '13 位，最多 8192' },
    { id: 'mode1', prompt: 'M1 M0 = 01', promptHint: '方式位', target: '方式 1', targetDetail: '16 位，最多 65536' },
    { id: 'mode2', prompt: 'M1 M0 = 10', promptHint: '方式位', target: '方式 2', targetDetail: '8 位自动重装，TL0 溢出时硬件把 TH0 抄回 TL0' },
    { id: 'mode3', prompt: 'M1 M0 = 11', promptHint: '方式位', target: '方式 3', targetDetail: '只有 T0 有；TH0 借用 TR1、TF1；T1 停止计数' },
    { id: 'ct0', prompt: 'C/T = 0', promptHint: '计数 / 定时位', target: '定时', targetDetail: '数机器周期' },
    { id: 'ct1', prompt: 'C/T = 1', promptHint: '计数 / 定时位', target: '计数', targetDetail: '数 P3.4 或 P3.5 引脚脉冲' },
    { id: 'gate0', prompt: 'GATE = 0', promptHint: '门控位', target: '只看 TR', targetDetail: '只要 TR=1 就加' },
    { id: 'gate1', prompt: 'GATE = 1', promptHint: '门控位', target: '引脚高电平同时满足才数', targetDetail: 'T0 看 INT0，T1 看 INT1' },
  ],
};

/**
 * 80C51 addressing modes, in the order of `var DZ` on
 * `u3-addressing-design.html`, the page opened by overview `#addressing`
 * (tab ① 难题与对比). Each chip is the instruction that
 * pane reveals as「80C51 的做法」.
 * The pane's short labels are 寄存器 / 立即 / 直接 / 间接 / 变址 / 相对 / 位.
 * 间接 there is `MOV A,@R0` (only R0 and R1), so the slot says 寄存器间接寻址.
 */
export const ADDRESSING_MODE_BOARD: MatchBoard = {
  id: 'u3-addressing-modes',
  title: '指令 ↔ 寻址方式',
  prompt: '把第 3 章课件里 80C51 的 7 条代表指令对上七种寻址方式。',
  hint: '先看操作数上的记号：#、Rn、直接地址、@Ri、@A+、rel、位地址。',
  chapterId: '3',
  knowledgePointId: '3.1',
  sectionId: 'addressing',
  moduleId: 'u3-overview',
  medalId: 'addressing_modes',
  firstClearPoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
  cooldownMs: 10 * 60 * 1000,
  shell: {
    ariaLabel: '练一练：指令对寻址方式',
    sectionLink: '对照课件①',
    expandClosed: '展开练一练：指令对寻址方式',
    promptSide: '指令',
    targetSide: '寻址方式',
    actionHint: '先点指令，再点寻址方式。鼠标也可以直接拖过去。',
    emptyTray: '7 条指令都放好了。',
    slotName: '寻址方式',
  },
  pairs: [
    { id: 'reg', prompt: 'MOV A,Rn', promptHint: '操作码 E8–EF，低 3 位是寄存器号', target: '寄存器寻址', targetDetail: '号编在操作码里' },
    { id: 'imm', prompt: 'MOV A,#30H', promptHint: '机器码 74 30', target: '立即寻址', targetDetail: '常数跟在操作码后面' },
    { id: 'dir', prompt: 'MOV A,30H', promptHint: '机器码 E5 30', target: '直接寻址', targetDetail: '第 2 字节是片内地址' },
    { id: 'ind', prompt: 'MOV A,@R0', promptHint: '机器码 E6，只有 R0、R1', target: '寄存器间接寻址', targetDetail: '地址放在间址寄存器里' },
    { id: 'idx', prompt: 'MOVC A,@A+DPTR', promptHint: '机器码 93，再读一次 ROM', target: '变址寻址', targetDetail: '基址 DPTR 加偏移 A' },
    { id: 'rel', prompt: 'SJMP rel', promptHint: '机器码 80 rel，存离这儿多远', target: '相对寻址', targetDetail: '下一条地址加偏移' },
    { id: 'bit', prompt: 'SETB P1.0', promptHint: '机器码 D2 90，位地址 90H', target: '位寻址', targetDetail: '只动这一位' },
  ],
};

/**
 * 80C51 CPU, textbook figure 2-3 on the unit 2 CPU note.
 * Three groups: 运算器 (ALU, ACC), 控制器 (IR, ID), 其他寄存器 (PC, DPTR).
 * Slot text is the job of that block. The chip is its name.
 * B, PSW, SP and the ports stay on the figure; this puzzle is the six
 * blocks a first pass has to place.
 */
export const CPU_STRUCTURE_BOARD: MatchBoard = {
  id: 'u2-cpu-structure',
  title: 'CPU 结构拼图',
  prompt: '把 80C51 CPU 的 6 块碎片放回教材图 2-3 的位置。',
  hint: '运算器负责算，控制器负责取指令和译码。PC 记下一条指令地址，复位时装入 0000H；DPTR 才用来访问片外空间。',
  chapterId: '2',
  knowledgePointId: '2.1',
  sectionId: 'cpu',
  moduleId: 'u2-cpu-structure',
  medalId: 'cpu_structure_home',
  firstClearPoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
  cooldownMs: 10 * 60 * 1000,
  shell: {
    ariaLabel: '练一练：CPU 结构拼图',
    sectionLink: '对照图 2-3',
    expandClosed: '展开练一练：CPU 结构拼图',
    promptSide: '碎片',
    targetSide: '结构位置',
    actionHint: '先点一块碎片，再点框图里的空位。鼠标也可以直接拖进去。',
    emptyTray: '6 块都放进去了。',
    slotName: '结构位置',
    diagramTitle: '80C51 CPU · 图 2-3',
  },
  zones: [
    { id: 'alu-group', title: '运算器', slotIds: ['alu', 'acc'] },
    { id: 'ctl-group', title: '控制器', slotIds: ['ir', 'id'] },
    { id: 'reg-group', title: '其他寄存器', slotIds: ['pc', 'dptr'] },
  ],
  pairs: [
    { id: 'alu', prompt: 'ALU', promptHint: '算术逻辑部件', target: '做算术与逻辑', targetDetail: '运算器 · 8 位，还带位处理' },
    { id: 'acc', prompt: 'ACC', promptHint: '累加器，助记符 A', target: '暂存操作数和结果', targetDetail: '运算器 · 8 位，字节地址 E0H' },
    { id: 'ir', prompt: 'IR', promptHint: '指令寄存器', target: '先收下当前指令', targetDetail: '控制器 · 操作码再送去译码' },
    { id: 'id', prompt: 'ID', promptHint: '指令译码器', target: '把操作码译成信号', targetDetail: '控制器 · 再驱动控制逻辑' },
    { id: 'pc', prompt: 'PC', promptHint: '程序计数器', target: '记下一条指令地址', targetDetail: '其他寄存器 · 16 位，复位 0000H' },
    { id: 'dptr', prompt: 'DPTR', promptHint: '数据指针，DPH 加 DPL', target: '指向片外 64 KB', targetDetail: '其他寄存器 · 供 MOVX、MOVC 使用' },
  ],
};

/**
 * 80C51 存储器组织，讲解笔记 `u2-memory` 的地址图。
 * 片内四条是图上可点的分区：工作寄存器、位寻址、用户 RAM、SFR。
 * 第五块是片外数据存储器，用 MOVX 而不是 MOV。地址和“只能直接寻址”都来自该篇，不另加考点。
 */
export const MEMORY_REGION_BOARD: MatchBoard = {
  id: 'u2-memory-regions',
  title: '存储区 ↔ 含义',
  prompt: '把 80C51 片内的 4 个存储区和片外数据存储器对上各自的地址或访问方式。',
  hint: '片内 RAM 只到 7FH，SFR 在它上面。片外数据存储器靠 MOVX，不靠 MOV。',
  chapterId: '2',
  knowledgePointId: '2.2',
  sectionId: 'memory',
  moduleId: 'u2-memory',
  medalId: 'memory_regions',
  firstClearPoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
  cooldownMs: 10 * 60 * 1000,
  shell: {
    ariaLabel: '练一练：存储区对含义',
    sectionLink: '对照地址图',
    expandClosed: '展开练一练：存储区对含义',
    promptSide: '存储区',
    targetSide: '含义',
    actionHint: '先点存储区，再点含义。鼠标也可以直接拖过去。',
    emptyTray: '5 个区都放好了。',
    slotName: '含义',
  },
  pairs: [
    { id: 'bank', prompt: '工作寄存器区', promptHint: '4 组 R0~R7', target: '00H ~ 1FH', targetDetail: '32 B，复位后默认 BANK0' },
    { id: 'bit', prompt: '位寻址区', promptHint: '128 个位地址', target: '20H ~ 2FH', targetDetail: '16 B，位地址 00H~7FH' },
    { id: 'user', prompt: '用户 RAM 区', promptHint: '缓冲区兼堆栈', target: '30H ~ 7FH', targetDetail: '80 B，SP 宜设到 30H 以上' },
    { id: 'sfr', prompt: 'SFR', promptHint: '21 个专用寄存器', target: '80H ~ FFH', targetDetail: '只能直接寻址' },
    { id: 'xram', prompt: '片外数据存储器', promptHint: '最大 64 KB', target: 'MOVX + DPTR', targetDetail: 'RD / WR 选通，与片外 ROM 重号' },
  ],
};

/**
 * 80C51 external bus roles on the unit 2 bus note (`u2-bus`, anchor `#bus`).
 * Every pair is a sentence already on that page: P0 time-shares address and
 * data, P2 holds A15~A8 for the whole access, ALE's falling edge latches P0
 * into 74LS373, PSEN strobes external program memory, EA picks on-chip or
 * off-chip ROM, and RD/WR access external data memory. 8031 grounding EA
 * is that page's own sentence. No baud rate and no 8052-only fact.
 */
export const EXTERNAL_BUS_BOARD: MatchBoard = {
  id: 'u2-external-bus',
  title: '总线角色 ↔ 含义',
  prompt: '把 80C51 扩展外部存储器时的总线角色对上各自的作用。',
  hint: '锁存器是为分时服务的，不分时就不需要锁存。选通外部 ROM 的是 PSEN，选片内外的是 EA。',
  chapterId: '2',
  knowledgePointId: '2.6',
  sectionId: 'bus',
  moduleId: 'u2-bus',
  medalId: 'external_bus',
  firstClearPoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
  cooldownMs: 10 * 60 * 1000,
  shell: {
    ariaLabel: '练一练：总线角色对含义',
    sectionLink: '对照总线结构',
    expandClosed: '展开练一练：总线角色对含义',
    promptSide: '总线角色',
    targetSide: '含义',
    actionHint: '先点总线角色，再点含义。鼠标也可以直接拖过去。',
    emptyTray: '6 个角色都放好了。',
    slotName: '含义',
  },
  pairs: [
    { id: 'p0', prompt: 'P0', promptHint: '一条线干两件事', target: '低 8 位地址 / 数据分时复用', targetDetail: '先送低 8 位地址，再改作 D7~D0' },
    { id: 'p2', prompt: 'P2', promptHint: '没有第二个身份', target: '高 8 位地址 A15~A8', targetDetail: '整条指令期间稳定，不需要外接地址锁存器' },
    { id: 'ale', prompt: 'ALE', promptHint: '地址锁存允许', target: '锁存 P0 低 8 位地址', targetDetail: '下降沿锁进 74LS373' },
    { id: 'psen', prompt: 'PSEN', promptHint: '低电平有效', target: '选通外部程序存储器', targetDetail: '取指令时由它选通' },
    { id: 'ea', prompt: 'EA', promptHint: '内外程序存储器选择', target: 'EA = 1 先片内，EA = 0 只片外', targetDetail: '8031 片内没有 ROM，所以 EA 必须接地' },
    { id: 'rdwr', prompt: 'RD / WR', promptHint: 'P3.7、P3.6 的第二功能', target: '读写外部数据存储器', targetDetail: '外扩数据存储器要用' },
  ],
};

/**
 * 80C51 instruction teams on the unit 4 classroom panorama
 * (`u4-classroom`, anchor `#s-map`, the 回炉 111 条全景).
 * Category name, alias, and section number are the team card on that pane.
 * The function phrase is that team's `blurb` in `var TEAMS`.
 * The mnemonic is the first row of the same team in the ISA table on this
 * page, written the way `label()` shows it (`m` plus `ops`). The arrow
 * after the phrase is that row's `fn`, the 功能 column.
 * NOP and SWAP A stay in the team-card footnotes and are not pairs.
 * No baud-rate or chip-variant facts.
 */
export const INSTRUCTION_TEAMS_BOARD: MatchBoard = {
  id: 'u4-instruction-teams',
  title: '指令大类 ↔ 代表指令',
  prompt: '把 80C51 的指令五大类对上各自的代表助记符和功能。',
  hint: '先看这条是在搬数、做运算、按位处理、跳走，还是只碰一位。',
  chapterId: '4',
  knowledgePointId: '3.5',
  sectionId: 's-map',
  moduleId: 'u4-classroom',
  medalId: 'instruction_teams',
  firstClearPoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
  cooldownMs: 10 * 60 * 1000,
  shell: {
    ariaLabel: '练一练：指令大类对代表指令',
    sectionLink: '对照 111 条全景',
    expandClosed: '展开练一练：指令大类对代表指令',
    promptSide: '指令大类',
    targetSide: '代表指令',
    actionHint: '先点指令大类，再点代表指令。鼠标也可以直接拖过去。',
    emptyTray: '5 个大类都放好了。',
    slotName: '代表指令',
  },
  pairs: [
    { id: 'mov', prompt: '数据传送', promptHint: '3.3 · 搬运团队', target: 'MOV A,Rn', targetDetail: '只搬不算 · A←(Rn)' },
    { id: 'alu', prompt: '算术运算', promptHint: '3.4 · 计算团队', target: 'ADD A,Rn', targetDetail: '加减乘除与十进制调整 · A←(A)+(Rn)' },
    { id: 'logic', prompt: '逻辑运算', promptHint: '3.5 · 逻辑思维团队', target: 'ANL A,Rn', targetDetail: '按位做与、或、异或 · A←(A)∧(Rn)' },
    { id: 'jump', prompt: '控制转移', promptHint: '3.6 · 引导团队', target: 'LJMP addr16', targetDetail: '改写 PC · PC←addr16' },
    { id: 'bit', prompt: '位操作', promptHint: '3.7 · 位操作团队', target: 'MOV C,bit', targetDetail: '只跟单个位打交道 · CY←(bit)' },
  ],
};

const MATCH_BOARDS: readonly MatchBoard[] = [
  MEMORY_REGION_BOARD,
  CPU_STRUCTURE_BOARD,
  EXTERNAL_BUS_BOARD,
  INTERRUPT_SOURCE_FLAG_BOARD,
  INTERRUPT_VECTOR_BOARD,
  INTERRUPT_IE_ENABLE_BOARD,
  TCON_CONTROL_BITS_BOARD,
  INTERRUPT_PRIORITY_BOARD,
  TIMER_TMOD_BOARD,
  ADDRESSING_MODE_BOARD,
  INSTRUCTION_TEAMS_BOARD,
];

export function findMatchBoard(boardId: string): MatchBoard | null {
  return MATCH_BOARDS.find((board) => board.id === boardId) ?? null;
}

export interface MatchGrade {
  correct: boolean;
  wrongSlotIds: string[];
  missingSlotIds: string[];
}

/** A placement maps a slot id (the pair id) to the chip id dropped on it. */
export function gradeMatch(
  board: MatchBoard,
  placements: Readonly<Record<string, string>>,
): MatchGrade {
  const wrongSlotIds: string[] = [];
  const missingSlotIds: string[] = [];
  for (const pair of board.pairs) {
    const placed = placements[pair.id];
    if (!placed) missingSlotIds.push(pair.id);
    else if (placed !== pair.id) wrongSlotIds.push(pair.id);
  }
  return {
    correct: wrongSlotIds.length === 0 && missingSlotIds.length === 0,
    wrongSlotIds,
    missingSlotIds,
  };
}

export function matchMissMessage(grade: MatchGrade, board: MatchBoard): string {
  const remaining = grade.wrongSlotIds.length + grade.missingSlotIds.length;
  return `还有 ${remaining} 处没对上。${board.hint}`;
}

export function matchReviewLines(board: MatchBoard): readonly string[] {
  return board.pairs.map((pair) => `${pair.prompt} → ${pair.target}（${pair.targetDetail}）`);
}

export type MatchRewardReason = 'incorrect' | 'first_clear' | 'cooldown' | 'repeat' | 'preview';

export interface MatchRewardDecision {
  recordEvent: boolean;
  practicePoints: number;
  grantMedals: boolean;
  reason: MatchRewardReason;
  cooldownUntilMs: number | null;
}

/**
 * First correct clear of a board awards practice points and may unlock medals.
 * The same board stays quiet for `cooldownMs` so refreshing cannot farm events.
 * A later correct clear is stored with 0 practice points. Shared medals
 * (3 recorded clears on this board, or the first recorded clear of the
 * campus day) can still unlock. A clear inside the cooldown is not stored.
 */
export function decideMatchReward(input: {
  correct: boolean;
  previousClears: number;
  lastClearAtMs: number | null;
  nowMs: number;
  cooldownMs: number;
  firstClearPoints: number;
  awardToStudent: boolean;
}): MatchRewardDecision {
  if (!input.correct) {
    return {
      recordEvent: false,
      practicePoints: 0,
      grantMedals: false,
      reason: 'incorrect',
      cooldownUntilMs: null,
    };
  }
  if (!input.awardToStudent) {
    return {
      recordEvent: false,
      practicePoints: 0,
      grantMedals: false,
      reason: 'preview',
      cooldownUntilMs: null,
    };
  }
  const lastClearAtMs = input.lastClearAtMs;
  const cooling = input.previousClears > 0
    && lastClearAtMs != null
    && input.nowMs - lastClearAtMs < input.cooldownMs;
  if (cooling) {
    return {
      recordEvent: false,
      practicePoints: 0,
      grantMedals: false,
      reason: 'cooldown',
      cooldownUntilMs: lastClearAtMs + input.cooldownMs,
    };
  }
  const firstClear = input.previousClears <= 0;
  return {
    recordEvent: true,
    practicePoints: firstClear ? input.firstClearPoints : 0,
    grantMedals: true,
    reason: firstClear ? 'first_clear' : 'repeat',
    cooldownUntilMs: null,
  };
}

export interface NamedMedalGrant {
  title: string;
  points: number;
}

export function matchClearMessage(input: {
  reason: MatchRewardReason;
  practicePoints: number;
  medalTitle: string | null;
  medalPoints: number;
  cooldownMinutes: number;
  /** Newly inserted medals. When set, replaces medalTitle. */
  medals?: readonly NamedMedalGrant[];
}): string {
  if (input.reason === 'preview') return '对上了。教师或管理员预览不记入学生积分和勋章。';
  if (input.reason === 'incorrect') return '还有没对上的。';
  if (input.reason === 'cooldown') {
    return `已经对上过了。同一题 ${input.cooldownMinutes} 分钟内不再记分，过一会儿可以再练。`;
  }
  const medals = input.medals ?? (input.medalTitle
    ? [{ title: input.medalTitle, points: input.medalPoints }]
    : []);
  const medalClause = medals.length === 0
    ? ''
    : `，解锁勋章${medals.map((medal) => `「${medal.title}」+${medal.points}`).join('、')}`;
  if (input.reason === 'repeat') {
    if (medals.length === 0) return '又对上一次。学习记录已记下，这道题的首次积分不再发放。';
    return `又对上一次。学习记录已记下${medalClause}。`;
  }
  return `首次对上：+${input.practicePoints} 积分${medalClause}。`;
}

/** Stable shuffle so a reload does not become a new random puzzle, and tests stay quiet. */
export function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  const copy = [...items];
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  }
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    const swapIndex = (state >>> 0) % (index + 1);
    const current = copy[index] as T;
    copy[index] = copy[swapIndex] as T;
    copy[swapIndex] = current;
  }
  return copy;
}
