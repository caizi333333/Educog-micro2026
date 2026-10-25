/**
 * 教学内容数据 — 每个实验的详细教学资料
 * 桂林航天工业学院 · 微控制器原理与应用
 */

import type { Proj04MilestoneId } from '@/lib/experiment-config';

export interface TeachingSection {
  title: string;
  content: string; // Markdown-like plain text (rendered with whitespace preserved)
}

export interface RegisterRef {
  name: string;
  address: string;
  bits: string[];
  description: string;
}

/** 课程大纲映射信息 */
export interface SyllabusMapping {
  /** 授课周次；原件未列时明确待核实 */
  week: string;
  /** 对应教学主题，如 "单片机基础知识" */
  chapter: string;
  /** 对应条目的学时，不是平台实验的预计耗时 */
  hours: number;
  hoursLabel: string;
  /** 原件位置或平台扩展说明 */
  sourceNote: string;
  /** 对应章节的课程目标；平台任务自身目标另列 */
  courseObjectives: string;
  /** 课程章节或课件参考 */
  textbookRef: string;
  /** 平台知识图谱关联，编号独立于大纲 */
  knowledgeMap?: string;
  /** 思政融入点 */
  ideologicalPoint?: string;
}

/** 寻址方式的操作数、地址与适用范围对比 */
export interface AddressingMode {
  /** 寻址方式名称，如 "立即寻址" */
  name: string;
  /** 典型指令示例，如 "MOV A, #30H" */
  example: string;
  /** 一句话说明其特点/适用场合 */
  note: string;
}

/** 结构化课程思政（金句 + 融入点，用于说课"说思政"采分） */
export interface IdeologicalContent {
  /** 思政主题，如 "工匠精神 · 自主可控" */
  theme: string;
  /** 融入点（专业知识如何自然带出价值引导），2–4 条 */
  insights: string[];
  /** 点睛金句（源自课堂原话，可作视频字幕） */
  goldenQuote?: string;
}

/** 三维教学目标（知识/能力；思政维度取自 ideological） */
export interface Objectives3D {
  knowledge: string[];
  ability: string[];
}

/** 教学重点与难点（说课"说重难点"） */
export interface KeyPoints {
  /** 教学重点 */
  focus: string[];
  /** 教学难点 */
  difficulty: string[];
}

export interface ProjectBrief {
  evidenceStatus: string;
  simulationBoundary: string;
  prerequisiteGate: string;
  completionNextStep: string;
  roles: { role: string; responsibility: string }[];
  milestones: { id: Proj04MilestoneId; title: string; completionRule: string }[];
  deliverables: string[];
  rubric: { dimension: string; weight: number; evidence: string }[];
}

export interface TeachingContent {
  /** 课程大纲映射 — 对应《微控制器应用技术》教学大纲 */
  syllabusMapping?: SyllabusMapping;
  /** 三维教学目标（知识/能力），未填则由 objectives/knowledgePoints 自动派生 */
  objectives3D?: Objectives3D;
  /** 教学重点与难点，未填则由 knowledgePoints/commonMistakes 自动派生 */
  keyPoints?: KeyPoints;
  /** 寻址方式定性对比（仅指令系统类实验，如 exp02） */
  addressingComparison?: AddressingMode[];
  /** 结构化课程思政（优先于 syllabusMapping.ideologicalPoint 渲染） */
  ideological?: IdeologicalContent;
  /** 综合项目任务书；属于平台教学模板，不代表已有真实学生成果。 */
  projectBrief?: ProjectBrief;
  /** 理论背景 */
  theory: TeachingSection[];
  /** 硬件电路说明（文字描述，用 ASCII 示意） */
  circuitDescription: string;
  /** 关键寄存器参考 */
  registerReference: RegisterRef[];
  /** 分步指导 */
  stepByStep: { step: string; detail: string }[];
  /** 核心指令速查 */
  instructionRef: { instr: string; syntax: string; desc: string; example: string }[];
  /** 实际工程应用场景 */
  realWorldApplications: string[];
  /** 常见错误与陷阱 */
  commonMistakes: { mistake: string; explanation: string }[];
  /** 思考题 */
  thinkingQuestions: string[];
  /** 交互动画列表 — 引用 AnimationRegistry 中的动画 ID */
  animations?: { id: string; title: string }[];
}

