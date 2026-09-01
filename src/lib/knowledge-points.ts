// ============================================================================
// 微控制器应用技术 - 279个知识点三层级清单（含 AI 素养单元）
// 基于89C51系列单片机课程体系构建
// 10个一级知识点 + 53个二级知识点 + 216个三级知识点
//
// 除父子层级外，本文件还维护两类真实课程关系（见文件末尾 relationPatches）：
//   prerequisites —— 前置依赖边，由课程组按课程逻辑编写，每条附一句推导依据，
//                    可在 /admin/knowledge-graph 编辑器中逐节点调整；
//   appliedIn    —— 使用 exp/proj 正式编号指向 experiment-config.ts 中的真实配置；
//                    配置内中文覆盖项需按课程语义人工复核，不宣称可机械反向等同。
// 每条 prerequisites 边为什么成立（具体到寄存器/机制的课程逻辑，而非空泛占位）
// 通过 reasons/prerequisiteReasons 字段结构化出来，供 UI 层直接展示；
// 运行时统一走 getPrerequisiteReason(pointId, prereqId) 查询，见文件末尾。
// ============================================================================

export interface KnowledgePointResource {
  type: 'video' | 'animation' | 'slide' | 'quiz' | 'document' | 'experiment' | 'image';
  title: string;
  url?: string;          // For verified course videos, documents, or local diagram assets
  refId?: string;        // For quizzes (quiz question ID) or experiments (exp01 etc)
  duration?: number;     // minutes
}

// Short tutor commentary attached to high-value KP nodes. Each field is one
// student-facing sentence, not a wall of text — meant for the DetailPanel
// "讲解" header above the resource list.
export interface KnowledgePointTutor {
  core: string;          // 一句话本质 — "this idea boils down to ..."
  whyImportant?: string; // 为什么这一节非学不可
  commonMistake?: string;// 学生常踩的坑
  takeaway?: string;     // 离开页面前要带走的一句话
}

export interface KnowledgePoint {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  parentId?: string;
  chapter: number;
  description?: string;
  graphNodeId?: string;
  resources?: KnowledgePointResource[];
  tutor?: KnowledgePointTutor;
  // Real cross-chapter relationships beyond strict parent-child hierarchy.
  // prerequisites: this point's id depends on understanding these other ids first.
  // appliedIn: lab/experiment refIds where this concept is exercised in practice.
  prerequisites?: string[];
  appliedIn?: string[];
  // Why each id in `prerequisites` is actually a prerequisite — keyed by the
  // prerequisite's own id, value is a one-sentence, mechanism-specific reason.
  // Only used for the handful of nodes that declare prerequisites inline in
  // this array (no matching entry in relationPatches below); for every other
  // node the reason lives in relationPatches[id].reasons and is resolved at
  // runtime by getPrerequisiteReason().
  prerequisiteReasons?: Record<string, string>;
}

/**
 * Stable targets for legacy graph links whose aliases occur on more than one
 * taxonomy node. The explicit table prevents array order or database merge
 * order from changing a historical deep link's destination.
 */
export const LEGACY_GRAPH_NODE_TARGETS: Readonly<Record<string, string>> = {
  mcu: '1',
  cpu: '2.1',
  io: '2.3',
  addressing_modes: '3.1',
  interrupts: '5.1',
  timers: '6.1',
  uart: '7.2',
};

/** Resolve a graph resource only to an implemented course route. */
export function resolveKnowledgeResourceHref(resource: KnowledgePointResource, chapter?: number): string | null {
  if (resource.url) return resource.url;
  if (resource.type === 'experiment' && resource.refId) return `/simulation?experiment=${encodeURIComponent(resource.refId)}`;
  if (resource.type === 'animation' && resource.refId === 'anim-addressing-modes') return '#addressing-compare';
  if (resource.type === 'quiz' && resource.refId === 'quiz-ch3-addressing') return '/quiz?topic=addressing-modes';
  if (resource.type === 'quiz' && resource.refId === 'quiz-ch10-ai-literacy') return '/quiz?topic=ai-literacy';
  if (resource.type === 'quiz') {
    const chapterFromRef = resource.refId?.match(/^quiz-ch(\d{1,2})(?:-|$)/i)?.[1];
    const resolvedChapter = chapterFromRef ? Number(chapterFromRef) : chapter;
    if (Number.isInteger(resolvedChapter) && Number(resolvedChapter) >= 1 && Number(resolvedChapter) <= 10) {
      return `/quiz?chapter=${resolvedChapter}`;
    }
  }
  return null;
}

/**
 * Keep the detail panel aligned with a chapter filter. A selection already in
 * the requested chapter is preserved; otherwise the chapter root (or the first
 * available point) becomes the explicit landing point.
 */
export function resolveChapterSelection(
  points: KnowledgePoint[],
  chapter: number,
  currentSelectedId: string,
): string {
  const current = points.find((point) => point.id === currentSelectedId);
  if (current?.chapter === chapter) return current.id;
  return points.find((point) => point.chapter === chapter && point.level === 1)?.id
    ?? points.find((point) => point.chapter === chapter)?.id
    ?? '';
}

