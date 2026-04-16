// ============================================================================
// 微控制器应用技术 - 问题图谱 (Problem Graph)
// 基于89C51系列单片机课程体系构建
// 4个一级分类 + ~40个二级问题域 + ~160个三级具体问题
// ============================================================================

export interface ProblemNode {
  id: string;           // e.g. 'P1', 'P1.1', 'P1.1.1'
  name: string;
  level: 1 | 2 | 3;
  parentId?: string;
  category: 'concept' | 'coding' | 'experiment' | 'project';
  relatedKnowledgePoints: string[];  // Links to knowledge-points.ts IDs
  difficulty: 'easy' | 'medium' | 'hard';
  description?: string;
  solution?: string;     // Brief solution hint
  commonMistakes?: string[];
}

export const problemGraph: ProblemNode[] = [
  // ========================================================================
  // P1: 概念理解问题 (Concept Understanding Problems)
  // ========================================================================
  {
    id: 'P1', name: '概念理解问题', level: 1, category: 'concept',
    relatedKnowledgePoints: [],
    difficulty: 'medium',
    description: '对单片机体系结构、存储器、寄存器、寻址方式等基础概念的理解偏差与混淆',
  },

  // ---------- P1.1 存储器结构混淆 ----------
  {
    id: 'P1.1', name: '存储器结构混淆', level: 2, parentId: 'P1', category: 'concept',
    relatedKnowledgePoints: ['2.2'],
    difficulty: 'medium',
    description: '对程序存储器与数据存储器的地址空间、访问方式产生混淆',
  },
  {
    id: 'P1.1.1', name: '混淆ROM和RAM的地址空间', level: 3, parentId: 'P1.1', category: 'concept',
    relatedKnowledgePoints: ['2.2.1', '2.2.2'],
    difficulty: 'easy',
    description: '将程序存储器(ROM)和数据存储器(RAM)的地址空间混为一谈',
    solution: '明确哈佛结构：程序存储器和数据存储器各自独立编址，使用不同的访问指令(MOVC vs MOVX)',
    commonMistakes: ['认为ROM和RAM共享地址空间', '用MOVX指令访问内部ROM'],
  },
  {
    id: 'P1.1.2', name: '内部RAM分区不清', level: 3, parentId: 'P1.1', category: 'concept',
    relatedKnowledgePoints: ['2.2.2', '2.2.4'],
    difficulty: 'medium',
    description: '不理解内部RAM 128字节的四个分区及其用途',
    solution: '牢记分区：00H-1FH工作寄存器区(4组)、20H-2FH位寻址区、30H-7FH通用数据区、80H-FFH SFR区',
    commonMistakes: ['在位寻址区存放普通数据导致位操作冲突', '混淆直接地址和位地址'],
  },
  {
    id: 'P1.1.3', name: '外部存储器扩展地址译码错误', level: 3, parentId: 'P1.1', category: 'concept',
    relatedKnowledgePoints: ['2.2.5'],
    difficulty: 'hard',
    description: '对外部ROM/RAM扩展时的地址译码方法理解不正确',
    solution: '理解P0口作低8位数据/地址总线、P2口作高8位地址总线的分时复用机制，使用ALE锁存低地址',
    commonMistakes: ['忘记ALE信号锁存地址', '地址译码芯片选择不当'],
  },
  {
    id: 'P1.1.4', name: 'SFR与普通RAM混淆', level: 3, parentId: 'P1.1', category: 'concept',
    relatedKnowledgePoints: ['2.2.3'],
    difficulty: 'medium',
    description: '将特殊功能寄存器(SFR)当作普通RAM使用或不了解SFR的位寻址能力',
    solution: 'SFR位于80H-FFH，只能用直接寻址方式访问；地址能被8整除的SFR可位寻址',
    commonMistakes: ['用间接寻址(Ri)访问SFR', '对非位寻址SFR进行位操作'],
  },

  // ---------- P1.2 寻址方式混淆 ----------
  {
    id: 'P1.2', name: '寻址方式混淆', level: 2, parentId: 'P1', category: 'concept',
    relatedKnowledgePoints: ['3.1'],
    difficulty: 'medium',
    description: '对7种寻址方式的适用范围、操作数位置产生混淆',
  },
  {
    id: 'P1.2.1', name: '直接寻址与间接寻址混淆', level: 3, parentId: 'P1.2', category: 'concept',
    relatedKnowledgePoints: ['3.1.2', '3.1.3'],
    difficulty: 'easy',
    description: '不能区分MOV A, 30H（直接寻址）和MOV A, @R0（间接寻址）的本质区别',
    solution: '直接寻址的地址在指令中直接给出；间接寻址通过寄存器R0/R1间接提供地址',
    commonMistakes: ['直接寻址与立即寻址符号#混淆', '间接寻址忘记@符号'],
  },
  {
    id: 'P1.2.2', name: '立即寻址符号遗漏', level: 3, parentId: 'P1.2', category: 'concept',
    relatedKnowledgePoints: ['3.1.1'],
    difficulty: 'easy',
    description: '立即数前忘记加#号，导致变成直接寻址',
    solution: 'MOV A, #30H将立即数30H送入A；MOV A, 30H将地址30H的内容送入A。#号不可省略',
    commonMistakes: ['MOV A, 0FFH（应为MOV A, #0FFH）', '将立即数当作地址使用'],
  },
  {
    id: 'P1.2.3', name: '变址寻址理解困难', level: 3, parentId: 'P1.2', category: 'concept',
    relatedKnowledgePoints: ['3.1.5'],
    difficulty: 'medium',
    description: '不理解MOVC A, @A+DPTR的变址寻址机制',
    solution: '变址寻址用于查表操作：基址(DPTR/PC) + 偏移量(A) = 实际地址，常用于查表指令',
    commonMistakes: ['混淆MOVC和MOVX', '忘记DPTR需预先赋值'],
  },
  {
    id: 'P1.2.4', name: '位寻址范围不清', level: 3, parentId: 'P1.2', category: 'concept',
    relatedKnowledgePoints: ['3.1.6', '2.2.4'],
    difficulty: 'medium',
    description: '不清楚哪些区域支持位寻址操作',
    solution: '两个位寻址区域：内部RAM 20H-2FH(位地址00H-7FH)和部分SFR(地址能被8整除的)',
    commonMistakes: ['对通用RAM区进行位操作', '位地址和字节地址混淆'],
  },

  // ---------- P1.3 中断系统理解偏差 ----------
  {
    id: 'P1.3', name: '中断系统理解偏差', level: 2, parentId: 'P1', category: 'concept',
    relatedKnowledgePoints: ['5'],
    difficulty: 'hard',
    description: '对中断源、优先级、响应过程等概念存在理解偏差',
  },
  {
    id: 'P1.3.1', name: '中断优先级误解', level: 3, parentId: 'P1.3', category: 'concept',
    relatedKnowledgePoints: ['5.2', '5.2.3'],
    difficulty: 'medium',
    description: '混淆自然优先级和设置优先级（IP寄存器）的关系',
    solution: 'IP寄存器设置高/低两级优先级；同级中断按自然优先级(INT0>T0>INT1>T1>串口)排列',
    commonMistakes: ['认为自然优先级可以完全自定义', '高优先级中断不能嵌套低优先级中断的误解'],
  },
  {
    id: 'P1.3.2', name: '中断响应条件不清', level: 3, parentId: 'P1.3', category: 'concept',
    relatedKnowledgePoints: ['5.3', '5.3.1'],
    difficulty: 'medium',
    description: '不清楚中断响应需要满足的全部条件',
    solution: '三个条件：①中断源有请求(标志位置1)；②对应中断使能(IE中EA和各位)；③无同级或更高级中断在服务',
    commonMistakes: ['忘记开总中断EA', '未清除中断标志位导致重复响应'],
  },
  {
    id: 'P1.3.3', name: '外部中断触发方式混淆', level: 3, parentId: 'P1.3', category: 'concept',
    relatedKnowledgePoints: ['5.1.1', '5.1.2'],
    difficulty: 'easy',
    description: '不理解电平触发和边沿触发的区别及TCON中IT0/IT1的设置',
    solution: 'IT0/IT1=0为低电平触发（需保持到响应）；=1为下降沿触发（自动清标志位）',
    commonMistakes: ['电平触发时未及时撤除低电平导致重复进入', '边沿触发信号宽度不够'],
  },
  {
    id: 'P1.3.4', name: '中断向量地址记忆错误', level: 3, parentId: 'P1.3', category: 'concept',
    relatedKnowledgePoints: ['5.3.2'],
    difficulty: 'easy',
    description: '记错5个中断源对应的向量地址',
    solution: '从0003H开始，每隔8字节：INT0=0003H, T0=000BH, INT1=0013H, T1=001BH, 串口=0023H',
    commonMistakes: ['将向量地址间隔记为4字节', '混淆各中断源的向量地址'],
  },

  // ---------- P1.4 定时器/计数器模式混淆 ----------
  {
    id: 'P1.4', name: '定时器/计数器模式混淆', level: 2, parentId: 'P1', category: 'concept',
    relatedKnowledgePoints: ['6'],
    difficulty: 'medium',
    description: '对定时器的4种工作模式及TMOD/TCON寄存器配置存在困惑',
  },
  {
    id: 'P1.4.1', name: '模式0/1/2/3区别不清', level: 3, parentId: 'P1.4', category: 'concept',
    relatedKnowledgePoints: ['6.2.1', '6.2.2', '6.2.3', '6.2.4'],
    difficulty: 'medium',
    description: '不理解四种工作模式的计数器位数和特点',
    solution: '模式0: 13位；模式1: 16位；模式2: 8位自动重装；模式3: T0拆分为两个8位计数器',
    commonMistakes: ['模式0按16位计算初值', '模式2忘记设置TH的自动重装值'],
  },
  {
    id: 'P1.4.2', name: '定时与计数模式混淆', level: 3, parentId: 'P1.4', category: 'concept',
    relatedKnowledgePoints: ['6.1'],
    difficulty: 'easy',
    description: '不理解C/T位的作用，混淆定时模式和计数模式',
    solution: 'C/T=0为定时模式(内部时钟12分频)；C/T=1为计数模式(外部脉冲T0/T1引脚)',
    commonMistakes: ['定时模式下试图从外部引脚输入信号', '计数模式下用机器周期计算时间'],
  },
  {
    id: 'P1.4.3', name: '初值计算错误', level: 3, parentId: 'P1.4', category: 'concept',
    relatedKnowledgePoints: ['6.3'],
    difficulty: 'medium',
    description: '定时器初值的计算方法不正确',
    solution: '初值 = 最大计数值 - 需要计数次数。如模式1: 初值 = 65536 - (定时时间/机器周期)',
    commonMistakes: ['忘记考虑12分频', '初值直接用定时时间除以周期而不取补'],
  },
  {
    id: 'P1.4.4', name: 'GATE位功能不理解', level: 3, parentId: 'P1.4', category: 'concept',
    relatedKnowledgePoints: ['6.1.2'],
    difficulty: 'hard',
    description: '不理解TMOD中GATE位对定时器启停的门控作用',
    solution: 'GATE=0时，仅由TR0/TR1控制启停；GATE=1时，需要TR=1且INTx=1才能运行，可测量脉宽',
    commonMistakes: ['GATE=1时忘记外部引脚也需要高电平', '不理解GATE用于脉宽测量的场景'],
  },

  // ---------- P1.5 串口通信概念模糊 ----------
  {
    id: 'P1.5', name: '串口通信概念模糊', level: 2, parentId: 'P1', category: 'concept',
    relatedKnowledgePoints: ['7'],
    difficulty: 'hard',
    description: '对串行通信的基本概念、波特率计算、SCON寄存器配置理解不足',
  },
  {
    id: 'P1.5.1', name: '波特率计算错误', level: 3, parentId: 'P1.5', category: 'concept',
    relatedKnowledgePoints: ['7.3'],
    difficulty: 'hard',
    description: '串口波特率与定时器T1初值的关系计算错误',
    solution: '方式1波特率 = (2^SMOD / 32) × (T1溢出率)。T1用模式2, 初值 = 256 - (fosc/(384×波特率))(SMOD=0)',
    commonMistakes: ['忘记SMOD倍频的影响', '晶振频率代入错误（11.0592MHz vs 12MHz）'],
  },
  {
    id: 'P1.5.2', name: '串口工作方式区别不清', level: 3, parentId: 'P1.5', category: 'concept',
    relatedKnowledgePoints: ['7.2'],
    difficulty: 'medium',
    description: '不理解串口4种工作方式(方式0-3)的数据格式和波特率特点',
    solution: '方式0: 同步移位，固定fosc/12；方式1: 8位UART可变波特率；方式2/3: 9位UART，方式2固定、方式3可变',
    commonMistakes: ['方式1和方式3混淆', '方式0当成标准UART使用'],
  },
  {
    id: 'P1.5.3', name: 'SBUF双缓冲概念不清', level: 3, parentId: 'P1.5', category: 'concept',
    relatedKnowledgePoints: ['7.1'],
    difficulty: 'medium',
    description: '不理解发送SBUF和接收SBUF是两个物理寄存器共用一个地址',
    solution: '写SBUF自动送发送缓冲区开始发送；读SBUF自动取接收缓冲区数据。地址相同但物理独立',
    commonMistakes: ['认为发送和接收会互相覆盖', '发送后立即读SBUF期望得到发送的数据'],
  },
  {
    id: 'P1.5.4', name: 'TI/RI标志位处理不当', level: 3, parentId: 'P1.5', category: 'concept',
    relatedKnowledgePoints: ['7.2', '7.4'],
    difficulty: 'easy',
    description: '不清楚TI和RI标志位需要软件清零',
    solution: 'TI(发送完成)和RI(接收完成)必须由软件清零，硬件只负责置位',
    commonMistakes: ['认为TI/RI会自动清零', '中断服务程序中忘记清标志位导致反复进入'],
  },

  // ---------- P1.6 指令系统理解不透 ----------
  {
    id: 'P1.6', name: '指令系统理解不透', level: 2, parentId: 'P1', category: 'concept',
    relatedKnowledgePoints: ['3'],
    difficulty: 'medium',
    description: '对指令的操作码、操作数、字节数和执行周期理解不够深入',
  },
  {
    id: 'P1.6.1', name: '数据传送指令使用范围不清', level: 3, parentId: 'P1.6', category: 'concept',
    relatedKnowledgePoints: ['3.2'],
    difficulty: 'easy',
    description: '不清楚MOV、MOVX、MOVC三条指令的适用存储空间',
    solution: 'MOV用于内部RAM/SFR；MOVX用于外部RAM；MOVC用于程序存储器(查表)',
    commonMistakes: ['用MOV访问外部RAM', '用MOVX读取程序存储器中的表格数据'],
  },
  {
    id: 'P1.6.2', name: '逻辑运算与算术运算混淆', level: 3, parentId: 'P1.6', category: 'concept',
    relatedKnowledgePoints: ['3.3', '3.4'],
    difficulty: 'easy',
    description: '不清楚ANL/ORL/XRL与ADD/SUBB/MUL/DIV对标志位的影响',
    solution: '算术运算影响CY、AC、OV标志位；逻辑运算(ANL/ORL/XRL)不影响任何标志位',
    commonMistakes: ['逻辑运算后检查CY标志', '忘记SUBB总是带借位减法'],
  },
  {
    id: 'P1.6.3', name: '条件转移指令判断条件错误', level: 3, parentId: 'P1.6', category: 'concept',
    relatedKnowledgePoints: ['3.5'],
    difficulty: 'medium',
    description: '不理解JZ/JNZ/JC/JNC/CJNE/DJNZ等条件转移指令的判断条件',
    solution: 'JZ/JNZ判断A是否为零；JC/JNC判断CY标志；CJNE比较不等则转移并影响CY；DJNZ减1不为零则转移',
    commonMistakes: ['CJNE不影响A的值但会修改CY', 'DJNZ对R或直接地址减1的适用范围'],
  },
  {
    id: 'P1.6.4', name: '子程序调用与返回机制不清', level: 3, parentId: 'P1.6', category: 'concept',
    relatedKnowledgePoints: ['3.5.3'],
    difficulty: 'medium',
    description: '不理解ACALL/LCALL的压栈操作和RET/RETI的出栈返回机制',
    solution: 'CALL指令自动将PC压入堆栈(低字节先入)；RET弹出PC返回；RETI还会清除中断优先级标志',
    commonMistakes: ['混淆RET和RETI', '堆栈空间不足导致返回地址被覆盖'],
  },

  // ---------- P1.7 总线与时序概念模糊 ----------
  {
    id: 'P1.7', name: '总线与时序概念模糊', level: 2, parentId: 'P1', category: 'concept',
    relatedKnowledgePoints: ['2.4', '2.5'],
    difficulty: 'hard',
    description: '对总线结构、时序分析、机器周期等概念理解不清',
  },
  {
    id: 'P1.7.1', name: '机器周期与指令周期概念混淆', level: 3, parentId: 'P1.7', category: 'concept',
    relatedKnowledgePoints: ['2.4.2'],
    difficulty: 'easy',
    description: '不区分振荡周期、机器周期(12个振荡周期)、指令周期(1-4个机器周期)',
    solution: '12MHz晶振：振荡周期=1/12us，机器周期=1us，指令周期=1-4us',
    commonMistakes: ['将机器周期等同于指令周期', '忘记12分频因子'],
  },
  {
    id: 'P1.7.2', name: '地址/数据总线分时复用不理解', level: 3, parentId: 'P1.7', category: 'concept',
    relatedKnowledgePoints: ['2.3.1', '2.5'],
    difficulty: 'hard',
    description: '不理解P0口在访问外部存储器时的地址/数据分时复用机制',
    solution: 'P0口先输出低8位地址(ALE下降沿锁存到74HC573)，然后切换为数据总线',
    commonMistakes: ['外部存储器扩展时忘记连接地址锁存器', 'ALE信号连接错误'],
  },
  {
    id: 'P1.7.3', name: '读写时序分析困难', level: 3, parentId: 'P1.7', category: 'concept',
    relatedKnowledgePoints: ['2.4.3'],
    difficulty: 'hard',
    description: '不能正确分析外部存储器读写操作的时序波形',
    solution: '掌握关键时序：ALE锁存地址→PSEN/RD/WR控制读写→数据在总线上稳定→采样数据',
    commonMistakes: ['建立时间和保持时间的概念不清', '混淆PSEN和RD信号的用途'],
  },

  // ---------- P1.8 数制与编码转换困惑 ----------
  {
    id: 'P1.8', name: '数制与编码转换困惑', level: 2, parentId: 'P1', category: 'concept',
    relatedKnowledgePoints: ['1.4', '3.3'],
    difficulty: 'easy',
    description: '在二进制、十六进制、BCD码之间的转换存在困惑',
  },
  {
    id: 'P1.8.1', name: 'BCD码与二进制混淆', level: 3, parentId: 'P1.8', category: 'concept',
    relatedKnowledgePoints: ['3.3.4'],
    difficulty: 'easy',
    description: '不理解压缩BCD码的表示方法和DA A(十进制调整)指令',
    solution: 'BCD码每4位表示一个十进制数(0-9)；加法后需用DA A指令进行十进制调整',
    commonMistakes: ['BCD码中出现A-F的非法值', '忘记加法后进行DA A调整'],
  },
  {
    id: 'P1.8.2', name: '补码运算理解困难', level: 3, parentId: 'P1.8', category: 'concept',
    relatedKnowledgePoints: ['3.3'],
    difficulty: 'medium',
    description: '不理解有符号数的补码表示和溢出判断',
    solution: '正数补码=原码；负数补码=反码+1。溢出标志OV判断有符号数运算是否溢出',
    commonMistakes: ['混淆进位CY和溢出OV', '负数补码计算错误'],
  },
  {
    id: 'P1.8.3', name: '十六进制数表示规范不清', level: 3, parentId: 'P1.8', category: 'concept',
    relatedKnowledgePoints: ['3.1'],
    difficulty: 'easy',
    description: '汇编语言中十六进制数的表示规范(后缀H、首位非字母加0)不熟悉',
    solution: '十六进制数加H后缀，首位为A-F时前面需补0，如0FFH而非FFH',
    commonMistakes: ['FFH不加前导0导致汇编错误', 'B后缀(二进制)和H后缀(十六进制)混淆'],
  },
  {
    id: 'P1.8.4', name: 'ASCII码与数值转换混淆', level: 3, parentId: 'P1.8', category: 'concept',
    relatedKnowledgePoints: ['3.2', '7.4'],
    difficulty: 'easy',
    description: '串口传输时数字的ASCII码与实际数值混淆，如字符"1"(0x31)和数值1(0x01)',
    solution: '数字字符ASCII = 数值 + 0x30。如数值5对应ASCII码0x35(字符"5")',
    commonMistakes: ['串口发送数值1但PC端收到的是不可见字符', '接收"9"后当作数值9参与运算'],
  },

  // ---------- P1.9 工作寄存器组切换概念不清 ----------
  {
    id: 'P1.9', name: '工作寄存器组切换概念不清', level: 2, parentId: 'P1', category: 'concept',
    relatedKnowledgePoints: ['2.2.2', '5.4'],
    difficulty: 'medium',
    description: '对4组工作寄存器(R0-R7)的切换机制和用途理解不清',
  },
  {
    id: 'P1.9.1', name: 'PSW中RS1/RS0设置方法不清', level: 3, parentId: 'P1.9', category: 'concept',
    relatedKnowledgePoints: ['2.2.3'],
    difficulty: 'easy',
    description: '不清楚如何通过PSW的RS1和RS0位选择当前工作寄存器组',
    solution: 'RS1:RS0 = 00/01/10/11 分别选择第0/1/2/3组工作寄存器，对应地址00H-07H/08H-0FH/10H-17H/18H-1FH',
    commonMistakes: ['中断中忘记切换寄存器组导致数据被覆盖', '切换后忘记恢复原寄存器组'],
  },
  {
    id: 'P1.9.2', name: '寄存器组在中断中的作用不理解', level: 3, parentId: 'P1.9', category: 'concept',
    relatedKnowledgePoints: ['5.4', '5.4.1'],
    difficulty: 'medium',
    description: '不理解为何中断服务程序中要切换工作寄存器组',
    solution: '中断中切换到不同寄存器组可避免压栈保护R0-R7，提高中断响应速度',
    commonMistakes: ['主程序和中断用同一组寄存器组导致数据丢失', '嵌套中断中寄存器组分配冲突'],
  },
  {
    id: 'P1.9.3', name: '堆栈指针SP初始化不当', level: 3, parentId: 'P1.9', category: 'concept',
    relatedKnowledgePoints: ['2.2.2'],
    difficulty: 'medium',
    description: '不理解SP的初始值为何设为07H以及何时需要重新设置SP',
    solution: 'SP默认07H，压栈从08H开始(第1组寄存器区)。若使用多组寄存器需将SP调高避免冲突',
    commonMistakes: ['SP不调整导致堆栈覆盖工作寄存器', 'SP设置过高导致堆栈空间不足'],
  },

  // ---------- P1.10 I/O端口特性混淆 ----------
  {
    id: 'P1.10', name: 'I/O端口特性混淆', level: 2, parentId: 'P1', category: 'concept',
    relatedKnowledgePoints: ['2.3'],
    difficulty: 'medium',
    description: '对P0-P3四个端口的电气特性和功能差异理解不够',
  },
  {
    id: 'P1.10.1', name: 'P0口开漏结构不理解', level: 3, parentId: 'P1.10', category: 'concept',
    relatedKnowledgePoints: ['2.3.1'],
    difficulty: 'medium',
    description: '不理解P0口为何需要外接上拉电阻才能正确输出高电平',
    solution: 'P0口内部无上拉电阻(开漏输出)，作通用I/O时必须外接上拉电阻(典型10K)',
    commonMistakes: ['P0口不加上拉电阻直接作I/O', '将P0口和P1口等同处理'],
  },
  {
    id: 'P1.10.2', name: 'P3口第二功能与通用I/O冲突', level: 3, parentId: 'P1.10', category: 'concept',
    relatedKnowledgePoints: ['2.3.4'],
    difficulty: 'easy',
    description: '不清楚P3口引脚用作第二功能(如串口RXD/TXD)时不能同时作为通用I/O',
    solution: 'P3口各位第二功能：P3.0=RXD, P3.1=TXD, P3.2=INT0, P3.3=INT1, P3.4=T0, P3.5=T1, P3.6=WR, P3.7=RD',
    commonMistakes: ['串口使用中将P3.0/P3.1作普通I/O驱动LED', '中断引脚P3.2/P3.3作输出'],
  },
  {
    id: 'P1.10.3', name: '读-修改-写指令对端口的影响', level: 3, parentId: 'P1.10', category: 'concept',
    relatedKnowledgePoints: ['2.3'],
    difficulty: 'hard',
    description: '不理解端口锁存器读与引脚读的区别及读-修改-写指令的特殊行为',
    solution: 'ANL/ORL/XRL/CPL等读-修改-写指令读取锁存器而非引脚，避免总线竞争导致误读',
    commonMistakes: ['快速连续操作端口时产生竞争条件', '不理解锁存器读和引脚读的区别'],
  },

  // ========================================================================
  // P2: 编程实现问题 (Programming Implementation Problems)
  // ========================================================================
  {
    id: 'P2', name: '编程实现问题', level: 1, category: 'coding',
    relatedKnowledgePoints: [],
    difficulty: 'medium',
    description: '使用C语言或汇编语言进行单片机编程时出现的语法、逻辑和效率问题',
  },

  // ---------- P2.1 C语言数据类型问题 ----------
  {
    id: 'P2.1', name: 'C语言数据类型问题', level: 2, parentId: 'P2', category: 'coding',
    relatedKnowledgePoints: ['4.1'],
    difficulty: 'medium',
    description: 'Keil C51中数据类型的选择和使用不当',
  },
  {
    id: 'P2.1.1', name: '数据类型溢出', level: 3, parentId: 'P2.1', category: 'coding',
    relatedKnowledgePoints: ['4.1'],
    difficulty: 'easy',
    description: '运算结果超出数据类型范围导致溢出',
    solution: '注意unsigned char范围0-255，unsigned int范围0-65535。大数运算使用unsigned long',
    commonMistakes: ['255+1结果变为0', '两个unsigned char相乘结果溢出'],
  },
  {
    id: 'P2.1.2', name: 'C51特有数据类型不熟悉', level: 3, parentId: 'P2.1', category: 'coding',
    relatedKnowledgePoints: ['4.1'],
    difficulty: 'medium',
    description: '不了解bit、sbit、sfr、sfr16等C51扩展数据类型',
    solution: 'bit定义位变量；sbit定义特殊功能寄存器位；sfr定义字节SFR；sfr16定义双字节SFR',
    commonMistakes: ['用int操作位变量', '忘记sfr定义的地址必须是常量'],
  },
  {
    id: 'P2.1.3', name: '存储器类型修饰符使用不当', level: 3, parentId: 'P2.1', category: 'coding',
    relatedKnowledgePoints: ['4.1', '2.2'],
    difficulty: 'hard',
    description: '不正确使用data、idata、xdata、code等存储类型关键字',
    solution: 'data: 直接寻址区(00-7FH); idata: 间接寻址区(00-FFH); xdata: 外部RAM; code: ROM',
    commonMistakes: ['大数组放在data区导致空间不足', '查找表忘记用code关键字放ROM'],
  },
  {
    id: 'P2.1.4', name: '指针使用错误', level: 3, parentId: 'P2.1', category: 'coding',
    relatedKnowledgePoints: ['4.1'],
    difficulty: 'hard',
    description: 'C51中通用指针(3字节)和特定存储器指针(1-2字节)的区别导致错误',
    solution: '通用指针(3字节)效率低；指定存储空间的指针(如data char *)效率高但只能访问特定区域',
    commonMistakes: ['通用指针开销大影响性能', '跨存储区指针赋值导致访问错误'],
  },

  // ---------- P2.2 中断服务程序编写不当 ----------
  {
    id: 'P2.2', name: '中断服务程序编写不当', level: 2, parentId: 'P2', category: 'coding',
    relatedKnowledgePoints: ['5.4'],
    difficulty: 'hard',
    description: '中断服务程序(ISR)的编写违反最佳实践或存在逻辑错误',
  },
  {
    id: 'P2.2.1', name: 'ISR中执行耗时操作', level: 3, parentId: 'P2.2', category: 'coding',
    relatedKnowledgePoints: ['5.4.1'],
    difficulty: 'medium',
    description: '在中断服务程序中进行延时、LCD显示等耗时操作',
    solution: '中断中只做标志置位和紧急处理，复杂逻辑放在主循环中根据标志执行',
    commonMistakes: ['ISR中调用delay函数', 'ISR中进行串口多字节发送'],
  },
  {
    id: 'P2.2.2', name: '中断号与中断源不匹配', level: 3, parentId: 'P2.2', category: 'coding',
    relatedKnowledgePoints: ['5.4'],
    difficulty: 'easy',
    description: 'interrupt关键字后的中断号写错导致进入错误的中断',
    solution: 'interrupt 0=INT0, 1=T0, 2=INT1, 3=T1, 4=串口。using指定寄存器组',
    commonMistakes: ['interrupt编号记错', '忘记using关键字导致寄存器未保护'],
  },
  {
    id: 'P2.2.3', name: '共享变量未用volatile修饰', level: 3, parentId: 'P2.2', category: 'coding',
    relatedKnowledgePoints: ['5.4', '4.1'],
    difficulty: 'hard',
    description: '主程序与ISR共享的变量未声明为volatile，编译器优化导致逻辑错误',
    solution: '凡是ISR中修改、主程序中读取(或反之)的变量都必须加volatile关键字',
    commonMistakes: ['主循环轮询标志位时被编译器优化掉', '多字节变量原子性问题'],
  },
  {
    id: 'P2.2.4', name: '中断嵌套导致堆栈溢出', level: 3, parentId: 'P2.2', category: 'coding',
    relatedKnowledgePoints: ['5.2.3', '2.2.2'],
    difficulty: 'hard',
    description: '多级中断嵌套时堆栈消耗过多导致溢出',
    solution: '限制中断嵌套层数；每层中断约消耗2字节(PC)+寄存器保护开销；合理设置SP初值',
    commonMistakes: ['未考虑最坏情况堆栈深度', '中断中又开中断导致无限嵌套'],
  },

  // ---------- P2.3 延时函数精度不足 ----------
  {
    id: 'P2.3', name: '延时函数精度不足', level: 2, parentId: 'P2', category: 'coding',
    relatedKnowledgePoints: ['4.2', '6'],
    difficulty: 'medium',
    description: '软件延时或定时器延时的精度达不到要求',
  },
  {
    id: 'P2.3.1', name: '软件延时循环不精确', level: 3, parentId: 'P2.3', category: 'coding',
    relatedKnowledgePoints: ['4.2'],
    difficulty: 'easy',
    description: '使用for循环延时时间不够精确，受编译器优化和指令周期影响',
    solution: '精确延时应使用定时器或汇编级_nop_()。软件延时需要反汇编确认实际周期数',
    commonMistakes: ['不同优化级别下延时时间不一致', '编译器将空循环优化掉'],
  },
  {
    id: 'P2.3.2', name: '定时器中断延时累积误差', level: 3, parentId: 'P2.3', category: 'coding',
    relatedKnowledgePoints: ['6.3'],
    difficulty: 'medium',
    description: '定时器中断方式定时时重装初值产生的累积误差',
    solution: '模式1需软件重装（有误差），模式2自动重装（无累积误差）。长定时用模式2+软件计数',
    commonMistakes: ['模式1重装初值时间导致定时偏长', '忘记先停定时器再赋值(非模式2)'],
  },
  {
    id: 'P2.3.3', name: '晶振频率对延时的影响不考虑', level: 3, parentId: 'P2.3', category: 'coding',
    relatedKnowledgePoints: ['2.4.1', '6.3'],
    difficulty: 'easy',
    description: '更换不同频率晶振后未调整延时参数',
    solution: '延时时间直接和晶振频率相关。更换晶振需重新计算定时器初值和软件延时参数',
    commonMistakes: ['12MHz的延时代码直接用在11.0592MHz系统上', '延时偏差影响串口波特率'],
  },

  // ---------- P2.4 堆栈问题 ----------
  {
    id: 'P2.4', name: '堆栈问题', level: 2, parentId: 'P2', category: 'coding',
    relatedKnowledgePoints: ['2.2.2', '3.5.3'],
    difficulty: 'hard',
    description: '堆栈空间管理不当导致程序崩溃',
  },
  {
    id: 'P2.4.1', name: '堆栈溢出', level: 3, parentId: 'P2.4', category: 'coding',
    relatedKnowledgePoints: ['2.2.2'],
    difficulty: 'hard',
    description: '函数嵌套调用过深或局部变量过多导致堆栈溢出',
    solution: '51单片机内部RAM仅128/256字节，堆栈空间极其有限。减少嵌套层数、使用全局变量',
    commonMistakes: ['递归调用导致堆栈耗尽', '大数组作为局部变量放在堆栈中'],
  },
  {
    id: 'P2.4.2', name: 'PUSH/POP不配对', level: 3, parentId: 'P2.4', category: 'coding',
    relatedKnowledgePoints: ['3.2.4'],
    difficulty: 'medium',
    description: '汇编中PUSH和POP指令不配对导致堆栈失衡，返回地址错误',
    solution: '确保每个PUSH都有对应POP，且顺序相反(先入后出)。注意中断和子程序的配对',
    commonMistakes: ['条件分支中一个路径多PUSH少POP', 'PUSH/POP的操作数写错(应为直接地址)'],
  },
  {
    id: 'P2.4.3', name: '堆栈指针设置不合理', level: 3, parentId: 'P2.4', category: 'coding',
    relatedKnowledgePoints: ['2.2.2'],
    difficulty: 'medium',
    description: 'SP初始值设置过低或过高导致堆栈与数据区冲突',
    solution: '根据实际变量使用情况设置SP。C51编译器自动分配,汇编需手动设置(一般设为60H以上)',
    commonMistakes: ['SP设在工作寄存器区导致覆盖R0-R7', 'SP设置过高留给堆栈空间不足'],
  },

  // ---------- P2.5 位操作编程错误 ----------
  {
    id: 'P2.5', name: '位操作编程错误', level: 2, parentId: 'P2', category: 'coding',
    relatedKnowledgePoints: ['3.6', '4.2'],
    difficulty: 'medium',
    description: '位操作指令或C语言位运算使用不当',
  },
  {
    id: 'P2.5.1', name: 'sbit定义与头文件冲突', level: 3, parentId: 'P2.5', category: 'coding',
    relatedKnowledgePoints: ['4.1'],
    difficulty: 'easy',
    description: '自定义sbit与reg51.h/reg52.h中已定义的位名冲突',
    solution: '先查看头文件中已有的位定义，自定义时使用不同的名称或直接引用头文件中的定义',
    commonMistakes: ['重复定义P1^0导致编译错误', '头文件版本差异导致定义不一致'],
  },
  {
    id: 'P2.5.2', name: '位运算符与逻辑运算符混淆', level: 3, parentId: 'P2.5', category: 'coding',
    relatedKnowledgePoints: ['4.2'],
    difficulty: 'easy',
    description: '&和&&、|和||、~和!的混淆导致逻辑错误',
    solution: '&是按位与，&&是逻辑与；|是按位或，||是逻辑或；~是按位取反，!是逻辑非',
    commonMistakes: ['P1 & 0x0F写成P1 && 0x0F', '条件判断中用&代替&&'],
  },
  {
    id: 'P2.5.3', name: '位域操作移位方向错误', level: 3, parentId: 'P2.5', category: 'coding',
    relatedKnowledgePoints: ['4.2'],
    difficulty: 'medium',
    description: '位移操作的方向或位数搞错导致控制逻辑出错',
    solution: '左移<<向高位移(相当于乘2)；右移>>向低位移(相当于除2)。注意有符号数右移的符号扩展',
    commonMistakes: ['P1 = 0x01 << 8 超出范围', '有符号char右移时高位填充1'],
  },
  {
    id: 'P2.5.4', name: '特定位的置位/清零方法不熟', level: 3, parentId: 'P2.5', category: 'coding',
    relatedKnowledgePoints: ['3.6', '4.2'],
    difficulty: 'easy',
    description: '不熟悉对寄存器特定位进行置位、清零、取反的标准写法',
    solution: '置位: reg |= (1<<n); 清零: reg &= ~(1<<n); 取反: reg ^= (1<<n); 读取: (reg>>n)&1',
    commonMistakes: ['清零时忘记取反~', '宏定义BIT(n)的参数范围未检查'],
  },

  // ---------- P2.6 查表程序设计错误 ----------
  {
    id: 'P2.6', name: '查表程序设计错误', level: 2, parentId: 'P2', category: 'coding',
    relatedKnowledgePoints: ['3.2', '4.2'],
    difficulty: 'medium',
    description: '使用查表法实现数码管显示、数据转换时的常见错误',
  },
  {
    id: 'P2.6.1', name: '数码管段码表错误', level: 3, parentId: 'P2.6', category: 'coding',
    relatedKnowledgePoints: ['8.1'],
    difficulty: 'easy',
    description: '共阴/共阳数码管段码表编写错误导致显示乱码',
    solution: '共阴极：段亮为1；共阳极：段亮为0(取反)。注意a-g-dp对应的硬件连线顺序',
    commonMistakes: ['共阴段码用在共阳数码管上', '段码表顺序与硬件连线不一致'],
  },
  {
    id: 'P2.6.2', name: '查表偏移量计算错误', level: 3, parentId: 'P2.6', category: 'coding',
    relatedKnowledgePoints: ['3.1.5'],
    difficulty: 'medium',
    description: '汇编MOVC查表时偏移量计算不正确导致读取错误数据',
    solution: '使用MOVC A,@A+DPTR时，A为偏移量(0~255)，表格首地址装入DPTR',
    commonMistakes: ['偏移量超过255未分段处理', 'DB定义的表格位置与DPTR指向不一致'],
  },
  {
    id: 'P2.6.3', name: 'code关键字遗漏导致表格放在RAM', level: 3, parentId: 'P2.6', category: 'coding',
    relatedKnowledgePoints: ['4.1', '2.2.1'],
    difficulty: 'medium',
    description: 'C语言中常量表忘记加code关键字，表格被放在RAM中浪费宝贵空间',
    solution: '只读查找表应声明为code类型，如: unsigned char code seg_table[] = {...};',
    commonMistakes: ['大表格放data区导致RAM不足', '用xdata代替code(外部RAM访问慢)'],
  },

  // ---------- P2.7 多任务调度问题 ----------
  {
    id: 'P2.7', name: '多任务调度问题', level: 2, parentId: 'P2', category: 'coding',
    relatedKnowledgePoints: ['4.3', '5.4'],
    difficulty: 'hard',
    description: '在无操作系统环境下实现多任务协调运行时的问题',
  },
  {
    id: 'P2.7.1', name: '主循环阻塞导致响应延迟', level: 3, parentId: 'P2.7', category: 'coding',
    relatedKnowledgePoints: ['4.3'],
    difficulty: 'medium',
    description: '主循环中有阻塞式延时，导致无法及时响应按键或其他事件',
    solution: '使用定时器标志位代替阻塞延时，采用状态机方式实现非阻塞任务调度',
    commonMistakes: ['while(1)中调用delay_ms(1000)阻塞按键扫描', '多个延时任务串行执行'],
  },
  {
    id: 'P2.7.2', name: '状态机设计不完整', level: 3, parentId: 'P2.7', category: 'coding',
    relatedKnowledgePoints: ['4.3'],
    difficulty: 'hard',
    description: '状态机缺少状态转移条件或遗漏边界状态',
    solution: '画出完整状态转移图，每个状态有明确的进入/退出条件和默认处理',
    commonMistakes: ['遗漏非法状态的处理', '状态变量在中断和主程序间竞争'],
  },
  {
    id: 'P2.7.3', name: '按键消抖处理不完善', level: 3, parentId: 'P2.7', category: 'coding',
    relatedKnowledgePoints: ['8.2', '4.3'],
    difficulty: 'easy',
    description: '按键去抖动处理方法不当导致按键识别不可靠',
    solution: '硬件消抖(RC滤波)或软件消抖(延时10-20ms后再次确认)。推荐定时器扫描方式',
    commonMistakes: ['消抖延时太短(<5ms)或太长(>50ms)', '只检测按下不检测释放'],
  },
  {
    id: 'P2.7.4', name: '定时器时间片分配不当', level: 3, parentId: 'P2.7', category: 'coding',
    relatedKnowledgePoints: ['6.3', '4.3'],
    difficulty: 'hard',
    description: '使用定时器中断实现简单时间片调度时分配不合理',
    solution: '基准定时(如1ms)，不同任务按不同周期调度：按键扫描20ms、显示刷新5ms、通信100ms',
    commonMistakes: ['所有任务在同一个定时器中断中执行', '时间片太长导致显示闪烁'],
  },

  // ---------- P2.8 LCD/数码管显示程序问题 ----------
  {
    id: 'P2.8', name: '显示驱动程序问题', level: 2, parentId: 'P2', category: 'coding',
    relatedKnowledgePoints: ['8.1'],
    difficulty: 'medium',
    description: 'LED数码管或LCD1602驱动程序编写中的常见问题',
  },
  {
    id: 'P2.8.1', name: '动态扫描频率不当', level: 3, parentId: 'P2.8', category: 'coding',
    relatedKnowledgePoints: ['8.1.2'],
    difficulty: 'easy',
    description: '数码管动态扫描频率过低导致闪烁或过高导致亮度不均',
    solution: '每位显示1-2ms，4位数码管完整扫描周期4-8ms(刷新率>100Hz无闪烁)',
    commonMistakes: ['扫描间隔太长(>5ms/位)导致可见闪烁', '段码和位选切换顺序错误导致串显(鬼影)'],
  },
  {
    id: 'P2.8.2', name: '消隐处理缺失', level: 3, parentId: 'P2.8', category: 'coding',
    relatedKnowledgePoints: ['8.1.2'],
    difficulty: 'medium',
    description: '数码管动态扫描时位选切换瞬间未消隐导致显示串扰',
    solution: '切换位选前先关闭所有段码(消隐)，再送新段码和位选信号',
    commonMistakes: ['先送位选再送段码导致短暂显示错误数字', '消隐时间过长降低亮度'],
  },
  {
    id: 'P2.8.3', name: 'LCD1602时序控制错误', level: 3, parentId: 'P2.8', category: 'coding',
    relatedKnowledgePoints: ['8.1.3'],
    difficulty: 'medium',
    description: 'LCD1602初始化序列或读写时序不符合数据手册要求',
    solution: '严格按数据手册：上电等待>15ms → 功能设置 → 显示控制 → 清屏 → 模式设置',
    commonMistakes: ['初始化等待时间不够', '忙标志检测时RS/RW设置错误'],
  },
  {
    id: 'P2.8.4', name: 'LCD光标位置计算错误', level: 3, parentId: 'P2.8', category: 'coding',
    relatedKnowledgePoints: ['8.1.3'],
    difficulty: 'easy',
    description: 'LCD1602第二行地址起始为0x40而非0x10的计算错误',
    solution: '第一行地址0x00-0x0F，第二行地址0x40-0x4F。写地址命令需加0x80',
    commonMistakes: ['第二行起始地址写成0x10', '忘记写地址时最高位置1(加0x80)'],
  },

  // ---------- P2.9 串口通信编程问题 ----------
  {
    id: 'P2.9', name: '串口通信编程问题', level: 2, parentId: 'P2', category: 'coding',
    relatedKnowledgePoints: ['7.4'],
    difficulty: 'hard',
    description: '串口通信程序的初始化、收发和协议处理中的常见问题',
  },
  {
    id: 'P2.9.1', name: '串口初始化配置不完整', level: 3, parentId: 'P2.9', category: 'coding',
    relatedKnowledgePoints: ['7.2', '7.3'],
    difficulty: 'medium',
    description: '串口初始化时遗漏必要的寄存器配置步骤',
    solution: '完整初始化：SCON设置方式→TMOD配T1为模式2→TH1/TL1赋波特率初值→TR1启动→可选开中断',
    commonMistakes: ['忘记启动T1(TR1=1)', '未设置SMOD导致波特率减半'],
  },
  {
    id: 'P2.9.2', name: '串口收发数据丢失', level: 3, parentId: 'P2.9', category: 'coding',
    relatedKnowledgePoints: ['7.4'],
    difficulty: 'hard',
    description: '接收数据来不及处理或发送间隔过短导致数据丢失',
    solution: '使用环形缓冲区存储接收数据；发送前检查TI标志确认上一字节发送完成',
    commonMistakes: ['不检查TI直接连续发送', '接收中断中做复杂处理导致溢出'],
  },
  {
    id: 'P2.9.3', name: '多机通信地址识别错误', level: 3, parentId: 'P2.9', category: 'coding',
    relatedKnowledgePoints: ['7.2.3'],
    difficulty: 'hard',
    description: '方式2/3的多机通信中SM2、TB8、RB8的配合使用不当',
    solution: 'SM2=1时只接收RB8=1(地址帧)；匹配地址后SM2=0接收后续数据帧(RB8=0)',
    commonMistakes: ['地址匹配后忘记清SM2', '主机发数据帧时误将TB8置1'],
  },
  {
    id: 'P2.9.4', name: '串口调试助手参数不匹配', level: 3, parentId: 'P2.9', category: 'coding',
    relatedKnowledgePoints: ['7.3', '7.4'],
    difficulty: 'easy',
    description: 'PC端串口调试助手的波特率、数据位、停止位设置与MCU不一致',
    solution: '确保两端参数完全一致：波特率、数据位(8)、停止位(1)、校验位(无)。常用9600,8,N,1',
    commonMistakes: ['波特率不匹配收到乱码', '忘记选择正确的COM口'],
  },

  // ---------- P2.10 编译与链接错误 ----------
  {
    id: 'P2.10', name: '编译与链接错误', level: 2, parentId: 'P2', category: 'coding',
    relatedKnowledgePoints: ['1.5', '4.1'],
    difficulty: 'easy',
    description: 'Keil编译器常见的编译错误和警告处理',
  },
  {
    id: 'P2.10.1', name: '头文件包含错误', level: 3, parentId: 'P2.10', category: 'coding',
    relatedKnowledgePoints: ['1.5.1'],
    difficulty: 'easy',
    description: '遗漏reg51.h/reg52.h头文件或包含路径错误',
    solution: '项目中必须包含#include <reg51.h>或<reg52.h>以定义SFR地址和位名称',
    commonMistakes: ['新建文件忘记包含头文件', '用双引号和尖括号混用导致路径问题'],
  },
  {
    id: 'P2.10.2', name: '函数声明与定义不一致', level: 3, parentId: 'P2.10', category: 'coding',
    relatedKnowledgePoints: ['4.2'],
    difficulty: 'easy',
    description: '函数原型声明与实际定义的参数类型、返回值不匹配',
    solution: '在头文件或文件开头声明函数原型，确保与定义完全一致',
    commonMistakes: ['返回类型不匹配', '参数个数不一致', '缺少函数原型的前向声明'],
  },
  {
    id: 'P2.10.3', name: 'DATA/XDATA空间溢出', level: 3, parentId: 'P2.10', category: 'coding',
    relatedKnowledgePoints: ['2.2.2', '4.1'],
    difficulty: 'medium',
    description: '链接时报DATA或XDATA段空间不足的错误',
    solution: '优化变量分配：大数组用xdata、只读数据用code、减少全局变量、利用overlay优化',
    commonMistakes: ['所有变量默认放data区', '未开启编译器overlay优化'],
  },

  // ========================================================================
  // P3: 实验操作问题 (Experiment Operation Problems)
  // ========================================================================
  {
    id: 'P3', name: '实验操作问题', level: 1, category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'medium',
    description: '硬件实验中的电路搭建、仪器使用、调试排错和芯片操作相关问题',
  },

  // ---------- P3.1 电路连线错误 ----------
  {
    id: 'P3.1', name: '电路连线错误', level: 2, parentId: 'P3', category: 'experiment',
    relatedKnowledgePoints: ['2.3', '8'],
    difficulty: 'easy',
    description: '面包板或PCB上的电路连接错误',
  },
  {
    id: 'P3.1.1', name: '电源和地线连接不当', level: 3, parentId: 'P3.1', category: 'experiment',
    relatedKnowledgePoints: ['1.4.3'],
    difficulty: 'easy',
    description: 'VCC和GND接反或遗漏去耦电容',
    solution: '确认芯片VCC(40脚)和GND(20脚)；每个芯片就近放置0.1uF去耦电容',
    commonMistakes: ['VCC/GND接反导致芯片烧毁', '去耦电容引线过长失去滤波效果'],
  },
  {
    id: 'P3.1.2', name: '面包板接触不良', level: 3, parentId: 'P3.1', category: 'experiment',
    relatedKnowledgePoints: ['8'],
    difficulty: 'easy',
    description: '面包板插孔老化或元件引脚弯曲导致接触不良',
    solution: '使用万用表通断挡检查每个连接点；元件引脚要剪适当长度并垂直插入',
    commonMistakes: ['跨行插线未对准孔位', '元件引脚氧化未清洁'],
  },
  {
    id: 'P3.1.3', name: '上拉/下拉电阻遗漏', level: 3, parentId: 'P3.1', category: 'experiment',
    relatedKnowledgePoints: ['2.3.1'],
    difficulty: 'medium',
    description: 'P0口作通用I/O时忘记接上拉电阻，或按键电路缺少上拉/下拉',
    solution: 'P0口必须外接上拉电阻(4.7K-10K)；按键输入建议使用内部/外部上拉+低电平有效设计',
    commonMistakes: ['P0口不接上拉输出高电平失败', '按键浮空时读到不确定值'],
  },
  {
    id: 'P3.1.4', name: '晶振电路连接错误', level: 3, parentId: 'P3.1', category: 'experiment',
    relatedKnowledgePoints: ['1.4.3', '2.4.1'],
    difficulty: 'medium',
    description: '晶振和负载电容连接方式或参数不正确导致不起振',
    solution: '晶振接XTAL1(19脚)和XTAL2(18脚)之间，两端各接30pF瓷片电容到地。引线尽短',
    commonMistakes: ['负载电容值选择不当', '晶振引线过长引入噪声'],
  },

  // ---------- P3.2 仿真器/调试器配置错误 ----------
  {
    id: 'P3.2', name: '仿真器/调试器配置错误', level: 2, parentId: 'P3', category: 'experiment',
    relatedKnowledgePoints: ['1.5'],
    difficulty: 'medium',
    description: '使用Keil仿真或Proteus联合仿真时的配置问题',
  },
  {
    id: 'P3.2.1', name: 'Keil工程配置不正确', level: 3, parentId: 'P3.2', category: 'experiment',
    relatedKnowledgePoints: ['1.5.1'],
    difficulty: 'easy',
    description: 'Keil工程目标芯片选型、时钟频率或输出格式设置错误',
    solution: 'Target → Device选择AT89C51 → Crystal填写实际晶振频率 → Output勾选Create HEX File',
    commonMistakes: ['芯片型号选错导致编译选项差异', '忘记勾选生成HEX文件'],
  },
  {
    id: 'P3.2.2', name: 'Proteus仿真与实际行为差异', level: 3, parentId: 'P3.2', category: 'experiment',
    relatedKnowledgePoints: ['1.5.2'],
    difficulty: 'medium',
    description: 'Proteus仿真结果与实际硬件运行行为不一致',
    solution: 'Proteus不模拟精确时序和电气特性。注意电源、去耦、信号完整性等仿真不涵盖的因素',
    commonMistakes: ['仿真正常但实际电路不工作(通常是硬件问题)', 'Proteus中定时精度与实际不同'],
  },
  {
    id: 'P3.2.3', name: 'HEX文件加载失败', level: 3, parentId: 'P3.2', category: 'experiment',
    relatedKnowledgePoints: ['1.5.2'],
    difficulty: 'easy',
    description: 'Proteus中加载HEX文件路径错误或格式不正确',
    solution: '双击MCU器件 → Program File浏览选择HEX文件 → Clock Frequency填写正确的频率值',
    commonMistakes: ['HEX文件路径含中文或空格', '编译失败但加载了旧的HEX文件'],
  },
  {
    id: 'P3.2.4', name: '调试断点和单步执行问题', level: 3, parentId: 'P3.2', category: 'experiment',
    relatedKnowledgePoints: ['1.5.1', '1.5.3'],
    difficulty: 'medium',
    description: 'Keil调试模式下断点设置、单步执行和变量观察操作不熟练',
    solution: '编译后进入Debug模式，在代码行号处点击设断点，F10单步(不进入)，F11单步(进入函数)',
    commonMistakes: ['Release模式下打断点无效', 'Watch窗口变量地址不正确'],
  },

  // ---------- P3.3 示波器使用不当 ----------
  {
    id: 'P3.3', name: '示波器使用不当', level: 2, parentId: 'P3', category: 'experiment',
    relatedKnowledgePoints: ['1.5.3'],
    difficulty: 'medium',
    description: '使用示波器观察单片机信号波形时的常见操作问题',
  },
  {
    id: 'P3.3.1', name: '探头衰减比设置错误', level: 3, parentId: 'P3.3', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '示波器探头衰减比(1X/10X)与通道设置不匹配导致读数偏差',
    solution: '实验中一般使用10X探头，示波器通道需对应设置为10X衰减(Probe → 10X)',
    commonMistakes: ['探头10X但通道设为1X导致幅度偏小10倍', '混用不同衰减比探头'],
  },
  {
    id: 'P3.3.2', name: '触发条件设置不当', level: 3, parentId: 'P3.3', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'medium',
    description: '波形不稳定或抓不到信号，触发电平和触发方式设置不合理',
    solution: '设置合理的触发电平(信号幅度中间位置)；边沿触发选上升沿；复杂信号用模式触发',
    commonMistakes: ['触发电平设在噪声区域导致波形漂移', 'Auto模式下看到不稳定波形'],
  },
  {
    id: 'P3.3.3', name: '时基和幅度量程选择不当', level: 3, parentId: 'P3.3', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '时间轴(Time/div)或电压轴(Volts/div)设置不当导致波形看不清',
    solution: '根据信号频率调整时基：看2-3个完整周期。根据信号幅度调整量程：占屏幕2/3高度最佳',
    commonMistakes: ['串口信号用太大时基看不清位变化', '数字信号量程设太大波形变一条线'],
  },

  // ---------- P3.4 电源问题 ----------
  {
    id: 'P3.4', name: '电源问题', level: 2, parentId: 'P3', category: 'experiment',
    relatedKnowledgePoints: ['1.4.3'],
    difficulty: 'medium',
    description: '实验系统供电不当导致的工作异常',
  },
  {
    id: 'P3.4.1', name: '电源电压不稳定', level: 3, parentId: 'P3.4', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'medium',
    description: '电源纹波过大或电压不在芯片工作范围内',
    solution: '89C51工作电压4.0-5.5V。使用稳压电源或7805稳压模块，输出端加滤波电容',
    commonMistakes: ['USB供电时负载过重导致电压跌落', '电源线过细/过长压降过大'],
  },
  {
    id: 'P3.4.2', name: '上电复位不可靠', level: 3, parentId: 'P3.4', category: 'experiment',
    relatedKnowledgePoints: ['1.4.3'],
    difficulty: 'easy',
    description: '复位电路参数不当导致上电后单片机不能可靠复位',
    solution: 'RC复位电路：RST引脚接10uF电容到VCC + 10K电阻到GND，复位脉宽>2个机器周期',
    commonMistakes: ['电容值太小复位脉宽不够', '手动复位按键未加防抖'],
  },
  {
    id: 'P3.4.3', name: '外设功耗超出端口驱动能力', level: 3, parentId: 'P3.4', category: 'experiment',
    relatedKnowledgePoints: ['2.3.5'],
    difficulty: 'medium',
    description: '直接用I/O口驱动大电流负载(如继电器、电机)导致端口损坏',
    solution: 'I/O口灌电流能力约20mA(P0)或10mA(P1-P3)。大电流负载需三极管或驱动芯片(ULN2003)',
    commonMistakes: ['直接用端口驱动继电器线圈', '多个LED同时点亮超出总电流限制'],
  },

  // ---------- P3.5 芯片烧写/下载失败 ----------
  {
    id: 'P3.5', name: '芯片烧写/下载失败', level: 2, parentId: 'P3', category: 'experiment',
    relatedKnowledgePoints: ['1.5.3', '1.5.4'],
    difficulty: 'medium',
    description: '使用STC-ISP或其他工具下载程序到芯片时失败',
  },
  {
    id: 'P3.5.1', name: 'COM端口选择错误', level: 3, parentId: 'P3.5', category: 'experiment',
    relatedKnowledgePoints: ['1.5.4'],
    difficulty: 'easy',
    description: 'STC-ISP中串口号选择不正确或驱动未安装',
    solution: '设备管理器确认COM端口号，安装CH340/PL2303/CP2102驱动。选择对应COM口和波特率',
    commonMistakes: ['USB转串口驱动未安装', '多个COM口时选错端口'],
  },
  {
    id: 'P3.5.2', name: '冷启动下载操作不当', level: 3, parentId: 'P3.5', category: 'experiment',
    relatedKnowledgePoints: ['1.5.4'],
    difficulty: 'easy',
    description: 'STC单片机需要冷启动(先断电再上电)才能下载，操作顺序不对',
    solution: 'STC-ISP中点击"下载/编程"后再给单片机上电(冷启动)。确保晶振工作正常',
    commonMistakes: ['先上电再点下载按钮', '上电时序太快ISP来不及握手'],
  },
  {
    id: 'P3.5.3', name: 'HEX文件选择错误', level: 3, parentId: 'P3.5', category: 'experiment',
    relatedKnowledgePoints: ['1.5.1'],
    difficulty: 'easy',
    description: '下载了旧版本的HEX文件或选错文件',
    solution: '确认Keil编译成功(0 Error)后，在Output目录下选择最新的HEX文件',
    commonMistakes: ['编译有错误但HEX文件是旧的', '多工程目录下选错HEX文件'],
  },
  {
    id: 'P3.5.4', name: '芯片加密或型号不匹配', level: 3, parentId: 'P3.5', category: 'experiment',
    relatedKnowledgePoints: ['1.5.4'],
    difficulty: 'medium',
    description: '芯片已被加密锁定或ISP工具中芯片型号选择不匹配',
    solution: '确认芯片型号(丝印)与ISP工具中选择一致。加密芯片需擦除后重新编程',
    commonMistakes: ['STC89C52与STC89C51型号选错', '芯片已锁无法读取需要擦除'],
  },

  // ---------- P3.6 传感器与外设接口问题 ----------
  {
    id: 'P3.6', name: '传感器与外设接口问题', level: 2, parentId: 'P3', category: 'experiment',
    relatedKnowledgePoints: ['8', '9'],
    difficulty: 'medium',
    description: '连接和使用各种传感器、执行器等外设时的接口问题',
  },
  {
    id: 'P3.6.1', name: 'ADC/DAC连接与配置错误', level: 3, parentId: 'P3.6', category: 'experiment',
    relatedKnowledgePoints: ['9.1'],
    difficulty: 'medium',
    description: 'ADC0809或DAC0832的接口时序和控制信号连接错误',
    solution: '注意ADC的START、EOC、OE信号时序；DAC的CS、WR信号配合。参考数据手册时序图',
    commonMistakes: ['ADC未等转换完成(EOC)就读数据', 'DAC参考电压接错'],
  },
  {
    id: 'P3.6.2', name: '温度传感器DS18B20通信失败', level: 3, parentId: 'P3.6', category: 'experiment',
    relatedKnowledgePoints: ['9.2'],
    difficulty: 'hard',
    description: 'DS18B20单总线时序要求严格，初始化或读写时序不满足',
    solution: '严格按时序：复位480us→等待60us→检测存在脉冲60-240us。读/写位时序需精确到us级',
    commonMistakes: ['时序不精确导致通信失败', '忘记4.7K上拉电阻', '多个DS18B20 ROM码读取错误'],
  },
  {
    id: 'P3.6.3', name: 'I2C/SPI通信时序错误', level: 3, parentId: 'P3.6', category: 'experiment',
    relatedKnowledgePoints: ['9.3'],
    difficulty: 'hard',
    description: '软件模拟I2C或SPI协议时时序不满足设备要求',
    solution: 'I2C注意起始/停止条件、ACK应答、地址格式(7位+读写位)。SPI注意CPOL/CPHA模式匹配',
    commonMistakes: ['I2C地址位左移1位的问题', 'SPI时钟极性/相位模式不匹配'],
  },
  {
    id: 'P3.6.4', name: '电机驱动电路问题', level: 3, parentId: 'P3.6', category: 'experiment',
    relatedKnowledgePoints: ['9.4'],
    difficulty: 'medium',
    description: '步进电机或直流电机驱动电路连接和控制错误',
    solution: '步进电机需正确相序(如四相八拍)；直流电机用H桥或L298N模块，注意续流二极管',
    commonMistakes: ['步进电机相序接错导致不转或抖动', '电机反电动势损坏I/O口'],
  },

  // ---------- P3.7 PCB设计与焊接问题 ----------
  {
    id: 'P3.7', name: 'PCB设计与焊接问题', level: 2, parentId: 'P3', category: 'experiment',
    relatedKnowledgePoints: ['8'],
    difficulty: 'medium',
    description: 'PCB板制作和元器件焊接中的常见问题',
  },
  {
    id: 'P3.7.1', name: '虚焊与桥接', level: 3, parentId: 'P3.7', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '焊接质量不佳导致虚焊(接触不良)或桥接(引脚短路)',
    solution: '虚焊：焊点应光亮圆润、充分浸润焊盘。桥接：相邻引脚间用吸锡带清除多余焊锡',
    commonMistakes: ['烙铁温度过高焊盘脱落', '烙铁温度过低焊锡不融化形成虚焊'],
  },
  {
    id: 'P3.7.2', name: '元器件方向装反', level: 3, parentId: 'P3.7', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '有极性元器件(电解电容、二极管、IC)方向装反',
    solution: 'IC看缺口/圆点标记对准1脚；电解电容长脚为正极；LED长脚为正极；二极管有标记端为阴极',
    commonMistakes: ['电解电容装反可能爆裂', 'IC方向装反导致芯片烧毁'],
  },
  {
    id: 'P3.7.3', name: '布线不合理导致信号干扰', level: 3, parentId: 'P3.7', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'hard',
    description: 'PCB走线过细、过长或并行走线导致信号串扰',
    solution: '数字信号线和模拟信号线分开走；电源线加粗；关键信号线旁加地线保护',
    commonMistakes: ['时钟线过长引入噪声', '电源线和信号线平行走引起干扰'],
  },
  {
    id: 'P3.7.4', name: '贴片元件焊接困难', level: 3, parentId: 'P3.7', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'medium',
    description: 'SMD元件(0805/0603)手工焊接技术不熟练导致虚焊或偏移',
    solution: '先在一个焊盘上锡，用镊子固定元件焊好一端，再焊另一端。使用助焊剂提高润湿性',
    commonMistakes: ['烙铁头太大无法焊接小间距引脚', '焊锡量过多导致桥接'],
  },

  // ---------- P3.8 万用表使用问题 ----------
  {
    id: 'P3.8', name: '万用表使用问题', level: 2, parentId: 'P3', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '使用数字万用表进行电路测量时的常见操作错误',
  },
  {
    id: 'P3.8.1', name: '量程选择错误', level: 3, parentId: 'P3.8', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '测量时选错量程或测量类型导致读数不准或损坏仪表',
    solution: '先估计被测量范围选择合适量程。不确定时先用最大量程。注意DC/AC的切换',
    commonMistakes: ['用电阻挡测量带电电路', '用电流挡并联测量导致短路烧保险'],
  },
  {
    id: 'P3.8.2', name: '测量方式错误(串联/并联)', level: 3, parentId: 'P3.8', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '电压应并联测量、电流应串联测量，测量方式搞反',
    solution: '电压表并联在被测两端；电流表串联在回路中。测电阻时电路必须断电',
    commonMistakes: ['电压挡串联在回路中', '电流挡并联在电路两端(短路)'],
  },
  {
    id: 'P3.8.3', name: '在线测量时参考点选择不当', level: 3, parentId: 'P3.8', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '测量电路中各点电压时参考地线选择不正确',
    solution: '测量以电源负极(GND)为参考点，红表笔接被测点，黑表笔接地',
    commonMistakes: ['参考点不是电路公共地', '不同模块的地没有连通'],
  },

  // ---------- P3.9 Proteus仿真操作问题 ----------
  {
    id: 'P3.9', name: 'Proteus仿真操作问题', level: 2, parentId: 'P3', category: 'experiment',
    relatedKnowledgePoints: ['1.5.2'],
    difficulty: 'easy',
    description: 'Proteus原理图绘制和仿真运行中的常见操作问题',
  },
  {
    id: 'P3.9.1', name: '器件库查找困难', level: 3, parentId: 'P3.9', category: 'experiment',
    relatedKnowledgePoints: ['1.5.2'],
    difficulty: 'easy',
    description: '在Proteus器件库中找不到所需元器件',
    solution: '使用关键字搜索：如"AT89C51"、"LED"、"7SEG"。常用器件类别：Microprocessor ICs、Optoelectronics',
    commonMistakes: ['搜索关键字拼写错误', '找不到虚拟仪器(在左侧工具栏)'],
  },
  {
    id: 'P3.9.2', name: '仿真中虚拟仪器配置错误', level: 3, parentId: 'P3.9', category: 'experiment',
    relatedKnowledgePoints: ['1.5.2'],
    difficulty: 'easy',
    description: '虚拟示波器、逻辑分析仪等仿真工具的参数配置不当',
    solution: '虚拟示波器双击可设置时基和量程。逻辑分析仪需设置采样时钟频率与信号匹配',
    commonMistakes: ['虚拟示波器时基太大看不到波形', '逻辑分析仪通道未关联到正确网络'],
  },
  {
    id: 'P3.9.3', name: '电路网络未正确连接', level: 3, parentId: 'P3.9', category: 'experiment',
    relatedKnowledgePoints: ['1.5.2'],
    difficulty: 'easy',
    description: 'Proteus中导线看似连接但实际未形成电气连接',
    solution: '连接点应出现实心圆点。使用Net Label可实现不画线的远距离连接。注意交叉线与连接线的区别',
    commonMistakes: ['导线交叉但未连接(缺少节点)', '网络标签名不一致导致未连通'],
  },

  // ---------- P3.10 实验安全与规范 ----------
  {
    id: 'P3.10', name: '实验安全与规范', level: 2, parentId: 'P3', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '实验操作中的安全注意事项和规范问题',
  },
  {
    id: 'P3.10.1', name: '带电操作接插元器件', level: 3, parentId: 'P3.10', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '在电路通电状态下插拔芯片或连接线',
    solution: '所有元器件的插拔和电路修改必须在断电状态下进行。CMOS器件需防静电',
    commonMistakes: ['带电插拔IC导致烧毁', '未戴防静电手环操作CMOS芯片'],
  },
  {
    id: 'P3.10.2', name: '实验记录不完整', level: 3, parentId: 'P3.10', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '实验过程中未及时记录数据、现象和问题',
    solution: '实验前写好预习报告；实验中记录每步操作和结果；出现问题记录现象和解决过程',
    commonMistakes: ['事后凭记忆补写实验报告', '只记录成功结果不记录调试过程'],
  },
  {
    id: 'P3.10.3', name: '实验台收拾不规范', level: 3, parentId: 'P3.10', category: 'experiment',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '实验结束后未正确关闭电源、整理器材',
    solution: '实验结束：关闭电源→断开连线→整理元器件→清洁实验台→关闭仪器',
    commonMistakes: ['忘记关电源导致器件过热', '元器件散落遗失'],
  },

  // ========================================================================
  // P4: 项目设计问题 (Project Design Problems)
  // ========================================================================
  {
    id: 'P4', name: '项目设计问题', level: 1, category: 'project',
    relatedKnowledgePoints: [],
    difficulty: 'hard',
    description: '综合性项目设计中的系统架构、模块集成、性能优化和工程规范问题',
  },

  // ---------- P4.1 需求分析与方案设计问题 ----------
  {
    id: 'P4.1', name: '需求分析与方案设计问题', level: 2, parentId: 'P4', category: 'project',
    relatedKnowledgePoints: ['10'],
    difficulty: 'hard',
    description: '项目初期的需求理解和总体方案设计中的问题',
  },
  {
    id: 'P4.1.1', name: '需求理解不完整', level: 3, parentId: 'P4.1', category: 'project',
    relatedKnowledgePoints: ['10'],
    difficulty: 'medium',
    description: '未全面理解项目功能需求和性能指标，遗漏关键约束条件',
    solution: '列出功能需求清单和非功能需求(精度、速度、功耗、成本)，与指导老师确认',
    commonMistakes: ['只关注核心功能忽略辅助功能', '未考虑极端工作条件'],
  },
  {
    id: 'P4.1.2', name: '芯片选型不当', level: 3, parentId: 'P4.1', category: 'project',
    relatedKnowledgePoints: ['1.2'],
    difficulty: 'medium',
    description: '外围芯片(ADC、驱动器、传感器等)选型不满足设计要求',
    solution: '根据精度、速度、接口兼容性和成本综合选型。预留一定性能余量',
    commonMistakes: ['ADC精度不够', '驱动能力不足需要增加缓冲器', '选择停产芯片'],
  },
  {
    id: 'P4.1.3', name: '系统框图设计不合理', level: 3, parentId: 'P4.1', category: 'project',
    relatedKnowledgePoints: ['10'],
    difficulty: 'hard',
    description: '系统总体框图中模块划分不清、接口定义不明确',
    solution: '明确每个模块的输入/输出信号、电平标准和通信协议。画出完整的系统框图和信号流',
    commonMistakes: ['模块之间信号电平不匹配', '接口定义模糊导致集成困难'],
  },
  {
    id: 'P4.1.4', name: '项目进度规划不合理', level: 3, parentId: 'P4.1', category: 'project',
    relatedKnowledgePoints: [],
    difficulty: 'medium',
    description: '项目时间分配不当，预留调试时间不足',
    solution: '按"设计30%、编码30%、调试40%"分配时间。调试阶段通常需要最多时间',
    commonMistakes: ['以为编码完成就等于项目完成', '低估集成调试所需时间'],
  },

  // ---------- P4.2 模块间通信设计不当 ----------
  {
    id: 'P4.2', name: '模块间通信设计不当', level: 2, parentId: 'P4', category: 'project',
    relatedKnowledgePoints: ['7', '9.3'],
    difficulty: 'hard',
    description: '多个功能模块间的数据传输和协调存在设计缺陷',
  },
  {
    id: 'P4.2.1', name: '通信协议定义不完善', level: 3, parentId: 'P4.2', category: 'project',
    relatedKnowledgePoints: ['7.4'],
    difficulty: 'hard',
    description: '自定义通信协议缺少帧头、校验、超时等必要机制',
    solution: '协议应包含：帧头+长度+命令+数据+校验(CRC/累加和)+帧尾。定义超时重发机制',
    commonMistakes: ['无帧同步导致数据错位', '无校验导致错误数据被接受'],
  },
  {
    id: 'P4.2.2', name: '多设备总线冲突', level: 3, parentId: 'P4.2', category: 'project',
    relatedKnowledgePoints: ['9.3'],
    difficulty: 'hard',
    description: 'I2C或SPI总线上多设备同时通信导致冲突',
    solution: 'I2C通过地址区分设备，注意地址不能冲突。SPI使用独立CS线选择设备',
    commonMistakes: ['I2C设备地址冲突', 'SPI片选信号时序不满足'],
  },
  {
    id: 'P4.2.3', name: '数据同步与时序配合问题', level: 3, parentId: 'P4.2', category: 'project',
    relatedKnowledgePoints: ['4.3'],
    difficulty: 'hard',
    description: '多个模块间的数据同步和时序配合不当导致数据不一致',
    solution: '使用握手信号或标志位进行数据同步；关键操作需关中断保证原子性',
    commonMistakes: ['读取多字节数据中途被中断修改', '采集和显示不同步导致数据跳变'],
  },

  // ---------- P4.3 功耗优化不足 ----------
  {
    id: 'P4.3', name: '功耗优化不足', level: 2, parentId: 'P4', category: 'project',
    relatedKnowledgePoints: ['10.2'],
    difficulty: 'hard',
    description: '电池供电或低功耗应用场景下的功耗管理不到位',
  },
  {
    id: 'P4.3.1', name: '未使用低功耗模式', level: 3, parentId: 'P4.3', category: 'project',
    relatedKnowledgePoints: ['10.2.1'],
    difficulty: 'medium',
    description: '空闲时未让MCU进入空闲(Idle)或掉电(Power Down)模式',
    solution: '无任务时进入Idle模式(PCON.IDL=1)，仍可被中断唤醒。深度休眠用Power Down模式',
    commonMistakes: ['Power Down模式忘记配置唤醒源', '主循环空跑消耗大量功耗'],
  },
  {
    id: 'P4.3.2', name: '外围电路功耗过大', level: 3, parentId: 'P4.3', category: 'project',
    relatedKnowledgePoints: ['10.2'],
    difficulty: 'medium',
    description: '传感器、显示器等外围设备持续工作消耗过多电能',
    solution: '不使用时关闭传感器电源；LCD背光按需开启；LED亮度通过PWM调节',
    commonMistakes: ['传感器24小时常开', 'LCD背光始终全亮'],
  },
  {
    id: 'P4.3.3', name: '时钟频率选择不当', level: 3, parentId: 'P4.3', category: 'project',
    relatedKnowledgePoints: ['2.4.1', '10.2'],
    difficulty: 'medium',
    description: '使用了不必要的高频时钟，未根据实际需求降低时钟频率',
    solution: '功耗与时钟频率近似线性关系。不需要高速处理时可选用低频晶振(如3.579MHz)',
    commonMistakes: ['所有应用都用12MHz', '降频后忘记调整定时器和波特率参数'],
  },

  // ---------- P4.4 抗干扰设计缺失 ----------
  {
    id: 'P4.4', name: '抗干扰设计缺失', level: 2, parentId: 'P4', category: 'project',
    relatedKnowledgePoints: ['10.3'],
    difficulty: 'hard',
    description: '产品级设计中缺少必要的抗干扰和可靠性措施',
  },
  {
    id: 'P4.4.1', name: '软件看门狗未使用', level: 3, parentId: 'P4.4', category: 'project',
    relatedKnowledgePoints: ['10.3.1'],
    difficulty: 'medium',
    description: '程序跑飞后无法自动复位恢复',
    solution: '启用看门狗定时器(WDT)，主循环中定期喂狗。超时自动复位。STC系列有内置WDT',
    commonMistakes: ['中断中喂狗导致主循环死循环时无法复位', '喂狗时间设置不合理'],
  },
  {
    id: 'P4.4.2', name: '输入信号未滤波', level: 3, parentId: 'P4.4', category: 'project',
    relatedKnowledgePoints: ['10.3'],
    difficulty: 'medium',
    description: '外部输入信号(按键、传感器)未做硬件或软件滤波',
    solution: '硬件：输入端加RC低通滤波(100R+0.1uF)。软件：多次采样取平均或中值滤波',
    commonMistakes: ['ADC采样不做滤波导致数据跳变', '数字输入不消抖导致误触发'],
  },
  {
    id: 'P4.4.3', name: '电源抗干扰措施不足', level: 3, parentId: 'P4.4', category: 'project',
    relatedKnowledgePoints: ['10.3'],
    difficulty: 'hard',
    description: '电源线上的噪声干扰影响系统稳定性',
    solution: '电源入口加TVS保护；每个IC旁加0.1uF去耦电容；模拟/数字电源分开',
    commonMistakes: ['去耦电容离IC太远', '模拟地和数字地未正确处理'],
  },
  {
    id: 'P4.4.4', name: '冗余设计和容错处理缺失', level: 3, parentId: 'P4.4', category: 'project',
    relatedKnowledgePoints: ['10.3'],
    difficulty: 'hard',
    description: '关键功能缺少冗余检查和异常恢复机制',
    solution: '关键数据多份存储并校验；通信加重发机制；程序异常入口加跳转到复位向量',
    commonMistakes: ['EEPROM写入不校验导致数据损坏', '程序跑飞无恢复手段'],
  },

  // ---------- P4.5 系统调试方法不当 ----------
  {
    id: 'P4.5', name: '系统调试方法不当', level: 2, parentId: 'P4', category: 'project',
    relatedKnowledgePoints: ['1.5.3'],
    difficulty: 'medium',
    description: '综合项目调试阶段方法不当导致效率低下',
  },
  {
    id: 'P4.5.1', name: '未采用分模块调试策略', level: 3, parentId: 'P4.5', category: 'project',
    relatedKnowledgePoints: ['1.5'],
    difficulty: 'medium',
    description: '将所有模块一次性集成调试，难以定位问题',
    solution: '先逐模块单独调试验证，再逐步集成。每集成一个模块验证一次',
    commonMistakes: ['一次写完所有代码才开始调试', '模块接口未单独测试'],
  },
  {
    id: 'P4.5.2', name: '缺少调试输出手段', level: 3, parentId: 'P4.5', category: 'project',
    relatedKnowledgePoints: ['7.4'],
    difficulty: 'easy',
    description: '没有利用LED指示灯或串口打印来输出调试信息',
    solution: '预留一个LED作状态指示；使用串口printf输出关键变量值到PC端串口助手',
    commonMistakes: ['完全"盲调"没有任何反馈信息', '调试代码发布时忘记删除影响性能'],
  },
  {
    id: 'P4.5.3', name: '不会使用逻辑分析仪/示波器定位时序问题', level: 3, parentId: 'P4.5', category: 'project',
    relatedKnowledgePoints: ['1.5.3'],
    difficulty: 'hard',
    description: '对通信时序、PWM波形等问题不知如何用仪器观察和分析',
    solution: '用示波器观察关键信号波形(时钟、数据、控制)，对比数据手册的时序要求',
    commonMistakes: ['不知道该测哪个信号', '示波器带宽不足导致波形失真'],
  },
  {
    id: 'P4.5.4', name: '问题复现和记录不规范', level: 3, parentId: 'P4.5', category: 'project',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '遇到偶发故障时不能有效复现和记录问题特征',
    solution: '记录故障的触发条件、频率、表现。尝试简化系统逐步排除变量来复现',
    commonMistakes: ['修改多处后问题消失但不知道哪个修改起作用', '偶发问题不重视直到发布后暴露'],
  },

  // ---------- P4.6 代码架构与可维护性问题 ----------
  {
    id: 'P4.6', name: '代码架构与可维护性问题', level: 2, parentId: 'P4', category: 'project',
    relatedKnowledgePoints: ['4'],
    difficulty: 'hard',
    description: '项目代码组织混乱、缺乏模块化和文档',
  },
  {
    id: 'P4.6.1', name: '所有代码放在一个文件中', level: 3, parentId: 'P4.6', category: 'project',
    relatedKnowledgePoints: ['4.2'],
    difficulty: 'easy',
    description: '不进行文件分模块，所有功能代码堆在main.c中',
    solution: '按功能分文件：uart.c/h、timer.c/h、lcd.c/h、key.c/h。main.c只做初始化和主循环调度',
    commonMistakes: ['main.c上千行难以维护', '文件间全局变量随意引用'],
  },
  {
    id: 'P4.6.2', name: '硬件依赖未抽象', level: 3, parentId: 'P4.6', category: 'project',
    relatedKnowledgePoints: ['4.2'],
    difficulty: 'hard',
    description: '硬件引脚和寄存器操作散布在业务逻辑代码中',
    solution: '用宏定义或函数封装硬件操作。如#define LED P1^0, void LED_On(void){LED=0;}',
    commonMistakes: ['更换引脚需要修改几十处代码', '业务逻辑和硬件操作耦合'],
  },
  {
    id: 'P4.6.3', name: '魔术数字和缺少注释', level: 3, parentId: 'P4.6', category: 'project',
    relatedKnowledgePoints: ['4.2'],
    difficulty: 'easy',
    description: '代码中大量使用未定义的常数，缺少有意义的注释',
    solution: '用#define或const定义有意义的常量名。关键算法和复杂逻辑处添加注释',
    commonMistakes: ['TH0=0xFC出现多处但不知道含义', '半年后自己看不懂自己的代码'],
  },
  {
    id: 'P4.6.4', name: '版本管理缺失', level: 3, parentId: 'P4.6', category: 'project',
    relatedKnowledgePoints: [],
    difficulty: 'easy',
    description: '不使用版本管理工具，靠文件夹复制备份代码',
    solution: '学习使用Git进行版本管理。每个稳定版本打标签，功能开发在分支上进行',
    commonMistakes: ['修改出错无法回退', '文件夹命名"v1_final_最终版_真的最终版"'],
  },

  // ---------- P4.7 用户交互设计不佳 ----------
  {
    id: 'P4.7', name: '用户交互设计不佳', level: 2, parentId: 'P4', category: 'project',
    relatedKnowledgePoints: ['8'],
    difficulty: 'medium',
    description: '人机交互界面和操作逻辑设计不友好',
  },
  {
    id: 'P4.7.1', name: '显示信息不清晰', level: 3, parentId: 'P4.7', category: 'project',
    relatedKnowledgePoints: ['8.1'],
    difficulty: 'easy',
    description: 'LCD或数码管显示的信息含义不明确，缺少单位和提示',
    solution: '显示内容应包含参数名称/缩写、数值和单位。如"T:25.3C"而非仅显示"253"',
    commonMistakes: ['用户不知道显示的数字代表什么', '切换界面没有提示'],
  },
  {
    id: 'P4.7.2', name: '按键操作逻辑混乱', level: 3, parentId: 'P4.7', category: 'project',
    relatedKnowledgePoints: ['8.2'],
    difficulty: 'medium',
    description: '按键功能定义不直观，操作流程复杂难记',
    solution: '按键功能保持一致性；提供长按和短按区分；复杂设置用菜单层级结构',
    commonMistakes: ['同一按键在不同界面功能完全不同', '没有退出/返回的操作方式'],
  },
  {
    id: 'P4.7.3', name: '报警与状态反馈缺失', level: 3, parentId: 'P4.7', category: 'project',
    relatedKnowledgePoints: ['8'],
    difficulty: 'easy',
    description: '系统异常时没有声光报警，正常运行时没有状态指示',
    solution: '运行指示灯周期闪烁表示正常；异常用蜂鸣器报警+LED快闪；显示错误代码',
    commonMistakes: ['系统死机但外观上看不出异常', '报警条件设置不合理导致误报'],
  },

  // ---------- P4.8 文档与报告编写问题 ----------
  {
    id: 'P4.8', name: '文档与报告编写问题', level: 2, parentId: 'P4', category: 'project',
    relatedKnowledgePoints: [],
    difficulty: 'medium',
    description: '项目报告和技术文档编写质量不达标',
  },
  {
    id: 'P4.8.1', name: '原理图绘制不规范', level: 3, parentId: 'P4.8', category: 'project',
    relatedKnowledgePoints: ['8'],
    difficulty: 'medium',
    description: '电路原理图符号不标准、连线混乱、缺少标注',
    solution: '使用标准元器件符号；信号流从左到右、从上到下；标注元件参数值和关键信号名',
    commonMistakes: ['手绘原理图潦草不清', '未标注电阻阻值和电容容值'],
  },
  {
    id: 'P4.8.2', name: '流程图与程序不一致', level: 3, parentId: 'P4.8', category: 'project',
    relatedKnowledgePoints: ['4.3'],
    difficulty: 'easy',
    description: '报告中的程序流程图与实际代码逻辑不一致',
    solution: '先画流程图再编码，或代码完成后更新流程图。流程图要能反映实际的分支和循环逻辑',
    commonMistakes: ['先写代码后画流程图时遗漏分支', '流程图中判断条件与代码不对应'],
  },
  {
    id: 'P4.8.3', name: '测试数据分析不充分', level: 3, parentId: 'P4.8', category: 'project',
    relatedKnowledgePoints: [],
    difficulty: 'medium',
    description: '只给出测试数据但缺少分析和结论',
    solution: '记录多组测试数据，计算误差、标准差。分析数据趋势和异常点。与理论值对比',
    commonMistakes: ['只测一组数据就下结论', '不分析误差来源和大小'],
  },

  // ---------- P4.9 可靠性与量产问题 ----------
  {
    id: 'P4.9', name: '可靠性与量产问题', level: 2, parentId: 'P4', category: 'project',
    relatedKnowledgePoints: ['10.3'],
    difficulty: 'hard',
    description: '从实验样机到可靠产品的过渡中遇到的问题',
  },
  {
    id: 'P4.9.1', name: '温度对系统影响未考虑', level: 3, parentId: 'P4.9', category: 'project',
    relatedKnowledgePoints: ['10.3'],
    difficulty: 'hard',
    description: '未考虑温度变化对晶振频率、传感器精度和电路参数的影响',
    solution: '关注器件的工作温度范围。关键参数的温漂需在软件中补偿或选用低温漂元器件',
    commonMistakes: ['室温测试正常但高温/低温环境失效', '晶振频偏导致串口通信在极端温度下失败'],
  },
  {
    id: 'P4.9.2', name: 'EEPROM/Flash擦写寿命未考虑', level: 3, parentId: 'P4.9', category: 'project',
    relatedKnowledgePoints: ['2.2.1'],
    difficulty: 'medium',
    description: '频繁擦写Flash/EEPROM可能超过其寿命限制',
    solution: 'Flash典型擦写寿命10万次。避免频繁写入(如每秒写一次)，使用磨损均衡策略',
    commonMistakes: ['每次采集数据都写Flash', '未使用磨损均衡导致部分扇区先损坏'],
  },
  {
    id: 'P4.9.3', name: '静电防护不足', level: 3, parentId: 'P4.9', category: 'project',
    relatedKnowledgePoints: ['10.3'],
    difficulty: 'medium',
    description: '产品外接端口缺少ESD保护',
    solution: '所有对外接口(按键、传感器、通信口)加TVS或ESD保护二极管',
    commonMistakes: ['触摸按键无ESD保护', '外接传感器口被静电击穿'],
  },

  // ---------- P4.10 综合项目常见设计缺陷 ----------
  {
    id: 'P4.10', name: '综合项目常见设计缺陷', level: 2, parentId: 'P4', category: 'project',
    relatedKnowledgePoints: ['10'],
    difficulty: 'hard',
    description: '课程设计和毕业设计中常见的系统级设计缺陷',
  },
  {
    id: 'P4.10.1', name: 'PWM控制精度不足', level: 3, parentId: 'P4.10', category: 'project',
    relatedKnowledgePoints: ['6.3', '9.4'],
    difficulty: 'medium',
    description: '软件PWM分辨率和频率不满足电机或LED调光的需求',
    solution: '利用定时器中断产生PWM。提高定时器中断频率可提高分辨率，但会增加CPU负担',
    commonMistakes: ['PWM频率太低导致电机噪声或LED闪烁', '分辨率不够导致调节粗糙'],
  },
  {
    id: 'P4.10.2', name: 'PID控制参数整定困难', level: 3, parentId: 'P4.10', category: 'project',
    relatedKnowledgePoints: ['10.1'],
    difficulty: 'hard',
    description: '温度控制或电机速度控制中PID参数调整困难',
    solution: '先只用P，再加I消除稳态误差，最后加D改善动态特性。可用试凑法或Ziegler-Nichols法',
    commonMistakes: ['P太大系统振荡', 'I太大导致积分饱和', 'D太大放大噪声'],
  },
  {
    id: 'P4.10.3', name: '多路ADC采集通道切换问题', level: 3, parentId: 'P4.10', category: 'project',
    relatedKnowledgePoints: ['9.1'],
    difficulty: 'medium',
    description: '多通道ADC切换时前一通道电压影响当前通道读数(串扰)',
    solution: '切换通道后丢弃第一次转换结果，或加延时等待采样保持电容充电完成',
    commonMistakes: ['通道切换后立即读取(值偏向前一通道)', '未丢弃首次无效转换结果'],
  },
  {
    id: 'P4.10.4', name: '数据存储与断电保持问题', level: 3, parentId: 'P4.10', category: 'project',
    relatedKnowledgePoints: ['9.5'],
    difficulty: 'medium',
    description: '需要断电保存的参数(如校准值、用户设置)未正确存储',
    solution: '使用外部EEPROM(如AT24C02)或MCU内部Flash保存。写入前校验、读出后校验',
    commonMistakes: ['断电后设置参数丢失需要重新配置', '写入EEPROM未做页面对齐'],
  },
  {
    id: 'P4.10.5', name: '实时时钟(RTC)精度不足', level: 3, parentId: 'P4.10', category: 'project',
    relatedKnowledgePoints: ['6', '9.5'],
    difficulty: 'medium',
    description: '使用定时器软件实现的时钟长期运行后误差累积过大',
    solution: '使用专用RTC芯片(DS1302/DS1307)和32.768KHz晶振。或用网络授时校准',
    commonMistakes: ['软件时钟每天偏差几分钟', 'DS1302的BCD码转换出错'],
  },
  {
    id: 'P4.10.6', name: '矩阵键盘扫描冲突', level: 3, parentId: 'P4.10', category: 'project',
    relatedKnowledgePoints: ['8.2'],
    difficulty: 'medium',
    description: '矩阵键盘多键同时按下时产生鬼键或键值识别错误',
    solution: '使用逐行扫描法+消抖。多键同时按可加二极管防鬼键或只响应第一个有效键',
    commonMistakes: ['行列线方向搞混', '扫描速度太慢导致按键响应迟钝'],
  },
  {
    id: 'P4.10.7', name: '步进电机失步问题', level: 3, parentId: 'P4.10', category: 'project',
    relatedKnowledgePoints: ['9.4'],
    difficulty: 'hard',
    description: '步进电机在加减速过程中丢步导致位置不准确',
    solution: '采用梯形或S型加减速曲线。不要瞬间高速启动，需从低速逐步加速到目标速度',
    commonMistakes: ['启动频率超过电机最高启动频率', '负载突变时未动态调整速度'],
  },
  {
    id: 'P4.10.8', name: '无线通信模块集成问题', level: 3, parentId: 'P4.10', category: 'project',
    relatedKnowledgePoints: ['7.4', '10.4'],
    difficulty: 'hard',
    description: 'NRF24L01/HC-05等无线模块与MCU通信时数据丢包或连接不稳定',
    solution: '确认SPI/UART参数匹配；增加应答和重发机制；天线远离干扰源；注意3.3V/5V电平转换',
    commonMistakes: ['5V I/O直连3.3V模块导致损坏', '未设置重发次数导致大量丢包'],
  },
  {
    id: 'P4.1.5', name: '电源方案设计不合理', level: 3, parentId: 'P4.1', category: 'project',
    relatedKnowledgePoints: ['1.4.3', '10.2'],
    difficulty: 'medium',
    description: '混合电压系统(3.3V和5V)的电源分配和电平转换设计不当',
    solution: '先用5V再用LDO(如AMS1117)产生3.3V。不同电压域之间用电平转换芯片(如TXS0108)',
    commonMistakes: ['3.3V模块直接接5V损坏', '电源纹波导致ADC精度下降'],
  },
  {
    id: 'P4.2.4', name: '中断驱动与轮询混用不当', level: 3, parentId: 'P4.2', category: 'project',
    relatedKnowledgePoints: ['5.4', '4.3'],
    difficulty: 'hard',
    description: '系统中部分功能用中断、部分用轮询，但两者配合不当导致数据竞争',
    solution: '明确每个功能的响应时间需求决定用中断还是轮询。共享资源需关中断保护或使用标志位通信',
    commonMistakes: ['中断和轮询同时操作同一端口', '长时间关中断导致其他中断丢失'],
  },
  {
    id: 'P4.6.5', name: '头文件交叉包含', level: 3, parentId: 'P4.6', category: 'project',
    relatedKnowledgePoints: ['4.2'],
    difficulty: 'medium',
    description: '多个.h文件互相包含导致编译错误或符号重定义',
    solution: '每个.h文件使用#ifndef/#define/#endif防止重复包含。减少头文件间的交叉依赖',
    commonMistakes: ['A.h包含B.h，B.h又包含A.h导致递归', '全局变量在.h中定义导致多重定义'],
  },
  {
    id: 'P4.7.4', name: '多级菜单导航困难', level: 3, parentId: 'P4.7', category: 'project',
    relatedKnowledgePoints: ['8.1.3', '8.2'],
    difficulty: 'medium',
    description: '项目中菜单层级过多，用户容易迷失在哪一层',
    solution: '菜单不超过3层；LCD第一行显示当前菜单层级/路径；提供"返回上一级"和"回到主页"快捷键',
    commonMistakes: ['进入深层菜单不知如何返回', '不同菜单页面缺少标题标识'],
  },
  {
    id: 'P3.6.5', name: '蜂鸣器驱动方式不当', level: 3, parentId: 'P3.6', category: 'experiment',
    relatedKnowledgePoints: ['8', '2.3'],
    difficulty: 'easy',
    description: '有源蜂鸣器和无源蜂鸣器使用方式混淆或驱动电流不足',
    solution: '有源蜂鸣器给电平就响；无源蜂鸣器需要方波驱动(频率决定音调)。均需三极管驱动',
    commonMistakes: ['无源蜂鸣器给高电平不响', '直接用I/O口驱动电流不足声音小'],
  },
  {
    id: 'P2.5.5', name: '中断标志位的手动清除遗漏', level: 3, parentId: 'P2.5', category: 'coding',
    relatedKnowledgePoints: ['5.4', '6.1'],
    difficulty: 'medium',
    description: '部分中断标志位需要手动清除(如串口TI/RI)，遗漏导致重复进入中断',
    solution: '定时器溢出标志TF0/TF1由硬件自动清除；串口TI/RI必须软件清除；外部中断边沿触发自动清除',
    commonMistakes: ['串口中断中忘记清TI/RI', '不区分自动清除和手动清除的中断源'],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all problem nodes belonging to a specific category.
 */
export function getProblemsByCategory(category: ProblemNode['category']): ProblemNode[] {
  return problemGraph.filter((p) => p.category === category);
}

/**
 * Get all problem nodes at a specific hierarchy level.
 */
export function getProblemsByLevel(level: 1 | 2 | 3): ProblemNode[] {
  return problemGraph.filter((p) => p.level === level);
}

/**
 * Get all direct child problems of a given parent.
 */
export function getChildProblems(parentId: string): ProblemNode[] {
  return problemGraph.filter((p) => p.parentId === parentId);
}

/**
 * Get a single problem node by its ID.
 */
export function getProblemById(id: string): ProblemNode | undefined {
  return problemGraph.find((p) => p.id === id);
}

/**
 * Get all level-3 problems related to a specific knowledge point ID.
 */
export function getProblemsByKnowledgePoint(kpId: string): ProblemNode[] {
  return problemGraph.filter(
    (p) => p.level === 3 && p.relatedKnowledgePoints.includes(kpId)
  );
}

/**
 * Get the full path (ancestors) of a problem node.
 */
export function getProblemPath(id: string): ProblemNode[] {
  const path: ProblemNode[] = [];
  let current = getProblemById(id);
  while (current) {
    path.unshift(current);
    current = current.parentId ? getProblemById(current.parentId) : undefined;
  }
  return path;
}

/**
 * Get problems filtered by difficulty.
 */
export function getProblemsByDifficulty(difficulty: ProblemNode['difficulty']): ProblemNode[] {
  return problemGraph.filter((p) => p.level === 3 && p.difficulty === difficulty);
}

// ============================================================================
// Statistics
// ============================================================================

export const problemGraphStats = {
  total: problemGraph.length,
  level1: getProblemsByLevel(1).length,
  level2: getProblemsByLevel(2).length,
  level3: getProblemsByLevel(3).length,
  byCategory: {
    concept: getProblemsByCategory('concept').filter((p) => p.level === 3).length,
    coding: getProblemsByCategory('coding').filter((p) => p.level === 3).length,
    experiment: getProblemsByCategory('experiment').filter((p) => p.level === 3).length,
    project: getProblemsByCategory('project').filter((p) => p.level === 3).length,
  },
  byDifficulty: {
    easy: getProblemsByDifficulty('easy').length,
    medium: getProblemsByDifficulty('medium').length,
    hard: getProblemsByDifficulty('hard').length,
  },
} as const;
