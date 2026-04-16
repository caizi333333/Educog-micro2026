/**
 * 教学内容数据 — 每个实验的详细教学资料
 * 桂林航天工业学院 · 微控制器原理与应用
 */

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
  /** 对应教学大纲周次，如 "第1-2周" */
  week: string;
  /** 对应教学主题，如 "单片机基础知识" */
  chapter: string;
  /** 对应学时 */
  hours: number;
  /** 教材参考章节 */
  textbookRef: string;
  /** 知识图谱关联（大纲中的知识点层级） */
  knowledgeMap?: string;
  /** 思政融入点 */
  ideologicalPoint?: string;
}

export interface TeachingContent {
  /** 课程大纲映射 — 对应《微控制器应用技术》教学大纲 */
  syllabusMapping?: SyllabusMapping;
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
      week: '第1-2周',
      chapter: '单片机基础知识',
      hours: 4,
      textbookRef: '《单片机原理及应用技术》第1章：89C51系列单片机概述',
      knowledgeMap: '一级知识点"单片机概述"，含约20个三级知识点',
      ideologicalPoint: '国产芯片发展历程（爱国主义教育）',
    },
    theory: [
      {
        title: '8051 并行 I/O 口结构',
        content: `8051 有 4 个 8 位并行 I/O 口 (P0~P3)，每个口有 8 个引脚。

P1 口特点：
• 准双向口，内部有上拉电阻
• 复位后默认输出高电平 (0xFF)
• 可逐位操作 (P1.0 ~ P1.7)
• 输出低电平能力约 20mA，可直接驱动 LED

P0 口特点：
• 开漏输出，需要外接上拉电阻
• 复用为地址/数据总线低 8 位
• 驱动能力最强 (约 26mA)

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
  R = (5V - 2V - 0.4V) / 10mA ≈ 260Ω → 选 330Ω

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
│              │  330Ω   LED
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
      { instr: 'RL', syntax: 'RL A', desc: '累加器循环左移', example: 'RL A  ; A.7→CY, A.6→A.7, ...' },
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
      { mistake: '限流电阻值选择不当', explanation: '电阻过小(<100Ω)会烧毁LED或单片机；过大(>1kΩ)LED亮度不足。建议 220Ω~470Ω。' },
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
      week: '第3-5周',
      chapter: '单片机硬件结构',
      hours: 6,
      textbookRef: '《单片机原理及应用技术》第2章：存储器组织与特殊功能寄存器',
      knowledgeMap: '一级知识点"硬件结构"，含约40个三级知识点',
      ideologicalPoint: '航天嵌入式系统可靠性设计（航天品质/工匠精神）',
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

注意：MOV 指令不影响任何标志位（PSW 不变）`,
      },
    ],
    circuitDescription: `
┌──────────────┐
│   AT89C51    │  330Ω    LED (灌电流)
│              │
│  P1.0~P1.7 ─┤├──┤►├── VCC  (×8)
│              │
│  模式1: 单点流水    0FEH→0FDH→0FBH→...→7FH
│  模式2: 奇偶交替    0AAH ↔ 55H
│  模式3: 中心扩散    0E7H→0C3H→81H→00H
└──────────────┘`,
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
    ],
    stepByStep: [
      { step: '1. 理解灯码', detail: '0FEH=11111110B，低电平亮，即只有 P1.0 亮' },
      { step: '2. 模式1：逐个点亮', detail: '依次输出 0FEH→0FDH→0FBH→...→7FH，每次只亮一个灯' },
      { step: '3. 模式2：奇偶交替', detail: '0AAH=10101010B，55H=01010101B，交替输出' },
      { step: '4. 模式3：中心扩散', detail: '从中间两个灯开始，逐步向两侧展开' },
      { step: '5. 观察延时效果', detail: '调整 DELAY 参数 R6/R7 改变流水速度' },
    ],
    instructionRef: [
      { instr: 'MOV', syntax: 'MOV P1, #data', desc: '立即数写端口', example: 'MOV P1, #0AAH ; 奇数位亮' },
      { instr: 'NOP', syntax: 'NOP', desc: '空操作(1机器周期)', example: 'NOP ; 精确微调延时' },
      { instr: 'PUSH', syntax: 'PUSH direct', desc: 'SP+1, [SP]←data', example: 'PUSH ACC' },
      { instr: 'POP', syntax: 'POP direct', desc: 'data←[SP], SP-1', example: 'POP B' },
    ],
    realWorldApplications: [
      '节日彩灯控制器 — 多种花样灯光模式循环',
      'KTV/舞厅灯光控制 — 音乐节拍与灯光联动',
      '电路板测试程序 — 用灯光模式验证 IO 口功能',
    ],
    commonMistakes: [
      { mistake: '共阴和共阳数码管搞混', explanation: '共阴数码管高电平亮，共阳数码管低电平亮。LED 阵列同理要确认驱动极性。' },
      { mistake: '子程序中修改了调用者的寄存器', explanation: 'DELAY 使用 R6/R7，若主程序也用到这些寄存器需先 PUSH 保护。' },
    ],
    thinkingQuestions: [
      '0AAH 和 55H 的二进制分别是什么？为什么交替输出能实现奇偶闪烁？',
      '如何实现从两端向中心聚拢的效果？需要几个灯码？',
      '如果用循环+移位指令代替逐个写灯码，程序会有什么优势？',
    ],
  },

  // ═══════════════════════════════════════════════
  // 实验三：定时/计数器实验
  // ═══════════════════════════════════════════════
  exp03: {
    syllabusMapping: {
      week: '第13-14周',
      chapter: '定时器/计数器',
      hours: 4,
      textbookRef: '《单片机原理及应用技术》第5章：定时器/计数器工作模式与应用',
      knowledgeMap: '一级知识点"定时器/计数器"，含约20个三级知识点',
      ideologicalPoint: '精确测量与中国计量技术发展（科技创新）',
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
  50ms:  初值 = 65536-50000 = 15536 = 3CB0H`,
      },
      {
        title: '中断系统',
        content: `8051 有 5 个中断源：

优先级(默认):  中断向量    名称
最高  INT0     0003H      外部中断0
      T0       000BH      定时器0溢出
      INT1     0013H      外部中断1
      T1       001BH      定时器1溢出
最低  UART     0023H      串口中断

IE 寄存器 (A8H, 可位寻址):
  EA — ES — ET1 — EX1 — ET0 — EX0
  |                              |
  总开关                    各个中断使能

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
        bits: ['EA', '—', 'ET2', 'ES', 'ET1', 'EX1', 'ET0', 'EX0'],
        description: '中断使能寄存器，EA为总开关',
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
      { instr: 'CLR', syntax: 'CLR bit', desc: '位清0', example: 'CLR TF0   ; 清溢出标志' },
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
      week: '第6-7周',
      chapter: '指令系统与汇编语言',
      hours: 4,
      textbookRef: '《单片机原理及应用技术》第3章：指令系统——算术运算与逻辑运算指令',
      knowledgeMap: '一级知识点"软件编程"，含约35个三级知识点',
      ideologicalPoint: '严谨的工程思维（工匠精神）',
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
  9: 6FH (0110 1111)  a,b,c,d,f,g`,
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
      week: '第6-7周',
      chapter: '指令系统与汇编语言',
      hours: 4,
      textbookRef: '《单片机原理及应用技术》第3章：指令系统——位操作与控制转移指令',
      knowledgeMap: '一级知识点"软件编程"，含约35个三级知识点',
      ideologicalPoint: '严谨的工程思维（工匠精神）',
    },
    theory: [
      {
        title: '机械按键抖动原理',
        content: `机械按键的触点在按下和释放瞬间会产生抖动：

按键信号波形：
  高 ─┐ ┌┐┌┐┌─────────────┐ ┌┐┌┐┌─ 高
  低   └┘└┘└              └┘└┘└
      ├抖动├  ← 稳定 →  ├抖动├
      ~5-10ms              ~5-10ms

如果不消抖，一次按键可能被识别为多次！

消抖方法：
1. 硬件消抖：RC 滤波 + 施密特触发器
2. 软件消抖（最常用）：
   - 检测到按键按下
   - 延时 10~20ms
   - 再次检测，如果仍按下则有效
   - 等待按键释放（防止连触）`,
      },
      {
        title: '矩阵键盘扫描',
        content: `4×4 矩阵键盘只需 8 根线 (行4 + 列4)

扫描原理：
  行输出  列输入
  R0 ─┼──┼──┼──┼─ C0
  R1 ─┼──┼──┼──┼─ C1
  R2 ─┼──┼──┼──┼─ C2
  R3 ─┼──┼──┼──┼─ C3

步骤：
  1. R0=0, R1~R3=1 → 读列，找到哪列为0
  2. R1=0, 其他=1 → 读列
  3. R2=0, ...
  4. R3=0, ...

键值 = 行号 × 4 + 列号 (0~15)`,
      },
    ],
    circuitDescription: `
┌──────────────┐     4×4 矩阵键盘
│   AT89C51    │     C3 C2 C1 C0
│              │      |  |  |  |
│  P1.0 (R0) ──├───× ─× ─× ─×
│  P1.1 (R1) ──├───× ─× ─× ─×
│  P1.2 (R2) ──├───× ─× ─× ─×
│  P1.3 (R3) ──├───× ─× ─× ─×
│              │      |  |  |  |
│  P3.0 (C0) ──├─────┘  |  |  |
│  P3.1 (C1) ──├────────┘  |  |
│  P3.2 (C2) ──├───────────┘  |
│  P3.3 (C3) ──├──────────────┘
│  P0 (显示) ──├── 键值显示
└──────────────┘
列线需上拉电阻 (10KΩ)`,
    registerReference: [],
    stepByStep: [
      { step: '1. 初始化端口', detail: 'P1 高4位输出, P3 低4位输入(带上拉)' },
      { step: '2. 行扫描', detail: '依次将 P1 的一行置0, 其余置1' },
      { step: '3. 读列状态', detail: '读 P3 低4位, 如果有0说明对应列有键按下' },
      { step: '4. 计算键值', detail: '键值 = 行号×4 + 列号' },
      { step: '5. 软件消抖', detail: '延时 20ms 后再次确认按键状态' },
    ],
    instructionRef: [
      { instr: 'ANL', syntax: 'ANL A, #data', desc: '逻辑与', example: 'ANL A, #0FH ; 取低4位' },
      { instr: 'RRC', syntax: 'RRC A', desc: '带进位右移', example: 'RRC A ; 逐位检测' },
      { instr: 'JC', syntax: 'JC rel', desc: 'CY=1跳转', example: 'JC COL_FOUND' },
      { instr: 'JNB', syntax: 'JNB bit, rel', desc: '位=0跳转', example: 'JNB P3.2, KEY' },
    ],
    realWorldApplications: [
      '电梯按钮面板 — 可靠的按键检测和楼层选择',
      '微波炉控制面板 — 多键组合和长按识别',
      '密码锁 — 键盘输入密码并验证',
      'ATM 机键盘 — 安全的数字输入',
      '遥控器 — 红外编码键盘',
    ],
    commonMistakes: [
      { mistake: '没有消抖导致重复触发', explanation: '一次按键产生多次响应，必须加10~20ms延时消抖。' },
      { mistake: '忘记等待按键释放', explanation: '按住按键时程序持续执行，导致功能重复触发。应加"等待释放"逻辑。' },
      { mistake: '列线没有上拉电阻', explanation: '输入引脚悬空时状态不确定，必须加上拉电阻确保默认高电平。' },
    ],
    thinkingQuestions: [
      '如何区分短按和长按？需要什么数据结构？',
      '如果同时按下两个键，扫描程序会怎样？如何处理"鬼键"？',
      '用中断方式检测按键和轮询方式各有什么优缺点？',
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
      week: '第11-12周',
      chapter: '中断系统',
      hours: 4,
      textbookRef: '《单片机原理及应用技术》第4章：中断系统——定时器中断与计时应用',
      knowledgeMap: '一级知识点"中断系统"，含约25个三级知识点',
      ideologicalPoint: '实时系统与安全关键系统（科技伦理）',
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

中断优先级：
  T0 中断 (000BH) — 计时，优先级默认较高
  T1 中断 (001BH) — 显示，可被 T0 中断打断

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
        name: 'IP',
        address: '0B8H',
        bits: ['—', '—', 'PT2', 'PS', 'PT1', 'PX1', 'PT0', 'PX0'],
        description: '中断优先级寄存器，1=高优先级',
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
      { instr: 'JB', syntax: 'JB bit, rel', desc: '位=1时跳转', example: 'JB 24H.0, SHOW_SEC' },
    ],
    realWorldApplications: [
      '电子手表 — 精确计时与多模式显示',
      '工厂计时器 — 生产线工时统计',
      '微波炉/烤箱定时 — 倒计时控制',
      '考试计时系统 — 精确的开考/交卷控制',
    ],
    commonMistakes: [
      { mistake: 'T0 和 T1 中断中使用相同寄存器冲突', explanation: '两个中断可能嵌套，必须各自 PUSH/POP 保护使用的寄存器，或使用不同的寄存器组 (RS0/RS1)。' },
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
      week: '第13-14周',
      chapter: '定时器/计数器',
      hours: 4,
      textbookRef: '《单片机原理及应用技术》第5章：定时器/计数器——PWM波形生成与频率控制',
      knowledgeMap: '一级知识点"定时器/计数器"，含约20个三级知识点',
      ideologicalPoint: '精确测量与中国计量技术发展（科技创新）',
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

音符编码:
  0 = 休止符
  1~7 = 低音 Do~Si
  8~14 = 中音 Do~Si
  15~21 = 高音 Do~Si

节拍编码 (以 1/16 音符为单位):
  4 = 四分音符 (1拍)
  8 = 二分音符 (2拍)
  16 = 全音符 (4拍)
  2 = 八分音符 (半拍)

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
      { instr: 'DW', syntax: 'DW word1,word2,...', desc: '定义16位字数据', example: 'DW 0FC44H, 0FC6CH' },
      { instr: 'CPL', syntax: 'CPL bit', desc: '位取反(翻转)', example: 'CPL P2.0 ; 产生方波' },
      { instr: 'DEC', syntax: 'DEC A', desc: '减1', example: 'DEC A  ; 音符索引-1' },
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
      '如何实现音量控制？(提示: PWM占空比)',
      '如果要同时发两个音(和弦), 单片机能做到吗？怎么实现？',
      '为什么真实的音乐芯片音质比单片机方波好得多？',
    ],
  },

  // ═══════════════════════════════════════════════
  // 实验八：步进电机控制
  // ═══════════════════════════════════════════════
  exp08: {
    syllabusMapping: {
      week: '第13-14周',
      chapter: '定时器/计数器',
      hours: 4,
      textbookRef: '《单片机原理及应用技术》第5章：定时器/计数器——步进电机脉冲控制',
      knowledgeMap: '一级知识点"定时器/计数器"，含约20个三级知识点',
      ideologicalPoint: '精确测量与中国计量技术发展（科技创新）',
    },
    theory: [
      {
        title: '步进电机工作原理',
        content: `步进电机 — 脉冲控制的精确定位电机

四相步进电机 (28BYJ-48):
  4 个线圈 A/B/C/D, 通电顺序决定转向
  步距角: 5.625°/64 (减速比 1:64)
  一圈 = 360° ÷ 5.625° × 64 = 4096 步

三种驱动模式：
1. 单四拍 (全步): A→B→C→D
   稳定但力矩小, 4步/周期

2. 双四拍 (全步): AB→BC→CD→DA
   力矩大但功耗高, 4步/周期

3. 八拍 (半步): A→AB→B→BC→C→CD→D→DA
   精度最高, 运行最平滑, 8步/周期

相序表 (P1高4位控制, 低电平有效):
  A相: 0001 → 0F1H
  AB:  0011 → 0F3H
  B相: 0010 → 0F2H
  ...`,
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
│  T0 中断 ────├── 速度控制
└──────────────┘`,
    registerReference: [],
    stepByStep: [
      { step: '1. 建立相序表', detail: 'DB 定义 8 个半步相序数据, 正转和反转各一份' },
      { step: '2. 定时器控制速度', detail: 'T0 定时中断, 定时值决定步进速度' },
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
      '28BYJ-48 电机转一圈需要多少个半步脉冲？',
      '如何实现 S 曲线加减速？对电机运行有什么好处？',
      '步进电机和伺服电机有什么区别？各适合什么应用？',
    ],
  },

  // ═══════════════════════════════════════════════
  // 实验九：串口通信
  // ═══════════════════════════════════════════════
  exp09: {
    syllabusMapping: {
      week: '第15-16周',
      chapter: '串行通信',
      hours: 4,
      textbookRef: '《单片机原理及应用技术》第6章：串行通信——UART编程与协议应用',
      knowledgeMap: '一级知识点"通信接口"，含约25个三级知识点',
      ideologicalPoint: '物联网与智慧城市建设（科技创新/社会责任）',
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
  T1 模式2: TH1 = 256 - (f_osc / (12 × 32 × 波特率))

  12MHz, 9600bps: TH1 = 256 - 3.255 ≈ 253 = FDH
  11.0592MHz, 9600bps: TH1 = 256 - 3 = 253 = FDH (精确!)`,
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
TI: 发送中断标志 (发送完一帧后硬件置1, 需软件清0)
RI: 接收中断标志 (接收完一帧后硬件置1, 需软件清0)

发送: MOV SBUF, A → 自动发送 → TI=1
接收: RI=1 → MOV A, SBUF → 读取数据`,
      },
    ],
    circuitDescription: `
┌──────────────┐              PC (串口助手)
│   AT89C51    │              ┌─────────┐
│              │  MAX232      │ COM Port│
│  TXD (P3.1)─├──→ T1OUT ──→ │ RXD     │
│  RXD (P3.0)─├──← R1OUT ──← │ TXD     │
│              │              │ GND     │
│  T1 (波特率) │              └─────────┘
│  TH1=FDH    │
│  (9600bps)   │   或 USB-TTL 模块 (CH340/CP2102)
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
      { step: '2. 配置波特率', detail: 'TMOD=20H (T1模式2), TH1=FDH (9600bps)' },
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
      { mistake: '波特率不匹配', explanation: '发送和接收双方波特率必须一致。12MHz晶振的9600bps有微小误差(0.16%)，11.0592MHz完全精确。' },
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
      week: '实践项目1（4学时）',
      chapter: '走进89C51的世界',
      hours: 4,
      textbookRef: '对应第1-5周知识点：Keil环境搭建、LED流水灯、按键控制',
      knowledgeMap: '综合运用"单片机概述"+"硬件结构"知识点',
      ideologicalPoint: '国产芯片发展历程与航天品质',
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
  12MHz ┤ XTAL1/2           │─ P1.0~P1.7 → [330Ω] → LED → VCC
  30pF×2│                   │
        │ RST ← [10μF]+[8.2K]│─ P0.0~P0.7 → 数码管段选
        │                    │─ P2.4~P2.7 → 数码管位选
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
      { step: '2. 连接 LED', detail: 'P1.0~P1.7 经 330Ω 电阻接 LED，灌电流驱动' },
      { step: '3. 编写流水灯', detail: 'RL A 循环左移实现 LED 逐个点亮' },
      { step: '4. 设计延时', detail: 'DJNZ 双重循环产生约 500ms 可见延时' },
      { step: '5. 连接数码管', detail: 'P0 输出段码, MOVC 查表取码' },
      { step: '6. 显示 0~9', detail: '循环查表 SEG_TAB, 每隔 500ms 切换数字' },
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
      week: '实践项目2（4学时）',
      chapter: '智慧路灯系统设计',
      hours: 4,
      textbookRef: '对应第6-12周知识点：光敏传感器检测、PWM调光、定时开关控制',
      knowledgeMap: '综合运用"软件编程"+"中断系统"+"定时器/计数器"知识点',
      ideologicalPoint: '节能减排与绿色发展（生态文明建设）',
    },
    theory: [
      {
        title: 'ADC0809 模数转换原理',
        content: `ADC0809 是 8 位逐次逼近型 A/D 转换器，8 路模拟输入：

工作流程：
  采样 → 保持 → 量化 → 编码

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
  转换时间: ~100μs (CLK=500kHz)
  输入电压范围: 0~5V (Vref+=5V)
  量化公式: D = Vin / Vref × 256

控制信号时序：
  1. 选择通道 (ADDA/B/C)
  2. START 上升沿启动转换
  3. 等待 EOC 变高 (转换完成)
  4. OE=1 读取数据`,
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
  LED调光: >100Hz (避免闪烁)
  电机驱动: >1kHz (避免噪声)`,
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
智慧路灯系统电路：

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
     CLK ← 500kHz (可由ALE分频)

MOSFET 驱动电路：
     P2.0 → [10K] → Gate
                      │
     +12V ── Drain ──┤
                    Source ── LED灯串 ── GND`,
    registerReference: [
      {
        name: 'TMOD',
        address: '89H',
        bits: ['GATE1', 'C/T1', 'M1.1', 'M0.1', 'GATE0', 'C/T0', 'M1.0', 'M0.0'],
        description: '定时器模式寄存器。T0方式1(16位): TMOD=01H; T1方式2(8位自重装): TMOD=20H',
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
      { step: '2. 编写ADC读取子程序', detail: 'START脉冲启动转换，延时等待EOC，OE使能后读取P0口数据' },
      { step: '3. 配置定时器生成PWM', detail: 'T0方式1，100μs中断，256级计数产生约39Hz~10kHz可调PWM' },
      { step: '4. 实现自动调光算法', detail: '光照值取反作为PWM占空比：环境越暗→ADC值越大→取反后PWM越大→LED越亮' },
      { step: '5. 初始化LCD1602', detail: '发送0x38/0x0C/0x06/0x01指令序列，配置为8位2行显示' },
      { step: '6. LCD显示数据', detail: '第1行显示光照ADC值，第2行显示PWM占空比百分比' },
      { step: '7. 系统集成测试', detail: '遮挡光敏电阻观察LED亮度变化和LCD数据更新' },
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
      '市政智慧路灯系统 — 根据环境光自动调节路灯亮度，节能30%~60%',
      '汽车自适应大灯 — 根据对向车灯和环境光调节远近光',
      'LED显示屏亮度控制 — 户外屏根据阳光强度自动调节',
      '手机/笔记本屏幕自动亮度 — 光线传感器+PWM背光调节',
      '温室补光系统 — 光照不足时自动开启植物补光灯',
    ],
    commonMistakes: [
      { mistake: 'PWM频率太低导致LED闪烁', explanation: '人眼对100Hz以下闪烁敏感。定时器中断周期应使PWM频率>200Hz。若256级分辨率，中断周期需<20μs (1/200/256)。' },
      { mistake: 'ADC读取未等待转换完成', explanation: 'ADC0809转换需约100μs。START脉冲后必须延时或查询EOC信号，否则读到的是上次转换结果。' },
      { mistake: 'LCD初始化时序不足', explanation: 'LCD上电后需等待>15ms才能发送指令。每条指令间需检查忙标志或延时>40μs，清屏指令需>1.6ms。' },
      { mistake: '光敏电阻分压方向接反', explanation: '光敏电阻阻值随光照增大而减小。需根据实际需求确定分压电路方向：串联固定电阻取上端或下端电压。' },
    ],
    thinkingQuestions: [
      '为什么PWM频率需要高于100Hz？如果用于电机调速，频率要求有什么不同？',
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
      week: '实践项目3（4学时）',
      chapter: '智能小车运动控制系统设计',
      hours: 4,
      textbookRef: '对应第8-14周知识点：电机驱动、红外避障、循迹控制、蓝牙遥控',
      knowledgeMap: '综合运用"C语言编程"+"中断系统"+"定时器/计数器"+"通信接口"知识点',
      ideologicalPoint: '智能制造与中国制造2025（科技强国）',
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
  黑线上: 无反射 → 输出高电平(1)
  白底上: 有反射 → 输出低电平(0)

三路循迹传感器编码：
  左 中 右  |  状态     |  动作
   0  1  0  |  正中     |  直行
   1  1  0  |  偏右     |  左转
   0  1  1  |  偏左     |  右转
   1  1  1  |  十字路口 |  策略决定
   0  0  0  |  脱线     |  停车/搜索`,
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
  │ P2.4(ENA)──→ L298N ENA (PWM调速)        │
  │ P2.5(ENB)──→ L298N ENB (PWM调速)        │
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
        bits: ['-', '-', 'PT2', 'PS', 'PT1', 'PX1', 'PT0', 'PX0'],
        description: '中断优先级。01H = EX0高优先级(避障响应优先)',
      },
    ],
    stepByStep: [
      { step: '1. 搭建电机驱动电路', detail: 'L298N的IN1~IN4接P2口，ENA/ENB接PWM输出或VCC(全速)' },
      { step: '2. 编写电机控制子程序', detail: '前进/后退/左转/右转/停止 5个子程序，控制IN1~IN4高低电平' },
      { step: '3. 配置蓝牙串口', detail: 'T1方式2产生9600bps波特率，SCON=50H，开串口中断' },
      { step: '4. 实现遥控模式', detail: '串口中断接收命令(F/B/L/R/S)，CJNE分支调用对应电机子程序' },
      { step: '5. 配置外部中断', detail: 'INT0/INT1接避障传感器，下降沿触发，中断中执行转向避障' },
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
      { mistake: '中断服务中调用延时', explanation: '中断ISR中调用DELAY_500MS会导致系统"冻结"500ms，无法响应其他中断。应设置标志位，在主循环中处理延时动作。' },
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
      week: '实践项目4（4学时）',
      chapter: '智慧农业大棚监控系统设计',
      hours: 4,
      textbookRef: '对应第11-16周知识点：温湿度采集、LCD显示、串口数据传输、报警控制',
      knowledgeMap: '综合运用"中断系统"+"定时器/计数器"+"通信接口"全部知识点',
      ideologicalPoint: '乡村振兴与智慧农业（科技服务社会）',
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
  2. ROM命令: CCH(跳过ROM) 或 33H(读ROM)
  3. 功能命令: 44H(启动转换) 或 BEH(读暂存器)

温度数据格式 (12位)：
  MSB: SSSS SSSS   S=符号位
  LSB: XXXX YYYY   X=整数 Y=小数

  正温度: T = (MSB×256 + LSB) × 0.0625
  负温度: T = ((~MSB×256 + ~LSB) + 1) × (-0.0625)

  例: 25.0625°C → MSB=01H, LSB=91H
      0x0191 = 401 → 401×0.0625 = 25.0625°C`,
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

关键：所有时序必须用NOP/DJNZ精确延时，
晶振频率直接影响延时精度！
12MHz: 1个机器周期 = 1μs`,
      },
      {
        title: 'UART 串口通信与数据上报',
        content: `8051 UART 方式1 (8位数据, 可变波特率)：

数据帧格式：
  ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
  │起始│D0 │D1 │D2 │D3 │D4 │D5 │D6 │D7 │停止│
  │ 0  │   │   │   │   │   │   │   │   │ 1  │
  └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘

波特率 = fosc / (12 × 32 × (256-TH1))
  @11.0592MHz: TH1=FDH → 9600bps

JSON格式数据上报（与上位机/物联网平台对接）：
  {"temp":25,"humi":65}\\r\\n

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
        title: 'AT24C02 I2C EEPROM 存储',
        content: `AT24C02 是 2Kbit (256字节) 串行EEPROM：

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
  │           [4.7kΩ上拉]                     │
  │                                           │
  │ P1.0~P1.7 ──→ LCD1602 数据口             │
  │ P2.5=RS P2.6=RW P2.7=E                   │
  │                                           │
  │ P3.0(RXD) ←── USB转TTL TXD              │
  │ P3.1(TXD) ──→ USB转TTL RXD              │
  │                                           │
  │ P3.5 ──→ 蜂鸣器 (有源, 高电平驱动)       │
  │                                           │
  │ P3.6 ──→ 继电器 → 风扇/加热器            │
  │                                           │
  │ P2.0(SCL) ──→ AT24C02 SCL               │
  │ P2.1(SDA) ←→ AT24C02 SDA               │
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
      { step: '2. DS18B20温度读取', detail: '复位→跳过ROM(CCH)→启动转换(44H)→等待750ms→复位→读暂存器(BEH)→读2字节' },
      { step: '3. 温度数据处理', detail: '12位数据×0.0625得到实际温度。整数部分右移4位，小数部分取低4位×625' },
      { step: '4. LCD显示温湿度', detail: '第1行显示"Temp:25.0C"，第2行显示"Humi:65%"。数字→ASCII需DIV AB分离各位' },
      { step: '5. 串口数据上报', detail: '组装JSON字符串{"temp":xx,"humi":xx}，逐字节通过SBUF发送，等待TI' },
      { step: '6. 阈值报警设计', detail: 'SUBB A,#30比较温度阈值，JNC跳转控制蜂鸣器。可扩展为上下限双阈值' },
      { step: '7. EEPROM存储配置', detail: 'I2C写入报警阈值到AT24C02，上电时读取恢复设置' },
      { step: '8. 系统可靠性测试', detail: '长时间运行观察数据稳定性，测试传感器异常时的容错处理' },
    ],
    instructionRef: [
      { instr: 'RRC', syntax: 'RRC A', desc: '带进位右移，CY→A7，A0→CY', example: 'RRC A ; 单总线写位操作' },
      { instr: 'MOV C,bit', syntax: 'MOV C,bit', desc: '位→进位标志', example: 'MOV C,DQ ; 读单总线数据位' },
      { instr: 'MOV bit,C', syntax: 'MOV bit,C', desc: '进位标志→位', example: 'MOV DQ,C ; 写单总线数据位' },
      { instr: 'DIV', syntax: 'DIV AB', desc: 'A÷B，商→A，余数→B', example: 'DIV AB ; 分离十位个位' },
      { instr: 'SUBB', syntax: 'SUBB A,#data', desc: '带借位减法，设置CY', example: 'SUBB A,#30 ; 比较30度阈值' },
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
      { mistake: '单总线时序不准', explanation: 'DS18B20要求μs级精度。12MHz晶振下1个机器周期=1μs，NOP=1μs，DJNZ=2μs。不同晶振必须重新计算延时。' },
      { mistake: '忘记4.7kΩ上拉电阻', explanation: '单总线和I2C都是开漏输出，必须外接上拉电阻。没有上拉，总线无法回到高电平，通信必然失败。' },
      { mistake: '温度负数处理错误', explanation: 'DS18B20负温度用补码表示，MSB高5位全1。必须先判断符号位，负数需取反加1再乘0.0625。' },
      { mistake: '串口发送不等TI', explanation: '写SBUF后必须等TI=1才能发下一字节。否则数据会被覆盖导致丢失。常用JNB TI,$循环等待。' },
      { mistake: 'EEPROM写入后未延时', explanation: 'AT24C02每次写入需5ms内部编程时间(tWR)。连续写入前必须延时5ms或查询ACK。' },
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