export const knowledgePoints: KnowledgePoint[] = [
  // ========================================================================
  // 一级知识点1：单片机概述（4学时）
  // ========================================================================
  { id: '1', name: '单片机概述', level: 1, chapter: 1, description: '单片机基本概念、发展历史、分类选型与开发环境', graphNodeId: 'mcu',
    tutor: {
      core: '单片机 = 把 CPU、RAM、ROM、定时器、I/O 都做进一颗芯片，让一个芯片就能跑完整的控制系统。',
      whyImportant: '它是嵌入式系统的"砖头"——后面所有章节（中断、定时器、串口、接口）都是这块砖里的某一块。',
      commonMistake: '把 8051 当成"小型 PC"。它没有操作系统，所有外设都得你写代码直接拨寄存器。',
      takeaway: '8051 = 能独立完成"采集→判断→输出"控制闭环的一颗芯片。',
    },
    resources: [
    { type: 'slide', title: '第1章 单片机概述 课件PPT', refId: 'ch01-ppt' },
    { type: 'quiz', title: '第1章 单元测验', refId: 'quiz-ch1' },
    { type: 'experiment', title: '项目一：走进89C51的世界', refId: 'proj01', duration: 120 },
    { type: 'animation', title: '单片机内部结构动画演示', refId: 'anim-mcu-structure' },
  ] },

  { id: '1.1', name: '单片机发展历史', level: 2, parentId: '1', chapter: 1, description: '微处理器与单片机的发展历程', resources: [
    { type: 'slide', title: '1.1 单片机发展历史 课件', refId: 'ch01-ppt-s1' },
    { type: 'document', title: '单片机发展史阅读材料', refId: 'doc-mcu-history' },
  ] },
  { id: '1.1.1', name: '微处理器的诞生与发展', level: 3, parentId: '1.1', chapter: 1, description: '从Intel 4004到现代微处理器的演进历程' },
  { id: '1.1.2', name: '单片机的发展阶段', level: 3, parentId: '1.1', chapter: 1, description: '4位、8位、16位到32位单片机的发展脉络' },
  { id: '1.1.3', name: '国产单片机发展现状', level: 3, parentId: '1.1', chapter: 1, description: 'STC、GD、CH32等国产单片机厂商与产品' },

  { id: '1.2', name: '单片机分类与选型', level: 2, parentId: '1', chapter: 1, description: '按不同标准对单片机进行分类及选型方法', resources: [
    { type: 'slide', title: '1.2 单片机分类与选型 课件', refId: 'ch01-ppt-s2' },
    { type: 'quiz', title: '单片机分类与选型 练习题', refId: 'quiz-ch1-classify' },
  ] },
  { id: '1.2.1', name: '按字长分类', level: 3, parentId: '1.2', chapter: 1, description: '8位、16位、32位单片机的特点与适用场景' },
  { id: '1.2.2', name: '常见系列', level: 3, parentId: '1.2', chapter: 1, description: '51系列、AVR、PIC、STM32等主流单片机系列比较' },
  { id: '1.2.3', name: '选型原则与方法', level: 3, parentId: '1.2', chapter: 1, description: '根据功能需求、成本、功耗等因素进行芯片选型' },

  { id: '1.3', name: '单片机应用领域', level: 2, parentId: '1', chapter: 1, description: '单片机在各行业中的典型应用', resources: [
    { type: 'slide', title: '1.3 单片机应用领域 课件', refId: 'ch01-ppt-s3' },
    { type: 'document', title: '单片机典型应用案例汇编', refId: 'doc-mcu-applications' },
  ] },
  { id: '1.3.1', name: '工业控制', level: 3, parentId: '1.3', chapter: 1, description: 'PLC、电机控制、过程控制等工业应用' },
  { id: '1.3.2', name: '智能仪器仪表', level: 3, parentId: '1.3', chapter: 1, description: '数字万用表、示波器等智能测量仪器' },
  { id: '1.3.3', name: '消费电子', level: 3, parentId: '1.3', chapter: 1, description: '家电控制、玩具、遥控器等消费类产品' },
  { id: '1.3.4', name: '物联网与智能制造', level: 3, parentId: '1.3', chapter: 1, description: 'IoT节点、智能传感、工业4.0中的单片机应用' },
  { id: '1.3.5', name: '汽车电子', level: 3, parentId: '1.3', chapter: 1, description: '车身控制、发动机管理等汽车电子中的MCU应用' },

  { id: '1.4', name: '89C51基本结构', level: 2, parentId: '1', chapter: 1, description: 'AT89C51单片机的引脚、内部结构与最小系统', graphNodeId: 'mcu', resources: [
    { type: 'slide', title: '1.4 89C51基本结构 课件', refId: 'ch01-ppt-s4' },
    { type: 'animation', title: '89C51引脚功能交互动画', refId: 'anim-89c51-pins' },
    { type: 'experiment', title: '项目一：走进89C51的世界', refId: 'proj01', duration: 120 },
    { type: 'quiz', title: '89C51结构 练习题', refId: 'quiz-ch1-structure' },
  ] },
  { id: '1.4.1', name: '芯片引脚功能', level: 3, parentId: '1.4', chapter: 1, description: '40引脚DIP封装各引脚的名称与功能说明' },
  { id: '1.4.2', name: '内部功能框图', level: 3, parentId: '1.4', chapter: 1, description: 'CPU、存储器、I/O、定时器等内部模块组成' },
  { id: '1.4.3', name: '时钟电路与复位电路', level: 3, parentId: '1.4', chapter: 1, description: '晶振连接方式与上电复位/手动复位电路设计' },
  { id: '1.4.4', name: '工作方式（最小系统）', level: 3, parentId: '1.4', chapter: 1, description: '单片机最小系统的组成与工作条件' },

  { id: '1.5', name: '开发工具与环境', level: 2, parentId: '1', chapter: 1, description: '单片机开发所需的软硬件工具', resources: [
    { type: 'slide', title: '1.5 开发工具与环境 课件', refId: 'ch01-ppt-s5' },
    { type: 'document', title: 'Keil与Proteus安装配置指南', refId: 'doc-keil-proteus-setup' },
    { type: 'experiment', title: '项目一：走进89C51的世界', refId: 'proj01', duration: 120 },
  ] },
  { id: '1.5.1', name: 'Keil uVision集成开发环境', level: 3, parentId: '1.5', chapter: 1, description: 'Keil C51/uVision IDE的安装、配置与使用方法' },
  { id: '1.5.2', name: 'Proteus仿真软件', level: 3, parentId: '1.5', chapter: 1, description: 'Proteus电路仿真与单片机联合仿真方法' },
  { id: '1.5.3', name: '硬件调试工具', level: 3, parentId: '1.5', chapter: 1, description: '仿真器、烧录器的使用方法与调试技巧' },
  { id: '1.5.4', name: 'STC-ISP下载工具', level: 3, parentId: '1.5', chapter: 1, description: 'STC-ISP软件的使用与程序下载流程' },

  // ========================================================================
  // 一级知识点2：硬件结构（6学时）
  // ========================================================================
  { id: '2', name: '硬件结构', level: 1, chapter: 2, description: 'CPU结构、存储器、I/O接口、时钟时序与总线系统', graphNodeId: 'cpu',
    tutor: {
      core: '8051 内部 = 1 个 8 位 CPU + 4KB ROM + 128B RAM + 4 组 8 位 I/O 口 + 2 个定时器 + 1 个全双工串口 + 5 个中断源。',
      whyImportant: '后续学到的中断 / 定时器 / 串口都是"在这张内部地图上拨某个寄存器"，地图本身得先记牢。',
      commonMistake: '把 ROM 和 RAM 写混。代码烧在 ROM（内部 4KB / 外扩 64KB），运行变量放在 RAM（内部 128B / 外扩 64KB），二者地址空间是分开的。',
      takeaway: '内部 RAM 只有 128 字节——下笔前先想清楚每个变量该放在哪一段。',
    },
    resources: [
    { type: 'slide', title: '第2章 硬件结构 课件PPT', refId: 'ch02-ppt' },
    { type: 'quiz', title: '第2章 单元测验', refId: 'quiz-ch2' },
    { type: 'animation', title: 'CPU内部结构与数据通路动画', refId: 'anim-cpu-datapath' },
  ] },

  { id: '2.1', name: 'CPU结构', level: 2, parentId: '2', chapter: 2, description: '中央处理器的运算器、控制器等核心组件', graphNodeId: 'cpu', resources: [
    { type: 'slide', title: '2.1 CPU结构 课件', refId: 'ch02-ppt-s1' },
    { type: 'animation', title: 'ALU运算过程动画演示', refId: 'anim-alu-operation' },
    { type: 'quiz', title: 'CPU结构 练习题', refId: 'quiz-ch2-cpu' },
  ] },
  { id: '2.1.1', name: '运算器（ALU）结构与功能', level: 3, parentId: '2.1', chapter: 2, description: '算术逻辑单元的组成、运算类型与标志位' },
  { id: '2.1.2', name: '控制器工作原理', level: 3, parentId: '2.1', chapter: 2, description: '取指、译码、执行的控制流程与时序' },
  { id: '2.1.3', name: '程序计数器（PC）', level: 3, parentId: '2.1', chapter: 2, description: '16位程序计数器的功能与程序执行顺序控制' },
  { id: '2.1.4', name: '指令寄存器与指令译码器', level: 3, parentId: '2.1', chapter: 2, description: 'IR保存当前指令、译码器解析操作码' },

  { id: '2.2', name: '存储器组织', level: 2, parentId: '2', chapter: 2, description: '程序存储器、数据存储器与特殊功能寄存器', graphNodeId: 'memory', resources: [
    { type: 'slide', title: '2.2 存储器组织 课件', refId: 'ch02-ppt-s2' },
    { type: 'animation', title: '存储器地址空间映射动画', refId: 'anim-memory-map' },
    { type: 'quiz', title: '存储器组织 练习题', refId: 'quiz-ch2-memory' },
  ] },
  { id: '2.2.1', name: '程序存储器（ROM/Flash）结构', level: 3, parentId: '2.2', chapter: 2, description: '内部4KB Flash和外部程序存储器的地址空间' },
  { id: '2.2.2', name: '数据存储器（RAM）结构', level: 3, parentId: '2.2', chapter: 2, description: '内部128B RAM的分区：工作寄存器区、位寻址区、通用区' },
  { id: '2.2.3', name: '特殊功能寄存器（SFR）', level: 3, parentId: '2.2', chapter: 2, description: 'SFR的地址分布、常用寄存器功能与访问方法', graphNodeId: 'sfr' },
  { id: '2.2.4', name: '位可寻址区', level: 3, parentId: '2.2', chapter: 2, description: '内部RAM 20H-2FH共128个位地址的使用' },
  { id: '2.2.5', name: '外部存储器扩展', level: 3, parentId: '2.2', chapter: 2, description: '外部ROM和RAM的扩展方法与地址译码' },

  { id: '2.3', name: 'I/O接口', level: 2, parentId: '2', chapter: 2, description: 'P0-P3四个8位并行I/O端口的结构与特性', graphNodeId: 'io', resources: [
    { type: 'slide', title: '2.3 I/O接口 课件', refId: 'ch02-ppt-s3' },
    { type: 'animation', title: 'P0-P3端口内部结构对比动画', refId: 'anim-io-ports' },
    { type: 'experiment', title: '实验一：基础LED控制实验', refId: 'exp01', duration: 90 },
  ] },
  { id: '2.3.1', name: 'P0口结构与特性', level: 3, parentId: '2.3', chapter: 2, description: '开漏输出结构、需外接上拉电阻、可作地址/数据总线' },
  { id: '2.3.2', name: 'P1口结构与特性', level: 3, parentId: '2.3', chapter: 2, description: '准双向口结构、内部上拉电阻、通用I/O口', resources: [
    { type: 'image', title: '实验1 流水灯硬件原理图（P1→LED1-4）', url: '/resources/course/diagrams/lab1-flowing-led-schematic.svg' },
  ], appliedIn: ['exp01'] },
  { id: '2.3.3', name: 'P2口结构与特性', level: 3, parentId: '2.3', chapter: 2, description: '准双向口、可作高8位地址总线' },
  { id: '2.3.4', name: 'P3口结构与第二功能', level: 3, parentId: '2.3', chapter: 2, description: 'P3口的第二功能：RXD/TXD/INT0/INT1/T0/T1/WR/RD' },
  { id: '2.3.5', name: 'I/O口驱动能力与扩展', level: 3, parentId: '2.3', chapter: 2, description: '各端口灌电流/拉电流能力及74HC245/74HC573扩展' },

  { id: '2.4', name: '时钟与时序', level: 2, parentId: '2', chapter: 2, description: '时钟产生方式与机器周期、指令周期的概念', resources: [
    { type: 'slide', title: '2.4 时钟与时序 课件', refId: 'ch02-ppt-s4' },
    { type: 'animation', title: '机器周期与指令周期时序动画', refId: 'anim-timing-cycle' },
  ] },
  { id: '2.4.1', name: '时钟电路', level: 3, parentId: '2.4', chapter: 2, description: '内部振荡器与外部时钟信号两种方式' },
  { id: '2.4.2', name: '机器周期与指令周期', level: 3, parentId: '2.4', chapter: 2, description: '振荡周期、机器周期（12T）、指令周期的换算关系' },
  { id: '2.4.3', name: '时序分析方法', level: 3, parentId: '2.4', chapter: 2, description: '取指时序、读写时序的分析与应用' },

  { id: '2.5', name: '复位系统', level: 2, parentId: '2', chapter: 2, description: '单片机各种复位方式与复位电路设计', resources: [
    { type: 'slide', title: '2.5 复位系统 课件', refId: 'ch02-ppt-s5' },
    { type: 'animation', title: '上电复位与手动复位过程动画', refId: 'anim-reset-circuit' },
  ] },
  { id: '2.5.1', name: '上电复位电路', level: 3, parentId: '2.5', chapter: 2, description: 'RC上电复位电路的参数计算与设计' },
  { id: '2.5.2', name: '手动复位电路', level: 3, parentId: '2.5', chapter: 2, description: '按键手动复位电路设计与去抖动' },
  { id: '2.5.3', name: '看门狗复位', level: 3, parentId: '2.5', chapter: 2, description: 'WDT看门狗定时器的原理与喂狗操作' },
  { id: '2.5.4', name: '复位后的初始状态', level: 3, parentId: '2.5', chapter: 2, description: '复位后PC、SP、PSW及各SFR的初始值' },

  { id: '2.6', name: '总线结构', level: 2, parentId: '2', chapter: 2, description: '地址总线、数据总线与控制总线的组成与功能', resources: [
    { type: 'slide', title: '2.6 总线结构 课件', refId: 'ch02-ppt-s6' },
    { type: 'animation', title: '三总线数据传输动画', refId: 'anim-bus-transfer' },
  ] },
  { id: '2.6.1', name: '地址总线（AB）', level: 3, parentId: '2.6', chapter: 2, description: '16位地址总线的寻址范围与地址空间划分' },
  { id: '2.6.2', name: '数据总线（DB）', level: 3, parentId: '2.6', chapter: 2, description: '8位数据总线的数据传输方式与时序' },
  { id: '2.6.3', name: '控制总线（CB）', level: 3, parentId: '2.6', chapter: 2, description: 'ALE、PSEN、EA、RD、WR等控制信号的功能' },
  { id: '2.6.4', name: '总线时序分析', level: 3, parentId: '2.6', chapter: 2, description: '外部存储器读写总线时序的分析方法' },

  { id: '2.7', name: '低功耗工作方式', level: 2, parentId: '2', chapter: 2, description: '待机（空闲）与掉电两种低功耗模式、PCON电源控制寄存器与唤醒条件', resources: [
    { type: 'slide', title: '第2章 硬件结构 课件PPT', refId: 'ch02-ppt' },
  ] },

  // ========================================================================
  // 一级知识点3：指令系统（4学时）
  // ========================================================================
  { id: '3', name: '指令系统', level: 1, chapter: 3, description: '寻址方式、数据传送、算术逻辑运算、控制转移与位操作指令', graphNodeId: 'addressing_modes',
    tutor: {
      core: '8051 共 111 条指令，背后只有 7 种寻址方式（立即 / 直接 / 寄存器 / 寄存器间接 / 变址 / 相对 / 位寻址）。',
      whyImportant: '即便你只用 C 写代码，编译器最终也会把它翻成这些指令——理解它们才能调试关键时序、读懂反汇编。',
      commonMistake: '把"立即寻址"和"直接寻址"搞混。`MOV A, #30H` 是把数 0x30 给 A，`MOV A, 30H` 是把地址 30H 处的内容给 A。',
      takeaway: '写汇编先想"这一步是从哪取数、放到哪"——寻址方式就是这件事的语法。',
    },
    resources: [
    { type: 'slide', title: '第3章 指令系统 课件PPT', refId: 'ch03-ppt' },
    { type: 'quiz', title: '第3章 单元测验', refId: 'quiz-ch3' },
    { type: 'experiment', title: '实验二：指令系统实验', refId: 'exp02', duration: 90 },
  ] },

  { id: '3.1', name: '寻址方式', level: 2, parentId: '3', chapter: 3, description: '89C51支持的7种寻址方式', graphNodeId: 'addressing_modes', resources: [
    { type: 'slide', title: '3.1 寻址方式 课件', refId: 'ch03-ppt-s1' },
    { type: 'animation', title: '7种寻址方式对比动画', refId: 'anim-addressing-modes' },
    { type: 'quiz', title: '寻址方式 练习题', refId: 'quiz-ch3-addressing' },
    { type: 'experiment', title: '实验二：指令系统实验', refId: 'exp02', duration: 90 },
  ] },
  { id: '3.1.1', name: '立即寻址', level: 3, parentId: '3.1', chapter: 3, description: '操作数直接包含在指令中，以#开头表示' },
  { id: '3.1.2', name: '直接寻址', level: 3, parentId: '3.1', chapter: 3, description: '操作数的地址直接给出，可访问内部RAM和SFR' },
  { id: '3.1.3', name: '寄存器寻址', level: 3, parentId: '3.1', chapter: 3, description: '操作数在工作寄存器R0-R7或A、B、DPTR中' },
  { id: '3.1.4', name: '寄存器间接寻址', level: 3, parentId: '3.1', chapter: 3, description: '用@R0、@R1或@DPTR指向操作数地址' },
  { id: '3.1.5', name: '变址寻址', level: 3, parentId: '3.1', chapter: 3, description: '基址+变址方式（@A+DPTR或@A+PC）访问ROM表格' },
  { id: '3.1.6', name: '相对寻址', level: 3, parentId: '3.1', chapter: 3, description: '以PC当前值为基准加偏移量的转移方式' },
  { id: '3.1.7', name: '位寻址', level: 3, parentId: '3.1', chapter: 3, description: '对位地址空间中的单个位进行操作' },

  { id: '3.2', name: '数据传送指令', level: 2, parentId: '3', chapter: 3, description: 'MOV、MOVX、MOVC等数据传送指令组', resources: [
    { type: 'slide', title: '3.2 数据传送指令 课件', refId: 'ch03-ppt-s2' },
    { type: 'animation', title: 'MOV/MOVX/MOVC数据流向动画', refId: 'anim-mov-dataflow' },
    { type: 'experiment', title: '实验二：指令系统实验', refId: 'exp02', duration: 90 },
  ] },
  { id: '3.2.1', name: '内部RAM传送（MOV）', level: 3, parentId: '3.2', chapter: 3, description: 'MOV指令的各种操作数组合与使用方法' },
  { id: '3.2.2', name: '外部RAM传送（MOVX）', level: 3, parentId: '3.2', chapter: 3, description: 'MOVX指令访问外部数据存储器的方法' },
  { id: '3.2.3', name: '程序存储器传送（MOVC）', level: 3, parentId: '3.2', chapter: 3, description: 'MOVC查表指令读取ROM中的常数数据' },
  { id: '3.2.4', name: '堆栈操作（PUSH/POP）', level: 3, parentId: '3.2', chapter: 3, description: '堆栈指针SP与压栈/出栈操作' },
  { id: '3.2.5', name: '数据交换（XCH/XCHD/SWAP）', level: 3, parentId: '3.2', chapter: 3, description: '字节交换、半字节交换与累加器高低半字节交换' },

  { id: '3.3', name: '算术运算指令', level: 2, parentId: '3', chapter: 3, description: '加减乘除与十进制调整指令', resources: [
    { type: 'slide', title: '3.3 算术运算指令 课件', refId: 'ch03-ppt-s3' },
    { type: 'animation', title: 'ADD/SUBB运算与标志位变化动画', refId: 'anim-arithmetic-flags' },
  ] },
  { id: '3.3.1', name: '加法指令（ADD/ADDC）', level: 3, parentId: '3.3', chapter: 3, description: '不带进位加法ADD和带进位加法ADDC的使用' },
  { id: '3.3.2', name: '减法指令（SUBB）', level: 3, parentId: '3.3', chapter: 3, description: '带借位减法指令及多字节减法实现' },
  { id: '3.3.3', name: '乘法指令（MUL）', level: 3, parentId: '3.3', chapter: 3, description: 'MUL AB指令实现8位无符号数乘法' },
  { id: '3.3.4', name: '除法指令（DIV）', level: 3, parentId: '3.3', chapter: 3, description: 'DIV AB指令实现8位无符号数除法' },
  { id: '3.3.5', name: '十进制调整（DA）', level: 3, parentId: '3.3', chapter: 3, description: 'BCD码加法的十进制调整方法' },
  { id: '3.3.6', name: '增1减1指令（INC/DEC）', level: 3, parentId: '3.3', chapter: 3, description: 'INC和DEC指令对寄存器和存储单元的操作' },

  { id: '3.4', name: '逻辑运算指令', level: 2, parentId: '3', chapter: 3, description: '与或非异或、移位与清零指令', resources: [
    { type: 'slide', title: '3.4 逻辑运算指令 课件', refId: 'ch03-ppt-s4' },
    { type: 'animation', title: '逻辑运算与移位操作动画', refId: 'anim-logic-shift' },
  ] },
  { id: '3.4.1', name: '与运算（ANL）', level: 3, parentId: '3.4', chapter: 3, description: '逻辑与运算在屏蔽位和条件判断中的应用' },
  { id: '3.4.2', name: '或运算（ORL）', level: 3, parentId: '3.4', chapter: 3, description: '逻辑或运算在置位和数据合并中的应用' },
  { id: '3.4.3', name: '异或运算（XRL）', level: 3, parentId: '3.4', chapter: 3, description: '逻辑异或运算在取反和比较中的应用' },
  { id: '3.4.4', name: '取反指令（CPL）', level: 3, parentId: '3.4', chapter: 3, description: '累加器A按位取反操作' },
  { id: '3.4.5', name: '移位指令（RL/RLC/RR/RRC）', level: 3, parentId: '3.4', chapter: 3, description: '左移、右移、带进位循环移位操作' },
  { id: '3.4.6', name: '清零指令（CLR）', level: 3, parentId: '3.4', chapter: 3, description: '累加器清零与位清零操作' },

  { id: '3.5', name: '控制转移指令', level: 2, parentId: '3', chapter: 3, description: '无条件转移、条件转移、子程序调用与返回', resources: [
    { type: 'slide', title: '3.5 控制转移指令 课件', refId: 'ch03-ppt-s5' },
    { type: 'animation', title: '跳转与子程序调用堆栈动画', refId: 'anim-jump-stack' },
  ] },
  { id: '3.5.1', name: '无条件转移（LJMP/AJMP/SJMP）', level: 3, parentId: '3.5', chapter: 3, description: '长转移、绝对转移、短转移的区别与适用范围' },
  { id: '3.5.2', name: '条件转移（JZ/JNZ/CJNE/DJNZ）', level: 3, parentId: '3.5', chapter: 3, description: '零判断、比较不等转移、减1不为零转移' },
  { id: '3.5.3', name: '子程序调用（LCALL/ACALL）', level: 3, parentId: '3.5', chapter: 3, description: '长调用和绝对调用的堆栈操作与返回地址保存' },
  { id: '3.5.4', name: '返回指令（RET/RETI）', level: 3, parentId: '3.5', chapter: 3, description: '子程序返回RET和中断返回RETI的区别' },
  { id: '3.5.5', name: '空操作（NOP）', level: 3, parentId: '3.5', chapter: 3, description: 'NOP指令在延时和程序对齐中的使用' },

  { id: '3.6', name: '位操作指令', level: 2, parentId: '3', chapter: 3, description: '对位地址空间的传送、逻辑与控制转移操作', resources: [
    { type: 'slide', title: '3.6 位操作指令 课件', refId: 'ch03-ppt-s6' },
    { type: 'animation', title: '位寻址区与位操作动画', refId: 'anim-bit-operations' },
  ] },
  { id: '3.6.1', name: '位传送（MOV C,bit）', level: 3, parentId: '3.6', chapter: 3, description: '进位标志C与可位寻址位之间的数据传送' },
  { id: '3.6.2', name: '位逻辑（ANL/ORL/CPL）', level: 3, parentId: '3.6', chapter: 3, description: '位与、位或、位取反操作' },
  { id: '3.6.3', name: '位条件转移（JC/JNC/JB/JNB/JBC）', level: 3, parentId: '3.6', chapter: 3, description: '根据位状态进行条件转移的各类指令' },
  { id: '3.6.4', name: '位置位/复位（SETB/CLR）', level: 3, parentId: '3.6', chapter: 3, description: '位置1和位清0操作及其在I/O控制中的应用' },

  // ========================================================================
  // 一级知识点4：C语言编程（6学时）
  // ========================================================================
  { id: '4', name: 'C语言编程', level: 1, chapter: 4, description: 'Keil C51开发环境、数据类型、控制结构与编程规范',
    tutor: {
      core: 'Keil C51 在标准 C 之上扩了 sfr / sbit / data / xdata 等关键字，让你直接读写 8051 的寄存器和外部存储器。',
      whyImportant: '工程上几乎都用 C 写 8051——这一章决定你能不能把一段 C 代码翻译成对硬件的精确控制。',
      commonMistake: '在 C51 里随便用 int / float。单片机 RAM 只有 128 字节，能用 `unsigned char` 就别用 `int`，能用 `bit` 就别用 `unsigned char`。',
      takeaway: '写 8051 C，第一个问题永远是"这个变量该放在 data / idata / xdata 里？"',
    },
    resources: [
    { type: 'slide', title: '第4章 C语言编程 课件PPT', refId: 'ch04-ppt' },
    { type: 'quiz', title: '第4章 单元测验', refId: 'quiz-ch4' },
    { type: 'experiment', title: '实验一：基础LED控制实验', refId: 'exp01', duration: 90 },
    { type: 'document', title: 'Keil C51编程快速参考手册', refId: 'doc-c51-reference' },
  ], prerequisites: ['1.5', '2.2', '3'], appliedIn: ['exp01', 'exp02'],
    prerequisiteReasons: {
      '1.5': 'Keil C51 就是1.5介绍的开发工具本身，写C前必须先会用它建工程、编译、下载',
      '2.2': 'C51 的 sfr/sbit/data/xdata 等关键字直接对应2.2的存储器分区（SFR、内部RAM等），不懂存储器组织就不知道变量该声明成什么存储类型',
      '3': 'C51 代码最终由编译器翻译成第3章的指令；理解寻址方式和指令语义才能读懂C语句对硬件的真实操作',
    } },

  { id: '4.1', name: 'Keil C51开发环境', level: 2, parentId: '4', chapter: 4, description: '工程管理、编译调试与程序下载', resources: [
    { type: 'slide', title: '4.1 Keil C51开发环境 课件', refId: 'ch04-ppt-s1' },
    { type: 'document', title: 'Keil uVision安装与工程创建教程', refId: 'doc-keil-tutorial' },
  ] },
  { id: '4.1.1', name: '工程创建与配置', level: 3, parentId: '4.1', chapter: 4, description: '新建工程、选择芯片型号、添加源文件与配置选项' },
  { id: '4.1.2', name: '编译、链接与调试', level: 3, parentId: '4.1', chapter: 4, description: '编译错误排查、断点调试、变量观察与单步执行' },
  { id: '4.1.3', name: '在线仿真与下载', level: 3, parentId: '4.1', chapter: 4, description: 'Keil与Proteus联调、HEX文件生成与烧录' },

  { id: '4.2', name: 'C51数据类型', level: 2, parentId: '4', chapter: 4, description: 'C51特有的数据类型与存储类型', resources: [
    { type: 'slide', title: '4.2 C51数据类型 课件', refId: 'ch04-ppt-s2' },
    { type: 'quiz', title: 'C51数据类型 练习题', refId: 'quiz-ch4-datatypes' },
  ] },
  { id: '4.2.1', name: '基本数据类型', level: 3, parentId: '4.2', chapter: 4, description: 'bit、sbit、sfr、sfr16等C51特有类型的定义与使用' },
  { id: '4.2.2', name: '存储类型关键字', level: 3, parentId: '4.2', chapter: 4, description: 'data、idata、xdata、code、pdata存储区域修饰符' },
  { id: '4.2.3', name: '指针与数组', level: 3, parentId: '4.2', chapter: 4, description: 'C51中通用指针和存储器特定指针的区别与使用' },
  { id: '4.2.4', name: '结构体与联合体', level: 3, parentId: '4.2', chapter: 4, description: 'struct和union在寄存器映射和数据封装中的应用' },

  { id: '4.3', name: 'C51控制结构', level: 2, parentId: '4', chapter: 4, description: 'C51程序的基本控制流程', resources: [
    { type: 'slide', title: '4.3 C51控制结构 课件', refId: 'ch04-ppt-s3' },
    { type: 'quiz', title: 'C51控制结构 练习题', refId: 'quiz-ch4-control' },
  ] },
  { id: '4.3.1', name: '顺序结构', level: 3, parentId: '4.3', chapter: 4, description: '赋值语句、表达式求值与顺序执行流程' },
  { id: '4.3.2', name: '选择结构（if/switch）', level: 3, parentId: '4.3', chapter: 4, description: 'if-else条件判断和switch-case多分支选择' },
  { id: '4.3.3', name: '循环结构（for/while/do-while）', level: 3, parentId: '4.3', chapter: 4, description: '三种循环语句在延时、轮询中的应用' },
  { id: '4.3.4', name: '函数定义与调用', level: 3, parentId: '4.3', chapter: 4, description: '函数声明、参数传递、返回值与递归调用' },

  { id: '4.4', name: 'C51特殊功能', level: 2, parentId: '4', chapter: 4, description: 'C51特有的编程特性与技巧', resources: [
    { type: 'slide', title: '4.4 C51特殊功能 课件', refId: 'ch04-ppt-s4' },
    { type: 'quiz', title: 'C51特殊功能 练习题', refId: 'quiz-ch4-special' },
  ] },
  { id: '4.4.1', name: '中断服务函数编写', level: 3, parentId: '4.4', chapter: 4, description: 'interrupt关键字、中断号指定与using关键字' },
  { id: '4.4.2', name: 'SFR访问方法', level: 3, parentId: '4.4', chapter: 4, description: '通过sfr关键字和头文件访问特殊功能寄存器' },
  { id: '4.4.3', name: '位操作编程', level: 3, parentId: '4.4', chapter: 4, description: '使用sbit定义位变量、位运算符的使用技巧' },
  { id: '4.4.4', name: '内联汇编', level: 3, parentId: '4.4', chapter: 4, description: '#pragma asm/endasm在C51中嵌入汇编代码' },
  { id: '4.4.5', name: '可重入函数', level: 3, parentId: '4.4', chapter: 4, description: 'reentrant关键字与中断中调用函数的注意事项' },

  { id: '4.5', name: '常用库函数', level: 2, parentId: '4', chapter: 4, description: 'C51标准库和自定义工具函数', resources: [
    { type: 'slide', title: '4.5 常用库函数 课件', refId: 'ch04-ppt-s5' },
    { type: 'document', title: 'C51常用库函数速查表', refId: 'doc-c51-stdlib' },
  ] },
  { id: '4.5.1', name: '延时函数设计', level: 3, parentId: '4.5', chapter: 4, description: '软件延时函数的设计与精确延时的计算方法' },
  { id: '4.5.2', name: '数学运算库', level: 3, parentId: '4.5', chapter: 4, description: 'math.h中常用数学函数在嵌入式中的使用' },
  { id: '4.5.3', name: '字符串处理', level: 3, parentId: '4.5', chapter: 4, description: 'string.h字符串函数与LCD显示字符处理' },

  { id: '4.6', name: '编程规范', level: 2, parentId: '4', chapter: 4, description: '嵌入式C语言编程的最佳实践', resources: [
    { type: 'slide', title: '4.6 编程规范 课件', refId: 'ch04-ppt-s6' },
    { type: 'document', title: '嵌入式C编程规范指南', refId: 'doc-coding-standards' },
  ] },
  { id: '4.6.1', name: '命名规范', level: 3, parentId: '4.6', chapter: 4, description: '变量、函数、宏定义的命名规则与风格统一' },
  { id: '4.6.2', name: '注释规范', level: 3, parentId: '4.6', chapter: 4, description: '文件头注释、函数注释与关键代码行内注释' },
  { id: '4.6.3', name: '模块化编程', level: 3, parentId: '4.6', chapter: 4, description: '头文件与源文件分离、模块接口设计' },
  { id: '4.6.4', name: '代码优化技巧', level: 3, parentId: '4.6', chapter: 4, description: '减少ROM/RAM占用、提升执行效率的编程方法' },

  // ========================================================================
  // 一级知识点5：中断系统（4学时）
  // ========================================================================
  { id: '5', name: '中断系统', level: 1, chapter: 5, description: '中断概念、89C51中断源、外部中断、中断嵌套与应用', graphNodeId: 'interrupts',
    tutor: {
      core: '中断 = 让 CPU 在跑主程序的同时，对外部 / 内部事件即时响应；8051 共 5 个中断源（INT0 / T0 / INT1 / T1 / 串口），可设两级优先级。',
      whyImportant: '没有中断，所有事件都得靠 CPU 不停轮询；学会中断，才能写出真正"事件驱动"的嵌入式程序。',
      commonMistake: '在中断服务程序里写很长的代码 / 调用阻塞函数。ISR 应当"短而快"——把长任务做成标志位，回到主循环再处理。',
      takeaway: '中断 = "硬件举手 → CPU 立即接管 → 处理完回到原处"。',
    },
    resources: [
    { type: 'slide', title: '第5章 中断系统 课件PPT', refId: 'ch05-ppt' },
    { type: 'quiz', title: '第5章 单元测验', refId: 'quiz-ch5' },
    { type: 'experiment', title: '实验五：按键输入与消抖处理', refId: 'exp05', duration: 90 },
    { type: 'experiment', title: '实验六：定时器中断与计时功能', refId: 'exp06', duration: 120 },
  ], prerequisites: ['2.2.3', '2.5'], appliedIn: ['exp05', 'exp06'],
    prerequisiteReasons: {
      '2.2.3': '中断相关的 IE、IP、TCON、SCON 等控制位全部落在特殊功能寄存器里，配中断本质是拨这些 SFR 的位',
      '2.5': '复位会把 IE/IP 等中断相关 SFR 恢复到初始值（默认关闭中断），理解复位后的状态才知道为何进入 main 后要显式开中断',
    } },

  { id: '5.1', name: '中断基本概念', level: 2, parentId: '5', chapter: 5, description: '中断的定义、分类与优先级机制', graphNodeId: 'interrupts', resources: [
    { type: 'slide', title: '5.1 中断基本概念 课件', refId: 'ch05-ppt-s1' },
    { type: 'animation', title: '中断处理流程动画演示', refId: 'anim-interrupt-flow' },
    { type: 'quiz', title: '中断基本概念 练习题', refId: 'quiz-ch5-basics' },
  ] },
  { id: '5.1.1', name: '中断的定义与作用', level: 3, parentId: '5.1', chapter: 5, description: '中断的含义、与轮询方式的比较及其优势' },
  { id: '5.1.2', name: '中断源分类', level: 3, parentId: '5.1', chapter: 5, description: '内部中断与外部中断、可屏蔽与不可屏蔽中断' },
  { id: '5.1.3', name: '中断优先级', level: 3, parentId: '5.1', chapter: 5, description: '中断优先级的概念与查询次序（自然优先级）' },

  { id: '5.2', name: '89C51中断系统', level: 2, parentId: '5', chapter: 5, description: '89C51的5个中断源与相关控制寄存器', resources: [
    { type: 'slide', title: '5.2 89C51中断系统 课件', refId: 'ch05-ppt-s2' },
    { type: 'animation', title: 'IE/IP寄存器位功能交互动画', refId: 'anim-ie-ip-register' },
    { type: 'quiz', title: '89C51中断系统 练习题', refId: 'quiz-ch5-system' },
  ] },
  { id: '5.2.1', name: '5个中断源', level: 3, parentId: '5.2', chapter: 5, description: 'INT0、INT1、T0、T1、串口中断的触发条件' },
  { id: '5.2.2', name: '中断允许寄存器（IE）', level: 3, parentId: '5.2', chapter: 5, description: 'EA总允许位与各中断源使能位的设置方法' },
  { id: '5.2.3', name: '中断优先级寄存器（IP）', level: 3, parentId: '5.2', chapter: 5, description: 'IP寄存器各位的功能与两级优先级设置' },
  { id: '5.2.4', name: '中断向量表', level: 3, parentId: '5.2', chapter: 5, description: '各中断源对应的入口地址（0003H-0023H）' },

  { id: '5.3', name: '外部中断', level: 2, parentId: '5', chapter: 5, description: 'INT0和INT1外部中断的配置与应用', resources: [
    { type: 'slide', title: '5.3 外部中断 课件', refId: 'ch05-ppt-s3' },
    { type: 'experiment', title: '实验五：按键输入与消抖处理', refId: 'exp05', duration: 90 },
    { type: 'animation', title: '电平触发与边沿触发对比动画', refId: 'anim-trigger-modes' },
  ] },
  { id: '5.3.1', name: '电平触发方式', level: 3, parentId: '5.3', chapter: 5, description: '低电平触发外部中断的特点与注意事项' },
  { id: '5.3.2', name: '边沿触发方式', level: 3, parentId: '5.3', chapter: 5, description: '下降沿触发外部中断的设置与响应过程' },
  { id: '5.3.3', name: '外部中断应用（按键中断）', level: 3, parentId: '5.3', chapter: 5, description: '外部中断实现按键检测的电路与程序设计' },

  { id: '5.4', name: '中断处理流程', level: 2, parentId: '5', chapter: 5, description: '从中断请求到中断返回的完整处理流程', resources: [
    { type: 'slide', title: '5.4 中断处理流程 课件', refId: 'ch05-ppt-s4' },
    { type: 'animation', title: '中断响应全过程时序动画', refId: 'anim-interrupt-response' },
  ] },
  { id: '5.4.1', name: '中断请求', level: 3, parentId: '5.4', chapter: 5, description: '中断标志位的置位与中断请求信号的产生' },
  { id: '5.4.2', name: '中断响应条件', level: 3, parentId: '5.4', chapter: 5, description: '中断被CPU响应需满足的三个条件' },
  { id: '5.4.3', name: '中断服务程序', level: 3, parentId: '5.4', chapter: 5, description: '现场保护、中断处理与现场恢复的编写方法' },
  { id: '5.4.4', name: '中断返回', level: 3, parentId: '5.4', chapter: 5, description: 'RETI指令执行的操作与断点恢复' },
  { id: '5.4.5', name: '中断响应时间', level: 3, parentId: '5.4', chapter: 5, description: '中断响应的最短和最长时间计算与分析' },

  { id: '5.5', name: '中断嵌套', level: 2, parentId: '5', chapter: 5, description: '多级中断优先级与中断嵌套机制', resources: [
    { type: 'slide', title: '5.5 中断嵌套 课件', refId: 'ch05-ppt-s5' },
    { type: 'animation', title: '中断嵌套与优先级切换动画', refId: 'anim-interrupt-nesting' },
  ] },
  { id: '5.5.1', name: '两级优先级机制', level: 3, parentId: '5.5', chapter: 5, description: '高优先级中断可打断低优先级中断的执行' },
  { id: '5.5.2', name: '中断嵌套编程', level: 3, parentId: '5.5', chapter: 5, description: '中断嵌套程序的编写方法与堆栈管理' },
  { id: '5.5.3', name: '中断优先级应用', level: 3, parentId: '5.5', chapter: 5, description: '合理分配中断优先级以满足实时性要求' },

  { id: '5.6', name: '中断应用', level: 2, parentId: '5', chapter: 5, description: '中断在实际项目中的综合应用', resources: [
    { type: 'slide', title: '5.6 中断应用 课件', refId: 'ch05-ppt-s6' },
    { type: 'experiment', title: '实验六：定时器中断与计时功能', refId: 'exp06', duration: 120 },
    { type: 'quiz', title: '中断应用 综合练习', refId: 'quiz-ch5-application' },
  ] },
  { id: '5.6.1', name: '按键检测', level: 3, parentId: '5.6', chapter: 5, description: '利用外部中断实现按键事件的实时响应' },
  { id: '5.6.2', name: '定时中断应用', level: 3, parentId: '5.6', chapter: 5, description: '定时器中断实现精确定时与周期性任务' },
  { id: '5.6.3', name: '串口中断收发', level: 3, parentId: '5.6', chapter: 5, description: '串口中断方式收发数据的程序框架' },
  { id: '5.6.4', name: '多中断源处理', level: 3, parentId: '5.6', chapter: 5, description: '多个中断源同时使用时的协调与冲突处理' },

  // ========================================================================
  // 一级知识点6：定时器/计数器（4学时）
  // ========================================================================
  { id: '6', name: '定时器/计数器', level: 1, chapter: 6, description: '定时器/计数器的原理、工作模式与应用', graphNodeId: 'timers',
    tutor: {
      core: '8051 有 2 个 16 位定时器/计数器（T0 / T1）能在 CPU 跑别的事时独立计数；4 种工作模式决定它的位宽和触发方式。',
      whyImportant: '几乎所有"周期性事件"——LED 闪烁、PWM、串口波特率、按键消抖——背后都是定时器。',
      commonMistake: '把"定时模式"和"计数模式"分不清。定时模式数的是机器周期（内部时钟），计数模式数的是 T0 / T1 引脚的外部脉冲。',
      takeaway: '想精确周期 → 选定时器；想数外部事件 → 选计数器。',
    },
    resources: [
    { type: 'slide', title: '第6章 定时器/计数器 课件PPT', refId: 'ch06-ppt' },
    { type: 'quiz', title: '第6章 单元测验', refId: 'quiz-ch6' },
    { type: 'experiment', title: '实验三：定时/计数器实验', refId: 'exp03', duration: 90 },
    { type: 'experiment', title: '实验六：定时器中断与计时功能', refId: 'exp06', duration: 120 },
  ], prerequisites: ['5', '2.2.3'], appliedIn: ['exp03', 'exp06', 'exp07'],
    prerequisiteReasons: {
      '5': '定时器溢出（TF0/TF1置位）最常见的处理方式就是触发中断，不懂中断的请求/响应流程就理解不了定时器中断的工作方式',
      '2.2.3': 'TMOD、TCON、TH0/TL0、TH1/TL1 都是特殊功能寄存器，配置定时器就是拨这些 SFR 的位与装初值',
    } },

  { id: '6.1', name: '定时器基础', level: 2, parentId: '6', chapter: 6, description: '定时器/计数器的工作原理与控制寄存器', graphNodeId: 'timers', resources: [
    { type: 'slide', title: '6.1 定时器基础 课件', refId: 'ch06-ppt-s1' },
    { type: 'animation', title: 'TMOD/TCON寄存器位功能动画', refId: 'anim-tmod-tcon' },
    { type: 'quiz', title: '定时器基础 练习题', refId: 'quiz-ch6-basics' },
  ] },
  { id: '6.1.1', name: '定时器/计数器原理', level: 3, parentId: '6.1', chapter: 6, description: '加1计数器的工作原理、定时与计数的区别' },
  { id: '6.1.2', name: 'TMOD寄存器', level: 3, parentId: '6.1', chapter: 6, description: '定时器模式寄存器各位功能：GATE、C/T、M1M0' },
  { id: '6.1.3', name: 'TCON寄存器', level: 3, parentId: '6.1', chapter: 6, description: '定时器控制寄存器：TR0/TR1启动、TF0/TF1溢出标志' },
  { id: '6.1.4', name: '定时器初值计算', level: 3, parentId: '6.1', chapter: 6, description: '根据定时时间和晶振频率计算TH和TL的初值' },

  { id: '6.2', name: '工作模式', level: 2, parentId: '6', chapter: 6, description: 'T0/T1的四种工作模式', resources: [
    { type: 'slide', title: '6.2 工作模式 课件', refId: 'ch06-ppt-s2' },
    { type: 'animation', title: '定时器四种工作模式对比动画', refId: 'anim-timer-modes' },
    { type: 'experiment', title: '实验三：定时/计数器实验', refId: 'exp03', duration: 90 },
  ] },
  { id: '6.2.1', name: '模式0（13位定时器）', level: 3, parentId: '6.2', chapter: 6, description: '13位计数器的结构与最大定时范围' },
  { id: '6.2.2', name: '模式1（16位定时器）', level: 3, parentId: '6.2', chapter: 6, description: '16位计数器的结构与编程方法' },
  { id: '6.2.3', name: '模式2（8位自动重装）', level: 3, parentId: '6.2', chapter: 6, description: '8位自动重装模式的特点与波特率发生应用' },
  { id: '6.2.4', name: '模式3（分割模式）', level: 3, parentId: '6.2', chapter: 6, description: 'T0分成两个独立8位计数器的工作方式' },

  { id: '6.3', name: '定时器应用', level: 2, parentId: '6', chapter: 6, description: '定时器在精确延时和信号生成中的应用', resources: [
    { type: 'slide', title: '6.3 定时器应用 课件', refId: 'ch06-ppt-s3' },
    { type: 'experiment', title: '实验六：定时器中断与计时功能', refId: 'exp06', duration: 120 },
    { type: 'experiment', title: '实验七：蜂鸣器音频控制', refId: 'exp07', duration: 90 },
    { type: 'quiz', title: '定时器应用 练习题', refId: 'quiz-ch6-application' },
  ] },
  { id: '6.3.1', name: '精确延时', level: 3, parentId: '6.3', chapter: 6, description: '使用定时器实现毫秒级和微秒级精确延时' },
  { id: '6.3.2', name: '方波产生', level: 3, parentId: '6.3', chapter: 6, description: '定时器中断翻转I/O口产生指定频率方波' },
  { id: '6.3.3', name: 'PWM信号生成', level: 3, parentId: '6.3', chapter: 6, description: '软件模拟PWM控制LED亮度和电机速度' },
  { id: '6.3.4', name: '频率测量', level: 3, parentId: '6.3', chapter: 6, description: '利用定时器和计数器测量外部信号频率' },
  { id: '6.3.5', name: '长定时实现', level: 3, parentId: '6.3', chapter: 6, description: '通过软件计数器扩展定时范围实现秒级定时' },

  { id: '6.4', name: '计数器应用', level: 2, parentId: '6', chapter: 6, description: '外部事件计数功能的应用', resources: [
    { type: 'slide', title: '6.4 计数器应用 课件', refId: 'ch06-ppt-s4' },
    { type: 'animation', title: '外部脉冲计数与门控模式动画', refId: 'anim-counter-gate' },
  ] },
  { id: '6.4.1', name: '外部脉冲计数', level: 3, parentId: '6.4', chapter: 6, description: '对外部T0/T1引脚输入脉冲进行计数' },
  { id: '6.4.2', name: '转速测量', level: 3, parentId: '6.4', chapter: 6, description: '利用计数器和定时器配合测量电机转速' },
  { id: '6.4.3', name: '事件计数与显示', level: 3, parentId: '6.4', chapter: 6, description: '计数结果在数码管或LCD上实时显示' },
  { id: '6.4.4', name: '门控计数', level: 3, parentId: '6.4', chapter: 6, description: 'GATE位控制的门控计数模式与脉宽测量应用' },

  // ========================================================================
  // 一级知识点7：串行通信（4学时）
  // ========================================================================
  { id: '7', name: '串行通信', level: 1, chapter: 7, description: '通信基础知识、89C51串口与常用通信协议', graphNodeId: 'uart',
    tutor: {
      core: '8051 串口能在 4 种模式下收发 8 / 9 位数据；最常用的模式 1 是 8 位 UART，波特率由 T1 溢出率决定。',
      whyImportant: '单片机和 PC、和别的板子、和上位机几乎都靠串口对话——这一节是"嵌入式系统对外说话"的入口。',
      commonMistake: '设波特率时没算清楚。T1 模式 2、SMOD 位、晶振频率三件事任一项错，都会乱码。',
      takeaway: '想让两块板子通信 → 先把波特率、数据位、停止位、奇偶校验四件事统一。',
    },
    resources: [
    { type: 'slide', title: '第7章 串行通信 课件PPT', refId: 'ch07-ppt' },
    { type: 'quiz', title: '第7章 单元测验', refId: 'quiz-ch7' },
    { type: 'experiment', title: '实验九：串口通信实验', refId: 'exp09', duration: 90 },
  ], prerequisites: ['5', '6'], appliedIn: ['exp09'] ,
    prerequisiteReasons: {
      '5': '串口收发既可查询 TI/RI 标志也可用中断方式处理（IE 中的 ES 位），中断方式收发要求先懂中断的请求/服务流程',
      '6': '串口最常用的波特率由定时器 T1 工作在模式2（自动重装）的溢出率决定，不懂定时器就算不出、也调不对波特率',
    } },

  { id: '7.1', name: '通信基础', level: 2, parentId: '7', chapter: 7, description: '串行通信的基本概念与分类', resources: [
    { type: 'slide', title: '7.1 通信基础 课件', refId: 'ch07-ppt-s1' },
    { type: 'animation', title: '串行与并行通信对比动画', refId: 'anim-serial-parallel' },
  ] },
  { id: '7.1.1', name: '串行通信与并行通信', level: 3, parentId: '7.1', chapter: 7, description: '串行和并行数据传输方式的特点与比较' },
  { id: '7.1.2', name: '同步通信与异步通信', level: 3, parentId: '7.1', chapter: 7, description: '同步传输和异步传输的帧格式与时钟要求' },
  { id: '7.1.3', name: '波特率概念', level: 3, parentId: '7.1', chapter: 7, description: '波特率的定义、常用波特率值与误差分析' },
  { id: '7.1.4', name: '通信协议基础', level: 3, parentId: '7.1', chapter: 7, description: '数据帧格式、起始位、数据位、校验位和停止位' },
  { id: '7.1.5', name: '通信方向与模式', level: 3, parentId: '7.1', chapter: 7, description: '单工、半双工和全双工通信模式的区别' },

  { id: '7.2', name: '89C51串口', level: 2, parentId: '7', chapter: 7, description: '89C51内置UART串口的寄存器与工作模式', graphNodeId: 'uart', resources: [
    { type: 'slide', title: '7.2 89C51串口 课件', refId: 'ch07-ppt-s2' },
    { type: 'animation', title: 'SCON/SBUF寄存器与串口时序动画', refId: 'anim-uart-timing' },
    { type: 'quiz', title: '89C51串口 练习题', refId: 'quiz-ch7-uart' },
  ] },
  { id: '7.2.1', name: 'SCON寄存器', level: 3, parentId: '7.2', chapter: 7, description: '串口控制寄存器各位功能：SM0/SM1/REN/TI/RI' },
  { id: '7.2.2', name: 'SBUF寄存器', level: 3, parentId: '7.2', chapter: 7, description: '串口数据缓冲区的发送和接收双缓冲机制' },
  { id: '7.2.3', name: '波特率设置（T1产生）', level: 3, parentId: '7.2', chapter: 7, description: '利用定时器T1模式2产生标准波特率的计算' },
  { id: '7.2.4', name: '串口工作模式', level: 3, parentId: '7.2', chapter: 7, description: '模式0同步移位、模式1/3异步通信、模式2固定波特率' },

  { id: '7.3', name: 'UART编程', level: 2, parentId: '7', chapter: 7, description: '串口通信的软件实现方法', resources: [
    { type: 'slide', title: '7.3 UART编程 课件', refId: 'ch07-ppt-s3' },
    { type: 'experiment', title: '实验九：串口通信实验', refId: 'exp09', duration: 90 },
    { type: 'quiz', title: 'UART编程 练习题', refId: 'quiz-ch7-programming' },
  ] },
  { id: '7.3.1', name: '串口初始化', level: 3, parentId: '7.3', chapter: 7, description: '配置SCON、TMOD、TH1/TL1和中断允许寄存器' },
  { id: '7.3.2', name: '发送数据', level: 3, parentId: '7.3', chapter: 7, description: '查询方式发送：写SBUF、等待TI、清TI标志' },
  { id: '7.3.3', name: '接收数据', level: 3, parentId: '7.3', chapter: 7, description: '查询方式接收：等待RI、读SBUF、清RI标志' },
  { id: '7.3.4', name: '中断方式收发', level: 3, parentId: '7.3', chapter: 7, description: '串口中断服务函数中判断TI/RI实现收发' },

  { id: '7.4', name: '通信协议', level: 2, parentId: '7', chapter: 7, description: '常用的有线和总线通信标准', resources: [
    { type: 'slide', title: '7.4 通信协议 课件', refId: 'ch07-ppt-s4' },
    { type: 'animation', title: 'RS-232/RS-485/SPI/I2C协议对比动画', refId: 'anim-comm-protocols' },
    { type: 'document', title: '常用通信协议对比手册', refId: 'doc-comm-protocols' },
  ] },
  { id: '7.4.1', name: 'RS-232标准', level: 3, parentId: '7.4', chapter: 7, description: 'RS-232电平标准、MAX232电平转换芯片' },
  { id: '7.4.2', name: 'RS-485标准', level: 3, parentId: '7.4', chapter: 7, description: 'RS-485差分信号、多机通信与总线拓扑' },
  { id: '7.4.3', name: 'SPI协议', level: 3, parentId: '7.4', chapter: 7, description: 'SPI四线制（MOSI/MISO/SCK/CS）主从通信' },
  { id: '7.4.4', name: 'I2C协议', level: 3, parentId: '7.4', chapter: 7, description: 'I2C两线制（SDA/SCL）总线协议与地址机制' },

  // ========================================================================
  // 一级知识点8：接口技术（4学时）
  // ========================================================================
  { id: '8', name: '接口技术', level: 1, chapter: 8, description: '显示、键盘、AD/DA、传感器与电机驱动接口', graphNodeId: 'io',
    tutor: {
      core: '8051 通过 I/O 口连各种外部器件——LED、按键、LCD、AD/DA、电机驱动——本质都是"读 / 写一个引脚的高低"。',
      whyImportant: '本课程几乎所有实验最终都落在这一层——把抽象的"显示数字"翻译成具体的"P1.0 给高电平、P1.1 给低电平…"。',
      commonMistake: '直接用 I/O 口拉负载。8051 的 P1 / P2 / P3 灌电流能力大约 10mA，驱动电机 / 大电流负载必须加三极管或专用驱动 IC。',
      takeaway: '接接口前先问三件事：电平能否匹配 / 电流够不够 / 时序对不对。',
    },
    resources: [
    { type: 'slide', title: '第8章 接口技术 课件PPT', refId: 'ch08-ppt' },
    { type: 'quiz', title: '第8章 单元测验', refId: 'quiz-ch8' },
    { type: 'experiment', title: '实验四：数码管显示实验', refId: 'exp04', duration: 90 },
    { type: 'experiment', title: '实验八：步进电机控制实验', refId: 'exp08', duration: 120 },
  ], prerequisites: ['2.3', '4'], appliedIn: ['exp01', 'exp04', 'exp05', 'exp07', 'exp08'],
    prerequisiteReasons: {
      '2.3': '所有外接器件（LED、数码管、按键、电机驱动）都挂在 P0-P3 的 I/O 口上，接口本质是对 2.3 中某个端口的读写',
      '4': '接口驱动代码用 C51 编写，需要先会用 sfr/sbit 访问端口寄存器、用循环控制结构组织扫描/延时逻辑',
    } },

  { id: '8.1', name: '显示接口', level: 2, parentId: '8', chapter: 8, description: 'LED数码管和LCD液晶显示器的驱动方法', resources: [
    { type: 'slide', title: '8.1 显示接口 课件', refId: 'ch08-ppt-s1' },
    { type: 'experiment', title: '实验四：数码管显示实验', refId: 'exp04', duration: 90 },
    { type: 'animation', title: '数码管动态扫描显示原理动画', refId: 'anim-7seg-scan' },
    { type: 'image', title: '实验1 流水灯程序流程图', url: '/resources/course/diagrams/lab1-flowing-led-flowchart.svg' },
  ] },
  { id: '8.1.1', name: 'LED数码管（共阴/共阳）', level: 3, parentId: '8.1', chapter: 8, description: '七段数码管的结构、段码表与驱动电路', appliedIn: ['exp04'] },
  { id: '8.1.2', name: '动态显示与静态显示', level: 3, parentId: '8.1', chapter: 8, description: '静态锁存显示和动态扫描显示的原理与比较' },
  { id: '8.1.3', name: 'LCD1602驱动', level: 3, parentId: '8.1', chapter: 8, description: 'LCD1602字符液晶的接口连接与指令集编程' },
  { id: '8.1.4', name: 'LCD12864驱动', level: 3, parentId: '8.1', chapter: 8, description: 'LCD12864图形液晶的初始化与图文显示编程' },
  { id: '8.1.5', name: 'LED点阵显示', level: 3, parentId: '8.1', chapter: 8, description: '8x8 LED点阵的行列扫描驱动与字符显示', prerequisites: ['2.3.2'],
    prerequisiteReasons: { '2.3.2': '点阵的行列线直接接在准双向口结构的 P1 口引脚上，行列扫描本质是逐位读写这些 I/O 口' } },

  { id: '8.2', name: '键盘接口', level: 2, parentId: '8', chapter: 8, description: '按键输入的硬件连接与软件处理', resources: [
    { type: 'slide', title: '8.2 键盘接口 课件', refId: 'ch08-ppt-s2' },
    { type: 'experiment', title: '实验五：按键输入与消抖处理', refId: 'exp05', duration: 90 },
    { type: 'animation', title: '矩阵键盘扫描原理动画', refId: 'anim-matrix-keypad' },
  ] },
  { id: '8.2.1', name: '独立按键', level: 3, parentId: '8.2', chapter: 8, description: '独立按键的连接方式与电平检测方法' },
  { id: '8.2.2', name: '矩阵键盘', level: 3, parentId: '8.2', chapter: 8, description: '4x4矩阵键盘的行列扫描法与反转法', prerequisites: ['2.3'], appliedIn: ['exp05'],
    prerequisiteReasons: { '2.3': '矩阵键盘的行线、列线接在 I/O 口上，行列扫描/反转法本质是按特定时序对这些端口交替置位与读取' } },
  { id: '8.2.3', name: '按键消抖', level: 3, parentId: '8.2', chapter: 8, description: '硬件消抖（RC滤波）和软件消抖（延时检测）' },

  { id: '8.3', name: 'AD/DA转换', level: 2, parentId: '8', chapter: 8, description: '模数和数模转换器的接口与编程', resources: [
    { type: 'slide', title: '8.3 AD/DA转换 课件', refId: 'ch08-ppt-s3' },
    { type: 'animation', title: 'ADC0809逐次逼近转换动画', refId: 'anim-adc-sar' },
    { type: 'quiz', title: 'AD/DA转换 练习题', refId: 'quiz-ch8-adda' },
  ] },
  { id: '8.3.1', name: 'ADC0809原理与接口', level: 3, parentId: '8.3', chapter: 8, description: 'ADC0809的8通道模拟输入与并行数据输出' },
  { id: '8.3.2', name: 'DAC0832原理与接口', level: 3, parentId: '8.3', chapter: 8, description: 'DAC0832的双缓冲结构与模拟电压输出' },
  { id: '8.3.3', name: '模拟信号采集应用', level: 3, parentId: '8.3', chapter: 8, description: '电压、温度等模拟量的采集、转换与显示' },
  { id: '8.3.4', name: 'ADC转换精度与采样率', level: 3, parentId: '8.3', chapter: 8, description: '分辨率、量化误差与采样定理在AD转换中的应用' },

  { id: '8.4', name: '传感器接口', level: 2, parentId: '8', chapter: 8, description: '常用传感器与单片机的接口技术', resources: [
    { type: 'slide', title: '8.4 传感器接口 课件', refId: 'ch08-ppt-s4' },
    { type: 'animation', title: 'DS18B20单总线通信时序动画', refId: 'anim-onewire-ds18b20' },
    { type: 'experiment', title: '项目四：智慧农业大棚监控系统设计', refId: 'proj04', duration: 240 },
  ] },
  { id: '8.4.1', name: '温度传感器（DS18B20）', level: 3, parentId: '8.4', chapter: 8, description: 'DS18B20单总线协议、温度读取与数据转换' },
  { id: '8.4.2', name: '湿度传感器（DHT11）', level: 3, parentId: '8.4', chapter: 8, description: 'DHT11单总线时序、温湿度数据解析' },
  { id: '8.4.3', name: '光敏传感器', level: 3, parentId: '8.4', chapter: 8, description: '光敏电阻的接口电路与光照强度检测' },
  { id: '8.4.4', name: '超声波传感器', level: 3, parentId: '8.4', chapter: 8, description: 'HC-SR04超声波测距模块的触发与回波测量' },

  { id: '8.5', name: '电机驱动', level: 2, parentId: '8', chapter: 8, description: '常见电机的驱动电路与控制方法', resources: [
    { type: 'slide', title: '8.5 电机驱动 课件', refId: 'ch08-ppt-s5' },
    { type: 'experiment', title: '实验八：步进电机控制实验', refId: 'exp08', duration: 120 },
    { type: 'experiment', title: '项目三：智能小车运动控制系统设计', refId: 'proj03', duration: 180 },
    { type: 'animation', title: 'H桥驱动与步进电机相序动画', refId: 'anim-motor-hbridge' },
  ] },
  { id: '8.5.1', name: '直流电机驱动（L298N）', level: 3, parentId: '8.5', chapter: 8, description: 'L298N H桥驱动直流电机的正反转与调速控制' },
  { id: '8.5.2', name: '步进电机驱动', level: 3, parentId: '8.5', chapter: 8, description: '步进电机的相序控制（全步/半步）与ULN2003驱动' },
  { id: '8.5.3', name: '舵机控制', level: 3, parentId: '8.5', chapter: 8, description: 'PWM控制SG90舵机角度的脉宽与周期关系' },

  { id: '8.6', name: '声音输出接口', level: 2, parentId: '8', chapter: 8, description: '蜂鸣器发声原理与三极管驱动电路，音调（方波频率）与节拍（发声时长）的程序控制', resources: [
    { type: 'slide', title: '第8章 接口技术 课件PPT', refId: 'ch08-ppt' },
    { type: 'experiment', title: '实验七：蜂鸣器音频控制', refId: 'exp07', duration: 90 },
  ] },
  { id: '8.6.1', name: '有源与无源蜂鸣器驱动', level: 3, parentId: '8.6', chapter: 8, description: '有源蜂鸣器内置振荡源、加电即响；无源蜂鸣器需外部方波激励定音高，两者均经三极管放大驱动' },

  // ========================================================================
  // 一级知识点9：系统设计（项目实践）
  // ========================================================================
  { id: '9', name: '系统设计', level: 1, chapter: 9, description: '单片机系统的设计方法、PCB设计与调试测试',
    tutor: {
      core: '一个完整的 8051 系统 = 最小系统（晶振 + 复位 + 电源） + 外设接口 + 软件架构；做法是自顶向下分模块、自底向上集成。',
      whyImportant: '知识点会忘，但"如何把一个需求拆成 MCU 系统"的方法论会跟你一辈子。',
      commonMistake: '需求还没厘清就直接动手画原理图 / 写代码——返工的时间远多于前期分析的时间。',
      takeaway: '上电之前，先把"需求 → 方案 → 模块划分 → 接口定义"在纸上画清楚。',
    },
    resources: [
    { type: 'slide', title: '第9章 系统设计 课件PPT', refId: 'ch09-ppt' },
    { type: 'quiz', title: '第9章 单元测验', refId: 'quiz-ch9' },
    { type: 'experiment', title: '项目二：智慧路灯系统设计', refId: 'proj02', duration: 180 },
    { type: 'experiment', title: '项目三：智能小车运动控制系统设计', refId: 'proj03', duration: 180 },
    { type: 'experiment', title: '项目四：智慧农业大棚监控系统设计', refId: 'proj04', duration: 240 },
  ], prerequisites: ['7', '8'], appliedIn: ['proj02', 'proj03', 'proj04'],
    prerequisiteReasons: {
      '7': '系统级项目普遍要与上位机/其他模块通信（WiFi、蓝牙都靠串口AT指令），串口是系统对外数据交换的常规入口',
      '8': '系统设计要把需求拆成显示、按键、传感、驱动等具体模块，这些模块的实现方式就是第8章的各类接口技术',
    } },

  { id: '9.1', name: '系统设计方法', level: 2, parentId: '9', chapter: 9, description: '嵌入式系统开发的工程化方法', resources: [
    { type: 'slide', title: '9.1 系统设计方法 课件', refId: 'ch09-ppt-s1' },
    { type: 'document', title: '嵌入式系统开发流程指南', refId: 'doc-dev-workflow' },
  ] },
  { id: '9.1.1', name: '需求分析', level: 3, parentId: '9.1', chapter: 9, description: '功能需求、性能指标与约束条件的分析方法' },
  { id: '9.1.2', name: '方案设计', level: 3, parentId: '9.1', chapter: 9, description: '方案比较、器件选型与系统架构设计' },
  { id: '9.1.3', name: '硬件设计流程', level: 3, parentId: '9.1', chapter: 9, description: '原理图设计、元器件选型与电路计算' },
  { id: '9.1.4', name: '软件设计流程', level: 3, parentId: '9.1', chapter: 9, description: '程序流程图绘制、模块划分与接口定义' },
  { id: '9.1.5', name: '软硬件协同设计', level: 3, parentId: '9.1', chapter: 9, description: '硬件功能与软件实现的分工与配合策略' },

  { id: '9.2', name: 'PCB设计基础', level: 2, parentId: '9', chapter: 9, description: 'PCB设计工具与布局布线方法', resources: [
    { type: 'slide', title: '9.2 PCB设计基础 课件', refId: 'ch09-ppt-s2' },
    { type: 'document', title: 'Altium Designer快速入门', refId: 'doc-ad-quickstart' },
  ] },
  { id: '9.2.1', name: '原理图绘制', level: 3, parentId: '9.2', chapter: 9, description: '电路原理图的绘制规范与常用符号' },
  { id: '9.2.2', name: 'PCB布局布线', level: 3, parentId: '9.2', chapter: 9, description: '元器件布局原则、走线规则与接地处理' },
  { id: '9.2.3', name: 'Altium Designer基础', level: 3, parentId: '9.2', chapter: 9, description: 'AD软件的基本操作：原理图库、PCB库与设计规则' },
  { id: '9.2.4', name: 'DRC检查与制板', level: 3, parentId: '9.2', chapter: 9, description: '设计规则检查、Gerber文件输出与PCB制作流程' },

  { id: '9.3', name: '调试与测试', level: 2, parentId: '9', chapter: 9, description: '系统调试方法与测试技术', resources: [
    { type: 'slide', title: '9.3 调试与测试 课件', refId: 'ch09-ppt-s3' },
    { type: 'quiz', title: '调试与测试 练习题', refId: 'quiz-ch9-debug' },
  ] },
  { id: '9.3.1', name: '硬件调试方法', level: 3, parentId: '9.3', chapter: 9, description: '万用表测量、示波器观察与逻辑分析仪使用' },
  { id: '9.3.2', name: '软件调试技巧', level: 3, parentId: '9.3', chapter: 9, description: '断点设置、单步调试、变量监视与串口打印调试' },
  { id: '9.3.3', name: '联合调试', level: 3, parentId: '9.3', chapter: 9, description: '硬件与软件的联合调试流程与问题定位' },
  { id: '9.3.4', name: '性能测试', level: 3, parentId: '9.3', chapter: 9, description: '系统响应时间、精度和稳定性的测试方法' },
  { id: '9.3.5', name: '故障排除方法', level: 3, parentId: '9.3', chapter: 9, description: '常见硬件故障和软件bug的排查思路与方法' },

  { id: '9.4', name: '项目文档', level: 2, parentId: '9', chapter: 9, description: '工程项目的文档规范与答辩要求', resources: [
    { type: 'slide', title: '9.4 项目文档 课件', refId: 'ch09-ppt-s4' },
    { type: 'document', title: '实验一至八实验报告模板', refId: 'doc-report-template', url: '/resources/course/microcontroller-lab-report-1-8.pdf' },
  ] },
  { id: '9.4.1', name: '技术报告撰写', level: 3, parentId: '9.4', chapter: 9, description: '技术报告的结构、内容要求与排版规范' },
  { id: '9.4.2', name: '项目答辩要求', level: 3, parentId: '9.4', chapter: 9, description: '答辩流程、PPT制作与现场演示注意事项' },
  { id: '9.4.3', name: '版本管理与协作', level: 3, parentId: '9.4', chapter: 9, description: '代码版本控制与团队协作开发的基本方法' },

  // ========================================================================
  // 一级知识点10：前沿应用（2学时）
  // ========================================================================
  { id: '10', name: '前沿应用', level: 1, chapter: 10, description: '物联网、人工智能、RISC-V与AIoT等前沿技术',
    tutor: {
      core: '8051 不是过去式——它在 IoT 末端、低成本工业控制、教学领域仍然广泛使用；ARM Cortex-M、RISC-V 是它的延展方向。',
      whyImportant: '学完 8051 不是终点，而是理解"任何 MCU 都是 CPU + 存储 + 外设 + 中断"这个共性后的起点。',
      commonMistake: '学完 8051 就觉得它"过时"。它教的是嵌入式系统的"原型"，框架可以平移到 STM32、RISC-V 上。',
      takeaway: '8051 是嵌入式系统的"教学原型"——掌握它，再学任何 MCU 都是同一个套路。',
    },
    resources: [
    { type: 'slide', title: '第10章 前沿应用 课件PPT', refId: 'ch10-ppt' },
    { type: 'quiz', title: '第10章 单元测验', refId: 'quiz-ch10' },
    { type: 'document', title: '物联网与AIoT前沿技术综述', refId: 'doc-aiot-overview' },
  ], prerequisites: ['9'],
    prerequisiteReasons: {
      '9': '前沿应用（IoT节点、AIoT）都是在一个完整系统（最小系统+外设接口+软件架构）之上再叠加联网/智能模块，先会搭系统才谈得上升级它',
    } },

  { id: '10.1', name: '物联网应用', level: 2, parentId: '10', chapter: 10, description: '单片机与无线通信模块的物联网应用', resources: [
    { type: 'slide', title: '10.1 物联网应用 课件', refId: 'ch10-ppt-s1' },
    { type: 'experiment', title: '项目四：智慧农业大棚监控系统设计', refId: 'proj04', duration: 240 },
    { type: 'document', title: 'ESP8266 AT指令参考手册', refId: 'doc-esp8266-at' },
  ] },
  { id: '10.1.1', name: 'WiFi模块（ESP8266）', level: 3, parentId: '10.1', chapter: 10, description: 'ESP8266 AT指令控制与TCP/IP网络连接' },
  { id: '10.1.2', name: '蓝牙模块（HC-05）', level: 3, parentId: '10.1', chapter: 10, description: 'HC-05蓝牙串口透传与手机APP通信' },
  { id: '10.1.3', name: 'LoRa无线通信', level: 3, parentId: '10.1', chapter: 10, description: 'LoRa低功耗远距离无线通信技术与应用场景' },
  { id: '10.1.4', name: 'MQTT协议基础', level: 3, parentId: '10.1', chapter: 10, description: 'MQTT发布/订阅模型与物联网云平台对接' },
  { id: '10.1.5', name: 'NB-IoT窄带物联网', level: 3, parentId: '10.1', chapter: 10, description: 'NB-IoT技术特点与低功耗广域物联网应用' },

  { id: '10.2', name: '人工智能导论', level: 2, parentId: '10', chapter: 10, description: 'AI与嵌入式系统结合的前沿方向', resources: [
    { type: 'slide', title: '10.2 人工智能导论 课件', refId: 'ch10-ppt-s2' },
    { type: 'document', title: 'TinyML入门阅读材料', refId: 'doc-tinyml-intro' },
  ] },
  { id: '10.2.1', name: 'TinyML概念', level: 3, parentId: '10.2', chapter: 10, description: '微型机器学习在MCU上的部署与推理' },
  { id: '10.2.2', name: '边缘计算', level: 3, parentId: '10.2', chapter: 10, description: '边缘端数据处理与云边协同架构' },
  { id: '10.2.3', name: 'AI在嵌入式中的简单应用', level: 3, parentId: '10.2', chapter: 10, description: '语音识别、图像分类等AI模型在MCU上的应用案例' },
  { id: '10.2.4', name: '神经网络基础概念', level: 3, parentId: '10.2', chapter: 10, description: '感知机、激活函数与前馈网络的基本原理' },

  { id: '10.3', name: 'RISC-V架构', level: 2, parentId: '10', chapter: 10, description: 'RISC-V开源指令集架构简介', resources: [
    { type: 'slide', title: '10.3 RISC-V架构 课件', refId: 'ch10-ppt-s3' },
    { type: 'document', title: 'RISC-V与8051架构对比分析', refId: 'doc-riscv-vs-8051' },
  ] },
  { id: '10.3.1', name: 'RISC-V基本概念', level: 3, parentId: '10.3', chapter: 10, description: 'RISC-V开源指令集的设计理念与模块化特点' },
  { id: '10.3.2', name: '国产RISC-V芯片发展', level: 3, parentId: '10.3', chapter: 10, description: '兆易GD32V、平头哥等国产RISC-V MCU发展现状' },
  { id: '10.3.3', name: 'RISC-V与51对比', level: 3, parentId: '10.3', chapter: 10, description: 'RISC-V和8051在架构、性能与生态上的比较' },

  { id: '10.4', name: 'AIoT前沿', level: 2, parentId: '10', chapter: 10, description: '人工智能与物联网融合的应用方向', resources: [
    { type: 'slide', title: '10.4 AIoT前沿 课件', refId: 'ch10-ppt-s4' },
    { type: 'document', title: '智能制造与AIoT案例集', refId: 'doc-aiot-cases' },
  ] },
  { id: '10.4.1', name: '智能制造中的单片机应用', level: 3, parentId: '10.4', chapter: 10, description: '工业4.0中MCU在传感、控制与通信中的角色' },
  { id: '10.4.2', name: '智慧农业系统', level: 3, parentId: '10.4', chapter: 10, description: '温湿度监测、自动灌溉等农业物联网系统' },
  { id: '10.4.3', name: '智能家居控制', level: 3, parentId: '10.4', chapter: 10, description: '智能灯控、环境监测与远程控制的系统设计' },
  { id: '10.4.4', name: '可穿戴设备应用', level: 3, parentId: '10.4', chapter: 10, description: '低功耗MCU在健康监测手环等可穿戴设备中的应用' },
  { id: '10.4.5', name: '边缘计算与MCU', level: 3, parentId: '10.4', chapter: 10, description: '边缘智能在资源受限MCU上的部署方案与典型应用' },
  { id: '10.4.6', name: 'TinyML嵌入式机器学习', level: 3, parentId: '10.4', chapter: 10, description: '在微控制器上部署轻量级机器学习模型的方法与工具链' },

  { id: '10.5', name: 'AI素养与责任使用', level: 2, parentId: '10', chapter: 10, description: '核验AI输出、保护数据、规范引用并明确AI辅助调试边界', resources: [
    { type: 'document', title: 'AI辅助学习核验清单', refId: 'doc-ai-literacy-checklist' },
    { type: 'quiz', title: 'AI素养情境测验', refId: 'quiz-ch10-ai-literacy' },
  ], prerequisites: ['10.2'], prerequisiteReasons: {
    '10.2': '负责任地核验和引用 AI 输出，需先理解 AI 的基本能力、适用场景与局限',
  } },
  { id: '10.5.1', name: 'AI输出核验与引用', level: 3, parentId: '10.5', chapter: 10, description: '依据课程资料、数据手册和可运行结果交叉核验AI回答，并标明AI辅助范围' },
  { id: '10.5.2', name: '隐私与数据安全', level: 3, parentId: '10.5', chapter: 10, description: '不向外部模型提交账号、密钥、学生身份和未授权实验数据' },
  { id: '10.5.3', name: '提示设计与问题界定', level: 3, parentId: '10.5', chapter: 10, description: '用明确对象、约束、输入输出和验收条件组织问题，而不是把结论交给模型决定' },
  { id: '10.5.4', name: 'AI辅助调试边界', level: 3, parentId: '10.5', chapter: 10, description: 'AI可以解释和提示，但代码正确性必须由编译、仿真、测试和教师评价确认' },
  { id: '10.5.5', name: '学术诚信与责任判断', level: 3, parentId: '10.5', chapter: 10, description: '保留个人推理、引用来源和修改记录，不把AI生成内容冒充独立完成成果' },
];

