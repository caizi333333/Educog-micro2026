// ============================================================================
// 微控制器应用技术 - 270个知识点三层级清单
// 基于89C51系列单片机课程体系构建
// 10个一级知识点 + ~50个二级知识点 + ~210个三级知识点
// ============================================================================

export interface KnowledgePointResource {
  type: 'video' | 'animation' | 'slide' | 'quiz' | 'document' | 'experiment';
  title: string;
  url?: string;          // For verified course videos or public documents
  refId?: string;        // For quizzes (quiz question ID) or experiments (exp01 etc)
  duration?: number;     // minutes
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
}

export const knowledgePoints: KnowledgePoint[] = [
  // ========================================================================
  // 一级知识点1：单片机概述（4学时）
  // ========================================================================
  { id: '1', name: '单片机概述', level: 1, chapter: 1, description: '单片机基本概念、发展历史、分类选型与开发环境', graphNodeId: 'mcu', resources: [
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
  { id: '2', name: '硬件结构', level: 1, chapter: 2, description: 'CPU结构、存储器、I/O接口、时钟时序与总线系统', graphNodeId: 'cpu', resources: [
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
  { id: '2.3.2', name: 'P1口结构与特性', level: 3, parentId: '2.3', chapter: 2, description: '准双向口结构、内部上拉电阻、通用I/O口' },
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

  // ========================================================================
  // 一级知识点3：指令系统（4学时）
  // ========================================================================
  { id: '3', name: '指令系统', level: 1, chapter: 3, description: '寻址方式、数据传送、算术逻辑运算、控制转移与位操作指令', graphNodeId: 'addressing_modes', resources: [
    { type: 'slide', title: '第3章 指令系统 课件PPT', refId: 'ch03-ppt' },
    { type: 'quiz', title: '第3章 单元测验', refId: 'quiz-ch3' },
    { type: 'experiment', title: '实验二：指令系统实验', refId: 'exp02', duration: 90 },
  ] },

  { id: '3.1', name: '寻址方式', level: 2, parentId: '3', chapter: 3, description: '89C51支持的7种寻址方式', graphNodeId: 'addressing_modes', resources: [
    { type: 'slide', title: '3.1 寻址方式 课件', refId: 'ch03-ppt-s1' },
    { type: 'animation', title: '7种寻址方式对比动画', refId: 'anim-addressing-modes' },
    { type: 'quiz', title: '寻址方式 练习题', refId: 'quiz-ch3-addressing' },
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
  { id: '4', name: 'C语言编程', level: 1, chapter: 4, description: 'Keil C51开发环境、数据类型、控制结构与编程规范', resources: [
    { type: 'slide', title: '第4章 C语言编程 课件PPT', refId: 'ch04-ppt' },
    { type: 'quiz', title: '第4章 单元测验', refId: 'quiz-ch4' },
    { type: 'experiment', title: '实验一：基础LED控制实验', refId: 'exp01', duration: 90 },
    { type: 'document', title: 'Keil C51编程快速参考手册', refId: 'doc-c51-reference' },
  ] },

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
  { id: '5', name: '中断系统', level: 1, chapter: 5, description: '中断概念、89C51中断源、外部中断、中断嵌套与应用', graphNodeId: 'interrupts', resources: [
    { type: 'slide', title: '第5章 中断系统 课件PPT', refId: 'ch05-ppt' },
    { type: 'quiz', title: '第5章 单元测验', refId: 'quiz-ch5' },
    { type: 'experiment', title: '实验五：按键输入与消抖处理', refId: 'exp05', duration: 90 },
    { type: 'experiment', title: '实验六：定时器中断与计时功能', refId: 'exp06', duration: 120 },
  ] },

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
  { id: '6', name: '定时器/计数器', level: 1, chapter: 6, description: '定时器/计数器的原理、工作模式与应用', graphNodeId: 'timers', resources: [
    { type: 'slide', title: '第6章 定时器/计数器 课件PPT', refId: 'ch06-ppt' },
    { type: 'quiz', title: '第6章 单元测验', refId: 'quiz-ch6' },
    { type: 'experiment', title: '实验三：定时/计数器实验', refId: 'exp03', duration: 90 },
    { type: 'experiment', title: '实验六：定时器中断与计时功能', refId: 'exp06', duration: 120 },
  ] },

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
  { id: '7', name: '串行通信', level: 1, chapter: 7, description: '通信基础知识、89C51串口与常用通信协议', graphNodeId: 'uart', resources: [
    { type: 'slide', title: '第7章 串行通信 课件PPT', refId: 'ch07-ppt' },
    { type: 'quiz', title: '第7章 单元测验', refId: 'quiz-ch7' },
    { type: 'experiment', title: '实验九：串口通信实验', refId: 'exp09', duration: 90 },
  ] },

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
  { id: '8', name: '接口技术', level: 1, chapter: 8, description: '显示、键盘、AD/DA、传感器与电机驱动接口', graphNodeId: 'io', resources: [
    { type: 'slide', title: '第8章 接口技术 课件PPT', refId: 'ch08-ppt' },
    { type: 'quiz', title: '第8章 单元测验', refId: 'quiz-ch8' },
    { type: 'experiment', title: '实验四：数码管显示实验', refId: 'exp04', duration: 90 },
    { type: 'experiment', title: '实验八：步进电机控制实验', refId: 'exp08', duration: 120 },
  ] },

  { id: '8.1', name: '显示接口', level: 2, parentId: '8', chapter: 8, description: 'LED数码管和LCD液晶显示器的驱动方法', resources: [
    { type: 'slide', title: '8.1 显示接口 课件', refId: 'ch08-ppt-s1' },
    { type: 'experiment', title: '实验四：数码管显示实验', refId: 'exp04', duration: 90 },
    { type: 'animation', title: '数码管动态扫描显示原理动画', refId: 'anim-7seg-scan' },
  ] },
  { id: '8.1.1', name: 'LED数码管（共阴/共阳）', level: 3, parentId: '8.1', chapter: 8, description: '七段数码管的结构、段码表与驱动电路' },
  { id: '8.1.2', name: '动态显示与静态显示', level: 3, parentId: '8.1', chapter: 8, description: '静态锁存显示和动态扫描显示的原理与比较' },
  { id: '8.1.3', name: 'LCD1602驱动', level: 3, parentId: '8.1', chapter: 8, description: 'LCD1602字符液晶的接口连接与指令集编程' },
  { id: '8.1.4', name: 'LCD12864驱动', level: 3, parentId: '8.1', chapter: 8, description: 'LCD12864图形液晶的初始化与图文显示编程' },
  { id: '8.1.5', name: 'LED点阵显示', level: 3, parentId: '8.1', chapter: 8, description: '8x8 LED点阵的行列扫描驱动与字符显示' },

  { id: '8.2', name: '键盘接口', level: 2, parentId: '8', chapter: 8, description: '按键输入的硬件连接与软件处理', resources: [
    { type: 'slide', title: '8.2 键盘接口 课件', refId: 'ch08-ppt-s2' },
    { type: 'experiment', title: '实验五：按键输入与消抖处理', refId: 'exp05', duration: 90 },
    { type: 'animation', title: '矩阵键盘扫描原理动画', refId: 'anim-matrix-keypad' },
  ] },
  { id: '8.2.1', name: '独立按键', level: 3, parentId: '8.2', chapter: 8, description: '独立按键的连接方式与电平检测方法' },
  { id: '8.2.2', name: '矩阵键盘', level: 3, parentId: '8.2', chapter: 8, description: '4x4矩阵键盘的行列扫描法与反转法' },
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
    { type: 'experiment', title: '项目四：智慧农业大棚监控系统设计', refId: 'proj04', duration: 180 },
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

  // ========================================================================
  // 一级知识点9：系统设计（项目实践）
  // ========================================================================
  { id: '9', name: '系统设计', level: 1, chapter: 9, description: '单片机系统的设计方法、PCB设计与调试测试', resources: [
    { type: 'slide', title: '第9章 系统设计 课件PPT', refId: 'ch09-ppt' },
    { type: 'quiz', title: '第9章 单元测验', refId: 'quiz-ch9' },
    { type: 'experiment', title: '项目二：智慧路灯系统设计', refId: 'proj02', duration: 180 },
    { type: 'experiment', title: '项目三：智能小车运动控制系统设计', refId: 'proj03', duration: 180 },
    { type: 'experiment', title: '项目四：智慧农业大棚监控系统设计', refId: 'proj04', duration: 180 },
  ] },

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
    { type: 'document', title: '技术报告写作规范模板', refId: 'doc-report-template' },
  ] },
  { id: '9.4.1', name: '技术报告撰写', level: 3, parentId: '9.4', chapter: 9, description: '技术报告的结构、内容要求与排版规范' },
  { id: '9.4.2', name: '项目答辩要求', level: 3, parentId: '9.4', chapter: 9, description: '答辩流程、PPT制作与现场演示注意事项' },
  { id: '9.4.3', name: '版本管理与协作', level: 3, parentId: '9.4', chapter: 9, description: '代码版本控制与团队协作开发的基本方法' },

  // ========================================================================
  // 一级知识点10：前沿应用（2学时）
  // ========================================================================
  { id: '10', name: '前沿应用', level: 1, chapter: 10, description: '物联网、人工智能、RISC-V与AIoT等前沿技术', resources: [
    { type: 'slide', title: '第10章 前沿应用 课件PPT', refId: 'ch10-ppt' },
    { type: 'quiz', title: '第10章 单元测验', refId: 'quiz-ch10' },
    { type: 'document', title: '物联网与AIoT前沿技术综述', refId: 'doc-aiot-overview' },
  ] },

  { id: '10.1', name: '物联网应用', level: 2, parentId: '10', chapter: 10, description: '单片机与无线通信模块的物联网应用', resources: [
    { type: 'slide', title: '10.1 物联网应用 课件', refId: 'ch10-ppt-s1' },
    { type: 'experiment', title: '项目四：智慧农业大棚监控系统设计', refId: 'proj04', duration: 180 },
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
];

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