/** 全部实验的教学内容，以实验 id 为 key */
export const teachingContents: Record<string, TeachingContent> = {

  // ═══════════════════════════════════════════════
  // 实验一：基础 LED 控制实验
  // ═══════════════════════════════════════════════
  exp01: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第2章 硬件结构、第4章 汇编程序设计',
      hours: 2,
      hoursLabel: '对应大纲实验2',
      sourceNote: '大纲表3“流水灯实验”（2学时）；本任务为流水灯仿真练习。',
      courseObjectives: '表2对应目标1、2、4；实验要求见表3。',
      textbookRef: '大纲表2第2、4章；表3实验2。',
      knowledgeMap: '平台2.3 I/O接口、3.5 控制转移指令',
      ideologicalPoint: '国产芯片发展历程（爱国主义教育）',
    },
    objectives3D: {
      knowledge: ['理解单片机 I/O 口结构与准双向端口特性', '掌握 LED 低电平点亮原理与延时程序的构成'],
      ability: ['能用汇编编写 P1 口控制程序实现流水灯', '学会通过仿真观察端口电平的变化'],
    },
    keyPoints: {
      focus: ['P1 口的输出控制与准双向端口的使用', '延时子程序的构成与调用'],
      difficulty: ['理解 LED"低电平点亮"与端口电平的对应关系', '延时时间与循环次数的换算'],
    },
    ideological: {
      theme: '科技报国 · 国产自主可控',
      insights: [
        '从依赖进口到国产 MCU 崛起：兆易创新、华大、复旦微等国产单片机已广泛用于家电、汽车、工业控制——一颗小小的控制芯片，背后是一条要靠自己掌握的产业链。',
        '越是基础的原理越要学扎实：点亮一个 LED 看似简单，却是理解 I/O 口、时序、程序控制的第一步；底层能力扎实，才谈得上向上创新。',
      ],
      goldenQuote: '芯片不能只会用，更要懂原理、能自己做。',
    },
    theory: [
      {
        title: '8051 并行 I/O 口结构',
        content: `8051 有 4 个 8 位并行 I/O 口 (P0~P3)，每个口有 8 个引脚。

P1 口特点：
• 准双向口，内部有上拉电阻
• 复位后默认输出高电平 (0xFF)
• 可逐位操作 (P1.0 ~ P1.7)
• 灌电流须按具体芯片手册校核；AT89C51的P1低电平输出规格在1.6mA测试条件下给出

P0 口特点：
• 开漏输出，需要外接上拉电阻
• 复用为地址/数据总线低 8 位
• AT89C51的26mA为P0整口灌电流上限，不是单引脚可用电流

器件依据：Microchip/Atmel AT89C51数据手册（0265G–02/00）第10页DC Characteristics及注1。
P1整口15mA、单引脚10mA为外部限流上限；超过规格测试电流时，不再保证相同的低电平电压。

P2 口特点：
• 准双向口，复用为地址总线高 8 位

P3 口特点：
• 准双向口，第二功能包括串口 (RXD/TXD)、外部中断 (INT0/INT1)、定时器计数输入 (T0/T1)`,
      },
      {
        title: 'LED 驱动原理',
        content: `LED（发光二极管）是单片机最基本的输出设备。

驱动方式：
1. 灌电流驱动（推荐）：LED 阳极接 VCC，阴极经限流电阻接 P1 口
   → P1.x = 0 时 LED 亮，P1.x = 1 时 LED 灭
   → 8051 灌电流能力 > 拉电流能力，更可靠

2. 拉电流驱动：LED 阳极经限流电阻接 P1 口，阴极接 GND
   → P1.x = 1 时 LED 亮

限流电阻计算：
  R = (VCC - V_LED - V_OL) / I_LED
  示例假设：VCC=5V、LED正向压降2V、目标电流不超过1.5mA。
  按V_OL=0估计最大电流，R ≥ (5V - 2V) / 1.5mA = 2kΩ。
  示例选2kΩ；8路同时亮的总电流约不超过12mA。
  实物还须核对电源上限、LED压降和电阻公差；更大电流使用外置驱动器。

流水灯原理：
  依次改变 P1 口各位的电平状态，配合适当延时
  实现视觉上的"流水"效果 (利用人眼视觉暂留)`,
      },
      {
        title: '移位指令与循环',
        content: `RL A — 累加器循环左移
  bit7 ← bit6 ← ... ← bit0 ← bit7 (最高位移到最低位)
  例: A = 1111 1110B → RL A → A = 1111 1101B

RR A — 累加器循环右移
  bit7 → bit0, bit6 → bit7, ...
  例: A = 0111 1111B → RR A → A = 1011 1111B

RLC A — 带进位循环左移 (9 位移位)
  CY ← bit7, bit7 ← bit6, ..., bit0 ← CY

RRC A — 带进位循环右移 (9 位移位)
  CY → bit7, bit0 → CY

应用：通过反复调用 RL/RR，实现 LED 逐位移动`,
      },
    ],
    circuitDescription: `
┌──────────────┐
│   AT89C51    │
│              │  2kΩ   LED
│  P1.0 ─────┤├───┤►├── VCC
│  P1.1 ─────┤├───┤►├── VCC
│  P1.2 ─────┤├───┤►├── VCC
│  P1.3 ─────┤├───┤►├── VCC
│  P1.4 ─────┤├───┤►├── VCC
│  P1.5 ─────┤├───┤►├── VCC
│  P1.6 ─────┤├───┤►├── VCC
│  P1.7 ─────┤├───┤►├── VCC
│              │
│  XTAL1 ──┤ 12MHz
│  XTAL2 ──┤ 晶振
│  RST ─── 复位电路
│  VCC = 5V, GND
└──────────────┘
注：LED 采用灌电流驱动，P1.x=0 时对应 LED 亮`,
    registerReference: [
      {
        name: 'P1',
        address: '90H',
        bits: ['P1.7', 'P1.6', 'P1.5', 'P1.4', 'P1.3', 'P1.2', 'P1.1', 'P1.0'],
        description: 'P1 口锁存器，复位值 0xFF，准双向口，可位寻址',
      },
      {
        name: 'ACC (A)',
        address: '0E0H',
        bits: ['ACC.7', 'ACC.6', 'ACC.5', 'ACC.4', 'ACC.3', 'ACC.2', 'ACC.1', 'ACC.0'],
        description: '累加器，算术/逻辑运算的核心寄存器',
      },
      {
        name: 'SP',
        address: '81H',
        bits: ['SP.7', 'SP.6', 'SP.5', 'SP.4', 'SP.3', 'SP.2', 'SP.1', 'SP.0'],
        description: '堆栈指针，复位值 07H，PUSH 时先+1再写入',
      },
    ],
    stepByStep: [
      { step: '1. 初始化 P1 口', detail: '使用 MOV P1, #0FEH 点亮第一个 LED (P1.0=0)' },
      { step: '2. 读取当前状态', detail: 'MOV A, P1 将 P1 当前值读入累加器' },
      { step: '3. 执行移位', detail: 'RL A 将累加器循环左移，LED 位置向左移动' },
      { step: '4. 输出新状态', detail: 'MOV P1, A 将移位后的值输出到 P1 口' },
      { step: '5. 调用延时', detail: 'ACALL DELAY 插入适当延时使人眼可见' },
      { step: '6. 边界检测', detail: 'CJNE A, #7FH, LOOP1 检测是否到达最左端' },
      { step: '7. 反向流水', detail: '使用 RR A 实现从左到右的反向流水' },
      { step: '8. 循环', detail: 'SJMP MAIN 回到起始位置重新开始' },
    ],
    instructionRef: [
      { instr: 'MOV', syntax: 'MOV dest, src', desc: '数据传送', example: 'MOV P1, #0FEH  ; P1 ← 0FEH' },
      { instr: 'RL', syntax: 'RL A', desc: '累加器循环左移(8位自环,不经CY)', example: 'RL A  ; A.7→A.0, A.6→A.7, ...' },
      { instr: 'RR', syntax: 'RR A', desc: '累加器循环右移', example: 'RR A  ; A.0→A.7, A.7→A.6, ...' },
      { instr: 'ACALL', syntax: 'ACALL addr11', desc: '绝对子程序调用 (2KB范围)', example: 'ACALL DELAY' },
      { instr: 'CJNE', syntax: 'CJNE A, #data, rel', desc: '比较不等转移', example: 'CJNE A, #7FH, LOOP1' },
      { instr: 'SJMP', syntax: 'SJMP rel', desc: '短跳转 (-128~+127)', example: 'SJMP MAIN' },
      { instr: 'DJNZ', syntax: 'DJNZ Rn, rel', desc: '减1非零转移', example: 'DJNZ R7, D2' },
      { instr: 'PUSH', syntax: 'PUSH direct', desc: '压栈 (SP+1, 写入)', example: 'PUSH ACC' },
      { instr: 'POP', syntax: 'POP direct', desc: '弹栈 (读出, SP-1)', example: 'POP ACC' },
      { instr: 'RET', syntax: 'RET', desc: '子程序返回', example: 'RET' },
    ],
    realWorldApplications: [
      '交通信号灯控制系统 — 红绿黄灯的时序切换',
      '广告灯箱流水灯 — 商业招牌的动态灯光效果',
      '工业设备状态指示 — 用 LED 阵列显示设备运行状态',
      '汽车转向灯控制 — 方向灯的顺序闪烁效果',
      '电梯楼层指示 — 逐层点亮的楼层显示',
    ],
    commonMistakes: [
      { mistake: '忘记 P1 口复位值为 0xFF', explanation: 'P1 口复位后全部为高电平，如果 LED 灌电流连接，则全灭。必须写入初始值才能点亮 LED。' },
      { mistake: '延时子程序没有保护现场', explanation: 'DELAY 子程序内部使用了 R6、R7，如果主程序也使用这些寄存器，会造成数据冲突。应 PUSH/POP 保护。' },
      { mistake: 'RL 和 RLC 搞混', explanation: 'RL 是 8 位循环移位 (bit7→bit0)，RLC 是 9 位通过进位 CY 的移位。流水灯应使用 RL，否则 CY 位会影响结果。' },
      { mistake: '限流电阻值选择不当', explanation: '须按供电、LED正向压降与目标电流计算，并同时核对单脚和整口电流。示例2kΩ用于低电流指示；需要更高亮度时应增加驱动器，不能只减小电阻。' },
    ],
    thinkingQuestions: [
      '如果将 RL A 改为 RLC A，流水灯效果会有什么变化？为什么？',
      '如何修改程序实现两个 LED 同时流水？(提示：考虑 P1 的初始值)',
      '延时子程序中 R6=50, R7=200，大约延时多少毫秒？(提示：12MHz晶振，1个机器周期=1μs)',
      '如果要实现呼吸灯效果（亮度渐变），仅用 P1 口能实现吗？需要什么技术？',
      '实际产品中，为什么通常不直接用单片机 I/O 口驱动大功率 LED？',
    ],
    animations: [
      { id: 'led-shift', title: 'LED流水灯 — RL A 循环左移动画' },
    ],
  },

  // ═══════════════════════════════════════════════
  // 实验二：指令系统实验
  // ═══════════════════════════════════════════════
  exp02: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第3章 指令系统、第4章 汇编程序设计',
      hours: 2,
      hoursLabel: '对应大纲实验1',
      sourceNote: '大纲表3“指令系统实验”（2学时）；平台3.1为寻址方式主题编号。',
      courseObjectives: '表2对应目标2、4；表3实验1对应目标1、2、4。',
      textbookRef: '大纲表2第3章3.2寻址方式；表3实验1。',
      knowledgeMap: '平台3.1及3.1.1—3.1.7七个子节点',
      ideologicalPoint: '航天嵌入式系统可靠性设计（航天品质/工匠精神）',
    },
    addressingComparison: [
      { name: '立即寻址', example: 'MOV A, #30H', note: '操作数直接编码在指令中，适合装入已知常量。' },
      { name: '寄存器寻址', example: 'MOV A, R3', note: '操作数位于所选工作寄存器组的R0—R7中，适合保存临时数据。' },
      { name: '直接寻址', example: 'MOV A, 30H', note: '指令给出内部RAM或特殊功能寄存器的直接地址，访问范围取决于地址。' },
      { name: '寄存器间接寻址', example: 'MOV A, @R0', note: 'R0或R1保存内部RAM地址，可通过修改指针依次访问数据。' },
      { name: '变址寻址', example: 'MOVC A, @A+DPTR', note: 'A与DPTR相加形成程序存储器中的查表地址。' },
      { name: '相对寻址', example: 'SJMP LOOP', note: '以本条指令执行后的PC为基准，加上有符号8位偏移，范围为−128至+127字节。' },
      { name: '位寻址', example: 'SETB P1.0', note: '访问可位寻址RAM或支持位寻址的特殊功能寄存器，不能用于任意位地址。' },
    ],
    objectives3D: {
      knowledge: ['理解 8051 的 7 种寻址方式及其区别', '掌握数据传送、算术与逻辑运算指令的用法'],
      ability: ['能根据场景选择合适的寻址方式编写程序', '学会用单步调试观察寄存器与内存的变化'],
    },
    keyPoints: {
      focus: ['7 种寻址方式的识别与选用（立即与直接寻址只差一个#号）', 'ADD/ADDC/SUBB 对 CY、AC、OV 标志位的影响'],
      difficulty: ['寄存器间接寻址 @Ri 与变址寻址 @A+DPTR 的理解', 'DA A 十进制调整的适用条件与多字节运算的进位链'],
    },
    ideological: {
      theme: '工匠精神 · 辩证工程思维 · 自主可控',
      insights: [
        '立即寻址 MOV A,#30H 把常量30H送入A；直接寻址 MOV A,30H 把内部RAM地址30H中的数据送入A。应先说明操作数的位置，再判断指令结果。',
        '选择寻址方式时先说明操作数在哪里、地址是否变化、指令允许访问什么范围；执行时间应查具体指令与芯片时序。',
        '自主可控：位寻址是 MCS-51 单片机的特色功能，掌握底层机制，才谈得上把芯片技术真正握在自己手里。',
      ],
      goldenQuote: '没有最好的寻址方式，只有最合适的寻址方式。',
    },
    theory: [
      {
        title: '8051 寻址方式',
        content: `8051 支持 7 种寻址方式：

1. 立即寻址 — 操作数直接在指令中
   MOV A, #55H      ; A ← 55H

2. 直接寻址 — 直接给出 RAM 或 SFR 地址
   MOV A, 30H       ; A ← RAM[30H]
   MOV A, P1        ; A ← P1 口

3. 寄存器寻址 — 使用 R0~R7
   MOV A, R3        ; A ← R3

4. 寄存器间接寻址 — R0/R1 做地址指针
   MOV A, @R0       ; A ← RAM[R0]

5. 变址寻址 — 用于查表
   MOVC A, @A+DPTR  ; A ← Code[A+DPTR]

6. 相对寻址 — 用于跳转
   SJMP LOOP        ; PC ← PC+2+偏移

7. 位寻址 — 操作单个位
   SETB P1.0        ; P1.0 ← 1`,
      },
      {
        title: '数据传送指令详解',
        content: `MOV 指令族是 8051 最常用的指令：

MOV A, #data    ; 立即数→A (2字节)
MOV A, Rn       ; 寄存器→A (1字节)
MOV A, direct   ; 直接地址→A (2字节)
MOV A, @Ri      ; 间接地址→A (1字节)
MOV Rn, #data   ; 立即数→Rn (2字节)
MOV Rn, A       ; A→Rn (1字节)
MOV direct, A   ; A→直接地址 (2字节)
MOV @Ri, A      ; A→间接地址 (1字节)
MOV direct, #data ; 立即数→直接地址 (3字节)
MOV DPTR, #data16 ; 16位立即数→DPTR (3字节)

标志位说明：普通字节传送不按算术结果设置CY、AC、OV；但写入A后，硬件会按A中1的个数更新奇偶标志P。MOV C,bit会写CY；直接写PSW或其中的位也会改变对应状态，不能概括为“PSW不变”。
例：MOV A,#01H执行后P=1；MOV A,#03H执行后P=0。
参考：Philips《80C51 family programmer’s guide and instruction set》PSW定义（印刷页82）与MOV指令说明。
https://www.keil.com/dd/docs/datashts/philips/p51_pg.pdf`,
      },
      {
        title: '算术运算与标志位（第二段）',
        content: `算术指令会更新 PSW 中的 CY / AC / OV 标志：

1. 多字节加法 — ADD 打头，ADDC 续接
   BB99H + CCAAH = 1 8843H：
   低字节  99H+AAH = 143H → A=43H, CY=1
   高字节  BBH+CCH+CY = 188H → A=88H, CY=1
   ADDC A,#0 收集最高进位 → 01H（第17位）

2. DA A 十进制调整 — 只跟在 ADD/ADDC 之后
   BCD 数 87+95：二进制加得 1CH（非法BCD, CY=1）
   DA A 按半字节>9 或 AC/CY=1 补 6 → 82H, CY=1
   即十进制 182（百位进 1）

3. MUL AB — 积低字节→A, 高字节→B
   11H × 22H = 0242H（17×34=578），积>255 时 OV=1

4. DIV AB — 商→A, 余数→B
   CCH ÷ 0AH：204÷10 = 20 余 4 → A=14H, B=04H

5. SUBB 带借位减 — 使用前先 CLR C
   33H − 77H = BCH, CY=1（不够减产生借位）
   OV=1 表示带符号数运算溢出`,
      },
      {
        title: '逻辑运算与移位（第三段）',
        content: `逻辑指令按位操作，不产生进位链：

ANL 与:  3CH ∧ 66H = 24H（取公共 1 位/屏蔽）
ORL 或:  3CH ∨ 66H = 7EH（置位）
XRL 异或: 3CH ⊕ 66H = 5AH（取反指定位/比较）
CPL A:   3CH → C3H（按位取反）
CLR A:   A的全部8位清零，与逐位取反的CPL A不同
SWAP A:  A7H → 7AH（高低半字节交换）

移位指令 — RL/RR 是 8 位自环，RLC/RRC 把 CY 串进
移位链构成 9 位循环：
  RL A:  81H → 03H（bit7 绕回 bit0）
  RR A:  81H → C0H（bit0 绕回 bit7）
  RLC A: CY=0, 81H → A=02H, CY=1（bit7 进 CY）
         再 RLC → A=05H, CY=0（CY 从 bit0 回来）
  RRC A: CY=1, 02H → A=81H, CY=0

校验和（末段）：
  用 @R0 间接寻址遍历 30H-5EH 逐字节 ADD 累加，
  丢弃进位取模 256，结果 F1H 存入 5FH 并输出 P1——
  这正是串口协议/存储器自检里校验和的标准做法`,
      },
    ],
    circuitDescription: `
┌──────────────┐
│   AT89C51    │  2kΩ   LED (灌电流,低电平亮)
│              │
│  P1.0~P1.7 ─┤├──┤►├── VCC  (×8)
│              │
│  阶段指示灯:  │  第一段 P1=0FEH → 1盏亮
│              │  第二段 P1=0FCH → 2盏亮
│              │  第三段 P1=0F8H → 3盏亮
│              │  结 尾  P1=校验和F1H 按位图样点亮
└──────────────┘
核心观察对象是内存面板：30H-5FH 三段式逐段填充，
每轮 LJMP MAIN 先清零再重填`,
    registerReference: [
      {
        name: 'PSW',
        address: '0D0H',
        bits: ['CY', 'AC', 'F0', 'RS1', 'RS0', 'OV', '—', 'P'],
        description: '程序状态字：CY=进位, AC=辅助进位, OV=溢出, P=奇偶',
      },
      {
        name: 'B',
        address: '0F0H',
        bits: ['B.7', 'B.6', 'B.5', 'B.4', 'B.3', 'B.2', 'B.1', 'B.0'],
        description: 'B 寄存器，MUL/DIV 指令的第二操作数',
      },
      {
        name: 'SP',
        address: '81H',
        bits: ['SP.7', 'SP.6', 'SP.5', 'SP.4', 'SP.3', 'SP.2', 'SP.1', 'SP.0'],
        description: '堆栈指针，本实验开头 MOV SP,#60H 移出数据区，避免 PUSH 破坏 30H-5FH',
      },
      {
        name: 'DPTR',
        address: 'DPH:83H DPL:82H',
        bits: ['DPH[7:0]', 'DPL[7:0]'],
        description: '16位数据指针，MOVC A,@A+DPTR 查 SRC_TAB 的基址寄存器',
      },
    ],
    stepByStep: [
      { step: '1. 清零数据区', detail: 'R0 作指针、DJNZ 计数，把 30H-5FH 共48个单元写 0（间接寻址的循环应用）' },
      { step: '2. 第一段·寻址方式', detail: '看内存面板 30H-33H：立即/直接/寄存器/间接寻址各写一例；34H-3FH 由 MOVC 查表搬入 SRC_TAB 的 12 字节' },
      { step: '3. 第二段·算术运算', detail: '40H-4DH 依次出现：多字节和 43H/88H/01H、BCD 结果 82H/01H、乘积 42H/02H、商余 14H/04H、SUBB 借位差 BCH/01H、INC/DEC 10H/0FH' },
      { step: '4. 第三段·逻辑移位', detail: '50H-5AH 依次为 24H,7EH,5AH,C3H,7AH,03H,C0H,02H,05H,81H,F0H，逐条对照 ANL/ORL/XRL/CPL/SWAP/RL/RR/RLC/RRC/ANL direct' },
      { step: '5. 校验和验证', detail: '程序遍历 30H-5EH 累加，5FH 应为 F1H，同时 P1 全口输出 F1H 位图样' },
      { step: '6. 对照阶段灯', detail: 'P1 低位 1盏→2盏→3盏递进指示当前段，配合段间延时观察"清零后逐段填充"' },
    ],
    instructionRef: [
      { instr: 'MOVC', syntax: 'MOVC A, @A+DPTR', desc: '变址寻址查表(读代码空间)', example: 'MOVC A, @A+DPTR ; A←SRC_TAB[R3]' },
      { instr: 'ADD', syntax: 'ADD A, src', desc: '加法，影响CY/AC/OV', example: 'ADD A, 35H ; 11H+22H=33H' },
      { instr: 'ADDC', syntax: 'ADDC A, src', desc: '带进位加，多字节续接', example: 'ADDC A, 3FH ; 高字节+CY' },
      { instr: 'DA', syntax: 'DA A', desc: '十进制调整(BCD修正)', example: 'DA A ; 1CH,CY=1 → 82H' },
      { instr: 'MUL', syntax: 'MUL AB', desc: 'A×B，低字节→A 高字节→B', example: 'MUL AB ; 11H×22H=0242H' },
      { instr: 'DIV', syntax: 'DIV AB', desc: 'A÷B，商→A 余数→B', example: 'DIV AB ; CCH÷0AH=14H余04H' },
      { instr: 'SUBB', syntax: 'SUBB A, src', desc: '带借位减(先CLR C)', example: 'SUBB A, #77H ; 33H-77H=BCH,CY=1' },
      { instr: 'ANL', syntax: 'ANL A, #data', desc: '逻辑与(也有 ANL direct,#data)', example: 'ANL A, #66H ; 3CH∧66H=24H' },
      { instr: 'XRL', syntax: 'XRL A, #data', desc: '逻辑异或', example: 'XRL A, #66H ; 3CH⊕66H=5AH' },
      { instr: 'SWAP', syntax: 'SWAP A', desc: '高低半字节交换', example: 'SWAP A ; A7H→7AH' },
      { instr: 'RLC', syntax: 'RLC A', desc: '带CY循环左移(9位)', example: 'RLC A ; CY=0,81H → 02H,CY=1' },
    ],
    realWorldApplications: [
      '通信数据帧校验 — 串口/网络协议用校验和验证完整性，与本实验末段算法同源',
      '电表/水表计费显示 — BCD 运算配合 DA A 修正，保证十进制数字不出错',
      '传感器数据换算 — MUL/DIV 把 ADC 原始值换算成温度、电压等物理量',
      '缓冲区批量搬移 — @Ri 间接寻址+DJNZ 是显存刷新、数据包拷贝的基本骨架',
    ],
    commonMistakes: [
      { mistake: '立即寻址与直接寻址混淆', explanation: 'MOV A,#30H 取的是数值 30H，MOV A,30H 取的是 30H 单元的内容——一个 # 号之差，结果完全不同。' },
      { mistake: '多字节加法高字节用了 ADD', explanation: '低字节 ADD 产生的进位保存在 CY 里，高字节必须用 ADDC 才能把它加进来，否则和会少 100H。' },
      { mistake: 'DA A 用在非 BCD 加法之后', explanation: 'DA A 只能修正 ADD/ADDC 之后的 BCD 结果，不能修正 SUBB，也不能把任意二进制数"变成"BCD。' },
      { mistake: 'SUBB 前忘记清 CY', explanation: 'SUBB 总是连同 CY 一起减，第一次减法前必须 CLR C，否则结果可能凭空少 1。' },
      { mistake: 'RL 与 RLC 混用', explanation: 'RL 是 8 位自环，RLC 把 CY 串进移位链构成 9 位循环；第三段 57H/58H 两次 RLC 的结果差异正来自 CY 的参与。' },
    ],
    thinkingQuestions: [
      '把 SRC_TAB 换成自己学号的 12 个字节，手算三段结果与 5FH 校验和，再与内存面板核对是否一致。',
      'BB99H+CCAAH 的第 17 位进位是怎样经 CY 一步步传到 43H 的？若把 ADDC 换成 ADD 会得到什么错误结果？',
      '87H+95H 直接相加得 1CH 为什么不是合法 BCD？DA A 依据哪些条件决定补 6？',
      '校验和为什么取模 256（丢弃进位）？如果两个字节互换位置，加法校验和能发现吗？换成 XRL 异或校验呢？',
    ],
  },

  // ═══════════════════════════════════════════════
  // 实验三：定时/计数器实验
  // ═══════════════════════════════════════════════
  exp03: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第5章 中断系统及定时/计数器',
      hours: 2,
      hoursLabel: '对应大纲实验3',
      sourceNote: '大纲表3“定时器/计数器实验”（2学时）；完整要求还包含外部计数与串口显示。',
      courseObjectives: '表2对应目标2、3、4。',
      textbookRef: '大纲表2第5章5.3—5.4；表3实验3。',
      knowledgeMap: '平台5 中断系统、6 定时器/计数器',
      ideologicalPoint: '精确测量与中国计量技术发展（科技创新）',
    },
    objectives3D: {
      knowledge: ['理解定时器/计数器工作方式与 TMOD/TCON 寄存器', '掌握定时初值的计算方法'],
      ability: ['能配置定时器产生精确的方波与定时信号', '学会用中断方式处理定时事件'],
    },
    keyPoints: {
      focus: ['TMOD/TCON 的配置与定时初值计算', '定时器中断的响应流程'],
      difficulty: ['方式1 溢出后需软件重装初值', '中断向量与中断服务程序的对应'],
    },
    ideological: {
      theme: '精益求精 · 精确的力量',
      insights: [
        '定时初值差一个数，方波周期就偏一截——精确定时是工业控制、通信、数字计量的共同基础。',
        '从北斗授时到高铁调度，越是关键的系统越依赖"准"；把一个 50ms 定时做到分毫不差，就是在练这份严谨。',
      ],
      goldenQuote: '差之毫厘，谬以千里——定时的精度，就是产品的底气。',
    },
    theory: [
      {
        title: '8051 定时器/计数器原理',
        content: `8051 有 2 个 16 位定时器/计数器 (T0, T1)。

工作原理：
  定时模式：每个机器周期计数器 +1 (f_osc/12)
  计数模式：T0/T1 引脚外部脉冲下降沿 +1

12MHz 晶振下：
  1 个机器周期 = 12 / 12MHz = 1μs
  最大定时 = 65536μs ≈ 65.5ms (模式1)

TMOD 寄存器 (89H, 不可位寻址):
  D7  D6  D5  D4 | D3  D2  D1  D0
  GATE C/T M1  M0 | GATE C/T M1  M0
  ← T1 控制 →    ← T0 控制 →

  GATE: 0=仅 TR 控制, 1=TR+INT 双重控制
  C/T:  0=定时模式, 1=计数模式
  M1M0: 00=模式0(13位), 01=模式1(16位)
         10=模式2(8位自动重装), 11=模式3(拆分)`,
      },
      {
        title: '定时初值计算',
        content: `模式1 (16位) 定时初值计算公式：

  初值 = 65536 - 定时时间(μs) / 机器周期(μs)

例：12MHz 晶振定时 50ms
  机器周期 = 1μs
  初值 = 65536 - 50000 = 15536 = 3CB0H
  → TH0 = 3CH, TL0 = 0B0H

模式2 (8位自动重装)：
  初值 = 256 - 定时时间(μs)
  最大定时 = 256μs

常用定时参数 (12MHz):
  10ms:  初值 = 65536-10000 = 55536 = D8F0H
  20ms:  初值 = 65536-20000 = 45536 = B1E0H
  50ms:  初值 = 65536-50000 = 15536 = 3CB0H

适用条件：上述参数采用经典12T内核、12MHz晶振，计数间隔为1μs。模式1从初值连续计到溢出后不会自动装回该初值，重复定时需要软件重装；实际周期须计入响应及重装开销。模式2由硬件将TH中的预置值重装到TL。超过单次计数范围的长定时应分段累计，并检查计数起点和误差累积。`,
      },
      {
        title: '中断系统',
        content: `8051 有 5 个中断源：

同级同时请求的查询次序（从上到下）:
中断源         中断向量    名称
      INT0     0003H      外部中断0
      T0       000BH      定时器0溢出
      INT1     0013H      外部中断1
      T1       001BH      定时器1溢出
      UART     0023H      串口中断
复位后IP各优先级位均为0，各源同属低优先级；可通过IP设置高、低两级。
上述查询次序不表示五个可嵌套的优先级。

IE 寄存器 (A8H, 可位寻址):
  EA — — ES ET1 EX1 ET0 EX0
  |                              |
  总开关                    各个中断使能

经典8051的IE.6和IE.5为保留位；ET2属于8052等含T2的扩展型号，不能套用到本节五中断源模型。
参考：Philips《80C51 family programmer’s guide and instruction set》表1（印刷页80）。
https://www.keil.com/dd/docs/datashts/philips/p51_pg.pdf

中断响应过程：
  1. 硬件自动将 PC 压栈 (SP+1, SP+1)
  2. PC ← 中断向量地址
  3. 执行中断服务程序
  4. RETI → 硬件恢复 PC (弹栈)`,
      },
    ],
    circuitDescription: `
┌──────────────┐
│   AT89C51    │
│              │
│  P0.0 ──────├── LED (方波指示)
│              │
│  T0 (内部)   │  12MHz 晶振
│  ┌──────┐    │  → 1μs 机器周期
│  │TH0|TL0│   │  → 50ms 定时
│  │3CH|B0H│   │  → 20次=1s
│  └──────┘    │
│              │
│  中断向量：   │
│  000BH→T0_INT│
└──────────────┘
方波周期 = 2s (每1s翻转P0.0)`,
    registerReference: [
      {
        name: 'TMOD',
        address: '89H',
        bits: ['GATE₁', 'C/T₁', 'M1₁', 'M0₁', 'GATE₀', 'C/T₀', 'M1₀', 'M0₀'],
        description: '定时器模式寄存器，不可位寻址',
      },
      {
        name: 'TCON',
        address: '88H',
        bits: ['TF1', 'TR1', 'TF0', 'TR0', 'IE1', 'IT1', 'IE0', 'IT0'],
        description: '定时器控制寄存器，可位寻址',
      },
      {
        name: 'IE',
        address: '0A8H',
        bits: ['EA', '—', '—', 'ES', 'ET1', 'EX1', 'ET0', 'EX0'],
        description: '经典8051中断使能寄存器，EA为总开关；IE.5保留，ET2仅属于8052等扩展型号',
      },
    ],
    stepByStep: [
      { step: '1. 配置 TMOD', detail: 'MOV TMOD, #01H → T0 模式1 (16位定时)' },
      { step: '2. 装载初值', detail: 'TH0=3CH, TL0=B0H → 定时 50ms' },
      { step: '3. 开中断', detail: 'SETB ET0 → 允许 T0 中断; SETB EA → 开总中断' },
      { step: '4. 启动定时器', detail: 'SETB TR0 → 启动 T0 计数' },
      { step: '5. 主程序等待', detail: 'SJMP LOOP → CPU 空转等待中断' },
      { step: '6. 中断服务', detail: '每 50ms 进入一次中断，重装初值，R0 减 1' },
      { step: '7. 方波翻转', detail: 'R0=0 时 (20次×50ms=1s)，CPL P0.0 翻转输出' },
    ],
    instructionRef: [
      { instr: 'SETB', syntax: 'SETB bit', desc: '位置1', example: 'SETB TR0  ; 启动T0' },
      { instr: 'CLR', syntax: 'CLR bit', desc: '位清0（查询方式需手动清TF0；中断响应时硬件自动清除）', example: 'CLR TR0   ; 停止定时器' },
      { instr: 'CPL', syntax: 'CPL bit', desc: '位取反', example: 'CPL P0.0  ; 翻转输出' },
      { instr: 'LJMP', syntax: 'LJMP addr16', desc: '长跳转(64KB)', example: 'LJMP T0_INT' },
      { instr: 'RETI', syntax: 'RETI', desc: '中断返回', example: 'RETI' },
    ],
    realWorldApplications: [
      '工业 PLC 定时控制 — 精确的时序控制和周期操作',
      '电子钟/秒表 — 利用定时器中断实现精确计时',
      'PWM 调速 — 通过定时器生成 PWM 波形控制电机转速',
      '超声波测距 — 精确计时计算声波传播时间',
      '心率监测 — 通过脉冲间隔测量心率',
    ],
    commonMistakes: [
      { mistake: '模式1忘记重装初值', explanation: '模式1不自动重装，溢出后 TH0/TL0 变为 0000H。必须在中断中手动重装。模式2才有自动重装功能。' },
      { mistake: 'EA 忘记置1', explanation: 'IE 寄存器中 EA 是总中断开关，即使 ET0=1，如果 EA=0 也无法响应中断。' },
      { mistake: '中断服务程序太长', explanation: '中断程序应尽量短，否则会影响主程序执行和其他中断响应。复杂处理应放在主程序中用标志位通知。' },
      { mistake: '中断中没有保护现场', explanation: '中断可能在任何时刻打断主程序，必须 PUSH ACC / PUSH PSW 保护被修改的寄存器。' },
    ],
    thinkingQuestions: [
      '如果晶振换为 11.0592MHz，定时 50ms 的初值应该是多少？',
      '模式1和模式2各有什么优缺点？什么场景用模式2更合适？',
      '为什么中断向量地址只有 8 字节空间 (如 000BH~0012H)？通常怎么处理？',
      '如何用两个定时器同时产生两个不同频率的方波？',
    ],
    animations: [
      { id: 'timer-counter', title: '定时器T0方式1 — 16位计数与溢出' },
    ],
  },

  // ═══════════════════════════════════════════════
  // 实验四：数码管显示实验
  // ═══════════════════════════════════════════════
  exp04: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第9章 人机接口：LED显示',
      hours: 2,
      hoursLabel: '对应大纲实验5',
      sourceNote: '大纲表3“LED数码管动静态显示实验”（2学时）；平台编号不等于大纲实验序号。',
      courseObjectives: '表2对应目标3、4。',
      textbookRef: '大纲表2第9章9.2；表3实验5。',
      knowledgeMap: '平台8.1 显示接口、3.1.5 变址寻址',
      ideologicalPoint: '严谨的工程思维（工匠精神）',
    },
    objectives3D: {
      knowledge: ['理解七段数码管段码编码与共阴/共阳区别', '掌握动态扫描显示与查表（MOVC）程序设计'],
      ability: ['能编写多位数码管动态显示程序', '学会用定时器中断驱动稳定的扫描刷新'],
    },
    keyPoints: {
      focus: ['段码编码与查表（MOVC）程序设计', '动态扫描的位选与段选配合'],
      difficulty: ['动态扫描的刷新时序（消隐与残影）', '共阴/共阳段码的区别'],
    },
    ideological: {
      theme: '工匠精神 · 严谨细致',
      insights: [
        '段码表错一位，屏上就显示一个错字；动态扫描靠的是几毫秒级的精确时间配合——细节决定成败。',
        '查表法用一张段码表换来又快又稳的显示，是"用空间换时间"的工程智慧，也是权衡取舍的日常。',
      ],
      goldenQuote: '一个 bit 的错位，屏上就是一个错字——工程师的严谨，藏在每一位里。',
    },
    theory: [
      {
        title: '七段数码管原理',
        content: `七段数码管由 7 个 LED 段 + 1 个小数点组成：

     ──a──
    |     |
    f     b
    |     |
     ──g──
    |     |
    e     c
    |     |
     ──d──  .dp

共阴数码管段码表 (高电平亮):
  0: 3FH (0011 1111)  a,b,c,d,e,f
  1: 06H (0000 0110)  b,c
  2: 5BH (0101 1011)  a,b,d,e,g
  3: 4FH (0100 1111)  a,b,c,d,g
  4: 66H (0110 0110)  b,c,f,g
  5: 6DH (0110 1101)  a,c,d,f,g
  6: 7DH (0111 1101)  a,c,d,e,f,g
  7: 07H (0000 0111)  a,b,c
  8: 7FH (0111 1111)  全亮
  9: 6FH (0110 1111)  a,b,c,d,f,g

本表按bit0—bit6对应a—g、bit7对应dp排列。若改用同位序的共阳数码管，段驱动变为低有效，应逐位取反；例如共阴0为3FH，保持dp关闭的共阳0为C0H。实物还须核对位驱动器是否另有反相。`,
      },
      {
        title: '动态扫描技术',
        content: `多位数码管驱动 — 动态扫描:

原理：利用人眼视觉暂留 (约 50ms)，轮流快速
点亮各位数码管，看起来好像同时亮。

扫描频率要求：
  每位显示 1~2ms，4位数码管一轮 4~8ms
  刷新率 > 60Hz (16ms内) → 无闪烁

步骤：
  1. 关闭所有位选 (消隐)
  2. 输出当前位的段码到 P0
  3. 打开当前位的位选 (P2.x=0)
  4. 延时 1~2ms
  5. 切换到下一位，重复`,
      },
      {
        title: 'MOVC 查表指令',
        content: `MOVC A, @A+DPTR — 代码空间查表

步骤：
  1. MOV DPTR, #TAB  ; DPTR 指向表头
  2. MOV A, #index   ; A = 要查的索引
  3. MOVC A, @A+DPTR ; A ← Code[DPTR+A]

DB 伪指令在代码空间定义数据表:
  TAB: DB 3FH, 06H, 5BH, ...

注意：
  • MOVC 只能读代码空间 (ROM)
  • A+DPTR 范围 0~65535
  • 查表后 A 的值被替换为表中数据`,
      },
    ],
    circuitDescription: `
┌──────────────┐     4位共阴数码管
│   AT89C51    │      千 百 十 个
│              │     ┌──┬──┬──┬──┐
│  P0 (段选) ──├───→ │a~g+dp        │
│              │     └──┴──┴──┴──┘
│  P2.4 ───────├───→  位选(千位)
│  P2.5 ───────├───→  位选(百位)
│  P2.6 ───────├───→  位选(十位)
│  P2.7 ───────├───→  位选(个位)
│              │
│  T1 中断 ────├── 2ms扫描定时
└──────────────┘`,
    registerReference: [
      {
        name: 'DPTR',
        address: 'DPH:83H DPL:82H',
        bits: ['DPH[7:0]', 'DPL[7:0]'],
        description: '16位数据指针，用于 MOVC/MOVX 寻址',
      },
    ],
    stepByStep: [
      { step: '1. 建立段码表', detail: '用 DB 在代码空间存储 0~F 的七段码' },
      { step: '2. 配置定时器', detail: 'T1 模式1, 2ms定时, 用于扫描刷新' },
      { step: '3. 初始化变量', detail: 'RAM 20H~23H 存储千/百/十/个位数字' },
      { step: '4. 中断扫描', detail: '每 2ms 显示一位, 4位轮流, 8ms一轮' },
      { step: '5. 主程序计数', detail: '每秒将数值+1, 用 DIV AB 分解各位' },
    ],
    instructionRef: [
      { instr: 'MOVC', syntax: 'MOVC A, @A+DPTR', desc: '查表取码', example: 'MOVC A, @A+DPTR' },
      { instr: 'DIV', syntax: 'DIV AB', desc: 'A÷B, 商→A, 余→B', example: 'DIV AB ; A=25/10→A=2,B=5' },
      { instr: 'DB', syntax: 'DB data1,data2,...', desc: '定义字节数据', example: 'DB 3FH,06H,5BH' },
    ],
    realWorldApplications: [
      '电子秤显示 — 重量数值实时显示',
      '温度计显示 — 传感器数据的数字化显示',
      '电梯楼层显示 — 大尺寸七段数码管',
      '加油机/计价器 — 油量和金额的动态显示',
      '频率计 — 测量信号频率并数字化显示',
    ],
    commonMistakes: [
      { mistake: '没有消隐导致重影', explanation: '切换位选前必须先关闭所有位选，否则上一位的段码会短暂显示在下一位上，产生"鬼影"。' },
      { mistake: '扫描太慢导致闪烁', explanation: '每位显示时间过长(>5ms)或位数过多会导致刷新率不足，肉眼可见闪烁。保持单位 1~2ms。' },
      { mistake: 'DPTR 被中断修改', explanation: '如果主程序和中断都使用 DPTR，必须在中断中 PUSH DPH/DPL 保护。' },
    ],
    thinkingQuestions: [
      '共阳数码管和共阴数码管的段码有什么关系？如何快速转换？',
      '如果要显示 8 位数码管，扫描频率需要提高到多少？',
      '为什么实际产品中常用专用驱动芯片 (如 TM1637) 而非直接扫描？',
    ],
  },

  // ═══════════════════════════════════════════════
  // 实验五：按键输入与消抖
  // ═══════════════════════════════════════════════
  exp05: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第9章 人机接口：键盘接口',
      hours: 0,
      hoursLabel: '平台练习',
      sourceNote: '大纲表2第9章9.1包含键盘接口；未单列本平台按键消抖任务的实践学时。',
      courseObjectives: '表2对应目标3、4。',
      textbookRef: '大纲表2第9章9.1；本任务采用轮询，不能替代表3实验4的外部中断要求。',
      knowledgeMap: '平台8.2.1 独立按键、8.2.3 按键消抖；8.2.2 矩阵键盘仅作实物拓展',
      ideologicalPoint: '严谨的工程思维（工匠精神）',
    },
    objectives3D: {
      knowledge: ['理解独立按键的低有效输入与软件消抖原理', '区分同键确认、等待释放与矩阵扫描拓展'],
      ability: ['能轮询 P3.0–P3.3 并将单键编码为0–3', '能通过键值与计数验证长按、换键及释放重按行为'],
    },
    keyPoints: {
      focus: ['一次采样识别单键，两次同键才接受', '确认四路均已释放后再接受下一次按键'],
      difficulty: ['区分换键、多键与全部释放', '区分理论延时（机器周期）与可调速画面的墙钟时间'],
    },
    ideological: {
      theme: '严谨务实 · 细节见真章',
      insights: [
        '按键抖动只有几毫秒，处理不好就误触发——真实世界的信号从来不干净，工程师要学会和"不完美"打交道。',
        '用软件消抖还是硬件消抖，是成本与可靠性的取舍，没有标准答案，只有对场景最合适的选择。',
      ],
      goldenQuote: '连几毫秒的抖动都要认真对待——可靠，是一点点抠出来的。',
    },
    theory: [
      {
        title: '四路独立按键与同键确认',
        content: `当前预置程序使用 P3.0–P3.3 四路独立低有效输入；按住画布按钮拉低对应位，松开回高。它不模拟机械触点波形、16键矩阵或外部中断。

一次采样读 P3 低4位：
1110B → 键0；1101B → 键1；1011B → 键2；0111B → 键3。
1111B 表示全部松开；其余组合表示同时多键，不作为有效单键。

处理过程：
1. 读到一个单键，保存候选键值。
2. 延时后再次采样，只有同一键值才接受；换键、释放或多键均拒绝本次候选。
3. 接受后把键值写入 P0、20H，并使21H有效按键次数增加一次。
4. 无论接受或拒绝，都等待四路全高；延时后再次全高，才允许下一次按键。

P0、20H保留最后有效键值，初始为FFH；21H是8位计数，超过255回到0。两次采样相同只验证采样时刻的状态，实物仍应测量触点抖动并调整消抖间隔。`,
      },
      {
        title: '消抖延时的条件与寄存器保护',
        content: `DELAY_20MS 使用组0的R6、R7计数，入口压栈保存，出口按相反顺序恢复；A与其他寄存器保持原值。程序明确选择寄存器组0，SP初始化为2FH，使堆栈避开20H–22H变量。PUSH采用直接地址并先将SP加1再存入数据，因此首个压栈字节写到30H；组0的R6对应直接地址06H，不能把PUSH 06H误读为压入立即数6。

按12MHz晶振、每机器周期12个晶振周期计算，含ACALL的一次延时为20313机器周期，约20.313ms。该值依据指令周期计算，不是所有8051兼容芯片的固定时间。
当前仿真按指令数推进，运行速度也可调整，不能把画布墙钟时间作为实物20ms的验证结果。
指令周期参考：Philips《80C51 family programmer’s guide and instruction set》表7（印刷页92–93）：https://www.keil.com/dd/docs/datashts/philips/p51_pg.pdf`,
      },
      {
        title: '实物拓展：4×4矩阵键盘',
        content: `4×4矩阵键盘用4条行线与4条列线连接16个交点。单键扫描时依次使一行输出低电平，其余行保持高电平，再读取列状态；键值可编码为行号×4+列号（0–15）。

这是实物或另建行列联动模型后的拓展任务。当前四个按钮只向P3注入独立电平，没有P1行线与交点连通模型，不能据此验证16键扫描。外部中断接线与处理也不属于本预置程序。`,
      },
    ],
    circuitDescription: `
四路独立常开按键（实物连接示意）：
P3.0 ── 键0 ── GND
P3.1 ── 键1 ── GND
P3.2 ── 键2 ── GND
P3.3 ── 键3 ── GND

P3输入前先写1；实物上拉方式按所用器件与板卡核实。
P0输出0–3的二进制键值；画布直接显示该端口值。
实物显示需另配合适的驱动与上拉，不能将画布显示等同于已搭建显示电路。
P1不参与本预置程序；P3.2虽有INT0复用功能，本程序仅按普通输入轮询。`,
    registerReference: [],
    stepByStep: [
      { step: '1. 初始化', detail: '选择寄存器组0，SP=2FH；P3写FFH；P0与20H初值FFH，21H计数初值0' },
      { step: '2. 读取单键', detail: '从P3低4位的一次采样识别键0–3；无键或同时多键继续查询' },
      { step: '3. 同键确认', detail: '延时后再次读取，只有键值与候选值相同才接受；期间换键不接受旧键' },
      { step: '4. 观察输出', detail: 'P0、20H保留最后有效键值；21H计数增加一次，持续按住不再增加' },
      { step: '5. 稳定释放', detail: '四路均回高，延时后再次全高，再允许下一次按键；释放后重按应再次计数' },
    ],
    instructionRef: [
      { instr: 'ANL', syntax: 'ANL A, #data', desc: '逻辑与', example: 'ANL A, #0FH ; 取低4位' },
      { instr: 'CJNE', syntax: 'CJNE A, direct, rel', desc: '比较键值，不同则跳转', example: 'CJNE A, 22H, WAIT_RELEASE ; 换键则拒绝本次候选' },
      { instr: 'PUSH/POP', syntax: 'PUSH direct / POP direct', desc: '保存并恢复子程序使用的寄存器', example: 'PUSH 06H ; 保存组0的R6，返回前POP 06H' },
      { instr: 'DJNZ', syntax: 'DJNZ Rn, rel', desc: '寄存器减1，非零继续循环', example: 'DJNZ R6, D20_INNER ; 延时内层计数' },
    ],
    realWorldApplications: [
      '电梯按钮面板 — 可靠的按键检测和楼层选择',
      '微波炉控制面板 — 多键组合和长按识别',
      '密码锁 — 键盘输入密码并验证',
      'ATM 机键盘 — 安全的数字输入',
      '遥控器 — 红外编码键盘',
    ],
    commonMistakes: [
      { mistake: '只确认任意键仍按下', explanation: '确认期间换键会误接旧键值，应比较两次单键编码是否完全相同。' },
      { mistake: '用无有效单键代替全部释放', explanation: '同时多键也返回FFH，但仍有输入为低；必须直接确认P3低4位全部为1。' },
      { mistake: '只加延时而不等待释放', explanation: '长按仍会重复触发，应完成两次全高确认后再接受下一次按键。' },
      { mistake: '把四个按钮当16键矩阵', explanation: '当前输入不随行扫描变化，矩阵键盘必须另有行列交点模型或实物连接。' },
    ],
    thinkingQuestions: [
      '如何区分短按和长按？需要什么数据结构？',
      '同时按下两键时为何不能把FFH返回值当作全部释放？',
      '如何在实物上测量抖动时间，并据此调整两次采样的间隔？',
    ],
    animations: [
      { id: 'stack-pushpop', title: '堆栈操作 — PUSH/POP与子程序调用' },
    ],
  },

  // ═══════════════════════════════════════════════
  // 实验六：定时器中断与计时功能
  // ═══════════════════════════════════════════════
  exp06: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第5章 定时中断、第9章 LED显示',
      hours: 2,
      hoursLabel: '对应大纲实验7',
      sourceNote: '大纲表3“电子时钟显示实验”（2学时）；完整要求包括每间隔1分钟蜂鸣报警。',
      courseObjectives: '表2第5章对应目标2、3、4；第9章对应目标3、4。',
      textbookRef: '大纲表2第5、9章；表3实验7。',
      knowledgeMap: '平台5 中断系统、6 定时器/计数器、8.1 显示接口',
      ideologicalPoint: '实时系统与安全关键系统（科技伦理）',
    },
    objectives3D: {
      knowledge: ['理解中断系统结构与 IE/IP 寄存器', '掌握用定时中断实现秒/分/时计时'],
      ability: ['能编写中断服务程序完成实时计时', '学会用多个变量维护时间并进位'],
    },
    keyPoints: {
      focus: ['定时中断的初始化与初值重装', '软件计数实现 1 秒基准'],
      difficulty: ['中断响应流程与优先级的理解', '计时的 60 进制进位处理'],
    },
    ideological: {
      theme: '实时与责任 · 科技向善',
      insights: [
        '时钟差一秒，在高铁调度、电网同步里可能就是一次事故——实时系统的每一拍都连着安全。',
        '中断优先级怎么排，本质是在有限资源里决定"什么最重要"，既是工程，也是价值判断。',
      ],
      goldenQuote: '越是关键的系统，越要把"准时"刻进骨子里。',
    },
    theory: [
      {
        title: '双定时器协同工作',
        content: `本实验同时使用 T0 和 T1：

T0 — 计时引擎 (50ms × 20 = 1s)
  TMOD 低4位: 0001B (模式1, 16位)
  功能: 秒/分/时的计时基准

T1 — 显示引擎 (2ms × 4位 = 8ms 刷新)
  TMOD 高4位: 0001B (模式1, 16位)
  功能: 4位数码管动态扫描

TMOD = 00010001B = 11H (两个定时器都是模式1)

中断关系（本实验未设置 IP）：
  两个中断同为默认低优先级，互不嵌套
  同时请求时按自然查询顺序先响应 T0 (000BH)
  T1 (001BH) 的扫描请求随后得到响应，仅晚几十微秒

注意：两个中断都需要在 ISR 中重装初值(模式1)`,
      },
      {
        title: '实时时钟算法',
        content: `时间进位逻辑 (BCD 或二进制)：

  秒 +1 → 秒 ≥ 60? → 秒=0, 分+1
  分 +1 → 分 ≥ 60? → 分=0, 时+1
  时 +1 → 时 ≥ 24? → 时=0

RAM 分配：
  20H: 小时 (0~23)
  21H: 分钟 (0~59)
  22H: 秒   (0~59)
  23H: 50ms 计数器 (0~19)

DIV AB 分解十位和个位：
  MOV A, 20H    ; 例: A=12
  MOV B, #10
  DIV AB        ; A=1 (十位), B=2 (个位)`,
      },
    ],
    circuitDescription: `
┌──────────────┐     4位数码管
│   AT89C51    │     ┌──┬──┬──┬──┐
│  P0 (段选) ──├───→ │时十│时个│分十│分个│
│  P2.4~P2.7 ──├───→ │位选│位选│位选│位选│
│              │     └──┴──┴──┴──┘
│  P3.2 ───────├── 模式切换键
│  P3.3 ───────├── 小时设置键
│  P3.4 ───────├── 分钟设置键
│              │
│  T0: 50ms计时│  T1: 2ms扫描
└──────────────┘`,
    registerReference: [
      {
        name: 'TMOD',
        address: '89H',
        bits: ['GATE₁', 'C/T₁', 'M1₁', 'M0₁', 'GATE₀', 'C/T₀', 'M1₀', 'M0₀'],
        description: '本实验 TMOD=11H：T0、T1 都工作在模式1（16位定时）',
      },
      {
        name: 'IE',
        address: '0A8H',
        bits: ['EA', '—', '—', 'ES', 'ET1', 'EX1', 'ET0', 'EX0'],
        description: '本实验 SETB ET0/ET1/EA 同时打开双定时器中断',
      },
    ],
    stepByStep: [
      { step: '1. 双定时器初始化', detail: 'TMOD=11H, T0定时50ms, T1定时2ms' },
      { step: '2. 开双中断', detail: 'SETB ET0; SETB ET1; SETB EA' },
      { step: '3. 初始化时间', detail: 'RAM 20H~22H 设初始时间 12:30:00' },
      { step: '4. T0 中断计时', detail: '每50ms进入, 计数20次=1s, 进位秒→分→时' },
      { step: '5. T1 中断显示', detail: '每2ms扫描一位, 4位轮流, DIV AB分解数字' },
      { step: '6. 按键调时', detail: 'JNB P3.x 检测按键, 加消抖, 调整时间' },
    ],
    instructionRef: [
      { instr: 'RETI', syntax: 'RETI', desc: '中断返回(恢复中断系统)', example: 'RETI' },
      { instr: 'JNB', syntax: 'JNB bit, rel', desc: '位=0时跳转', example: 'JNB P3.2, SET_MODE' },
      { instr: 'JB', syntax: 'JB bit, rel', desc: '位=1时跳转', example: 'JB 24H.0, DISPLAY_MIN_SEC ; 模式位=1显示分:秒' },
    ],
    realWorldApplications: [
      '电子手表 — 精确计时与多模式显示',
      '工厂计时器 — 生产线工时统计',
      '微波炉/烤箱定时 — 倒计时控制',
      '考试计时系统 — 精确的开考/交卷控制',
    ],
    commonMistakes: [
      { mistake: '误以为 T0 和 T1 中断会互相嵌套', explanation: 'IP 未设置时两个中断同级，不会互相打断；但都会打断主程序，各 ISR 仍须 PUSH/POP 保护 ACC/PSW（本实验做法）。若确需嵌套，要用 IP 设不同优先级并配合寄存器组切换 (RS0/RS1)。' },
      { mistake: '时间进位逻辑顺序错', explanation: '必须先检查秒→分→时的进位链。如果顺序反了会跳过某些进位。' },
    ],
    thinkingQuestions: [
      '如何提高计时精度？(提示：考虑中断响应延迟和重装初值的时机)',
      '如果要实现闹钟功能，程序结构需要怎样修改？',
      '能否用模式2(自动重装)替代模式1？有什么限制？',
    ],
    animations: [
      { id: 'interrupt-flow', title: '中断响应流程 — 从触发到返回' },
      { id: 'timer-counter', title: '定时器计数与溢出过程' },
    ],
  },

  // ═══════════════════════════════════════════════
  // 实验七：蜂鸣器音频控制
  // ═══════════════════════════════════════════════
  exp07: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第9章 人机接口：蜂鸣器',
      hours: 2,
      hoursLabel: '对应大纲实验6',
      sourceNote: '大纲表3“蜂鸣器控制实验”（2学时）；本平台旋律练习用于理解频率控制，课程还要求间断与救护车发声。',
      courseObjectives: '对应课程目标3、4。',
      textbookRef: '大纲表2第9章9.3；表3实验6。',
      knowledgeMap: '平台6.3 定时器应用、8 接口技术',
      ideologicalPoint: '精确测量与中国计量技术发展（科技创新）',
    },
    objectives3D: {
      knowledge: ['理解方波频率与音调的关系', '掌握用定时器控制蜂鸣器发声'],
      ability: ['能编写不同频率的发声程序', '学会用查表播放简单旋律'],
    },
    keyPoints: {
      focus: ['方波周期与音调频率的换算', '无源蜂鸣器的驱动方式'],
      difficulty: ['音符时长与节拍的控制', '定时初值随频率变化的计算'],
    },
    ideological: {
      theme: '学以致用 · 精益求精',
      insights: [
        '同一个定时器，改一改方波频率就是不同的音调——把抽象的寄存器变成能听见的旋律，理解就有了乐趣。',
        '提示音、报警声背后是人机交互的用心，好产品把体贴藏在每一个细节里。',
      ],
      goldenQuote: '把技术做得有温度，用户才愿意用。',
    },
    theory: [
      {
        title: '音频频率与音调',
        content: `音乐中的音符对应特定频率：

标准音 A4 = 440Hz

中音音阶频率 (Hz):
  Do(1)=523  Re(2)=587  Mi(3)=659  Fa(4)=698
  Sol(5)=784 La(6)=880  Si(7)=988

低音 = 频率÷2, 高音 = 频率×2

方波产生: 定时器定时 T = 1/(2×f)
  例: 中音 Do (523Hz)
  半周期 = 1/(2×523) = 956μs
  定时器初值 = 65536 - 956 = 64580 = FC44H

蜂鸣器类型：
  有源蜂鸣器: 给电就响(固定频率), 只需高低电平控制
  无源蜂鸣器: 需要方波驱动, 频率决定音调`,
      },
      {
        title: '音乐编码方法',
        content: `简谱编码格式: (音符, 节拍) 成对存储

音符编码 (音符 n 对应 FREQ_TAB 第 n-1 项):
  0 = 休止符
  1~7  = 低音 Do~Si (262~494Hz)
  8    = 中音 Do (523Hz, 频率表衔接处有两个入口)
  9~15 = 中音 Do~Si (523~988Hz)
  16   = 高音 Do (1046Hz, 同样双入口)
  17~23 = 高音 Do~Si，24 = 倍高音 Do (2093Hz)

节拍编码 (节拍值×基准25 装入8位计数器):
  2 = 半拍 (50 次中断)
  4 = 1拍  (100 次中断)
  8 = 2拍  (200 次中断，最长——8×25=200 不超 8 位)

《小星星》编码:
  1,4, 1,4, 5,4, 5,4  → do do sol sol
  6,4, 6,4, 5,8       → la la sol—
  ...
  0FFH = 结束标志`,
      },
    ],
    circuitDescription: `
┌──────────────┐
│   AT89C51    │     无源蜂鸣器
│              │     ┌────┐
│  P2.0 ──────├──┤ NPN ├──┤ BEEP ├── VCC
│              │     └────┘  └────┘
│              │   2N2222/S8050
│  T0 中断 ────├── 产生方波频率
│              │
│  频率表: DW  │── 每个音符的定时器初值
│  音乐数据: DB│── (音符,节拍) 对
└──────────────┘
注: 三极管放大驱动, 集电极接蜂鸣器`,
    registerReference: [],
    stepByStep: [
      { step: '1. 建立频率表', detail: 'DW 存储每个音符对应的定时器初值 (16位)' },
      { step: '2. 编码音乐', detail: 'DB 存储 (音符,节拍) 数据对, 0FFH结束' },
      { step: '3. 读取音符', detail: 'MOVC 从数据表读取当前音符和节拍' },
      { step: '4. 设定频率', detail: '根据音符索引查频率表, 装入 TH0/TL0' },
      { step: '5. T0 中断翻转', detail: '定时器溢出时 CPL P2.0 产生方波' },
      { step: '6. 节拍控制', detail: '延时对应节拍时长后切换到下一个音符' },
    ],
    instructionRef: [
      { instr: 'DW', syntax: 'DW word1,word2,...', desc: '定义16位字数据', example: 'DW 0F88CH, 0F95BH' },
      { instr: 'CPL', syntax: 'CPL bit', desc: '位取反(翻转)', example: 'CPL P2.0 ; 产生方波' },
      { instr: 'DEC', syntax: 'DEC A', desc: '减1', example: 'DEC A  ; 音符1对应索引0' },
      { instr: 'MUL', syntax: 'MUL AB', desc: 'A×B，低字节→A 高字节→B', example: 'MUL AB ; 索引×2 定位频率表 / 节拍×25' },
    ],
    realWorldApplications: [
      '门铃 — 播放预设旋律的电子门铃',
      '报警器 — 不同频率表示不同报警级别',
      '电子琴 — 按键触发不同音符',
      '倒车雷达 — 距离越近蜂鸣频率越高',
      '音乐贺卡 — 开卡触发的音乐芯片',
    ],
    commonMistakes: [
      { mistake: '有源和无源蜂鸣器搞混', explanation: '有源蜂鸣器只需给电平, 无源蜂鸣器需要方波驱动。用错类型会无声或音调固定。' },
      { mistake: '音符间没有间隔', explanation: '连续的相同音符如果没有短暂停顿, 听起来会连成一个长音。需在音符间加 10~30ms 静音。' },
    ],
    thinkingQuestions: [
      '把节拍基准从 25 改成 50，整首曲子会发生什么变化？音调会跟着变吗？为什么？',
      '如果要同时发两个音(和弦), 单片机能做到吗？怎么实现？',
      '为什么真实的音乐芯片音质比单片机方波好得多？',
    ],
  },

  // ═══════════════════════════════════════════════
  // 实验八：步进电机控制
  // ═══════════════════════════════════════════════
  exp08: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第10章 常用外部电路控制程序的设计',
      hours: 2,
      hoursLabel: '对应大纲实验8',
      sourceNote: '大纲表3“电机控制实验”（2学时）同时要求直流电机与四线双极型步进电机；当前仿真采用四相五线模型。',
      courseObjectives: '表2对应目标3、4。',
      textbookRef: '最新第10章课件10.3；第68页（页脚67）说明课程实验四线双极型与双H桥。',
      knowledgeMap: '平台8.5 电机驱动、6.3 定时器应用',
      ideologicalPoint: '精确测量与中国计量技术发展（科技创新）',
    },
    objectives3D: {
      knowledge: ['理解步进电机的相序与步距角', '掌握四相八拍的驱动时序'],
      ability: ['能编写步进电机正反转与调速程序', '学会用延时控制转速'],
    },
    keyPoints: {
      focus: ['相序表的构造与循环输出', '正转/反转的方向控制'],
      difficulty: ['转速与脉冲间隔的关系', '八拍与四拍驱动的区别'],
    },
    ideological: {
      theme: '精密控制 · 中国智造',
      insights: [
        '步进电机一步一个固定角度，靠的是精确的相序控制——工业机器人、3D 打印、数控机床都建立在这份"精准"之上。',
        '从"制造"到"智造"，底层就是把每一个动作控制到分毫不差的能力。',
      ],
      goldenQuote: '毫厘之间的精准，撑起中国智造的底气。',
    },
    theory: [
      {
        title: '步进电机工作原理',
        content: `步进电机 — 脉冲控制的精确定位电机

本平台示例：28BYJ-48四相五线单极型模型，ULN2003单向灌电流驱动。
课程实验：大纲表3实验8及最新第10章课件第68页采用四线双极型电机，需两个H桥反转绕组电流；两种接线不能混用。

示例参数（按标称减速比1:64、八拍半步计算，以实验室 28BYJ-48 为例）：
  4 个线圈 A/B/C/D, 通电顺序决定转向
  步距角: 5.625°/64 (减速比 1:64)
  按上述标称参数，一圈 = 360° ÷ 5.625° × 64 = 4096 个半步
  实物输出角度还取决于实际减速比、负载与丢步情况，仿真步数不等同于实测定位精度。

三种驱动模式：
1. 单四拍 (全步): A→B→C→D
   稳定但力矩小, 4步/周期

2. 双四拍 (全步): AB→BC→CD→DA
   力矩大但功耗高, 4步/周期

3. 八拍 (半步): A→AB→B→BC→C→CD→D→DA
   与全步相比步距角减半，8拍/周期；实际平稳性取决于驱动电流和负载

相序表 (P1高4位控制, 1=对应相通电):
  A相:  P1.4=1        → 10H
  AB相: P1.4+P1.5=1   → 30H
  B相:  P1.5=1        → 20H
  完整八拍: 10H,30H,20H,60H,40H,0C0H,80H,90H
  (低4位留作状态指示, 中断里用ANL/ORL只改高4位)`,
      },
      {
        title: 'ULN2003 驱动芯片',
        content: `ULN2003 — 达林顿晶体管阵列驱动器

特点：
  • 7路达林顿管, 每路可驱动 500mA
  • 内置续流二极管保护
  • 输入兼容 TTL/CMOS 电平
  • 输出开集电极, 可驱动感性负载

连接方式：
  P1.4 → IN1 → OUT1 → A相线圈
  P1.5 → IN2 → OUT2 → B相线圈
  P1.6 → IN3 → OUT3 → C相线圈
  P1.7 → IN4 → OUT4 → D相线圈

注意: ULN2003 是反相器, 输入高=输出低
      所以相序表中 1 表示对应相通电`,
      },
    ],
    circuitDescription: `
┌──────────────┐     ULN2003      步进电机
│   AT89C51    │    ┌───────┐    ┌──────┐
│  P1.4 (A相) ─├──→│IN1 OUT1│──→│ A相   │
│  P1.5 (B相) ─├──→│IN2 OUT2│──→│ B相   │
│  P1.6 (C相) ─├──→│IN3 OUT3│──→│ C相   │
│  P1.7 (D相) ─├──→│IN4 OUT4│──→│ D相   │
│              │    └───────┘    │ COM→5V│
│  P3.2 ───────├── 启停按键       └──────┘
│  P3.3 ───────├── 方向按键
│  P3.4 ───────├── 加速按键
│  P3.5 ───────├── 减速按键
│  P3.6 ───────├── 步进100步按键
│  T0 中断 ────├── 速度控制
└──────────────┘`,
    registerReference: [],
    stepByStep: [
      { step: '1. 建立相序表', detail: 'DB 定义一张8个半步相序数据表，正反转共用该表，仅改变索引增减方向' },
      { step: '2. 定时器控制速度', detail: 'T0定时中断控制步进速度；初始速度5对应F600H，须与速度表相同项一致' },
      { step: '3. 中断中输出相序', detail: '每次中断读取相序表下一项, 输出到 P1 高4位' },
      { step: '4. 方向控制', detail: '正转: 索引 0→7 递增; 反转: 7→0 递减' },
      { step: '5. 速度调节', detail: '修改定时器初值: 初值越大→定时越短→转速越快' },
      { step: '6. 定位模式', detail: '设定目标步数, 到达后自动停止' },
    ],
    instructionRef: [
      { instr: 'ANL', syntax: 'ANL P1, #0FH', desc: '端口位屏蔽', example: 'ANL P1, #0FH ; 保留低4位' },
      { instr: 'ORL', syntax: 'ORL P1, A', desc: '端口位合并', example: 'ORL P1, A   ; 设置高4位' },
      { instr: 'SUBB', syntax: 'SUBB A, #data', desc: '带借位减法', example: 'SUBB A, 24H ; 比较步数' },
    ],
    realWorldApplications: [
      '3D 打印机 — X/Y/Z 三轴步进电机精确定位',
      '数控机床 (CNC) — 刀具的精确运动控制',
      '自动窗帘 — 步进电机控制窗帘开合',
      '摄像头云台 — 水平/垂直方向的角度控制',
      '自动售货机 — 出货机构的精确推送',
    ],
    commonMistakes: [
      { mistake: '相序错误导致电机抖动', explanation: '相序表顺序搞错会导致电机振动不转。务必按 A→AB→B→BC→C→CD→D→DA 的正确顺序。' },
      { mistake: '转速过快电机丢步', explanation: '步进电机有最高启动频率, 超过则无法跟随。应从低速启动逐步加速(S曲线加减速)。' },
      { mistake: '没有续流保护', explanation: '电机线圈是感性负载, 断电瞬间产生高压反电动势。ULN2003 内置续流二极管, 若直接用三极管驱动需外加。' },
    ],
    thinkingQuestions: [
      '按本示例标称参数，28BYJ-48转一圈需要多少个半步？实物需要核对哪些参数？',
      '如何实现 S 曲线加减速？对电机运行有什么好处？',
      '步进电机和伺服电机有什么区别？各适合什么应用？',
    ],
  },

  // ═══════════════════════════════════════════════
  // 实验九：串口通信
  // ═══════════════════════════════════════════════
  exp09: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第6章 微控制器的串行通信技术',
      hours: 4,
      hoursLabel: '对应理论章节',
      sourceNote: '大纲表2第6章为4学时；表3未单列串口实验，本平台任务不能另计为大纲实践学时。',
      courseObjectives: '表2对应目标3、4。',
      textbookRef: '最新第6章课件6.2—6.5；第45—48页（页脚44—47）为波特率设置。',
      knowledgeMap: '平台7 串行通信、6.2 定时器工作模式',
      ideologicalPoint: '物联网与智慧城市建设（科技创新/社会责任）',
    },
    objectives3D: {
      knowledge: ['理解 UART 帧格式与波特率设置', '掌握 SCON/SBUF 与串口工作方式'],
      ability: ['能编写串口收发程序', '学会用定时器1 产生波特率'],
    },
    keyPoints: {
      focus: ['串口初始化与波特率计算', '发送/接收标志 TI/RI 的处理'],
      difficulty: ['波特率与定时器1初值的换算', '收发时序与标志位的清除'],
    },
    ideological: {
      theme: '互联互通 · 自主可控',
      insights: [
        '串口是设备之间对话的第一步——万物互联的时代，通信协议能不能自主可控，关系到整条产业的安全。',
        '波特率、校验位差一点就乱码，通信靠的是双方严格守约，一如工程里的契约精神。',
      ],
      goldenQuote: '让设备开口"说话"，是万物互联的第一课。',
    },
    theory: [
      {
        title: 'UART 串口通信原理',
        content: `UART = 通用异步收发器

数据帧格式：
  起始位(1) + 数据位(8) + 停止位(1)
  │←─── 1个字符 ───→│

  高 ─┐     D0 D1 D2 D3 D4 D5 D6 D7 ┌── 高
  低   └────┘  └──┘  └──┘  └──┘  └──┘
       起始位    8位数据(LSB先)     停止位

波特率 = 每秒传输的位数 (bps)
  常用: 2400, 4800, 9600, 19200, 115200

8051 UART 使用 T1 产生波特率：
  模式1波特率 = (2^SMOD / 32) × (T1溢出率)
  T1 模式2: TH1 = 256 - (2^SMOD × f_osc / (12 × 32 × 波特率))
  以下例子均按经典12T内核、SMOD=0计算；T1作为波特率发生器时不使能ET1。

  12MHz, 9600bps: TH1=256-3.26≈253=FDH
    （取整后实际约10416.67bps，相对9600bps偏差+8.51%，不能作为标准9600配置）
  11.0592MHz, 9600bps: TH1 = 256 - 3 = 253 = FDH (精确!)
    ——这就是串口应用偏爱 11.0592MHz 晶振的原因`,
      },
      {
        title: 'SCON 寄存器与收发控制',
        content: `SCON (98H) — 串口控制寄存器:

  SM0 SM1 SM2 REN TB8 RB8 TI  RI
   0   1   0   1   0   0  0   0  = 50H

SM0 SM1: 工作模式
  00 = 模式0 (同步, f/12)
  01 = 模式1 (8位UART, 可变波特率) ← 最常用
  10 = 模式2 (9位UART, f/32 或 f/64)
  11 = 模式3 (9位UART, 可变波特率)

REN: 允许接收 (=1 时才能接收数据)
TI: 发送中断标志，需软件清0。方式1在停止位开始时置1，不表示停止位已经全部发送完；方式0在第8位结束时置1。
RI: 接收中断标志，满足所选工作方式的接收条件后置1，需软件清0。
参考：授课第6章第33页（合并PDF第33页）。当前仿真将发送字节直接加入终端，不复现逐位物理发送时序。

发送: MOV SBUF, A → 自动发送 → TI=1
接收: RI=1 → MOV A, SBUF → 读取数据`,
      },
    ],
    circuitDescription: `
┌──────────────┐              PC (串口助手)
│   AT89C51    │              ┌─────────┐
│              │  MAX232      │ COM Port│
│  TXD (P3.1) ──→ MAX232发送通道 ──→ PC RXD
│  RXD (P3.0) ←── MAX232接收通道 ←── PC TXD
│              │              │ GND     │
│  T1 (波特率) │              └─────────┘
│  TH1=FDH    │  11.0592MHz、SMOD=0
│  (9600bps)   │   或匹配电平的USB-TTL模块；TTL侧需共地
└──────────────┘`,
    registerReference: [
      {
        name: 'SCON',
        address: '98H',
        bits: ['SM0', 'SM1', 'SM2', 'REN', 'TB8', 'RB8', 'TI', 'RI'],
        description: '串口控制寄存器，50H=模式1,允许接收',
      },
      {
        name: 'SBUF',
        address: '99H',
        bits: ['D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'],
        description: '串口缓冲器，读写同地址但物理上是两个寄存器',
      },
    ],
    stepByStep: [
      { step: '1. 配置 SCON', detail: 'SCON=50H → 模式1(8位UART), 允许接收' },
      { step: '2. 配置波特率', detail: '经典12T内核、11.0592MHz：TMOD=20H，SMOD=0，TH1=TL1=FDH，对应9600bit/s' },
      { step: '3. 启动 T1', detail: 'SETB TR1 → T1 开始产生波特率时钟' },
      { step: '4. 开串口中断', detail: 'SETB ES, SETB EA → 串口中断使能' },
      { step: '5. 发送字符串', detail: '循环: MOV SBUF,A → JNB TI,$ → CLR TI' },
      { step: '6. 回显功能', detail: '收到字符 (RI=1) → 读 SBUF → 发回' },
    ],
    instructionRef: [
      { instr: 'JNB', syntax: 'JNB bit, rel', desc: '位=0等待', example: 'JNB TI, $  ; 等发送完' },
      { instr: 'CLR', syntax: 'CLR bit', desc: '清标志位', example: 'CLR TI     ; 清发送标志' },
      { instr: 'INC', syntax: 'INC DPTR', desc: 'DPTR+1', example: 'INC DPTR   ; 字符串指针+1' },
      { instr: 'JZ', syntax: 'JZ rel', desc: 'A=0跳转', example: 'JZ DONE    ; 字符串结束' },
    ],
    realWorldApplications: [
      '工业 Modbus 通信 — 设备间的串口数据交换',
      'GPS 模块数据接收 — NMEA 协议解析',
      '蓝牙模块控制 — HC-05/06 AT 指令',
      '物联网数据上传 — 通过 ESP8266 WiFi 模块',
      '调试输出 — printf 风格的调试信息打印',
    ],
    commonMistakes: [
      { mistake: '波特率不匹配', explanation: '经典12T内核、SMOD=0、TH1=FDH时：12MHz得到10416.67bit/s，相对9600的误差为+8.51%；11.0592MHz得到9600bit/s。不能把仿真终端显示字符当作硬件波特率匹配的证明。' },
      { mistake: '忘记清 TI/RI 标志', explanation: 'TI/RI 由硬件置1，必须由软件清0。否则中断会反复触发或发送阻塞。' },
      { mistake: '中断中同时处理收发', explanation: '串口只有一个中断向量，TI和RI共用。必须在中断中判断是 TI 还是 RI 触发的。' },
    ],
    thinkingQuestions: [
      '为什么 11.0592MHz 是单片机常用的"怪"晶振频率？',
      '如何实现简单的命令解析？(如输入"LED ON"控制LED)',
      '串口通信如何检测数据传输错误？有哪些校验方法？',
    ],
    animations: [
      { id: 'uart-frame', title: 'UART数据帧 — 逐位发送过程' },
    ],
  },

  // ═══════════════════════════════════════════════
  // 项目一：走进89C51的世界
  // ═══════════════════════════════════════════════
  proj01: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第2章 硬件结构、第4章 汇编程序设计',
      hours: 0,
      hoursLabel: '平台拓展项目',
      sourceNote: '平台综合练习；原大纲表3未列“走进89C51的世界”项目及独立学时。',
      courseObjectives: '对应章节为目标1、2、4；本项目目标为平台教学设计。',
      textbookRef: '大纲表2第2、4章；实践主题参考表3实验1—2。',
      knowledgeMap: '平台1 单片机概述、2 硬件结构、3 指令系统',
      ideologicalPoint: '国产芯片发展历程与航天品质',
    },
    objectives3D: {
      knowledge: ['理解单片机最小系统的组成', '掌握 Keil 工程建立与程序下载流程'],
      ability: ['能独立完成从建工程到点灯的全过程', '能综合运用 I/O、延时、按键完成小系统'],
    },
    keyPoints: {
      focus: ['最小系统与开发环境的搭建', 'LED、按键等基础外设的综合运用'],
      difficulty: ['从单个知识点到完整系统的整合', '程序结构的组织与调试'],
    },
    ideological: {
      theme: '科技报国 · 打牢地基',
      insights: [
        '从点亮一个灯到搭起一个系统，起点都是把单片机原理学扎实——楼有多高，取决于地基有多深。',
        '国产 MCU 正在各行各业替代进口，把底层真正学懂的人，才有资格谈创新。',
      ],
      goldenQuote: '基础打牢，才谈得上把芯片握在自己手里。',
    },
    theory: [
      {
        title: 'AT89C51 芯片引脚功能',
        content: `AT89C51 是 40 引脚 DIP 封装：

           ┌──── AT89C51 ────┐
    P1.0 ─┤ 1            40 ├─ VCC (5V)
    P1.1 ─┤ 2            39 ├─ P0.0 (AD0)
    P1.2 ─┤ 3            38 ├─ P0.1 (AD1)
    P1.3 ─┤ 4            37 ├─ P0.2 (AD2)
    P1.4 ─┤ 5            36 ├─ P0.3 (AD3)
    P1.5 ─┤ 6            35 ├─ P0.4 (AD4)
    P1.6 ─┤ 7            34 ├─ P0.5 (AD5)
    P1.7 ─┤ 8            33 ├─ P0.6 (AD6)
    RST  ─┤ 9            32 ├─ P0.7 (AD7)
 RXD/P3.0─┤10            31 ├─ EA/VPP
 TXD/P3.1─┤11            30 ├─ ALE/PROG
INT0/P3.2─┤12            29 ├─ PSEN
INT1/P3.3─┤13            28 ├─ P2.7 (A15)
  T0/P3.4─┤14            27 ├─ P2.6 (A14)
  T1/P3.5─┤15            26 ├─ P2.5 (A13)
 WR/P3.6 ─┤16            25 ├─ P2.4 (A12)
 RD/P3.7 ─┤17            24 ├─ P2.3 (A11)
   XTAL2 ─┤18            23 ├─ P2.2 (A10)
   XTAL1 ─┤19            22 ├─ P2.1 (A9)
     GND ─┤20            21 ├─ P2.0 (A8)
           └─────────────────┘

关键引脚：
  VCC(40): 5V电源    GND(20): 接地
  RST(9):  高电平复位   EA(31): =1用内部ROM
  XTAL1/2: 晶振连接    ALE: 地址锁存`,
      },
      {
        title: '最小系统电路',
        content: `8051 最小系统包含 4 个必要部分：

1. 电源电路
   VCC=5V, GND, 每个VCC引脚并联 0.1μF 去耦电容

2. 晶振电路
   XTAL1/XTAL2 之间接 12MHz 晶振
   两个 30pF 负载电容接 GND

3. 复位电路
   RST 引脚：上电复位 (10μF + 8.2KΩ)
   可选手动复位按钮

4. EA 引脚
   EA = VCC → 使用内部 Flash ROM
   EA = GND → 使用外部 ROM

这是一切实验的硬件基础!`,
      },
    ],
    circuitDescription: `
最小系统 + LED + 数码管：

      +5V ─┬──[0.1μF]──┐
            │           GND
            │
        ┌───┴───────────────┐
VCC(40)─┤    AT89C51         │
        │                    │
  12MHz ┤ XTAL1/2           │─ P1.0~P1.7 → [2kΩ] → LED → VCC
  30pF×2│                   │
        │ RST ← [10μF]+[8.2K]│─ P0.0~P0.7 → 数码管段选
        │                    │  (静态显示：共阴数码管公共端接地)
 EA=VCC─┤                    │
GND(20)─┤                    │
        └────────────────────┘`,
    registerReference: [
      {
        name: 'SP',
        address: '81H',
        bits: [],
        description: '堆栈指针，复位值07H，指向 Register Bank 0 上方',
      },
      {
        name: 'PC',
        address: '(不可直接访问)',
        bits: [],
        description: '程序计数器，复位值0000H，16位，指向下一条要执行的指令',
      },
    ],
    stepByStep: [
      { step: '1. 搭建最小系统', detail: '连接电源+晶振+复位+EA，确保芯片可运行' },
      { step: '2. 连接 LED', detail: 'P1.0~P1.7 经 2kΩ 电阻接 LED，灌电流驱动' },
      { step: '3. 编写流水灯', detail: 'RL A 循环左移实现 LED 逐个点亮' },
      { step: '4. 设计延时', detail: 'DJNZ三重循环形成可见延时；经典12T、12MHz下子程序约1.006s，不含调用开销，不能按历史标签名认作500ms' },
      { step: '5. 连接数码管', detail: 'P0 输出段码静态显示（共阴公共端接地）, MOVC 查表取码' },
      { step: '6. 显示 0~9', detail: '循环查表SEG_TAB，每次调用延时后切换数字；实际间隔还包含查表及循环开销，仿真墙钟时间随运行速度变化' },
    ],
    instructionRef: [
      { instr: 'ORG', syntax: 'ORG addr', desc: '设置程序起始地址', example: 'ORG 0000H' },
      { instr: 'LJMP', syntax: 'LJMP addr16', desc: '长跳转(64KB)', example: 'LJMP MAIN' },
      { instr: 'DB', syntax: 'DB byte1,byte2,...', desc: '定义字节常量', example: 'DB 3FH,06H,5BH' },
      { instr: 'MOVC', syntax: 'MOVC A,@A+DPTR', desc: '代码空间查表', example: 'MOVC A,@A+DPTR' },
      { instr: 'END', syntax: 'END', desc: '程序结束标志', example: 'END' },
    ],
    realWorldApplications: [
      '单片机最小系统板设计 — 所有嵌入式项目的基础',
      '产品原型开发 — 从面包板到 PCB 的开发流程',
      'Arduino 底层 — Arduino UNO 的核心就是 ATmega328 (8051同族)',
      '嵌入式系统启动过程 — 理解 MCU 从复位到运行的全过程',
    ],
    commonMistakes: [
      { mistake: 'EA 引脚悬空', explanation: 'EA 引脚必须接 VCC(用内部ROM) 或 GND(用外部ROM)，悬空会导致程序无法运行。' },
      { mistake: '晶振电容选错', explanation: '12MHz 晶振通常配 30pF 电容。电容值不对会导致起振困难或频率偏差。' },
      { mistake: '复位时间不足', explanation: '上电复位要求 RST 保持高电平至少 2 个机器周期。RC 值过小会导致复位不可靠。' },
    ],
    thinkingQuestions: [
      '为什么 8051 复位后 PC=0000H？这对程序设计有什么要求？',
      '如果没有外部晶振，8051 能工作吗？(提示：部分型号有内部 RC 振荡器)',
      '最小系统为什么需要去耦电容？去掉会怎样？',
    ],
    animations: [
      { id: 'led-shift', title: 'LED流水灯动画演示' },
      { id: 'stack-pushpop', title: '堆栈操作可视化' },
    ],
  },
  proj02: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第8章 模拟量接口、第10章 外部电路控制',
      hours: 0,
      hoursLabel: '平台拓展项目',
      sourceNote: '平台综合练习；原大纲表3未列“智慧路灯”项目及独立学时。',
      courseObjectives: '对应章节为目标3、4；本项目目标为平台教学设计。',
      textbookRef: '大纲表2第8、10章；最新第10章课件10.2的PWM原理。',
      knowledgeMap: '平台8.3 AD/DA转换、6 定时器/计数器、8.5 电机驱动',
      ideologicalPoint: '节能减排与绿色发展（生态文明建设）',
    },
    objectives3D: {
      knowledge: ['理解光敏检测与 PWM 调光原理', '掌握定时控制与按需照明的实现'],
      ability: ['能设计光感自动调光的控制程序', '能把传感、控制、执行组织成完整系统'],
    },
    keyPoints: {
      focus: ['光敏信号采集与阈值判断', 'PWM 占空比调节亮度'],
      difficulty: ['多路信号的协调控制', '节能策略的逻辑设计'],
    },
    ideological: {
      theme: '绿色发展 · 生态文明',
      insights: [
        '按需照明、光感调光，一盏智慧路灯一年省下的电，累积起来就是实实在在的节能减排。',
        '技术的价值，最终要落到让城市更绿、生活更好上。',
      ],
      goldenQuote: '省下的每一度电，都是对绿水青山的一份责任。',
    },
    theory: [
      {
        title: 'ADC0809 模数转换原理',
        content: `ADC0809 是 8 位逐次逼近型 A/D 转换器，8 路模拟输入：

工作流程：
  通道选择与地址锁存 → 逐次比较 → 输出数据锁存
  转换期间应保持输入足够稳定；不能假定该器件带有独立的采样保持电路。

         模拟输入 IN0~IN7
              │
    ┌─────────┴─────────┐
    │   8路模拟多路开关    │
    │   (ADDA/ADDB/ADDC  │
    │    通道选择)         │
    └─────────┬─────────┘
              │
    ┌─────────┴─────────┐
    │   逐次逼近 SAR      │
    │   比较器 + DAC       │
    │   8位寄存器          │
    └─────────┬─────────┘
              │
         数字输出 D0~D7

关键参数：
  分辨率: 8 位 (256 级)
  转换时间: 典型100μs (CLK=640kHz)，不是软件固定等待时间
  本例参考范围: 0~5V (Vref+=5V、Vref-=0V)
  量化步长q: (Vref+−Vref−)/256，本例约19.53mV
  输出码D只能取0~255；(Vin−Vref−)/q用于估算，须考虑量化区间与端点饱和，不能在5V时得到256码。

控制信号时序：
  1. 设置ADDA/B/C；按建立/保持时间要求用ALE上升沿锁存通道地址
  2. START上升沿复位逐次逼近寄存器，下降沿开始转换
  3. EOC不会立即变低；先确认本次转换进入忙状态，再等待EOC由低变高，并设置超时处理
  4. OE=1，满足输出有效延时后读取数据，随后关闭OE

参考：TI ADC0808-N/ADC0809-N数据手册SNAS535H，第4页转换时间、第5页启动说明及第7页时序图。
https://www.ti.com/lit/ds/symlink/adc0809-n.pdf`,
      },
      {
        title: 'PWM 脉宽调制原理',
        content: `PWM (Pulse Width Modulation) 通过改变占空比控制平均电压：

  占空比 = Ton / T × 100%
  平均电压 Vavg = Vcc × 占空比

100% ─┬─────────────┬─ LED全亮
      │█████████████│
      │█████████████│
  0% ─┴─────────────┴─

 75% ─┬──────────┬──┬─ LED较亮
      │██████████│  │
      │██████████│  │
  0% ─┴──────────┴──┴─

 25% ─┬───┬─────────┬─ LED较暗
      │███│         │
      │███│         │
  0% ─┴───┴─────────┴─

用定时器中断生成 PWM：
  中断周期 = PWM分辨率的最小单位
  计数器 0→255 循环
  计数 < 占空比 → 输出高
  计数 ≥ 占空比 → 输出低

频率要求：
  本程序按12MHz、1ms中断、256计数档位演示时序：周期约256ms，频率约3.91Hz。
  该低频用于观察占空比，会产生可见闪烁，不能直接作为实物照明方案。
  实物调光与电机驱动频率须依据驱动器、负载和测量结果确定；应重新设计定时和占空比分辨率。`,
      },
      {
        title: 'LCD1602 液晶显示原理',
        content: `LCD1602 是 16×2 字符液晶显示模块：

引脚定义：
  VSS=GND  VDD=5V  V0=对比度调节
  RS: 0=指令 1=数据
  RW: 0=写   1=读
  E:  下降沿触发

常用指令：
  0x38: 8位数据, 2行, 5×7字体
  0x0C: 开显示, 关光标
  0x06: 写入后地址+1
  0x01: 清屏
  0x80: 设置第1行起始地址
  0xC0: 设置第2行起始地址

显示流程：
  1. 上电等待 >15ms
  2. 发送初始化指令序列
  3. 设置显示模式
  4. 写入字符数据

地址映射：
  第1行: 00H~0FH (共16字符)
  第2行: 40H~4FH (共16字符)`,
      },
    ],
    circuitDescription: `
智慧路灯接口设计示意（实物拓展）：
当前仿真从P0读取模拟输入，仅演示数据与PWM的对应关系，未模拟ADC0809的转换时序。

        +5V
         │
     ┌───┴───────────────────────────────┐
     │         AT89C51                    │
     │                                    │
     │ P0.0~P0.7 ← ADC0809 D0~D7        │
     │ P3.6 → ADC0809 START/ALE          │
     │                                    │
     │ P2.0 → [MOSFET] → 大功率LED灯     │
     │        (PWM调光输出)                │
     │                                    │
     │ P1.0~P1.7 → LCD1602 数据口         │
     │ P2.5=RS  P2.6=RW  P2.7=E          │
     └───────────────────────────────────┘

ADC0809 接线：
     光敏电阻 → 分压电路 → IN0
     Vref+ = 5V   Vref- = GND
     CLK ← 独立时钟源（例如640kHz，按器件时序选取）
     ADDA/B/C选择IN0；另行分配EOC输入与OE输出，并在程序中实现握手。

LED低侧开关示意：
     +12V → 匹配的限流或恒流驱动 → LED灯串 → N沟道MOSFET Drain
     MOSFET Source → GND；控制器与负载共地
     P2.0 → 栅极驱动 → Gate；设置栅源下拉
按实际栅极驱动电压、负载电流和损耗选器件；不能把源极接负载作为低侧开关，也不能省略LED限流。`,
    registerReference: [
      {
        name: 'TMOD',
        address: '89H',
        bits: ['GATE1', 'C/T1', 'M1.1', 'M0.1', 'GATE0', 'C/T0', 'M1.0', 'M0.0'],
        description: '定时器模式寄存器。本项目 TMOD=01H：T0方式1(16位)，1ms中断作PWM时基',
      },
      {
        name: 'TCON',
        address: '88H',
        bits: ['TF1', 'TR1', 'TF0', 'TR0', 'IE1', 'IT1', 'IE0', 'IT0'],
        description: 'TR0=1启动T0; TF0溢出标志(进入中断后自动清零)',
      },
      {
        name: 'IE',
        address: 'A8H',
        bits: ['EA', '-', '-', 'ES', 'ET1', 'EX1', 'ET0', 'EX0'],
        description: 'EA=1总中断允许; ET0=1允许T0中断',
      },
    ],
    stepByStep: [
      { step: '1. 搭建ADC采集电路', detail: '光敏电阻+分压电路连接ADC0809的IN0通道，提供0~5V模拟电压' },
      { step: '2. 设计实物ADC读取子程序', detail: '锁存通道地址，发送START脉冲；先确认EOC变低再等待变高，超时则报错，OE使能并满足延时后读P0。当前仿真只使用模拟输入。' },
      { step: '3. 配置定时器生成PWM', detail: 'T0方式1，1ms中断（初值FC18H），256级计数——PWM周期约256ms便于观察；工程中应缩短中断周期提高PWM频率' },
      { step: '4. 实现自动调光算法', detail: '光照值CPL取反作为PWM占空比：环境越暗→ADC值越小→取反后占空比越大→LED越亮' },
      { step: '5. 观察核心回路数据', detail: '内存面板观察32H光照值与30H占空比的取反联动，P2.0输出随占空比变化' },
      { step: '6. 初始化LCD1602（项目后续任务）', detail: '发送0x38/0x0C/0x06/0x01指令序列，第1行显示光照值、第2行显示占空比——实物阶段完成' },
      { step: '7. 系统集成测试', detail: '实物联调时遮挡光敏电阻，观察LED亮度自动变化' },
    ],
    instructionRef: [
      { instr: 'CPL', syntax: 'CPL A', desc: '累加器按位取反', example: 'CPL A  ; A=55H→AAH' },
      { instr: 'CJNE', syntax: 'CJNE A,#data,rel', desc: '比较不等则跳转，同时设置CY', example: 'CJNE A,30H,PWM_CMP' },
      { instr: 'JC', syntax: 'JC rel', desc: 'CY=1则跳转', example: 'JC PWM_HIGH  ; A<30H时跳' },
      { instr: 'SETB', syntax: 'SETB bit', desc: '位置1', example: 'SETB P2.0  ; LED输出高' },
      { instr: 'CLR', syntax: 'CLR bit', desc: '位清零', example: 'CLR P2.0   ; LED输出低' },
      { instr: 'RETI', syntax: 'RETI', desc: '中断返回(恢复中断系统)', example: 'RETI' },
    ],
    realWorldApplications: [
      '市政智慧路灯系统 — 根据环境光调整照明；节电量需按实际功率、运行时长和照明要求测量',
      '汽车自适应大灯 — 根据对向车灯和环境光调节远近光',
      'LED显示屏亮度控制 — 户外屏根据阳光强度自动调节',
      '手机/笔记本屏幕自动亮度 — 光线传感器+PWM背光调节',
      '温室补光系统 — 光照不足时自动开启植物补光灯',
    ],
    commonMistakes: [
      { mistake: '把观察用PWM直接用于照明', explanation: '本例约3.91Hz会明显闪烁。256档计数时PWM频率=1/(中断周期×256)；提高频率还需核对中断执行时间、驱动损耗与实际光输出，不能仅凭一个频率断言无闪烁。' },
      { mistake: '把EOC原有高电平误判为本次转换完成', explanation: 'START上升沿后EOC存在变低延迟。实物程序应确认忙状态后再等待完成，并设置超时；不能只等待一次高电平或把典型100μs当保证值。' },
      { mistake: 'LCD初始化时序不足', explanation: 'LCD上电后需等待>15ms才能发送指令。每条指令间需检查忙标志或延时>40μs，清屏指令需>1.6ms。' },
      { mistake: '光敏电阻分压方向接反', explanation: '光敏电阻阻值随光照增大而减小。需根据实际需求确定分压电路方向：串联固定电阻取上端或下端电压。' },
    ],
    thinkingQuestions: [
      '为什么当前约3.91Hz只适合观察？提高PWM频率后，指令执行时间、开关损耗与可见闪烁如何取舍？',
      'ADC0809的8位分辨率意味着什么？如果需要更高精度该怎么办？(提示：12位ADC、过采样)',
      '如何实现多段式亮度调节（如路灯的全亮/半亮/微亮/关闭四种模式）？',
      '如果光敏电阻响应速度慢，ADC读数会出现什么问题？如何用软件滤波解决？',
      '实际路灯系统除了光照传感器，还需要哪些传感器？(提示：人体红外、时钟RTC)',
    ],
    animations: [
      { id: 'pwm-wave', title: 'PWM脉宽调制 — 占空比与亮度控制' },
      { id: 'timer-counter', title: '定时器生成PWM信号' },
    ],
  },

  proj03: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第6章 串行通信、第10章 外部电路控制',
      hours: 0,
      hoursLabel: '平台拓展项目',
      sourceNote: '平台综合练习；原大纲表3未列“智能小车”项目及独立学时。',
      courseObjectives: '对应章节为目标3、4；本项目目标为平台教学设计。',
      textbookRef: '大纲表2第6、10章；最新第10章课件10.2的直流电机双向控制。',
      knowledgeMap: '平台7 串行通信、8.4 传感器接口、8.5 电机驱动',
      ideologicalPoint: '智能制造与中国制造2025（科技强国）',
    },
    objectives3D: {
      knowledge: ['理解电机驱动与循迹/避障原理', '掌握红外、蓝牙等模块的接口方法'],
      ability: ['能编写循迹、避障、调速的控制程序', '能综合传感与通信完成整车控制'],
    },
    keyPoints: {
      focus: ['电机方向与速度的控制', '红外循迹与避障的判断逻辑'],
      difficulty: ['多传感器信息的融合决策', '实时响应与运动平稳的平衡'],
    },
    ideological: {
      theme: '智能制造 · 中国制造2025',
      insights: [
        '循迹、避障、调速，一辆小车浓缩了自动驾驶与工业机器人的控制内核——中国智造的未来，就藏在这些基本功里。',
        '把传感、决策、执行串成一条完整的控制链，是从"会用"到"会造"的跨越。',
      ],
      goldenQuote: '今天练好智能小车，练的是明天智能制造的手艺。',
    },
    theory: [
      {
        title: 'L298N 直流电机驱动原理',
        content: `L298N 是双H桥电机驱动芯片，可驱动2个直流电机：

H桥工作原理：
  ┌──────────────────────────┐
  │   +Vm (电机电源)          │
  │    ┌──┤S1├──┬──┤S3├──┐   │
  │    │         │         │   │
  │    │    ┌────┴────┐    │   │
  │    │    │  Motor  │    │   │
  │    │    └────┬────┘    │   │
  │    │         │         │   │
  │    └──┤S2├──┴──┤S4├──┘   │
  │          GND              │
  └──────────────────────────┘

  S1+S4 ON → 正转    S2+S3 ON → 反转
  S1+S3 ON → 制动    全OFF → 自由停转

L298N 引脚功能：
  IN1/IN2: 电机A方向控制
  IN3/IN4: 电机B方向控制
  ENA/ENB: PWM使能(调速)

真值表 (电机A)：
  ENA  IN1  IN2  |  状态
   1    1    0   |  正转
   1    0    1   |  反转
   1    1    1   |  制动
   0    X    X   |  自由停转`,
      },
      {
        title: '红外避障与循迹传感器',
        content: `红外避障传感器：
  发射管发出红外光 → 遇障碍物反射 → 接收管检测
  检测距离: 2~30cm (可调)
  输出: 有障碍=低电平, 无障碍=高电平

  发射管    接收管
    ╲         ╱
     ╲       ╱
      ╲     ╱
   ════╤═══╤════  障碍物(反射面)

红外循迹传感器：
  利用黑色吸收红外光、白色反射红外光的特性
  黑线上: 无反射 → 输出低电平(0)
  白底上: 有反射 → 输出高电平(1)

三路循迹编码（左=P1.0 中=P1.1 右=P1.2，0=压线；
程序读入 A = P1 ∧ 07H，按 右中左 位权写出）：
  中间压线  101B=05H → 车在正中 → 直行
  左侧压线  110B=06H → 车身偏右 → 左转修正
  右侧压线  011B=03H → 车身偏左 → 右转修正
  全1(07H)=脱线、其余组合 → 停车待策略`,
      },
      {
        title: '状态机编程模型',
        content: `多模式系统适合用有限状态机(FSM)设计：

  ┌─────┐  蓝牙'1'  ┌─────┐  蓝牙'2'  ┌─────┐
  │遥控 │──────────→│避障 │──────────→│循迹 │
  │模式 │←──────────│模式 │←──────────│模式 │
  └──┬──┘  蓝牙'0'  └──┬──┘  蓝牙'0'  └──┬──┘
     │                  │                  │
     │   ┌──────────────┘                  │
     │   │   蓝牙'2'                       │
     │   └──────────────────────────────→──┘

汇编实现方式：
  MOV A, 30H          ; 读取当前模式
  CJNE A, #0, CHK1    ; 模式0=遥控
  ACALL REMOTE_MODE
  SJMP DONE
  CHK1:
  CJNE A, #1, CHK2    ; 模式1=避障
  ACALL AVOID_MODE
  SJMP DONE
  CHK2:
  ACALL TRACK_MODE    ; 模式2=循迹
  DONE:

串口中断中处理模式切换命令。`,
      },
      {
        title: 'HC-05 蓝牙串口通信',
        content: `HC-05 是主从一体蓝牙模块，透传串口数据：

连接方式：
  HC-05 TXD → 8051 RXD (P3.0)
  HC-05 RXD → 8051 TXD (P3.1)
  波特率: 9600bps (默认)

8051 串口配置 (9600bps@11.0592MHz)：
  TMOD = 21H   ; T1方式2(自重装)
  TH1  = FDH   ; 9600bps波特率
  TL1  = FDH
  SCON = 50H   ; 方式1, 允许接收
  TR1  = 1     ; 启动T1

波特率计算公式：
  波特率 = (2^SMOD / 32) × fosc / (12 × (256-TH1))
  9600 = (1/32) × 11059200 / (12 × (256-253))
  TH1 = 256 - 3 = 253 = 0xFD

中断接收：
  UART_ISR:
    CLR RI           ; 清接收标志
    MOV A, SBUF      ; 读取数据
    MOV 31H, A       ; 保存命令
    RETI`,
      },
    ],
    circuitDescription: `
智能小车系统电路：

  ┌─────────────────────────────────────────┐
  │              AT89C51                     │
  │                                          │
  │ P2.0(IN1)──┐                             │
  │ P2.1(IN2)──┼──→ L298N ──→ 左电机 M1     │
  │ P2.2(IN3)──┼──→ L298N ──→ 右电机 M2     │
  │ P2.3(IN4)──┘                             │
  │ P2.4(ENA)──→ L298N ENA ┐复位高电平=全速  │
  │ P2.5(ENB)──→ L298N ENB ┘(PWM调速留作拓展)│
  │                                          │
  │ P3.2(INT0) ←── 左红外避障传感器          │
  │ P3.3(INT1) ←── 右红外避障传感器          │
  │                                          │
  │ P1.0 ←── 左循迹传感器                    │
  │ P1.1 ←── 中循迹传感器                    │
  │ P1.2 ←── 右循迹传感器                    │
  │                                          │
  │ P3.0(RXD) ←── HC-05 TXD                 │
  │ P3.1(TXD) ──→ HC-05 RXD                 │
  └─────────────────────────────────────────┘

电源：
  电机: 7.4V锂电池 → L298N Vs
  逻辑: L298N 5V输出 → 8051 VCC`,
    registerReference: [
      {
        name: 'SCON',
        address: '98H',
        bits: ['SM0', 'SM1', 'SM2', 'REN', 'TB8', 'RB8', 'TI', 'RI'],
        description: '串口控制。50H=方式1+允许接收。RI=1收到数据，TI=1发送完成',
      },
      {
        name: 'SBUF',
        address: '99H',
        bits: [],
        description: '串口数据缓冲。写SBUF发送，读SBUF接收。物理上是两个独立寄存器',
      },
      {
        name: 'IE',
        address: 'A8H',
        bits: ['EA', '-', '-', 'ES', 'ET1', 'EX1', 'ET0', 'EX0'],
        description: '95H = EA+ES+EX1+EX0 = 串口+双外部中断全开',
      },
      {
        name: 'IP',
        address: 'B8H',
        bits: ['-', '-', '-', 'PS', 'PT1', 'PX1', 'PT0', 'PX0'],
        description: '经典8051中断优先级寄存器。当前预置程序未设置IP，各源保持默认低优先级；仿真按自然查询顺序处理，不验证优先级嵌套',
      },
    ],
    stepByStep: [
      { step: '1. 搭建电机驱动电路', detail: 'L298N的IN1~IN4接P2口，ENA/ENB接PWM输出或VCC(全速)' },
      { step: '2. 编写电机控制子程序', detail: '前进/后退/左转/右转/停止 5个子程序，控制IN1~IN4高低电平' },
      { step: '3. 配置蓝牙串口', detail: '经典12T、11.0592MHz、SMOD=0时，T1方式2及TH1=TL1=FDH对应9600bit/s；SCON=50H。当前画布仅注入模拟串口字节，不代表真实蓝牙连接' },
      { step: '4. 实现遥控模式', detail: '串口中断接收命令(F/B/L/R/S)，CJNE分支调用对应电机子程序' },
      { step: '5. 配置外部中断', detail: 'INT0/INT1接避障输入，IT0=IT1=1采用下降沿触发；画布脉冲触发对应转向，程序仅在避障模式处理中断动作' },
      { step: '6. 实现循迹模式', detail: '读P1低3位传感器状态，ANL屏蔽高位，CJNE判断偏向并纠正' },
      { step: '7. 设计模式切换', detail: '串口接收0/1/2切换模式，30H存储当前模式，主循环按模式分发' },
      { step: '8. 综合调试', detail: '先单独测试每种模式，再测试模式切换的无缝衔接' },
    ],
    instructionRef: [
      { instr: 'CJNE', syntax: 'CJNE A,#data,rel', desc: '比较跳转，实现switch-case', example: "CJNE A,#'F',NEXT" },
      { instr: 'ANL', syntax: 'ANL A,#data', desc: '逻辑与，屏蔽无关位', example: 'ANL A,#07H ; 保留低3位' },
      { instr: 'ACALL', syntax: 'ACALL addr11', desc: '短调用(2KB范围)', example: 'ACALL FORWARD' },
      { instr: 'MOV IE', syntax: 'MOV IE,#data', desc: '配置中断允许', example: 'MOV IE,#95H ; EA+ES+EX1+EX0' },
      { instr: 'CLR RI', syntax: 'CLR RI', desc: '清串口接收标志', example: 'CLR RI ; 必须软件清零' },
      { instr: 'RETI', syntax: 'RETI', desc: '中断返回', example: 'RETI ; 恢复中断优先级' },
    ],
    realWorldApplications: [
      'AGV自动导引车 — 工厂/仓库中循迹搬运，与本项目循迹原理相同',
      '扫地机器人 — 红外避障+碰撞传感器实现自主导航',
      '无人驾驶基础 — 传感器融合、路径规划的入门级实践',
      '物流分拣机器人 — 循迹+RFID识别实现自动分拣',
      '蓝牙遥控玩具 — 手机APP遥控的智能玩具车开发',
    ],
    commonMistakes: [
      { mistake: '电机驱动电源不足', explanation: 'L298N内部压降约2V，电机堵转电流可达1A以上。7.4V电池供电，L298N输出仅~5V。电源线要粗，加大容量滤波电容。' },
      { mistake: '中断服务中长时间延时', explanation: '本演示在避障ISR中直接调用双重循环延时，历史标签500MS不是实测值。子程序为125753机器周期，不含调用；经典12T、12MHz时约125.753ms，11.0592MHz时约136.451ms。当前非嵌套仿真期间无法处理其他中断，实物应改用标志与主循环定时，并测量响应。' },
      { mistake: '循迹传感器间距不合理', explanation: '三路传感器间距应略大于黑线宽度(通常2~3cm)。间距太大会丢线，太小则灵敏度不足。' },
      { mistake: 'CJNE后忘记处理CY标志', explanation: 'CJNE除了比较跳转外还会设置CY标志。如果后续有JC/JNC指令，可能受到干扰。注意CY的副作用。' },
    ],
    thinkingQuestions: [
      'H桥中如果S1和S2同时导通会怎样？L298N如何防止这种"直通"？',
      '为什么避障传感器用外部中断而不是轮询？在什么场景下轮询更合适？',
      '如何用PWM实现小车的差速转弯(比纯停止一侧电机更平滑)？',
      '蓝牙传输距离只有10m，如何扩展到更远距离？(提示：WiFi、LoRa、4G)',
      '如果要实现PID循迹，P/I/D三个参数分别解决什么问题？',
    ],
  },

  proj04: {
    syllabusMapping: {
      week: '',
      chapter: '大纲第6章 串行通信、第11章 应用系统设计',
      hours: 0,
      hoursLabel: '平台拓展项目',
      sourceNote: '平台综合练习；原大纲表3未列“大棚监控”项目及独立学时。',
      courseObjectives: '对应章节为目标3、4；本项目目标为平台教学设计。',
      textbookRef: '大纲表2第6、8、11章；温湿度器件、JSON遥测为平台应用拓展。',
      knowledgeMap: '平台7 串行通信、8.4 传感器接口、9 系统设计',
      ideologicalPoint: '乡村振兴与智慧农业（科技服务社会）',
    },
    objectives3D: {
      knowledge: ['理解温湿度采集与阈值报警原理', '掌握串口数据上报并能说明 LCD 后续接口边界'],
      ability: ['能设计环境监测与自动调控程序', '能把采集、传输、报警整合成可持续运行的监控闭环'],
    },
    keyPoints: {
      focus: ['传感器数据采集与串口上报', '阈值判断与自动控制/报警'],
      difficulty: ['多参数的实时监测与协调', '串口数据传输的可靠性'],
    },
    ideological: {
      theme: '科技惠农 · 服务社会',
      insights: [
        '温湿度、光照自动调控，让种地从"看天吃饭"走向"知天而作"——科技最动人的地方，是让普通人的日子更好过。',
        '把单片机用到田间地头，也是工科生把论文写在祖国大地上的一种方式。',
      ],
      goldenQuote: '把技术种进泥土里，才见得着它真正的分量。',
    },
    projectBrief: {
      evidenceStatus: '平台内置综合项目任务模板｜暂无真实学生成果材料',
      simulationBoundary: '当前平台用模拟温湿度输入验证采集、阈值报警与串口上报；默认程序持续循环属于正确行为。LCD 驱动尚未实现，EEPROM 仅为扩展项；实物传感精度、现场通信可靠性和长期稳定性须另行测试。',
      prerequisiteGate: '核心前置：完成 exp09 串口通信实验，能够配置定时器/中断，并能说明 DS18B20、DHT11 在当前仿真中的输入边界。I2C、LCD 和 EEPROM 不作为本轮完成前置。',
      completionNextStep: '完成有效遥测观测并保存 5 项里程碑自检后，可提交本轮项目完成；随后返回任务页进入教师复核。LCD、EEPROM 与实物联调作为独立扩展继续验证，不能回填为本轮已完成。',
      roles: [
        { role: '机械/农业场景', responsibility: '定义大棚布点、执行机构安装位置与环境约束。' },
        { role: '电气', responsibility: '完成传感器、继电器、蜂鸣器和电源接口设计。' },
        { role: '自动化', responsibility: '确定阈值、控制状态与异常降级策略。' },
        { role: '物联网', responsibility: '设计UART数据帧、上位机接入和数据字段。' },
        { role: '软件', responsibility: '实现驱动、状态机、日志和可复现测试。' },
      ],
      milestones: [
        { id: 'requirements', title: '1｜需求分析', completionRule: '提交对象、输入输出、阈值、异常场景和验收指标。' },
        { id: 'interfaces', title: '2｜接口设计', completionRule: '完成端口表、数据帧、模块接口和仿真边界说明。' },
        { id: 'implementation', title: '3｜控制实现', completionRule: '采集、阈值报警和串口上报模块可独立运行；注明 LCD 空接口与 EEPROM 扩展边界。' },
        { id: 'integration', title: '4｜联合调试', completionRule: '按正常、越限、传感器异常三类用例形成测试记录。' },
        { id: 'review', title: '5｜答辩复核', completionRule: '提交证据包并说明已验证结果、限制和后续实物验证。' },
      ],
      deliverables: [
        '带版本号的8051汇编代码与端口分配表',
        '仿真运行记录及关键寄存器/串口截图',
        '至少3类工况的测试表与问题修复记录',
        '个人贡献说明、工程伦理判断与项目反思',
      ],
      rubric: [
        { dimension: '功能正确性', weight: 30, evidence: '规定工况下的可重复运行记录' },
        { dimension: '接口规范', weight: 20, evidence: '端口表、数据帧和模块说明' },
        { dimension: '测试质量', weight: 20, evidence: '用例覆盖、异常处理和复测结果' },
        { dimension: '协作贡献', weight: 15, evidence: '分工、版本记录和个人贡献说明' },
        { dimension: '工程伦理', weight: 15, evidence: '数据真实性、安全边界和责任判断' },
      ],
    },
    theory: [
      {
        title: 'DS18B20 单总线温度传感器',
        content: `DS18B20 是 Dallas 单总线数字温度传感器：

引脚 (TO-92封装)：
  ┌───┐
  │   │
  └┤┤┤┘
   1 2 3
   │ │ │
  GND DQ VDD

特性：
  测温范围: -55°C ~ +125°C
  精度: ±0.5°C (-10°C~+85°C)
  分辨率: 9~12位可配置 (默认12位)
  供电: 3.0~5.5V (或寄生供电)

单总线协议流程：
  1. 初始化: 主机拉低480μs → 释放 → 从机拉低60~240μs
  2. ROM命令: 单器件总线可用CCH(跳过ROM)；多器件读取须选定地址，33H(读ROM)只用于单器件
  3. 功能命令: 44H启动转换，等待完成后重新复位和选择器件，再用BEH读取暂存器并校验CRC

温度数据格式 (12位)：
  MSB: SSSS SXXX   S=符号扩展位；高字节低3位也是整数位
  LSB: XXXX YYYY   X=整数 Y=小数

  raw = MSB×256 + LSB（无符号16位，0~65535）
  signed = raw < 32768 ? raw : raw−65536
  T = signed × 0.0625°C；这是16位符号扩展的二进制补码，不能对未限位的整数直接取反。

  例: 25.0625°C → MSB=01H, LSB=91H
      0x0191 = 401 → 401×0.0625 = 25.0625°C
  负温度例: 0xFF5E → 65374−65536 = −162 → −10.125°C
  较低分辨率下未定义的低位须按配置处理，不能仍当作12位有效精度。
参考：Analog Devices DS18B20数据手册，温度寄存器图4及表1。
https://www.analog.com/media/en/technical-documentation/data-sheets/DS18B20.pdf`,
      },
      {
        title: '单总线通信时序详解',
        content: `单总线严格时序要求 (μs级精度)：

复位脉冲：
  主机    ┐480~960μs┌──15~60μs──┐
  ────────┘         └           └──────
  从机                   ┐60~240μs┌
  ──────────────────────┘         └──

写0时隙 (60~120μs)：
  主机  ┐                    ┌
  ──────┘   60~120μs 低电平   └──

写1时隙 (1~15μs低 + 释放)：
  主机  ┐  ┌───────────────┐
  ──────┘1μs└               └──

读时隙 (主机采样窗口<15μs)：
  主机  ┐ ┌ 采样点(15μs内)
  ──────┘1└─────────────────
  从机输出  0或1

关键：按具体内核时序计算延时，可用经校准的指令循环或定时器；同时考虑中断打断。
经典12T内核、12MHz: 1个机器周期 = 1μs
这些延时是假定12MHz的独立算例；下节9600bit/s串口参数使用11.0592MHz。
实物只能选定同一晶振后统一重算定时、传感器延时和串口初值，不能直接混用。`,
      },
      {
        title: 'UART 串口通信与数据上报',
        content: `8051 UART 方式1 (8位数据, 可变波特率)：

数据帧格式：
  ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
  │起始│D0 │D1 │D2 │D3 │D4 │D5 │D6 │D7 │停止│
  │ 0  │   │   │   │   │   │   │   │   │ 1  │
  └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘

经典12T内核、SMOD=0时：波特率 = fosc / (12 × 32 × (256-TH1))
  @11.0592MHz: TH1=FDH → 9600bps

JSON格式数据上报（与上位机/物联网平台对接）：
  {"temp":25}\\r\\n
  上行为格式示例；DS18B20只测温度，湿度须由另一个实际传感器提供。

发送流程：
  1. 将数字转为ASCII: DIV AB分离十位/个位
  2. 加上30H变成ASCII字符
  3. 逐字节写入SBUF
  4. 等待TI=1(发送完成)
  5. 清除TI标志

优点：
  - JSON格式通用，PC/手机/云端都能解析
  - \\r\\n结尾便于行缓冲接收`,
      },
      {
        title: '扩展参考｜AT24C02 I2C EEPROM 存储',
        content: `本节仅供项目扩展，不计入当前平台完成判定。AT24C02 是 2Kbit (256字节) 串行EEPROM：

I2C 总线基础：
  SDA: 数据线 (双向)
  SCL: 时钟线 (主机控制)
  均需 4.7kΩ 上拉电阻

通信协议：
  起始 → 设备地址+W → ACK → 字节地址 → ACK → 数据 → ACK → 停止

设备地址：
  ┌───┬───┬───┬───┬───┬───┬───┬───┐
  │ 1 │ 0 │ 1 │ 0 │A2 │A1 │A0 │R/W│
  └───┴───┴───┴───┴───┴───┴───┴───┘
  A2=A1=A0=0时: 写=A0H, 读=A1H

写入时序：
  START → A0H → ACK → addr → ACK → data → ACK → STOP
  写入后需等待 5ms (tWR)

读取时序：
  START → A0H → ACK → addr → ACK →
  START → A1H → ACK → data → NACK → STOP

应用：存储报警阈值、历史数据、系统配置
  断电不丢失，擦写寿命 >100万次`,
      },
    ],
    circuitDescription: `
智慧农业大棚监控系统电路：

  ┌──────────────────────────────────────────┐
  │               AT89C51                     │
  │                                           │
  │ P3.7(DQ) ←──[4.7kΩ]──VCC                │
  │            └── DS18B20 (温度)             │
  │                                           │
  │ P3.4 ←── DHT11 DATA (温湿度)             │
  │           [4.7kΩ上拉] (本程序代入模拟值65%)│
  │                                           │
  │ P1.0~P1.7 ──→ LCD1602 数据口 (后续任务)  │
  │ P2.5=RS P2.6=RW P2.7=E                   │
  │                                           │
  │ P3.0(RXD) ←── USB转TTL TXD              │
  │ P3.1(TXD) ──→ USB转TTL RXD              │
  │                                           │
  │ P3.5 ──→ 蜂鸣器 (有源, 高电平驱动)       │
  │                                           │
  │ P3.6 ──→ 继电器 → 风扇/加热器 (拓展预留) │
  │                                           │
  │ P2.0(SCL) ──→ AT24C02 SCL ┐(项目拓展)   │
  │ P2.1(SDA) ←→ AT24C02 SDA ┘             │
  │              [4.7kΩ上拉×2]               │
  └──────────────────────────────────────────┘

DS18B20 接线 (单总线)：
     VCC ──[4.7kΩ]──┬── P3.7
                     │
               ┌─────┴─────┐
               │  DS18B20  │
               │ GND DQ VDD│
               └──┤──┤──┤──┘
                  │     │
                 GND   VCC`,
    registerReference: [
      {
        name: 'SCON',
        address: '98H',
        bits: ['SM0', 'SM1', 'SM2', 'REN', 'TB8', 'RB8', 'TI', 'RI'],
        description: '50H=方式1(8位UART)+允许接收。TI/RI需软件清零',
      },
      {
        name: 'SBUF',
        address: '99H',
        bits: [],
        description: '串口缓冲。写SBUF启动发送，读SBUF获取接收数据',
      },
      {
        name: 'B',
        address: 'F0H',
        bits: [],
        description: 'B寄存器。MUL AB结果高8位存B；DIV AB余数存B',
      },
      {
        name: 'PSW',
        address: 'D0H',
        bits: ['CY', 'AC', 'F0', 'RS1', 'RS0', 'OV', 'F1', 'P'],
        description: 'CY=进借位; AC=辅助进位(BCD); OV=溢出; P=奇偶',
      },
    ],
    stepByStep: [
      { step: '1. 实现单总线驱动', detail: '编写OW_RESET/OW_WRITE/OW_READ三个基础子程序，注意μs级时序' },
      { step: '2. DS18B20实物读取拓展', detail: '单器件示例：复位→CCH→44H→等待转换完成（12位最大750ms）→复位→CCH→BEH→读9字节并校验CRC。寄生供电转换期间需强上拉；多器件须匹配ROM地址。当前仿真使用模拟值。' },
      { step: '3. 温度数据处理', detail: '将前两字节组合为raw；raw≥32768时减65536得到有符号值，再乘0.0625°C。显示负温度时先保留符号，再处理绝对值的整数和小数部分。' },
      { step: '4. LCD显示温湿度（项目后续任务）', detail: 'UPDATE_LCD当前仅为空接口；第1行温度、第2行湿度的显示需在后续实物阶段另行实现与验证' },
      { step: '5. 串口数据上报', detail: '逐字节通过SBUF发送并等待TI；JSON中的温湿度须与各自的模拟输入或实际传感器对应，DS18B20不提供湿度。' },
      { step: '6. 阈值报警设计', detail: '本例非负模拟温度可用双字节SUBB与01E0H（30°C×16）作无符号比较。实物负温度须先按有符号补码处理；FF5EH是−10.125°C，不能因原始码大于01E0H而报警。' },
      { step: '7. EEPROM存储配置（项目拓展）', detail: '后续可用I2C写入报警阈值并验证上电恢复；当前程序未实现，且不计入本轮完成判定' },
      { step: '8. 系统可靠性测试', detail: '长时间运行观察数据稳定性，测试传感器异常时的容错处理' },
    ],
    instructionRef: [
      { instr: 'RRC', syntax: 'RRC A', desc: '带进位右移，CY→A7，A0→CY', example: 'RRC A ; 单总线写位操作' },
      { instr: 'MOV C,bit', syntax: 'MOV C,bit', desc: '位→进位标志', example: 'MOV C,DQ ; 读单总线数据位' },
      { instr: 'MOV bit,C', syntax: 'MOV bit,C', desc: '进位标志→位', example: 'MOV DQ,C ; 写单总线数据位' },
      { instr: 'DIV', syntax: 'DIV AB', desc: 'A÷B，商→A，余数→B', example: 'DIV AB ; 分离十位个位' },
      { instr: 'SUBB', syntax: 'SUBB A,#data', desc: '带借位减法，设置CY', example: 'SUBB A,#0E0H ; 16位比较：先减阈值01E0H低字节' },
      { instr: 'JNB', syntax: 'JNB bit,rel', desc: '位=0则跳转', example: 'JNB TI,$ ; 等待发送完成' },
      { instr: 'NOP', syntax: 'NOP', desc: '空操作(1个机器周期)', example: 'NOP ; 精确延时1μs@12MHz' },
    ],
    realWorldApplications: [
      '智慧农业温室 — 温湿度自动调控，远程手机监控，是本项目的直接应用',
      '冷链物流监控 — DS18B20记录运输全程温度，EEPROM存储数据',
      '工业环境监测 — 多传感器采集+串口上报+云端分析',
      '智能家居系统 — 温湿度+空气质量传感器联动空调/新风',
      '物联网(IoT)原型 — 串口→WiFi模块(ESP8266)→云平台，完整IoT链路',
      '气象观测站 — 多参数采集+定时存储+远程传输',
    ],
    commonMistakes: [
      { mistake: '单总线时序不准', explanation: '经典12T内核、12MHz晶振下1个机器周期=1μs，NOP=1μs，DJNZ=2μs。更换晶振或内核时必须重新计算延时，并核对中断影响。' },
      { mistake: '忘记4.7kΩ上拉电阻', explanation: '单总线和I2C都是开漏输出，必须外接上拉电阻。没有上拉，总线无法回到高电平，通信必然失败。' },
      { mistake: '温度负数处理错误', explanation: '12位配置时，先组合无符号16位raw；若raw≥32768，用raw−65536还原负数，再乘0.0625°C。例如FF5EH对应−10.125°C，不能丢失负号。' },
      { mistake: '串口发送不等TI', explanation: '写SBUF后必须等TI=1才能发下一字节。否则数据会被覆盖导致丢失。常用JNB TI,$循环等待。' },
      { mistake: '扩展项：EEPROM写入后未延时', explanation: 'AT24C02每次写入需5ms内部编程时间(tWR)。连续写入前必须延时5ms或查询ACK；该项不计入当前平台完成判定。' },
    ],
    thinkingQuestions: [
      '为什么DS18B20用单总线而不是I2C/SPI？单总线的优缺点是什么？',
      '12位温度分辨率0.0625°C，但精度只有±0.5°C，这两个概念有什么区别？',
      '如何实现多个DS18B20挂在同一条总线上？(提示：每个芯片有唯一64位ROM编码)',
      'JSON格式占用较多字节，如果要节省串口带宽，有什么替代方案？(提示：二进制协议、Protobuf)',
      '如果要做一个真正的物联网系统，串口之后还需要哪些模块？(提示：ESP8266 WiFi、MQTT协议)',
      '系统运行中如果DS18B20损坏(拔掉)，程序会怎样？如何增加容错处理？',
    ],
  },
};

// 为没有详细教学内容的实验提供默认内容
const defaultContent: TeachingContent = {
  theory: [],
  circuitDescription: '',
  registerReference: [],
  stepByStep: [],
  instructionRef: [],
  realWorldApplications: [],
  commonMistakes: [],
  thinkingQuestions: [],
};

export function getTeachingContent(expId: string): TeachingContent {
  return teachingContents[expId] || defaultContent;
}