// ============================================================================
// 课程关系表（前置依赖 + 实验应用）
// ----------------------------------------------------------------------------
// 依赖边为课程组按课程逻辑编写，可在 /admin/knowledge-graph 编辑器调整。
// 按章分组，每章前的注释说明本章依赖边的总体推导依据；
// 每条边行尾的注释是这条边的一句话课程逻辑。
// appliedIn 与 experiment-config.ts 各实验 knowledgePoints 清单反向对应。
// ============================================================================

type KnowledgeRelationPatch = {
  prerequisites?: string[];
  appliedIn?: string[];
  // Why each id in `prerequisites` is a real dependency — keyed by the
  // prerequisite's own id, one mechanism-specific sentence per key. Parsed
  // from (and kept in sync with) this file's original line-end comments;
  // see getPrerequisiteReason() below for the runtime lookup that UI code
  // should call instead of reading relationPatches directly.
  reasons?: Record<string, string>;
};

const relationPatches: Record<string, KnowledgeRelationPatch> = {
  // —— 第1章 单片机概述：章内认知主线是 历史→分类→应用→芯片→工具，
  //    后续所有章都以 1.4（89C51结构）和 1.5（开发环境）为总入口。——
  '1.2': { prerequisites: ['1.1'], reasons: { '1.1': '了解发展脉络后才能按字长/系列给单片机分类' } },                       // 了解发展脉络后才能按字长/系列给单片机分类
  '1.3': { prerequisites: ['1.2'], reasons: { '1.2': '应用领域的选择建立在分类与选型标准之上' } },                       // 应用领域的选择建立在分类与选型标准之上
  '1.4': { prerequisites: ['1.2'], appliedIn: ['proj01'], reasons: { '1.2': '从"51系列"聚焦到 89C51 具体芯片' } },// 从"51系列"聚焦到 89C51 具体芯片；项目一即认识89C51
  '1.5': { prerequisites: ['1.4'], appliedIn: ['proj01'], reasons: { '1.4': '开发工具围绕 89C51 展开：选型号、建工程、仿真' } },// 开发工具围绕 89C51 展开：选型号、建工程、仿真
  '1.2.2': { prerequisites: ['1.2.1'], reasons: { '1.2.1': '先有"按字长分类"的维度，再看各具体系列' } },                   // 先有"按字长分类"的维度，再看各具体系列
  '1.2.3': { prerequisites: ['1.2.2'], reasons: { '1.2.2': '选型是在已知各系列特点之间做取舍' } },                   // 选型是在已知各系列特点之间做取舍
  '1.4.2': { prerequisites: ['1.4.1'], reasons: { '1.4.1': '从外部引脚认识芯片，再进入内部功能框图' } },                   // 从外部引脚认识芯片，再进入内部功能框图
  '1.4.4': { prerequisites: ['1.4.3'], appliedIn: ['proj01'], reasons: { '1.4.3': '最小系统 = 芯片 + 时钟电路 + 复位电路' } }, // 最小系统 = 芯片 + 时钟电路 + 复位电路；项目一"最小系统电路设计"
  '1.5.4': { prerequisites: ['1.5.1'], reasons: { '1.5.1': '先能在 Keil 编译出 HEX，才谈 STC-ISP 下载' } },                   // 先能在 Keil 编译出 HEX，才谈 STC-ISP 下载
  '1.4.1': { appliedIn: ['proj01'] },                      // 项目一"89C51芯片引脚功能"
  '1.4.3': { appliedIn: ['proj01'] },                      // 项目一"最小系统电路设计"（时钟/复位电路）
  '1.5.1': { appliedIn: ['proj01'] },                      // 项目一"Keil μVision开发环境"
  '1.5.2': { appliedIn: ['proj01'] },                      // 项目一"Proteus仿真软件"

  // —— 第2章 硬件结构：以 1.4 的引脚/框图为入口逐个部件展开；
  //    2.2 存储器组织是全课程被依赖最多的枢纽（SFR/位寻址区/地址空间）。——
  '2': { prerequisites: ['1.4'], reasons: { '1.4': '先认全芯片外观与最小系统，再进内部结构' } },                         // 先认全芯片外观与最小系统，再进内部结构
  '2.1': { prerequisites: ['1.4'], reasons: { '1.4': '内部功能框图展开到 CPU 各部件' } },                       // 内部功能框图展开到 CPU 各部件
  '2.2': { prerequisites: ['2.1'], reasons: { '2.1': '存储空间按 CPU 取指/取数的视角组织' } },                       // 存储空间按 CPU 取指/取数的视角组织
  '2.3': { prerequisites: ['2.2'], reasons: { '2.2': 'P0-P3 的口锁存器本身就是 SFR，读写端口=读写 SFR' } },                       // P0-P3 的口锁存器本身就是 SFR，读写端口=读写 SFR
  '2.4': { prerequisites: ['1.4', '2.1'], reasons: { '1.4': '时钟电路在 1.4（最小系统）出现过，是本节讨论的硬件基础', '2.1': '取指-译码-执行需要时序刻度' } },                // 时钟电路在 1.4 出现过；取指-译码-执行需要时序刻度
  '2.5': { prerequisites: ['1.4', '2.2'], reasons: { '1.4': '复位电路是最小系统的一部分', '2.2': '复位后各 SFR 回到初值，需先理解存储器组织中 SFR 的地位' } },                // 复位电路是最小系统一部分；复位后各 SFR 回初值
  '2.6': { prerequisites: ['2.2', '2.4'], reasons: { '2.2': '外扩存储器才需要三总线', '2.4': '总线操作要看读写时序' } },                // 外扩存储器才需要三总线；总线操作要看读写时序
  '2.2.3': { prerequisites: ['2.2.2'], reasons: { '2.2.2': 'SFR 区占用内部 RAM 高 128B 的直接寻址地址空间' } },                   // SFR 区占用内部 RAM 高 128B 的直接寻址地址空间
  '2.2.4': { prerequisites: ['2.2.2'], reasons: { '2.2.2': '位寻址区 20H-2FH 是内部 RAM 的一段' } },                   // 位寻址区 20H-2FH 是内部 RAM 的一段
  '2.2.5': { prerequisites: ['2.2.1', '2.2.2'], reasons: { '2.2.1': '先知道内部 ROM 容量，才知道何时需要外扩程序存储器', '2.2.2': '先知道内部 RAM 容量，才知道何时需要外扩数据存储器' } },          // 先知道内部 ROM/RAM 容量，才知道何时需要外扩
  '2.4.2': { prerequisites: ['2.4.1'], reasons: { '2.4.1': '机器周期 = 12 个振荡周期，先有振荡源' } },                   // 机器周期 = 12 个振荡周期，先有振荡源
  '2.5.4': { prerequisites: ['2.2.3'], reasons: { '2.2.3': '复位后的初始状态就是各 SFR 的复位值' } },                   // 复位后的初始状态就是各 SFR 的复位值
  '2.6.4': { prerequisites: ['2.4.2'], reasons: { '2.4.2': '总线读写时序以机器周期为刻度分析' } },                   // 总线读写时序以机器周期为刻度分析
  '2.7': { prerequisites: ['2.2.3', '2.4', '2.5'], reasons: { '2.2.3': '低功耗由 PCON（SFR）的 IDL/PD 位控制', '2.4': '待机/掉电的本质是停发时钟', '2.5': '掉电模式需复位退出，先懂复位系统' } },       // 低功耗由 PCON（SFR）的 IDL/PD 位控制；待机/掉电的本质是停发时钟；掉电模式需复位退出，先懂复位系统
  '2.3.2': { appliedIn: ['exp01', 'exp02', 'proj01'] },    // 实验一/二"P1口结构与特性"、项目一"P1口输出控制"
  '2.3.5': { appliedIn: ['exp01', 'exp02', 'exp07', 'proj01'] }, // "LED控制/驱动原理""蜂鸣器驱动"都是灌电流与外加驱动问题

  // —— 第3章 指令系统：寻址方式是骨架（立即→直接→间接→变址的认知递进），
  //    指令组是肌肉；运算指令产生标志位，供控制转移使用。——
  '3': { prerequisites: ['2'], reasons: { '2': '指令操作的对象就是第2章的硬件资源' } },                           // 指令操作的对象就是第2章的硬件资源
  '3.1': { prerequisites: ['2.1', '2.2'], appliedIn: ['exp02'], reasons: { '2.1': '寻址的对象包括寄存器组', '2.2': '寻址的对象包括 RAM/ROM/SFR 地址空间' } }, // 寻址的对象是寄存器组与 RAM/ROM/SFR 地址空间；实验二第①段用五种寻址方式逐段搬数（30H-3FH）
  '3.2': { prerequisites: ['3.1'], reasons: { '3.1': '每条传送指令都是某种寻址方式的组合应用' } },                       // 每条传送指令都是某种寻址方式的组合应用
  '3.3': { prerequisites: ['3.2', '2.1'], reasons: { '3.2': '先取到操作数才能运算', '2.1': '运算结果的标志位在 PSW（属于 ALU/CPU 结构）' } },                // 先取到操作数才能运算；结果标志位在 PSW（ALU）
  '3.4': { prerequisites: ['3.2'], reasons: { '3.2': '逻辑运算同样以"操作数先就位"为前提' } },                       // 逻辑运算同样以"操作数先就位"为前提
  '3.5': { prerequisites: ['3.3', '2.1'], reasons: { '3.3': '条件转移依据运算标志位', '2.1': '转移本质是改写 PC（程序计数器，属于 CPU 结构）' } },                // 条件转移依据运算标志位；转移本质是改写 PC
  '3.6': { prerequisites: ['3.1', '2.2'], reasons: { '3.1': '位操作指令建立在位寻址方式之上', '2.2': '位操作指令建立在位寻址区（属于存储器组织）之上' } },                // 位操作指令建立在位寻址方式与位寻址区之上
  '3.1.2': { prerequisites: ['3.1.1'], reasons: { '3.1.1': '先分清"数"与"地址"：MOV A,#30H 与 MOV A,30H' } },                   // 先分清"数"与"地址"：MOV A,#30H 与 MOV A,30H
  '3.1.4': { prerequisites: ['3.1.2', '3.1.3'], reasons: { '3.1.2': '间接寻址 = 寄存器里存放的是地址，需先分清数与地址', '3.1.3': '间接寻址建立在寄存器寻址（R0/R1存放地址）之上，两个前概念缺一不可' } },          // 间接寻址 = 寄存器里存放的是地址，两个前概念缺一不可
  '3.1.5': { prerequisites: ['3.1.4'], reasons: { '3.1.4': '变址 = 基址寄存器 + 偏移，在间接寻址上再加一层' } },                   // 变址 = 基址寄存器 + 偏移，在间接寻址上再加一层
  '3.1.6': { prerequisites: ['2.1.3'], reasons: { '2.1.3': '相对寻址以 PC 当前值为基准加偏移' } },                   // 相对寻址以 PC 当前值为基准加偏移
  '3.1.7': { prerequisites: ['2.2.4'], reasons: { '2.2.4': '位寻址的对象是位地址空间' } },                   // 位寻址的对象是位地址空间
  '3.2.2': { prerequisites: ['3.1.4', '2.2.5'], reasons: { '3.1.4': 'MOVX 经 @DPTR/@Ri 间接寻址访问外扩 RAM', '2.2.5': 'MOVX 访问的正是需要外扩的那部分数据存储器' } },          // MOVX 经 @DPTR/@Ri 间接寻址访问外扩 RAM
  '3.2.3': { prerequisites: ['3.1.5'], appliedIn: ['exp02', 'exp04', 'exp07', 'exp08'], reasons: { '3.1.5': 'MOVC 用 @A+DPTR 变址查表' } }, // MOVC 用 @A+DPTR 变址查表；实验二查表演示、段码表/音符表/相序表全是查表
  '3.2.5': { appliedIn: ['exp02'] },                       // 实验二"SWAP半字节交换"（逻辑与移位段）
  '3.2.4': { prerequisites: ['2.2.2'], reasons: { '2.2.2': 'SP 指向内部 RAM，栈区就开在通用 RAM 区' } },                   // SP 指向内部 RAM，栈区就开在通用 RAM 区
  '3.3.1': { appliedIn: ['exp02'] },                       // 实验二"ADD/ADDC多字节加法与CY/AC标志"、末段校验和累加
  '3.3.2': { appliedIn: ['exp02'] },                       // 实验二"SUBB带借位减法与OV标志"
  '3.3.3': { appliedIn: ['exp02'] },                       // 实验二"MUL AB乘法指令"
  '3.3.4': { appliedIn: ['exp02'] },                       // 实验二"DIV AB除法指令"
  '3.3.5': { prerequisites: ['3.3.1'], appliedIn: ['exp02'], reasons: { '3.3.1': '十进制调整只跟在 BCD 加法之后使用' } }, // 十进制调整只跟在 BCD 加法之后使用；实验二"DA A十进制调整（BCD修正）"
  '3.5.3': { prerequisites: ['3.2.4'], reasons: { '3.2.4': '调用要压栈保存返回地址，先懂 PUSH/POP' } },                   // 调用要压栈保存返回地址，先懂 PUSH/POP
  '3.5.4': { prerequisites: ['3.5.3'], reasons: { '3.5.3': '有调用才有返回；RET 与 RETI 的区别在中断章展开' } },                   // 有调用才有返回；RET 与 RETI 的区别在中断章展开
  '3.6.4': { prerequisites: ['3.1.7'], appliedIn: ['exp02', 'exp03'], reasons: { '3.1.7': 'SETB/CLR 操作的是位地址' } }, // SETB/CLR 操作位地址；exp01 代码无位操作指令，不挂
  '3.2.1': { appliedIn: ['exp01'] },                       // 实验一"基本输出指令MOV"
  '3.4.1': { appliedIn: ['exp02'] },                       // 实验二逻辑段"ANL逻辑与：3CH∧66H"
  '3.4.2': { appliedIn: ['exp02'] },                       // 实验二逻辑段"ORL逻辑或：3CH∨66H"
  '3.4.3': { appliedIn: ['exp02'] },                       // 实验二逻辑段"XRL逻辑异或：3CH⊕66H"
  '3.4.4': { appliedIn: ['exp02'] },                       // 实验二"CPL取反指令"
  '3.4.5': { appliedIn: ['exp02'] },                       // 实验二"RL/RRC循环移位指令"（逻辑与移位段）
  '3.5.2': { appliedIn: ['exp02'] },                       // 实验二"程序循环设计"（DJNZ 循环骨架）

  // —— 第4章 C语言编程：C51 的每个扩展关键字都对应第2章一块真实硬件；
  //    控制结构编译后落到第3章的转移指令；中断函数指向第5章。——
  '4.1': { prerequisites: ['1.5'], appliedIn: ['proj01'], reasons: { '1.5': '在工具链总览基础上专攻 Keil 工程操作' } },// 在工具链总览基础上专攻 Keil 工程操作；项目一实操
  '4.2': { prerequisites: ['2.2'], reasons: { '2.2': 'data/idata/xdata/code 逐一对应存储器分区' } },                       // data/idata/xdata/code 逐一对应存储器分区
  '4.3': { prerequisites: ['4.2'], reasons: { '4.2': '先有变量与类型，再谈流程控制' } },                       // 先有变量与类型，再谈流程控制
  '4.4': { prerequisites: ['4.2', '3.6'], reasons: { '4.2': 'sfr/sbit 本质是给 SFR 与位地址起名，建立在数据类型/存储类型之上', '3.6': '位操作编程对应第3章的位指令' } },                // sfr/sbit 本质是给 SFR 与位地址起名；位操作编程对应位指令
  '4.5': { prerequisites: ['4.3'], reasons: { '4.3': '库函数的使用以函数定义与调用为前提' } },                       // 库函数的使用以函数定义与调用为前提
  '4.6': { prerequisites: ['4.3'], reasons: { '4.3': '规范约束的对象是已能写出来的程序' } },                       // 规范约束的对象是已能写出来的程序
  '4.2.2': { prerequisites: ['2.2.1', '2.2.2'], reasons: { '2.2.1': 'code 关键字对应程序存储器（ROM/Flash）', '2.2.2': 'data/idata/xdata 等关键字对应内部/外部数据存储器（RAM）分区' } },          // 每个存储类型关键字都指向一块真实存储区
  '4.4.1': { prerequisites: ['5.2', '4.3.4'], appliedIn: ['exp03'], reasons: { '5.2': 'interrupt n 的 n 就是89C51中断系统里的中断源编号', '4.3.4': '中断服务函数本质是一种特殊的函数定义' } }, // interrupt n 的 n 就是中断源编号；实验三写定时器 ISR
  '4.4.2': { prerequisites: ['2.2.3'], reasons: { '2.2.3': 'sfr 关键字访问的就是特殊功能寄存器' } },                   // sfr 关键字访问的就是特殊功能寄存器
  '4.4.3': { prerequisites: ['3.6.4'], reasons: { '3.6.4': 'sbit 变量的置位/清零对应 SETB/CLR' } },                   // sbit 变量的置位/清零对应 SETB/CLR
  '4.5.1': { prerequisites: ['2.4.2', '4.3.3'], appliedIn: ['exp01', 'exp08', 'proj01'], reasons: { '2.4.2': '延时长短要按机器周期折算才能算准', '4.3.3': '延时函数用 for/while 循环结构实现' } }, // 延时长短按机器周期折算、用循环实现；流水灯/步进调速都靠它
  '4.5.3': { appliedIn: ['exp09'] },                       // 实验九"字符串处理"
  '4.3.2': { appliedIn: ['exp05', 'exp06', 'proj03', 'proj04'] }, // 状态机/闰年判断/阈值比较都是选择结构的应用
  '4.3.3': { appliedIn: ['exp01', 'proj01'] },             // 实验一/项目一"循环程序结构"

  // —— 第5章 中断系统：主链是 请求→响应→服务→返回；
  //    IE/IP/TCON 都是 SFR（依赖2.2.3），响应/返回靠堆栈与 RETI（依赖第3章）。——
  '5.1': { prerequisites: ['2.1'], reasons: { '2.1': '先理解 CPU 顺序执行，才能理解"打断-返回"' } },                       // 先理解 CPU 顺序执行，才能理解"打断-返回"
  '5.2': { prerequisites: ['5.1', '2.2.3'], reasons: { '5.1': '把抽象中断概念落到 89C51 的 5 源两级', '2.2.3': 'IE/IP 是特殊功能寄存器' } },              // 把抽象中断概念落到 89C51 的 5 源两级；IE/IP 是 SFR
  '5.3': { prerequisites: ['5.2', '2.3.4'], reasons: { '5.2': '外部中断是 89C51 中断系统 5 个源之一', '2.3.4': 'INT0/INT1 复用在 P3.2/P3.3 第二功能上' } },              // INT0/INT1 复用在 P3.2/P3.3 第二功能上
  '5.4': { prerequisites: ['5.2', '3.2.4'], reasons: { '5.2': '响应流程建立在已认识的 89C51 中断系统之上', '3.2.4': '响应=硬件压栈保存断点，返回=出栈，堆栈是前提' } },              // 响应=硬件压栈保存断点，返回=出栈，堆栈是前提
  '5.5': { prerequisites: ['5.4'], reasons: { '5.4': '先走通单中断全流程，再谈嵌套' } },                       // 先走通单中断全流程，再谈嵌套
  '5.6': { prerequisites: ['5.3', '5.4'], reasons: { '5.3': '应用建立在触发方式（外部中断）之上', '5.4': '应用建立在处理流程之上，二者组合构成实际应用' } },                // 应用 = 触发方式 + 处理流程的组合
  '5.4.1': { prerequisites: ['5.2.1'], reasons: { '5.2.1': '请求来自 5 个中断源的标志位置位' } },                   // 请求来自 5 个中断源的标志位置位
  '5.4.2': { prerequisites: ['5.4.1', '5.2.2'], reasons: { '5.4.1': '响应的前提是请求已挂起', '5.2.2': '响应的前提是 EA/使能位（IE寄存器）已开放' } },          // 响应的前提是请求已挂起且 EA/使能位开放
  '5.4.3': { prerequisites: ['5.4.2'], appliedIn: ['exp03'], reasons: { '5.4.2': '被响应后才进入服务程序：保护现场→处理→恢复' } }, // 被响应后才进入服务程序：保护现场→处理→恢复；实验三实操
  '5.4.4': { prerequisites: ['5.4.3', '3.5.4'], reasons: { '5.4.3': 'RETI 是中断服务程序执行完毕后的收尾动作', '3.5.4': 'RETI 恢复断点并解除优先级封锁，区别于普通的 RET' } },          // RETI 恢复断点并解除优先级封锁，区别于 RET
  '5.4.5': { prerequisites: ['5.4.2', '2.4.2'], reasons: { '5.4.2': '响应时间的计算建立在响应条件判断之上', '2.4.2': '响应时间以机器周期为单位计算' } },          // 响应时间以机器周期为单位计算
  '5.5.1': { prerequisites: ['5.2.3'], reasons: { '5.2.3': '两级优先级由 IP 寄存器配置' } },                   // 两级优先级由 IP 寄存器配置
  '5.6.1': { prerequisites: ['5.3.3', '8.2.3'], appliedIn: ['exp05'], reasons: { '5.3.3': '按键中断是外部中断应用的典型场景', '8.2.3': '真实按键中断必须配合消抖' } }, // 真实按键中断必须配合消抖；实验五"中断与查询处理"
  '5.6.2': { prerequisites: ['6.1.3', '5.4.3'], appliedIn: ['proj02'], reasons: { '6.1.3': 'TF 溢出标志（TCON寄存器）就是定时中断的请求源', '5.4.3': '定时中断应用走的是同一套"响应→服务"流程' } }, // TF 溢出标志就是定时中断的请求源；项目二"定时器中断应用"
  '5.6.3': { prerequisites: ['7.2.1', '5.4.3'], appliedIn: ['exp09'], reasons: { '7.2.1': 'TI/RI 标志位在 SCON 中', '5.4.3': '串口中断按同一套"响应→服务"流程处理' } }, // TI/RI 在 SCON 中，串口中断按同一流程处理；实验九实操
  '5.6.4': { prerequisites: ['5.5.1'], reasons: { '5.5.1': '多中断源并存要靠优先级协调' } },                   // 多中断源并存要靠优先级协调
  '5.2.3': { appliedIn: ['exp06'] },                       // 实验六"中断优先级设置"
  '5.2.4': { appliedIn: ['exp03'] },                       // 实验三"中断向量表"
  '5.3.3': { appliedIn: ['exp05', 'proj03'] },             // 实验五按键中断、项目三"外部中断应用"

  // —— 第6章 定时器/计数器：定时的本质是数机器周期（依赖2.4），
  //    应用链是 初值→精确延时→方波→PWM，几乎全部以溢出中断组织（依赖第5章）。——
  '6.1': { prerequisites: ['2.4', '2.2.3'], reasons: { '2.4': '定时的本质是数机器周期', '2.2.3': 'TMOD/TCON 是特殊功能寄存器' } },              // 定时的本质是数机器周期；TMOD/TCON 是 SFR
  '6.2': { prerequisites: ['6.1'], appliedIn: ['exp06'], reasons: { '6.1': '四种模式都是 TMOD 中 M1M0 位的组合' } }, // 四种模式都是 TMOD 中 M1M0 的组合；实验六"工作模式分析"
  '6.3': { prerequisites: ['6.2', '5.4'], reasons: { '6.2': '定时器应用建立在四种工作模式的选择之上', '5.4': '定时器应用几乎都以"溢出中断"方式组织，需先懂中断处理流程' } },                // 定时器应用几乎都以"溢出中断"方式组织
  '6.4': { prerequisites: ['6.1', '2.3.4'], reasons: { '6.1': 'C/T=1 改数外部脉冲，与定时模式共用同一套寄存器基础', '2.3.4': 'T0/T1 引脚是 P3.4/P3.5 的第二功能' } },              // C/T=1 改数外部脉冲；T0/T1 引脚是 P3.4/P3.5 第二功能
  '6.1.4': { prerequisites: ['6.1.1', '2.4.2'], appliedIn: ['exp03', 'exp06'], reasons: { '6.1.1': '初值计算建立在"加1计数器"原理之上', '2.4.2': '初值 = 2^n − 定时时间/机器周期，需要机器周期换算' } }, // 初值 = 2^n − 定时时间/机器周期；两实验都要算初值
  '6.2.1': { prerequisites: ['6.1.2'], reasons: { '6.1.2': '模式选择由 TMOD 的 M1M0 决定' } },                   // 模式选择由 TMOD 的 M1M0 决定
  '6.2.2': { prerequisites: ['6.2.1'], reasons: { '6.2.1': '16 位模式是 13 位模式的自然扩展' } },                   // 16 位模式是 13 位模式的自然扩展
  '6.2.3': { prerequisites: ['6.2.2'], appliedIn: ['exp09'], reasons: { '6.2.2': '自动重装免去手工装初值——正是波特率发生的需求，建立在16位模式基础上' } }, // 自动重装免去手工装初值——正是波特率发生的需求；实验九用 T1 模式2
  '6.2.4': { prerequisites: ['6.2.2'], reasons: { '6.2.2': '模式3把 T0 拆成两个 8 位计数器，仍以16位模式认知为基础' } },                   // 模式3把 T0 拆成两个 8 位计数器
  '6.1.2': { appliedIn: ['exp03'] },                       // 实验三"TMOD寄存器配置"
  '6.3.1': { prerequisites: ['6.1.4'], appliedIn: ['exp07', 'exp08'], reasons: { '6.1.4': '精确延时的第一步是会算初值' } }, // 精确延时的第一步是会算初值；节拍/步进调速靠它
  '6.3.2': { prerequisites: ['6.3.1'], appliedIn: ['exp03', 'exp07'], reasons: { '6.3.1': '半周期定时翻转 I/O 即方波，建立在精确延时之上' } }, // 半周期定时翻转 I/O 即方波；方波频率=音符音高
  '6.3.3': { prerequisites: ['6.3.2'], appliedIn: ['exp07', 'proj02', 'proj03'], reasons: { '6.3.2': 'PWM = 占空比可调的方波' } }, // PWM = 占空比可调的方波；调光/调速/调声全用它
  '6.3.4': { prerequisites: ['6.4.1'], reasons: { '6.4.1': '频率测量 = 定时闸门内数外部脉冲，建立在外部脉冲计数之上' } },                   // 频率测量 = 定时闸门内数外部脉冲
  '6.3.5': { prerequisites: ['6.3.1'], appliedIn: ['exp06'], reasons: { '6.3.1': '软件计数器扩展 65ms 上限得到秒级定时，仍以精确延时为基础' } }, // 软件计数器扩展 65ms 上限得到秒级定时；实验六"实时时钟算法"
  '6.4.2': { prerequisites: ['6.4.1', '6.3.1'], reasons: { '6.4.1': '转速测量建立在外部脉冲计数之上', '6.3.1': '转速 = 单位时间内的脉冲计数，需要定时功能配合计时' } },          // 转速 = 单位时间内的脉冲计数，定时与计数配合
  '6.4.4': { prerequisites: ['6.1.2'], reasons: { '6.1.2': '门控计数由 TMOD 的 GATE 位控制' } },                   // 门控计数由 TMOD 的 GATE 位控制

  // —— 第7章 串行通信：从并行总线对比引出串行（依赖2.6）；
  //    波特率由 T1 模式2 产生是最典型的跨章依赖（7.2.3←6.2.3）。——
  '7.1': { prerequisites: ['2.6'], reasons: { '2.6': '从并行总线的对比引出串行传输的动机' } },                       // 从并行总线的对比引出串行传输的动机
  '7.2': { prerequisites: ['7.1', '2.2.3'], reasons: { '7.1': '89C51 串口是通信基础概念在具体芯片上的落地', '2.2.3': 'SCON/SBUF/PCON 都是特殊功能寄存器' } },              // SCON/SBUF/PCON 都是 SFR
  '7.3': { prerequisites: ['7.2', '4.3'], reasons: { '7.2': '收发程序建立在 SCON/SBUF 寄存器认知之上', '4.3': '收发程序用 C 的查询/中断框架实现' } },                // 收发程序用 C 的查询/中断框架实现
  '7.4': { prerequisites: ['7.1'], reasons: { '7.1': '各协议是帧格式/电平/拓扑的不同约定' } },                       // 各协议是帧格式/电平/拓扑的不同约定
  '7.1.3': { prerequisites: ['7.1.2'], reasons: { '7.1.2': '异步通信没有共享时钟，才需要双方约定波特率' } },                   // 异步通信没有共享时钟，才需要双方约定波特率
  '7.1.4': { appliedIn: ['proj04'] },                      // 项目四"UART数据帧格式设计"
  '7.2.3': { prerequisites: ['6.2.3', '7.1.3'], appliedIn: ['exp09'], reasons: { '6.2.3': 'T1 模式2 自动重装产生溢出率，是波特率的直接来源', '7.1.3': '波特率设置建立在"波特率概念"之上，是跨章依赖的典型' } }, // T1 模式2 自动重装产生溢出率→波特率，跨章依赖的典型
  '7.2.4': { prerequisites: ['7.2.1'], reasons: { '7.2.1': '工作模式由 SCON 的 SM0/SM1 位选择' } },                   // 工作模式由 SCON 的 SM0/SM1 位选择
  '7.2.1': { appliedIn: ['exp09'] },                       // 实验九"SCON寄存器配置"
  '7.2.2': { appliedIn: ['exp09'] },                       // 实验九"SBUF缓冲器使用"
  '7.3.1': { prerequisites: ['7.2.1', '7.2.3'], reasons: { '7.2.1': '初始化 = 配 SCON', '7.2.3': '初始化 = 配波特率' } },          // 初始化 = 配 SCON + 配波特率
  '7.3.2': { prerequisites: ['7.3.1'], appliedIn: ['exp09'], reasons: { '7.3.1': '发送要先完成初始化：写 SBUF、等 TI、清 TI' } }, // 写 SBUF、等 TI、清 TI；实验九"TI/RI标志位操作"
  '7.3.3': { prerequisites: ['7.3.1'], appliedIn: ['exp09'], reasons: { '7.3.1': '接收要先完成初始化：等 RI、读 SBUF、清 RI' } }, // 等 RI、读 SBUF、清 RI
  '7.3.4': { prerequisites: ['7.3.2', '5.2.2'], appliedIn: ['exp09'], reasons: { '7.3.2': '中断方式收发建立在查询方式发送流程之上', '5.2.2': '中断方式要在 IE 中开 ES（串口中断允许位）' } }, // 中断方式要在 IE 中开 ES；实验九"串口中断处理"
  '7.4.1': { prerequisites: ['7.1.4'], reasons: { '7.1.4': 'RS-232 是对帧格式加电平标准的具体化' } },                   // RS-232 是对帧格式加电平标准的具体化
  '7.4.4': { prerequisites: ['7.1.2'], reasons: { '7.1.2': 'I2C 是同步串行协议，建立在同步/异步通信概念之上' } }, // I2C 是同步串行协议；proj04 中 AT24C02 仅为后续扩展，不冒充已实现应用

  // —— 第8章 接口技术：所有接口都落在 I/O 口上（依赖2.3），
  //    显示扫描/单总线时序/电机调速普遍依赖第6章的定时能力。——
  '8.1': { prerequisites: ['2.3', '6.3'], appliedIn: ['exp04'], reasons: { '2.3': '显示器件挂在 I/O 口上', '6.3': '动态扫描靠定时刷新' } }, // 显示器件挂在 I/O 口上；动态扫描靠定时刷新
  '8.2': { prerequisites: ['2.3', '5.3'], appliedIn: ['exp05'], reasons: { '2.3': '行列线是 I/O', '5.3': '按键可用外部中断响应' } }, // 行列线是 I/O；按键可用外部中断响应
  '8.3': { prerequisites: ['2.3', '2.6'], reasons: { '2.3': '并行 AD/DA 的数据口是 I/O', '2.6': '典型接法经三总线扩展' } },                // 并行 AD/DA 的数据口是 I/O；典型接法经三总线扩展
  '8.4': { prerequisites: ['8.3', '6.3'], appliedIn: ['proj03'], reasons: { '8.3': '模拟型传感器经 AD 采集', '6.3': '单总线协议靠微秒级延时' } }, // 模拟型传感器经 AD 采集；单总线协议靠微秒级延时；项目三红外传感器
  '8.5': { prerequisites: ['2.3.5', '6.3'], reasons: { '2.3.5': 'I/O 灌电流不足必须外加驱动', '6.3': '调速本质是 PWM/脉冲频率' } },              // I/O 灌电流不足必须外加驱动；调速本质是 PWM/脉冲频率
  '8.1.1': { appliedIn: ['exp04', 'proj01'] },             // 实验四"7段数码管结构"、项目一"数码管段选与位选"
  '8.1.2': { prerequisites: ['8.1.1', '6.3.1'], appliedIn: ['exp04'], reasons: { '8.1.1': '动态扫描建立在数码管段码/驱动电路认知之上', '6.3.1': '动态扫描 = 逐位点亮 + 每位停留 1-2ms 的定时' } }, // 动态扫描 = 逐位点亮 + 每位停留 1-2ms 的定时
  '8.1.3': { appliedIn: ['proj02'] },                      // 项目二已使用 LCD1602；proj04 的 UPDATE_LCD 仍为空接口，不记为已应用
  '8.1.4': { prerequisites: ['8.1.3'], reasons: { '8.1.3': '12864 在 1602 的指令集思路上扩展图形显示' } },                   // 12864 在 1602 的指令集思路上扩展图形显示
  '8.1.5': { prerequisites: ['8.1.2'], reasons: { '8.1.2': '点阵行列扫描与数码管动态扫描是同一思路' } },                   // 点阵行列扫描与数码管动态扫描同一思路（叠加原有 2.3.2）
  '8.2.2': { prerequisites: ['8.2.1'], reasons: { '8.2.1': '先懂单键的电平检测，再上行列扫描' } },                   // 先懂单键的电平检测，再上行列扫描（叠加原有 2.3）
  '8.2.3': { prerequisites: ['8.2.1', '4.5.1'], appliedIn: ['exp05'], reasons: { '8.2.1': '抖动是机械按键的物理特性，需先认识按键电平检测', '4.5.1': '软件消抖=延时再确认，要用到延时函数设计' } }, // 抖动是机械按键的物理特性；软件消抖=延时再确认
  '8.3.1': { appliedIn: ['proj02'] },                      // 项目二"ADC0809工作原理与时序"
  '8.3.3': { prerequisites: ['8.3.1'], appliedIn: ['proj02'], reasons: { '8.3.1': '模拟量采集应用以 ADC0809 接口原理为硬件基础' } }, // 模拟量采集应用以 ADC 接口为硬件基础；项目二"阈值比较与自动控制"
  '8.3.4': { prerequisites: ['8.3.1'], reasons: { '8.3.1': '分辨率/采样率是 ADC 器件的固有指标' } },                   // 分辨率/采样率是 ADC 器件的固有指标
  '8.4.1': { prerequisites: ['6.3.1'], appliedIn: ['proj04'], reasons: { '6.3.1': 'DS18B20 单总线时序要求微秒级精确延时' } }, // DS18B20 单总线时序要求微秒级精确延时；项目四实操
  '8.4.2': { prerequisites: ['8.4.1'], appliedIn: ['proj04'], reasons: { '8.4.1': 'DHT11 同为单总线时序，读法与 DS18B20 类比' } }, // DHT11 同为单总线时序，读法与 DS18B20 类比
  '8.4.3': { prerequisites: ['8.3.1'], appliedIn: ['proj02'], reasons: { '8.3.1': '光敏电阻分压后经 AD 采集' } }, // 光敏电阻分压后经 AD 采集；项目二"光敏电阻特性与应用"
  '8.4.4': { prerequisites: ['6.4.4'], reasons: { '6.4.4': '超声波回波测宽用门控方式测脉冲宽度' } },                   // 超声波回波测宽用门控方式测脉冲宽度
  '8.5.1': { prerequisites: ['6.3.3'], appliedIn: ['proj03'], reasons: { '6.3.3': '直流电机调速靠 PWM' } }, // 直流电机调速靠 PWM；项目三"L298N电机驱动原理"
  '8.5.2': { prerequisites: ['6.3.1'], appliedIn: ['exp08'], reasons: { '6.3.1': '步进电机转速由相序节拍间隔（延时）决定' } }, // 步进电机转速由相序节拍间隔（延时）决定；实验八实操
  '8.5.3': { prerequisites: ['6.3.3'], reasons: { '6.3.3': '舵机角度由 PWM 脉宽决定' } },                   // 舵机角度由 PWM 脉宽决定
  '8.6': { prerequisites: ['2.3.5', '6.3'], appliedIn: ['exp07', 'proj04'], reasons: { '2.3.5': '蜂鸣器电流超出 I/O 灌电流须三极管驱动', '6.3': '音调=定时器方波频率、节拍=定时时长' } }, // 蜂鸣器电流超出 I/O 灌电流须三极管驱动；音调=定时器方波频率、节拍=定时时长；实验七整实验、项目四"阈值比较与蜂鸣器报警"
  '8.6.1': { prerequisites: ['6.3.2'], appliedIn: ['exp07'], reasons: { '6.3.2': '无源蜂鸣器音高由定时器方波频率决定，有源蜂鸣器只需通断控制' } }, // 无源蜂鸣器音高由定时器方波频率决定，有源蜂鸣器只需通断控制；实验七对比两类蜂鸣器

  // —— 第9章 系统设计：方法论建立在最小系统与模块化编程之上，
  //    调试手段来自 Keil（4.1）与硬件仪器；文档沉淀设计与调试结论。——
  '9.1': { prerequisites: ['1.4', '4.6'], reasons: { '1.4': '一切方案从最小系统起步', '4.6': '模块化思想从编程规范延伸到系统级设计' } },                // 一切方案从最小系统起步；模块化思想延伸到系统级
  '9.2': { prerequisites: ['9.1'], reasons: { '9.1': '原理图与方案确定后才进入 PCB 布局布线' } },                       // 原理图与方案确定后才进入 PCB 布局布线
  '9.3': { prerequisites: ['9.1', '4.1'], reasons: { '9.1': '调试对照的是设计阶段定下的指标', '4.1': '软件调试手段来自 Keil' } },                // 调试对照的是设计指标；软件调试手段来自 Keil
  '9.4': { prerequisites: ['9.3'], reasons: { '9.3': '文档沉淀设计与调试的结论' } },                       // 文档沉淀设计与调试的结论
  '9.1.2': { prerequisites: ['9.1.1'], reasons: { '9.1.1': '需求边界决定方案取舍' } },                   // 需求边界决定方案取舍
  '9.1.3': { prerequisites: ['9.1.2'], reasons: { '9.1.2': '硬件设计按选定方案展开' } },                   // 硬件设计按选定方案展开
  '9.1.4': { prerequisites: ['9.1.2'], reasons: { '9.1.2': '软件流程图同样从方案分解而来' } },                   // 软件流程图同样从方案分解而来
  '9.2.4': { prerequisites: ['9.2.2'], reasons: { '9.2.2': 'DRC 检查的对象是布局布线结果' } },                   // DRC 检查的对象是布局布线结果
  '9.3.3': { prerequisites: ['9.3.1', '9.3.2'], appliedIn: ['proj02', 'proj03'], reasons: { '9.3.1': '联合调试前要先分别过硬件关', '9.3.2': '联合调试前要先分别过软件关' } }, // 先分别过硬件/软件关再联调；两项目"系统集成/综合调试"
  '9.3.4': { appliedIn: ['proj04'] },                      // 项目四"系统可靠性设计"（稳定性测试）

  // —— 第10章 前沿应用：WiFi/蓝牙模块靠串口 AT 指令驱动（依赖第7章），
  //    传感数据是物联网源头（依赖第8章），架构对比回到第2/3章。——
  '10.1': { prerequisites: ['7.3', '8.4'], reasons: { '7.3': '无线模块（WiFi/蓝牙）靠串口驱动', '8.4': '传感数据是物联网应用的源头' } },               // 无线模块靠串口驱动；传感数据是物联网的源头
  '10.2': { prerequisites: ['10.1'], reasons: { '10.1': '边缘智能建立在联网设备与数据采集之上' } },                     // 边缘智能建立在联网设备与数据采集之上
  '10.3': { prerequisites: ['2.1', '3.1'], reasons: { '2.1': '对比对象之一是 8051 的 CPU 架构', '3.1': '对比对象之一是 8051 的指令集（寻址方式）' } },               // 对比对象是 8051 的 CPU 架构与指令集
  '10.4': { prerequisites: ['10.1', '10.2'], reasons: { '10.1': 'AIoT = 物联网', '10.2': 'AIoT = 物联网与人工智能（边缘智能）的交汇' } },             // AIoT = 物联网与人工智能的交汇
  '10.1.1': { prerequisites: ['7.3.1'], reasons: { '7.3.1': 'ESP8266 的 AT 指令经串口收发' } },                  // ESP8266 的 AT 指令经串口收发
  '10.1.2': { prerequisites: ['7.3.1'], appliedIn: ['proj03'], reasons: { '7.3.1': 'HC-05 蓝牙透传同样走串口' } }, // HC-05 蓝牙透传同样走串口；项目三"蓝牙串口通信"
  '10.1.4': { prerequisites: ['10.1.1'], reasons: { '10.1.1': '先联上网，再谈应用层的发布/订阅协议' } },                 // 先联上网，再谈应用层的发布/订阅协议
  '10.3.3': { prerequisites: ['10.3.1'], reasons: { '10.3.1': '对比之前先认识 RISC-V 本身' } },                 // 对比之前先认识 RISC-V 本身
};

// 将关系表并入主数组（模块加载时执行一次；与节点上已有的内联关系去重合并）。
function mergeUnique(base: string[] | undefined, extra: string[] | undefined): string[] | undefined {
  if (!extra || extra.length === 0) return base;
  const merged = [...(base || [])];
  for (const item of extra) {
    if (!merged.includes(item)) merged.push(item);
  }
  return merged;
}

for (const point of knowledgePoints) {
  const patch = relationPatches[point.id];
  if (!patch) continue;
  const prerequisites = mergeUnique(point.prerequisites, patch.prerequisites);
  const appliedIn = mergeUnique(point.appliedIn, patch.appliedIn);
  if (prerequisites) point.prerequisites = prerequisites;
  if (appliedIn) point.appliedIn = appliedIn;
}

/**
 * Why is `prereqId` a prerequisite of `pointId`? Returns a one-sentence,
 * mechanism-specific course-logic reason if one has been authored, or
 * undefined if none exists (never fabricate a reason at the call site).
 *
 * Resolves both data sources transparently so UI code never needs to know
 * where a given point's prerequisites were declared:
 *   1. relationPatches[pointId].reasons[prereqId]      (203 edges, chapters 1-10)
 *   2. knowledgePoints[pointId].prerequisiteReasons[prereqId]  (inline nodes, e.g. '4', '8.2.2')
 */
export function getPrerequisiteReason(pointId: string, prereqId: string): string | undefined {
  const fromPatch = relationPatches[pointId]?.reasons?.[prereqId];
  if (fromPatch) return fromPatch;
  const point = getPointById(pointId);
  return point?.prerequisiteReasons?.[prereqId];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all knowledge points belonging to a specific chapter.
 */
export function getPointsByChapter(chapter: number): KnowledgePoint[] {
  return knowledgePoints.filter((p) => p.chapter === chapter);
}

/**
 * Get all knowledge points at a specific hierarchy level.
 */
export function getPointsByLevel(level: 1 | 2 | 3): KnowledgePoint[] {
  return knowledgePoints.filter((p) => p.level === level);
}

/**
 * Get all direct child points of a given parent.
 */
export function getChildPoints(parentId: string): KnowledgePoint[] {
  return knowledgePoints.filter((p) => p.parentId === parentId);
}

/**
 * Get a single knowledge point by its ID.
 */
export function getPointById(id: string): KnowledgePoint | undefined {
  return knowledgePoints.find((p) => p.id === id);
}

// ============================================================================
// Resource Helper Functions
// ============================================================================

/**
 * Get all knowledge points that have resource links attached.
 */
export function getPointsWithResources(): KnowledgePoint[] {
  return knowledgePoints.filter((p) => p.resources && p.resources.length > 0);
}

/**
 * Get all resources associated with a specific chapter,
 * aggregated from all knowledge points in that chapter (deduplicated by refId/url).
 */
export function getResourcesByChapter(chapter: number): KnowledgePointResource[] {
  const seen = new Set<string>();
  const results: KnowledgePointResource[] = [];

  for (const point of knowledgePoints) {
    if (point.chapter !== chapter || !point.resources) continue;
    for (const res of point.resources) {
      const key = res.refId ?? res.url ?? `${res.type}:${res.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(res);
      }
    }
  }

  return results;
}

// ============================================================================
// Statistics
// ============================================================================

export const knowledgePointStats = {
  total: knowledgePoints.length,
  level1: getPointsByLevel(1).length,
  level2: getPointsByLevel(2).length,
  level3: getPointsByLevel(3).length,
} as const;

// 关系网统计：依赖边总数 / 跨章依赖边数 / 实验关联条数（节点×实验去重后）。
// 供图谱页统计面板与关系可视化图例展示，口径与上方关系表一致。
export const knowledgeRelationStats = (() => {
  const byId = new Map(knowledgePoints.map((p) => [p.id, p]));
  let prerequisiteEdges = 0;
  let crossChapterEdges = 0;
  const experimentLinks = new Set<string>();
  for (const point of knowledgePoints) {
    for (const pre of point.prerequisites || []) {
      const source = byId.get(pre);
      if (!source) continue;
      prerequisiteEdges += 1;
      if (source.chapter !== point.chapter) crossChapterEdges += 1;
    }
    for (const refId of point.appliedIn || []) {
      experimentLinks.add(`${point.id}->${refId}`);
    }
  }
  return { prerequisiteEdges, crossChapterEdges, experimentLinks: experimentLinks.size };
})();
