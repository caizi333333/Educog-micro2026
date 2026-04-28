
export type MultipleChoiceQuestion = {
  id: number;
  type: 'multiple-choice';
  questionText: string;
  options: string[];
  correctAnswer: string;
  ka: string; // Knowledge Atom
  chapter: number;
};

export type CodeCompletionQuestion = {
  id: number;
  type: 'code-completion';
  questionText: string;
  code: string; // Contains a placeholder like '___'
  correctAnswer: string;
  ka: string;
  chapter: number;
};

export type Question = MultipleChoiceQuestion | CodeCompletionQuestion;

export const quizQuestions: Question[] = [
  {
    id: 1,
    type: 'multiple-choice',
    questionText: '标准的8051微控制器采用的是什么结构？',
    options: ['冯·诺依曼结构', '哈佛结构', '普林斯顿结构', '混合结构'],
    correctAnswer: '哈佛结构',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 2,
    type: 'multiple-choice',
    questionText: '在8051中，哪个寄存器用于存放下一条要执行指令的地址？',
    options: ['A (累加器)', 'DPTR (数据指针)', 'PC (程序计数器)', 'PSW (程序状态字)'],
    correctAnswer: 'PC (程序计数器)',
    ka: '2.1',
    chapter: 1,
  },
  {
    id: 3,
    type: 'multiple-choice',
    questionText: '哪个I/O端口是纯粹的准双向口，没有第二功能？',
    options: ['P0', 'P1', 'P2', 'P3'],
    correctAnswer: 'P1',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 4,
    type: 'multiple-choice',
    questionText: '指令 `MOV A, #30H` 采用的是哪种寻址方式？',
    options: ['直接寻址', '寄存器寻址', '立即寻址', '寄存器间接寻址'],
    correctAnswer: '立即寻址',
    ka: '3.1',
    chapter: 4,
  },
  {
    id: 5,
    type: 'multiple-choice',
    questionText: '为了生成精确的串口波特率，通常使用定时器的哪种工作模式？',
    options: ['模式0 (13位定时器)', '模式1 (16位定时器)', '模式2 (8位自动重装)', '模式3 (双8位定时器)'],
    correctAnswer: '模式2 (8位自动重装)',
    ka: '6',
    chapter: 5,
  },
  {
    id: 6,
    type: 'multiple-choice',
    questionText: '在8051的中断系统中，哪个中断源的默认优先级最高？',
    options: ['定时器0溢出 (TF0)', '外部中断0 (IE0)', '定时器1溢出 (TF1)', '串行口中断 (TI/RI)'],
    correctAnswer: '外部中断0 (IE0)',
    ka: '5',
    chapter: 6,
  },
  {
    id: 7,
    type: 'multiple-choice',
    questionText: 'LED数码管动态扫描利用了人眼的什么效应？',
    options: ['视觉暂留效应', '近大远小效应', '色彩对比效应', '光圈效应'],
    correctAnswer: '视觉暂留效应',
    ka: '8.1',
    chapter: 7,
  },
  {
    id: 8,
    type: 'multiple-choice',
    questionText: '当中断服务程序执行完毕后，应该使用哪条指令返回？',
    options: ['RET', 'RETI', 'SJMP', 'LJMP'],
    correctAnswer: 'RETI',
    ka: '5',
    chapter: 6,
  },
  {
    id: 9,
    type: 'multiple-choice',
    questionText: '哪个SFR（特殊功能寄存器）用于配置定时器的工作模式？',
    options: ['TCON', 'SCON', 'TMOD', 'PCON'],
    correctAnswer: 'TMOD',
    ka: '6',
    chapter: 5,
  },
  {
    id: 10,
    type: 'multiple-choice',
    questionText: '在8051的内部RAM中，哪片区域的每一位都可以被单独操作？',
    options: ['工作寄存器区 (00H-1FH)', '可位寻址区 (20H-2FH)', '通用RAM区 (30H-7FH)', '特殊功能寄存器区 (80H-FFH)'],
    correctAnswer: '可位寻址区 (20H-2FH)',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 11,
    type: 'multiple-choice',
    questionText: '当P0端口用作通用I/O口输出高电平时，为什么通常需要外接上拉电阻？',
    options: ['因为P0是漏极开路结构', '因为P0内部有强下拉电阻', '为了提高响应速度', '为了兼容TTL电平'],
    correctAnswer: '因为P0是漏极开路结构',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 12,
    type: 'multiple-choice',
    questionText: '数据指针（DPTR）是一个多少位的寄存器？',
    options: ['8位', '16位', '32位', '4位'],
    correctAnswer: '16位',
    ka: '2.1',
    chapter: 2,
  },
  {
    id: 13,
    type: 'multiple-choice',
    questionText: '`DJNZ Rx, label` 指令的功能是什么？',
    options: ['将Rx加1，若结果不为0则跳转', '将Rx减1，若结果不为0则跳转', '将Rx与0比较，若相等则跳转', '将Rx清零并跳转'],
    correctAnswer: '将Rx减1，若结果不为0则跳转',
    ka: '3',
    chapter: 4,
  },
  {
    id: 14,
    type: 'multiple-choice',
    questionText: '在串行通信中，写入SBUF寄存器的数据会进入哪个缓冲器？',
    options: ['接收缓冲器', '发送缓冲器', '通用缓冲器', '标志寄存器'],
    correctAnswer: '发送缓冲器',
    ka: '7',
    chapter: 9,
  },
  {
    id: 15,
    type: 'multiple-choice',
    questionText: '哪个寄存器用于设置中断源的优先级？',
    options: ['IE', 'IP', 'TCON', 'SCON'],
    correctAnswer: 'IP',
    ka: '5',
    chapter: 6,
  },
  {
    id: 16,
    type: 'code-completion',
    questionText: '补全以下代码，使能定时器0的中断。',
    code: `MOV TMOD, #01H
MOV TH0, #0FCH
MOV TL0, #18H
___       ; 使能定时器0中断
SETB EA
SETB TR0`,
    correctAnswer: 'SETB ET0',
    ka: '5',
    chapter: 6,
  },
  {
    id: 17,
    type: 'code-completion',
    questionText: '补全以下代码，为定时器1的模式2（自动重装）设置9600波特率的初值（11.0592MHz晶振）。',
    code: `MOV TMOD, #20H  ; T1, 模式2
MOV SCON, #50H
___         ; 设置波特率初值
SETB TR1`,
    correctAnswer: 'MOV TH1, #0FDH',
    ka: '6',
    chapter: 5,
  },
  {
    id: 18,
    type: 'code-completion',
    questionText: '补全以下简单的延时循环。',
    code: `DELAY:
    MOV R7, #250
LOOP_HERE:
    ___  ; 循环250次
    RET`,
    correctAnswer: 'DJNZ R7, LOOP_HERE',
    ka: '3',
    chapter: 4,
  },
  {
    id: 19,
    type: 'multiple-choice',
    questionText: '访问外部数据存储器（External RAM）应该使用哪条指令？',
    options: ['MOV', 'MOVC', 'MOVX', 'PUSH'],
    correctAnswer: 'MOVX',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 20,
    type: 'code-completion',
    questionText: '补全代码，使能串行口中断。',
    code: `INIT_SERIAL:
    MOV TMOD, #20H
    MOV SCON, #50H
    MOV TH1, #0FDH
    SETB TR1
    SETB EA   ; 总中断
    ___     ; 使能串口中断
    RET`,
    correctAnswer: 'SETB ES',
    ka: '7',
    chapter: 9,
  },
  {
    id: 21,
    type: 'multiple-choice',
    questionText: '程序状态字（PSW）中的哪个标志位用于指示运算结果是否溢出？',
    options: ['CY (进位标志)', 'AC (辅助进位标志)', 'OV (溢出标志)', 'P (奇偶标志)'],
    correctAnswer: 'OV (溢出标志)',
    ka: '2.1',
    chapter: 2,
  },
  {
    id: 22,
    type: 'multiple-choice',
    questionText: 'P3.1引脚的第二功能是什么？',
    options: ['外部中断1 (INT1)', '定时器0输入 (T0)', '串行数据发送 (TXD)', '写外部存储器 (/WR)'],
    correctAnswer: '串行数据发送 (TXD)',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 23,
    type: 'multiple-choice',
    questionText: '指令 `MOVC A, @A+DPTR` 主要用于什么场合？',
    options: ['访问内部RAM', '访问外部RAM', '从程序存储器查表', '访问特殊功能寄存器'],
    correctAnswer: '从程序存储器查表',
    ka: '3.1',
    chapter: 4,
  },
  {
    id: 24,
    type: 'code-completion',
    questionText: '补全代码，使用寄存器间接寻址，将R0指向的内部RAM单元内容送到A。',
    code: `MOV R0, #40H
___`,
    correctAnswer: 'MOV A, @R0',
    ka: '3.1',
    chapter: 4,
  },
  {
    id: 25,
    type: 'multiple-choice',
    questionText: '在数码管动态扫描程序中，“消隐”操作的主要目的是什么？',
    options: ['节省功耗', '提高亮度', '防止切换时产生“鬼影”', '简化代码'],
    correctAnswer: '防止切换时产生“鬼影”',
    ka: '8.1',
    chapter: 7,
  },
  {
    id: 26,
    type: 'multiple-choice',
    questionText: '为了让动态扫描的显示看起来稳定无闪烁，扫描频率通常需要高于多少？',
    options: ['10Hz', '24Hz', '50Hz', '1000Hz'],
    correctAnswer: '50Hz',
    ka: '8.1',
    chapter: 7,
  },
  {
    id: 27,
    type: 'multiple-choice',
    questionText: '`ACALL` 和 `LCALL` 指令的主要区别是什么？',
    options: ['目标地址的跳转范围不同', '执行速度不同', '消耗的机器周期数相同', '对堆栈的影响不同'],
    correctAnswer: '目标地址的跳转范围不同',
    ka: '3',
    chapter: 4,
  },
  {
    id: 28,
    type: 'multiple-choice',
    questionText: '在串行通信中，当SCON寄存器中的TI标志位被硬件置1时，表示什么？',
    options: ['已成功接收一个字节', '已成功发送一个字节', '接收发生错误', '发送发生错误'],
    correctAnswer: '已成功发送一个字节',
    ka: '7',
    chapter: 9,
  },
  {
    id: 29,
    type: 'multiple-choice',
    questionText: '8051微控制器的CPU是多少位的？',
    options: ['4位', '8位', '16位', '32位'],
    correctAnswer: '8位',
    ka: '2.1',
    chapter: 1,
  },
  {
    id: 30,
    type: 'multiple-choice',
    questionText: '下列哪个不是8051微控制器的内部组件？',
    options: ['ALU', 'RAM', 'ROM', 'DMA控制器'],
    correctAnswer: 'DMA控制器',
    ka: '2.1',
    chapter: 1,
  },
  {
    id: 31,
    type: 'multiple-choice',
    questionText: '8051的引脚EA的作用是什么？',
    options: ['允许/禁止中断', '选择内部或外部程序存储器', '提供地址锁存信号', '接收外部事件'],
    correctAnswer: '选择内部或外部程序存储器',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 32,
    type: 'multiple-choice',
    questionText: '8051的堆栈指针SP在复位后的初始值是多少？',
    options: ['00H', '07H', '08H', 'FFH'],
    correctAnswer: '07H',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 33,
    type: 'multiple-choice',
    questionText: '`PUSH`指令会使堆栈指针SP如何变化？',
    options: ['先加1，后存数据', '先存数据，后加1', '先减1，后存数据', '先存数据，后减1'],
    correctAnswer: '先加1，后存数据',
    ka: '3',
    chapter: 2,
  },
  {
    id: 34,
    type: 'code-completion',
    questionText: '补全代码，将累加器A的内容压入堆栈以进行保护。',
    code: `; 子程序调用前保护现场
___
ACALL SOME_SUBROUTINE
POP ACC`,
    correctAnswer: 'PUSH ACC',
    ka: '3',
    chapter: 2,
  },
  {
    id: 35,
    type: 'multiple-choice',
    questionText: '访问地址为90H的SFR，实际上是访问哪个端口？',
    options: ['P0', 'P1', 'P2', 'P3'],
    correctAnswer: 'P1',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 36,
    type: 'multiple-choice',
    questionText: '在8051中，DPH和DPL分别代表数据指针DPTR的哪部分？',
    options: ['都是高8位', '都是低8位', '高8位和低8位', '低8位和高8位'],
    correctAnswer: '高8位和低8位',
    ka: '2.1',
    chapter: 2,
  },
  {
    id: 37,
    type: 'code-completion',
    questionText: '补全代码，将堆栈顶的数据弹出到直接地址为05H的单元（即R5）。',
    code: `...
; 恢复R5之前保存的值
___
...`,
    correctAnswer: 'POP 05H',
    ka: '3',
    chapter: 2,
  },
  {
    id: 38,
    type: 'multiple-choice',
    questionText: '对P1口执行“读-修改-写”操作时，可能会引发什么问题？',
    options: ['端口被烧毁', '引脚状态被意外锁存', '系统复位', '程序跑飞'],
    correctAnswer: '引脚状态被意外锁存',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 39,
    type: 'code-completion',
    questionText: '补全代码，将P3口设置为高阻态输入，以读取外部信号。',
    code: `INIT_P3:
    ___
    RET`,
    correctAnswer: 'MOV P3, #0FFH',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 40,
    type: 'multiple-choice',
    questionText: 'P3口的哪个引脚用作外部中断1 (INT1)？',
    options: ['P3.0', 'P3.1', 'P3.2', 'P3.3'],
    correctAnswer: 'P3.3',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 41,
    type: 'multiple-choice',
    questionText: '使用P0口作为地址/数据复用总线时，需要配合哪个信号来分离地址和数据？',
    options: ['PSEN', 'EA', 'ALE', 'RST'],
    correctAnswer: 'ALE',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 42,
    type: 'code-completion',
    questionText: '补全代码，将P2口的低4位清零，高4位保持不变。',
    code: `...
; 只操作P2的高四位，屏蔽低四位
___
...`,
    correctAnswer: 'ANL P2, #0F0H',
    ka: '3',
    chapter: 4,
  },
  {
    id: 43,
    type: 'multiple-choice',
    questionText: '指令 `XRL A, #0FFH` 等效于什么操作？',
    options: ['SETB A', 'CLR A', 'CPL A', 'NOP'],
    correctAnswer: 'CPL A',
    ka: '3',
    chapter: 4,
  },
  {
    id: 44,
    type: 'code-completion',
    questionText: '补全代码，实现将A寄存器的内容乘以B寄存器的内容。',
    code: `MOV A, #10
MOV B, #20
___ ; A*B -> 结果低8位在A,高8位在B`,
    correctAnswer: 'MUL AB',
    ka: '3',
    chapter: 4,
  },
  {
    id: 45,
    type: 'multiple-choice',
    questionText: '`CJNE A, #data, rel` 指令执行时，如果A不等于#data，会发生什么？',
    options: ['程序跳转到rel指定的地址', 'A的值被修改为#data', 'CY标志位置位', '程序停止'],
    correctAnswer: '程序跳转到rel指定的地址',
    ka: '3',
    chapter: 4,
  },
  {
    id: 46,
    type: 'multiple-choice',
    questionText: '`DA A` 指令的作用是什么？',
    options: ['对A进行逻辑与操作', '对A进行十进制调整', '将A右移一位', '将A除以2'],
    correctAnswer: '对A进行十进制调整',
    ka: '3',
    chapter: 4,
  },
  {
    id: 47,
    type: 'multiple-choice',
    questionText: '`RR A` 和 `RRC A` 指令的主要区别是什么？',
    options: ['旋转方向不同', '旋转速度不同', '是否包含进位位CY一起旋转', '操作的寄存器不同'],
    correctAnswer: '是否包含进位位CY一起旋转',
    ka: '3',
    chapter: 4,
  },
  {
    id: 48,
    type: 'code-completion',
    questionText: '补全代码，无条件跳转到名为 "LOOP_START" 的标签处。',
    code: `...
; 完成初始化,进入主循环
___
LOOP_START:
    ...`,
    correctAnswer: 'SJMP LOOP_START',
    ka: '3',
    chapter: 4,
  },
  {
    id: 49,
    type: 'multiple-choice',
    questionText: '访问内部RAM地址为60H的单元，属于哪种寻址方式？',
    options: ['立即寻址', '直接寻址', '寄存器寻址', '间接寻址'],
    correctAnswer: '直接寻址',
    ka: '3.1',
    chapter: 4,
  },
  {
    id: 50,
    type: 'code-completion',
    questionText: '补全代码，启动定时器1。',
    code: `...
; 定时器1已配置完成
___ ; 开始计时
...`,
    correctAnswer: 'SETB TR1',
    ka: '6',
    chapter: 5,
  },
  {
    id: 51,
    type: 'multiple-choice',
    questionText: '假设晶振为12MHz，在定时器模式1下，若要定时50ms，THx和TLx的初值应为多少？',
    options: ['B8H, 3EH', '3CH, B0H', 'FCH, 18H', 'FFH, FFH'],
    correctAnswer: '3CH, B0H',
    ka: '6',
    chapter: 5,
  },
  {
    id: 52,
    type: 'multiple-choice',
    questionText: 'TMOD寄存器的GATE位的作用是什么？',
    options: ['选择定时器或计数器模式', '控制定时器是否受外部引脚INTx控制启动', '启动或停止定时器', '设置定时器工作模式'],
    correctAnswer: '控制定时器是否受外部引脚INTx控制启动',
    ka: '6',
    chapter: 5,
  },
  {
    id: 53,
    type: 'code-completion',
    questionText: '补全代码，使用查询法等待定时器0的溢出标志TF0，直到其置位。',
    code: `WAIT_TF0:
    ___  ; 如果TF0为0，则在此处循环
    CLR TF0
    RET`,
    correctAnswer: 'JNB TF0, WAIT_TF0',
    ka: '6',
    chapter: 5,
  },
  {
    id: 54,
    type: 'multiple-choice',
    questionText: '将定时器用作计数器模式时，TMOD寄存器的C/T位应设置为？',
    options: ['0', '1', '不关心', '由GATE位决定'],
    correctAnswer: '1',
    ka: '6',
    chapter: 5,
  },
  {
    id: 55,
    type: 'multiple-choice',
    questionText: '中断响应后，CPU会自动将哪个寄存器的内容压入堆栈？',
    options: ['A', 'PSW', 'PC', 'SP'],
    correctAnswer: 'PC',
    ka: '5',
    chapter: 6,
  },
  {
    id: 56,
    type: 'code-completion',
    questionText: '补全代码，设置外部中断0为电平触发方式。',
    code: `; 设置INT0为电平触发
___
SETB EX0
SETB EA`,
    correctAnswer: 'CLR IT0',
    ka: '5',
    chapter: 6,
  },
  {
    id: 57,
    type: 'multiple-choice',
    questionText: '当一个低优先级中断正在服务时，如果一个高优先级中断请求到来，会发生什么？',
    options: ['高优先级中断被忽略', '低优先级中断被暂停，CPU响应高优先级中断', '系统复位', '两个中断轮流执行'],
    correctAnswer: '低优先级中断被暂停，CPU响应高优先级中断',
    ka: '5',
    chapter: 6,
  },
  {
    id: 58,
    type: 'multiple-choice',
    questionText: '串行口中断的向量地址是多少？',
    options: ['0003H', '000BH', '001BH', '0023H'],
    correctAnswer: '0023H',
    ka: '5',
    chapter: 6,
  },
  {
    id: 59,
    type: 'code-completion',
    questionText: '补全代码，在IE寄存器中，屏蔽（禁止）除总开关EA外的所有中断。',
    code: `; 关断所有中断源，仅保留总开关开启
___`,
    correctAnswer: 'MOV IE, #80H',
    ka: '5',
    chapter: 6,
  },
  {
    id: 60,
    type: 'multiple-choice',
    questionText: '共阳极数码管的公共端应连接到什么电平？',
    options: ['VCC (高电平)', 'GND (低电平)', '数据线', '悬空'],
    correctAnswer: 'VCC (高电平)',
    ka: '8.1',
    chapter: 7,
  },
  {
    id: 61,
    type: 'multiple-choice',
    questionText: '在矩阵键盘扫描中，判断是否有键按下的基本方法是？',
    options: ['先输出行线高电平，再检测列线电平', '先输出行线低电平，再检测列线电平', '同时检测行列电平', '测量端口电阻'],
    correctAnswer: '先输出行线低电平，再检测列线电平',
    ka: '8.2.2',
    chapter: 7,
  },
  {
    id: 62,
    type: 'code-completion',
    questionText: '补全代码，获取数字\'8\'的共阴极七段码（gfedcba=01111111b=7FH），并送到P0口。',
    code: `MOV P0, ___`,
    correctAnswer: '#7FH',
    ka: '8.1',
    chapter: 7,
  },
  {
    id: 63,
    type: 'multiple-choice',
    questionText: '提高动态扫描的刷新频率，会如何影响显示亮度？',
    options: ['亮度降低', '亮度增加', '亮度不变', '显示乱码'],
    correctAnswer: '亮度增加',
    ka: '8.1',
    chapter: 7,
  },
  {
    id: 64,
    type: 'multiple-choice',
    questionText: '驱动一个4x4的矩阵键盘，最少需要多少个I/O口？',
    options: ['4', '8', '16', '1'],
    correctAnswer: '8',
    ka: '8.2.2',
    chapter: 7,
  },
  {
    id: 65,
    type: 'multiple-choice',
    questionText: 'ADC0804的分辨率是多少位？',
    options: ['4位', '8位', '10位', '12位'],
    correctAnswer: '8位',
    ka: '8.3',
    chapter: 8,
  },
  {
    id: 66,
    type: 'multiple-choice',
    questionText: '在与ADC0804通信时，哪个信号的下降沿表示转换结束？',
    options: ['WR', 'RD', 'CS', 'INTR'],
    correctAnswer: 'INTR',
    ka: '8.3',
    chapter: 8,
  },
  {
    id: 67,
    type: 'code-completion',
    questionText: '要启动ADC0804进行转换，需要给它的WR引脚一个负脉冲。补全以下代码的第一步。',
    code: `START_CONV:
    ___       ; 产生下降沿
    SETB P3.6 ; 产生上升沿，完成脉冲
    RET`,
    correctAnswer: 'CLR P3.6',
    ka: '8.3',
    chapter: 8,
  },
  {
    id: 68,
    type: 'multiple-choice',
    questionText: '如果ADC的参考电压是5V，8位ADC读出的数字量是80H (十进制128)，那么输入的模拟电压大约是多少？',
    options: ['5V', '0V', '2.5V', '1.25V'],
    correctAnswer: '2.5V',
    ka: '8.3',
    chapter: 8,
  },
  {
    id: 69,
    type: 'multiple-choice',
    questionText: 'ADC转换过程中的“量化误差”是指什么？',
    options: ['由温度变化引起的误差', '模拟电压被近似为最接近的数字等级所产生的误差', '电源噪声干扰', '参考电压不稳'],
    correctAnswer: '模拟电压被近似为最接近的数字等级所产生的误差',
    ka: '8.3',
    chapter: 8,
  },
  {
    id: 70,
    type: 'multiple-choice',
    questionText: '在SCON寄存器中，REN位的作用是什么？',
    options: ['允许串行发送', '允许串行接收', '复位串口', '选择串口模式'],
    correctAnswer: '允许串行接收',
    ka: '7',
    chapter: 9,
  },
  {
    id: 71,
    type: 'code-completion',
    questionText: '在接收到数据后，应由软件清除接收中断标志RI。补全该操作。',
    code: `READ_CHAR:
    JNB RI, READ_CHAR ; 等待接收完成
    MOV A, SBUF
    ___               ; 清除接收标志`,
    correctAnswer: 'CLR RI',
    ka: '7',
    chapter: 9,
  },
  {
    id: 72,
    type: 'multiple-choice',
    questionText: '波特率的单位是什么？',
    options: ['Hz', 'Bps', 'bps', 'B/s'],
    correctAnswer: 'bps',
    ka: '7',
    chapter: 9,
  },
  {
    id: 73,
    type: 'multiple-choice',
    questionText: '使用11.0592MHz晶振而不是12MHz晶振进行串行通信，主要是为了什么？',
    options: ['功耗更低', '价格更便宜', '可以无误差地生成标准波特率', '速度更快'],
    correctAnswer: '可以无误差地生成标准波特率',
    ka: '7',
    chapter: 9,
  },
  {
    id: 74,
    type: 'multiple-choice',
    questionText: 'SBUF寄存器在物理上是几个寄存器？',
    options: ['1个', '2个', '4个', '8个'],
    correctAnswer: '2个',
    ka: '7',
    chapter: 9,
  },
  {
    id: 75,
    type: 'multiple-choice',
    questionText: '8051复位后，默认使用的工作寄存器组是哪一组？',
    options: ['Bank 0', 'Bank 1', 'Bank 2', 'Bank 3'],
    correctAnswer: 'Bank 0',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 76,
    type: 'code-completion',
    questionText: '补全代码，将P1.7引脚置为高电平。',
    code: `...
; 点亮连接在P1.7的某个指示灯
___
...`,
    correctAnswer: 'SETB P1.7',
    ka: '3',
    chapter: 3,
  },
  {
    id: 77,
    type: 'multiple-choice',
    questionText: '`SUBB A, R1` 指令执行的是什么运算？',
    options: ['A = A - R1', 'A = A - R1 - CY', 'R1 = A - R1', 'A = R1 - A'],
    correctAnswer: 'A = A - R1 - CY',
    ka: '3',
    chapter: 4,
  },
  {
    id: 78,
    type: 'multiple-choice',
    questionText: '在定时器模式2中，当TLx溢出后，从哪里自动重装初值？',
    options: ['TLx自身', 'THx', 'ROM', '一个固定的内部寄存器'],
    correctAnswer: 'THx',
    ka: '6',
    chapter: 5,
  },
  {
    id: 79,
    type: 'multiple-choice',
    questionText: '`RETI` 指令除了返回主程序，还执行了什么关键操作？',
    options: ['清除所有中断标志', '恢复中断优先级逻辑状态', '将SP指针清零', '使能所有中断'],
    correctAnswer: '恢复中断优先级逻辑状态',
    ka: '5',
    chapter: 6,
  },
  {
    id: 80,
    type: 'multiple-choice',
    questionText: '在一个标准的UART数据帧中，起始位是什么电平？',
    options: ['高电平', '低电平', '高阻态', '不确定'],
    correctAnswer: '低电平',
    ka: '7',
    chapter: 9,
  },
  {
    id: 81,
    type: 'multiple-choice',
    questionText: '“冯·诺依曼”结构的主要特点是什么？',
    options: ['程序和数据有独立的存储空间和总线', '程序和数据共享同一存储空间和总线', '只有数据存储器', '只能执行预设程序'],
    correctAnswer: '程序和数据共享同一存储空间和总线',
    ka: '2.1',
    chapter: 1,
  },
  {
    id: 82,
    type: 'code-completion',
    questionText: '补全代码，设置堆栈指针SP为60H，让堆栈从61H开始。',
    code: `...
; 初始化堆栈
___
...`,
    correctAnswer: 'MOV SP, #60H',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 83,
    type: 'multiple-choice',
    questionText: 'P3.7引脚的第二功能是什么？',
    options: ['/INT1', '/T0', 'TXD', '/RD'],
    correctAnswer: '/RD',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 84,
    type: 'multiple-choice',
    questionText: '指令 `LJMP` 的跳转范围是多少？',
    options: ['2K', '4K', '32K', '64K'],
    correctAnswer: '64K',
    ka: '3',
    chapter: 4,
  },
  {
    id: 85,
    type: 'code-completion',
    questionText: '补全代码，将定时器0设置为计数器模式（模式1）。',
    code: `; 设置T0为16位计数器模式
___`,
    correctAnswer: 'MOV TMOD, #05H',
    ka: '6',
    chapter: 5,
  },
  {
    id: 86,
    type: 'multiple-choice',
    questionText: '如果IP寄存器的值为00001001B，哪个中断的优先级最高？',
    options: ['外部中断0 (IE0)', '定时器0 (TF0)', '外部中断1 (IE1)', '定时器1 (TF1)'],
    correctAnswer: '外部中断0 (IE0)',
    ka: '5',
    chapter: 6,
  },
  {
    id: 87,
    type: 'multiple-choice',
    questionText: '在共阴极数码管中，要显示数字\'1\'(段码06H)，应该让哪些段点亮？',
    options: ['a, b', 'b, c', 'e, d', 'f, g'],
    correctAnswer: 'b, c',
    ka: '8.1',
    chapter: 7,
  },
  {
    id: 88,
    type: 'multiple-choice',
    questionText: 'ADC的“转换时间”是指什么？',
    options: ['CPU读取一次数据的时间', '从启动转换到获得稳定数字输出所需的时间', '两次转换之间的最小间隔', 'ADC的预热时间'],
    correctAnswer: '从启动转换到获得稳定数字输出所需的时间',
    ka: '8.3',
    chapter: 8,
  },
  {
    id: 89,
    type: 'code-completion',
    questionText: '补全代码，将累加器中的字符\'X\'通过串口发送出去（假设SEND_CHAR子程序已定义）。',
    code: `___
ACALL SEND_CHAR`,
    correctAnswer: `MOV A, #'X'`,
    ka: '7',
    chapter: 9,
  },
  {
    id: 90,
    type: 'multiple-choice',
    questionText: '8051的特殊功能寄存器(SFR)地址范围是多少？',
    options: ['00H - 7FH', '80H - FFH', 'F0H - FFH', '00H - FFH'],
    correctAnswer: '80H - FFH',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 91,
    type: 'multiple-choice',
    questionText: '`XCH A, R3` 指令的作用是什么？',
    options: ['将A和R3的内容相加', '将R3的内容复制到A', '将A和R3的内容交换', '将A和R3清零'],
    correctAnswer: '将A和R3的内容交换',
    ka: '3',
    chapter: 4,
  },
  {
    id: 92,
    type: 'multiple-choice',
    questionText: '如果一个定时器的溢出标志TFx被置1，但对应的中断没有被允许（ETx=0），会发生什么？',
    options: ['什么都不会发生', '仅标志位置位，不会产生中断', '系统复位', 'CPU进入空闲状态'],
    correctAnswer: '仅标志位置位，不会产生中断',
    ka: '6',
    chapter: 5,
  },
  {
    id: 93,
    type: 'multiple-choice',
    questionText: '中断向量表位于哪个存储器空间？',
    options: ['内部RAM', '外部RAM', '程序存储器ROM', 'SFR区'],
    correctAnswer: '程序存储器ROM',
    ka: '5',
    chapter: 6,
  },
  {
    id: 94,
    type: 'multiple-choice',
    questionText: '在串行通信中，奇偶校验位的作用是什么？',
    options: ['标记数据结束', '标记数据开始', '用于简单的差错检测', '提高传输速度'],
    correctAnswer: '用于简单的差错检测',
    ka: '7',
    chapter: 9,
  },
  {
    id: 95,
    type: 'multiple-choice',
    questionText: '`MOV A, @R0` 指令中，R0可以寻址的内部RAM范围是多少？',
    options: ['00H - 1FH', '00H - 2FH', '00H - 7FH', '80H - FFH'],
    correctAnswer: '00H - 7FH',
    ka: '3.1',
    chapter: 2,
  },
  {
    id: 96,
    type: 'code-completion',
    questionText: '补全代码，将累加器A的内容循环左移一位（不通过进位位）。',
    code: `MOV A, #81H ; A = 10000001B
___       ; 执行后 A = 00000011B`,
    correctAnswer: 'RL A',
    ka: '3',
    chapter: 4,
  },
  {
    id: 97,
    type: 'multiple-choice',
    questionText: 'TCON寄存器中的IT1位用于设置什么？',
    options: ['定时器1的工作模式', '外部中断1的触发方式', '启动定时器1', '定时器1的溢出标志'],
    correctAnswer: '外部中断1的触发方式',
    ka: '5',
    chapter: 6,
  },
  {
    id: 98,
    type: 'multiple-choice',
    questionText: '中断服务程序的入口地址称为？',
    options: ['中断向量', '中断标志', '中断请求', '中断优先级'],
    correctAnswer: '中断向量',
    ka: '5',
    chapter: 6,
  },
  {
    id: 99,
    type: 'code-completion',
    questionText: '补全代码，查表获取字符\'A\'（十六进制值为10）的共阴极段码（77H）。',
    code: `SEG_TABLE: DB ..., 77H, ...
MOV A, #10
MOV DPTR, #SEG_TABLE
___`,
    correctAnswer: 'MOVC A, @A+DPTR',
    ka: '3',
    chapter: 7,
  },
  {
    id: 100,
    type: 'multiple-choice',
    questionText: 'SCON寄存器中的SM2位在什么模式下起作用，主要用于什么场景？',
    options: ['模式1，提高波特率精度', '模式0，兼容老设备', '模式2和3，用于多机通信', '所有模式，用于错误检测'],
    correctAnswer: '模式2和3，用于多机通信',
    ka: '7',
    chapter: 9,
  },

  // === 矩阵键盘扫描 (补充8题) ===
  {
    id: 101,
    type: 'multiple-choice',
    questionText: '4x4矩阵键盘通常需要多少根I/O线？',
    options: ['4根', '6根', '8根', '16根'],
    correctAnswer: '8根',
    ka: '8.2.2',
    chapter: 8,
  },
  {
    id: 102,
    type: 'code-completion',
    questionText: '补全代码，扫描矩阵键盘的第1行（设定该行为低电平，其他行为高电平）。',
    code: `; 扫描矩阵键盘第1行
MOV P1, #___  ; P1.7-P1.4控制行，P1.3-P1.0读取列`,
    correctAnswer: '0EFH',
    ka: '8.2.2',
    chapter: 8,
  },
  {
    id: 103,
    type: 'multiple-choice',
    questionText: '矩阵键盘扫描中，如果检测到P1口为0EEH（11101110B），表示什么？',
    options: ['第1行第2列按键被按下', '第1行第1列按键被按下', '第2行第2列按键被按下', '没有按键按下'],
    correctAnswer: '第1行第2列按键被按下',
    ka: '8.2.2',
    chapter: 8,
  },
  {
    id: 104,
    type: 'code-completion',
    questionText: '补全代码，消除按键抖动的延时子程序（约10ms）。',
    code: `DELAY_10MS:
    MOV R6, #10    ; 外层循环
D1: MOV R7, #___   ; 内层循环，约1ms
D2: DJNZ R7, D2
    DJNZ R6, D1
    RET`,
    correctAnswer: '200',
    ka: '8.2.2',
    chapter: 8,
  },
  {
    id: 105,
    type: 'multiple-choice',
    questionText: '键盘扫描中的"去抖动"处理通常采用什么方法？',
    options: ['硬件滤波', '软件延时', '中断处理', '硬件滤波和软件延时'],
    correctAnswer: '硬件滤波和软件延时',
    ka: '8.2.2',
    chapter: 8,
  },
  {
    id: 106,
    type: 'code-completion',
    questionText: '补全代码，等待按键释放的检测循环。',
    code: `WAIT_RELEASE:
    MOV P1, #0F0H    ; 所有行输出低电平
    MOV A, P1        ; 读取按键状态
    ANL A, #0FH      ; 只保留列信息
    CJNE A, #___, WAIT_RELEASE  ; 等待所有按键释放
    RET`,
    correctAnswer: '0FH',
    ka: '8.2.2',
    chapter: 8,
  },
  {
    id: 107,
    type: 'multiple-choice',
    questionText: '4x4矩阵键盘的扫描频率一般设置为多少比较合适？',
    options: ['1Hz', '10Hz', '100Hz', '1kHz'],
    correctAnswer: '100Hz',
    ka: '8.2.2',
    chapter: 8,
  },
  {
    id: 108,
    type: 'code-completion',
    questionText: '补全代码，计算矩阵键盘的键值（行号*4+列号）。',
    code: `; R2=行号(0-3), R3=列号(0-3)
; 计算键值 = 行号*4 + 列号
CALC_KEY:
    MOV A, R2       ; A = 行号
    ___             ; A = 行号 * 4
    ADD A, R3       ; A = 行号*4 + 列号
    MOV R4, A       ; 保存键值到R4
    RET`,
    correctAnswer: 'RL A\nRL A',
    ka: '8.2.2',
    chapter: 8,
  },

  // === ADC应用 (补充6题) ===
  {
    id: 109,
    type: 'multiple-choice',
    questionText: '8位ADC的量化精度是多少？',
    options: ['1/128', '1/255', '1/256', '1/512'],
    correctAnswer: '1/256',
    ka: '8.3',
    chapter: 9,
  },
  {
    id: 110,
    type: 'code-completion',
    questionText: '补全代码，启动ADC0809的模拟通道0转换。',
    code: `; ADC0809控制信号连接：
; P2.0-P2.2: 地址线A/B/C
; P2.3: START
; P2.4: EOC
MOV P2, #___    ; 选择通道0并启动转换
SETB P2.3       ; 启动转换脉冲
CLR P2.3`,
    correctAnswer: '08H',
    ka: '8.3',
    chapter: 9,
  },
  {
    id: 111,
    type: 'multiple-choice',
    questionText: 'ADC0809的转换时间大约是多少？',
    options: ['10μs', '100μs', '1ms', '10ms'],
    correctAnswer: '100μs',
    ka: '8.3',
    chapter: 9,
  },
  {
    id: 112,
    type: 'code-completion',
    questionText: '补全代码，等待ADC转换完成的检测循环。',
    code: `WAIT_ADC:
    JNB P2.4, WAIT_ADC  ; 等待EOC变高
    MOV P0, #___        ; 输出使能信号
    MOV A, P1           ; 读取转换结果
    MOV P0, #0FFH       ; 禁止输出
    RET`,
    correctAnswer: '00H',
    ka: '8.3',
    chapter: 9,
  },
  {
    id: 113,
    type: 'multiple-choice',
    questionText: '如果ADC的参考电压是5V，8位ADC读到的数值是128，实际电压是多少？',
    options: ['1.25V', '2.5V', '3.75V', '5V'],
    correctAnswer: '2.5V',
    ka: '8.3',
    chapter: 9,
  },
  {
    id: 114,
    type: 'code-completion',
    questionText: '补全代码，将ADC读取的8位数据转换为3位BCD码显示（0-255转换为000-255）。',
    code: `; A寄存器中存放ADC结果(0-255)
ADC_TO_BCD:
    MOV B, #100
    DIV AB          ; A=百位，B=余数
    MOV R2, A       ; 保存百位
    MOV A, B
    MOV B, #___     ; 继续分解十位和个位
    DIV AB
    MOV R3, A       ; 保存十位
    MOV R4, B       ; 保存个位
    RET`,
    correctAnswer: '10',
    ka: '8.3',
    chapter: 9,
  },

  // === 寻址方式 (补充5题) ===
  {
    id: 115,
    type: 'multiple-choice',
    questionText: '8051有几种寻址方式？',
    options: ['4种', '5种', '6种', '7种'],
    correctAnswer: '7种',
    ka: '3.1',
    chapter: 2,
  },
  {
    id: 116,
    type: 'code-completion',
    questionText: '补全代码，使用寄存器间接寻址读取内部RAM 30H单元的内容。',
    code: `MOV R0, #30H     ; R0指向30H地址
___              ; 将30H单元内容读入累加器`,
    correctAnswer: 'MOV A, @R0',
    ka: '3.1',
    chapter: 2,
  },
  {
    id: 117,
    type: 'multiple-choice',
    questionText: '指令"MOV A, #20H"使用的是什么寻址方式？',
    options: ['直接寻址', '立即寻址', '寄存器寻址', '间接寻址'],
    correctAnswer: '立即寻址',
    ka: '3.1',
    chapter: 2,
  },
  {
    id: 118,
    type: 'code-completion',
    questionText: '补全代码，使用变址寻址读取程序存储器中的数据表。',
    code: `DPTR_TABLE: DB 10H, 20H, 30H, 40H
    ...
    MOV A, #2       ; 读取第3个数据(30H)
    MOV DPTR, #DPTR_TABLE
    ___`,
    correctAnswer: 'MOVC A, @A+DPTR',
    ka: '3.1',
    chapter: 2,
  },
  {
    id: 119,
    type: 'multiple-choice',
    questionText: '"MOV @R1, A"指令中的@R1属于什么寻址方式？',
    options: ['直接寻址', '寄存器寻址', '寄存器间接寻址', '相对寻址'],
    correctAnswer: '寄存器间接寻址',
    ka: '3.1',
    chapter: 2,
  },

  // === CPU结构 (补充代码题) ===
  {
    id: 120,
    type: 'code-completion',
    questionText: '补全代码，保存现场（将累加器和PSW压入堆栈）。',
    code: `; 保存现场
PUSH ___
PUSH PSW`,
    correctAnswer: 'ACC',
    ka: '2.1',
    chapter: 1,
  },
  {
    id: 121,
    type: 'code-completion',
    questionText: '补全代码，设置PSW寄存器选择第2组工作寄存器（R16-R23）。',
    code: `; 选择第2组工作寄存器
MOV PSW, #___   ; RS1=1, RS0=0`,
    correctAnswer: '10H',
    ka: '2.1',
    chapter: 1,
  },

  // === 存储器结构 (补充题) ===
  {
    id: 122,
    type: 'multiple-choice',
    questionText: '8051内部RAM中，20H-2FH区域被称为什么？',
    options: ['工作寄存器区', '位寻址区', '用户RAM区', '特殊功能寄存器区'],
    correctAnswer: '位寻址区',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 123,
    type: 'code-completion',
    questionText: '补全代码，直接操作位地址22H的第3位（对应字节地址24H的bit3）。',
    code: `; 设置24H单元的bit3为1
SETB ___`,
    correctAnswer: '23H',
    ka: '2.2',
    chapter: 2,
  },

  // === I/O端口 (补充题) ===
  {
    id: 124,
    type: 'code-completion',
    questionText: '补全代码，将P1口配置为输入口（所有位设为高电平）。',
    code: `; 配置P1口为输入
MOV P1, #___`,
    correctAnswer: '0FFH',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 125,
    type: 'multiple-choice',
    questionText: 'P0口作为地址/数据复用总线时，需要外接什么器件？',
    options: ['上拉电阻', '锁存器', '缓冲器', '锁存器和上拉电阻'],
    correctAnswer: '锁存器和上拉电阻',
    ka: '2.3',
    chapter: 3,
  },

  // === 指令系统 (补充代码题) ===
  {
    id: 126,
    type: 'code-completion',
    questionText: '补全代码，实现两个16位数相加（高字节在R1、R3，低字节在R0、R2）。',
    code: `; 16位加法: (R1R0) + (R3R2) -> (R1R0)
    MOV A, R0       ; 低字节相加
    ADD A, R2
    MOV R0, A
    MOV A, R1       ; 高字节相加（含进位）
    ___
    MOV R1, A`,
    correctAnswer: 'ADDC A, R3',
    ka: '3',
    chapter: 4,
  },

  // === 定时器/计数器 (补充题) ===
  {
    id: 127,
    type: 'multiple-choice',
    questionText: '定时器工作在模式2时的特点是什么？',
    options: ['13位定时器', '16位定时器', '8位自动重装定时器', '分频定时器'],
    correctAnswer: '8位自动重装定时器',
    ka: '6',
    chapter: 5,
  },
  {
    id: 128,
    type: 'code-completion',
    questionText: '补全代码，设置定时器1工作在模式2，定时1ms（12MHz晶振）。',
    code: `; T1模式2，定时1ms
    MOV TMOD, #20H   ; T1模式2
    MOV TH1, #___    ; 重装载值(256-250=6)
    MOV TL1, #___    ; 初值
    SETB TR1         ; 启动T1`,
    correctAnswer: '06H\n06H',
    ka: '6',
    chapter: 5,
  },

  // === 中断系统 (补充题) ===
  {
    id: 129,
    type: 'code-completion',
    questionText: '补全代码，设置外部中断0为边沿触发方式。',
    code: `; 设置INT0为边沿触发
    SETB ___        ; IT0=1`,
    correctAnswer: 'IT0',
    ka: '5',
    chapter: 6,
  },

  // === LED动态扫描 (补充题) ===
  {
    id: 130,
    type: 'code-completion',
    questionText: '补全代码，显示8位数码管的第4位（从左数），其他位熄灭。',
    code: `; 显示第4位数码管
    MOV P2, #___     ; 位选信号，第4位选通
    MOV P0, #3FH     ; 段选信号，显示"0"`,
    correctAnswer: '0F7H',
    ka: '8.1',
    chapter: 7,
  },

  // === 串行通信 (补充综合应用题) ===
  {
    id: 131,
    type: 'code-completion',
    questionText: '补全代码，设置串口工作在模式1，波特率9600（11.0592MHz晶振）。',
    code: `; 串口模式1，9600bps
    MOV SCON, #50H   ; 模式1，允许接收
    MOV TMOD, #20H   ; T1模式2
    MOV TH1, #___    ; 波特率9600的重装值
    MOV TL1, #0FDH
    SETB TR1         ; 启动T1`,
    correctAnswer: '0FDH',
    ka: '7',
    chapter: 9,
  },

  // === 综合应用题 ===
  {
    id: 132,
    type: 'multiple-choice',
    questionText: '在设计一个数字温度计系统时，需要用到哪些8051的功能模块？',
    options: ['ADC + 数码管显示', 'ADC + 数码管显示 + 定时器', 'ADC + 数码管显示 + 定时器 + 串口', '所有功能模块'],
    correctAnswer: 'ADC + 数码管显示 + 定时器 + 串口',
    ka: '8.3',
    chapter: 10,
  },
  {
    id: 133,
    type: 'code-completion',
    questionText: '补全代码，实现电子密码锁的密码比较功能（4位密码存储在30H-33H）。',
    code: `; 比较输入密码（40H-43H）与存储密码（30H-33H）
CHECK_PASSWORD:
    MOV R0, #30H     ; 存储密码地址
    MOV R1, #40H     ; 输入密码地址
    MOV R2, #4       ; 比较4位
LOOP:
    MOV A, @R0
    ___              ; 比较当前位
    JNZ WRONG        ; 不相等跳转
    INC R0
    INC R1
    DJNZ R2, LOOP
    ; 密码正确处理
    RET
WRONG:
    ; 密码错误处理
    RET`,
    correctAnswer: 'CJNE A, @R1, WRONG',
    ka: '8.2.2',
    chapter: 8,
  },
  {
    id: 134,
    type: 'multiple-choice',
    questionText: '在多任务系统中，使用定时器中断进行任务切换的主要优点是什么？',
    options: ['节省存储空间', '提高运行速度', '实现实时性', '降低功耗'],
    correctAnswer: '实现实时性',
    ka: '5',
    chapter: 6,
  },
  {
    id: 135,
    type: 'code-completion',
    questionText: '补全代码，实现简单的任务调度器（3个任务轮流执行）。',
    code: `; 任务调度器
SCHEDULER:
    PUSH ACC
    PUSH PSW
    INC TASK_ID      ; 任务号递增
    MOV A, TASK_ID
    CJNE A, #3, SKIP
    MOV TASK_ID, #___; 重置任务号
SKIP:
    ; 调用相应任务
    POP PSW
    POP ACC
    RETI`,
    correctAnswer: '0',
    ka: '5',
    chapter: 6,
  },

  // === 扩展题目 (136-200) ===
  // === CPU结构进阶题 ===
  {
    id: 136,
    type: 'multiple-choice',
    questionText: '8051的ALU（算术逻辑单元）可以进行哪些运算？',
    options: ['只能进行加法运算', '加法、减法、逻辑运算', '加法、减法、乘法、除法', '加法、减法、逻辑运算、乘法、除法'],
    correctAnswer: '加法、减法、逻辑运算、乘法、除法',
    ka: '2.1',
    chapter: 1,
  },
  {
    id: 137,
    type: 'code-completion',
    questionText: '补全代码，使用B寄存器进行8位乘法运算。',
    code: `; 计算 5 × 6
MOV A, #5
MOV B, #6
___          ; 执行乘法
; 结果：A=低8位，B=高8位`,
    correctAnswer: 'MUL AB',
    ka: '2.1',
    chapter: 1,
  },
  {
    id: 138,
    type: 'multiple-choice',
    questionText: '8051的堆栈指针SP初始值是多少？',
    options: ['06H', '07H', '08H', '09H'],
    correctAnswer: '07H',
    ka: '2.1',
    chapter: 1,
  },
  {
    id: 139,
    type: 'code-completion',
    questionText: '补全代码，将累加器A的内容压入堆栈。',
    code: `; 保存A寄存器到堆栈
___  A`,
    correctAnswer: 'PUSH',
    ka: '2.1',
    chapter: 1,
  },
  {
    id: 140,
    type: 'multiple-choice',
    questionText: 'PSW寄存器中的CY位表示什么？',
    options: ['奇偶校验位', '进位标志位', '辅助进位位', '溢出标志位'],
    correctAnswer: '进位标志位',
    ka: '2.1',
    chapter: 1,
  },

  // === 存储器结构进阶题 ===
  {
    id: 141,
    type: 'multiple-choice',
    questionText: '8051外部数据存储器的最大容量是多少？',
    options: ['64KB', '128KB', '256KB', '512KB'],
    correctAnswer: '64KB',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 142,
    type: 'code-completion',
    questionText: '补全代码，访问外部数据存储器地址1000H的内容。',
    code: `; 读取外部RAM 1000H的内容到A
MOV DPTR, #1000H
___`,
    correctAnswer: 'MOVX A, @DPTR',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 143,
    type: 'multiple-choice',
    questionText: '8051的程序存储器地址空间范围是？',
    options: ['0000H-0FFFH', '0000H-1FFFH', '0000H-7FFFH', '0000H-FFFFH'],
    correctAnswer: '0000H-FFFFH',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 144,
    type: 'code-completion',
    questionText: '补全代码，将立即数55H写入外部数据存储器2000H地址。',
    code: `; 写55H到外部RAM 2000H
MOV DPTR, #2000H
MOV A, #55H
___`,
    correctAnswer: 'MOVX @DPTR, A',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 145,
    type: 'multiple-choice',
    questionText: '位地址00H对应的字节地址是？',
    options: ['20H', '21H', '22H', '23H'],
    correctAnswer: '20H',
    ka: '2.2',
    chapter: 2,
  },

  // === I/O端口进阶题 ===
  {
    id: 146,
    type: 'multiple-choice',
    questionText: 'P3口的第二功能中，P3.0和P3.1分别是什么？',
    options: ['TXD和RXD', 'RXD和TXD', 'INT0和INT1', 'T0和T1'],
    correctAnswer: 'RXD和TXD',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 147,
    type: 'code-completion',
    questionText: '补全代码，只改变P1.3的状态，其他位保持不变。',
    code: `; 将P1.3置1，其他位不变
___  P1.3`,
    correctAnswer: 'SETB',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 148,
    type: 'multiple-choice',
    questionText: '当P0口用作地址总线时，输出的是什么？',
    options: ['数据总线', '低8位地址', '高8位地址', '控制信号'],
    correctAnswer: '低8位地址',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 149,
    type: 'code-completion',
    questionText: '补全代码，检测P1.0是否为低电平。',
    code: `; 检测P1.0状态
___  P1.0, HIGH_LEVEL  ; 如果P1.0=1则跳转`,
    correctAnswer: 'JB',
    ka: '2.3',
    chapter: 3,
  },
  {
    id: 150,
    type: 'multiple-choice',
    questionText: 'P2口在访问外部存储器时输出什么信号？',
    options: ['数据信号', '低8位地址', '高8位地址', '控制信号'],
    correctAnswer: '高8位地址',
    ka: '2.3',
    chapter: 3,
  },

  // === 指令系统进阶题 ===
  {
    id: 151,
    type: 'multiple-choice',
    questionText: '指令CJNE A, #50H, NEXT的功能是什么？',
    options: ['比较A与50H，相等则跳转', '比较A与50H，不相等则跳转', '将50H送入A', '将A与50H相加'],
    correctAnswer: '比较A与50H，不相等则跳转',
    ka: '3',
    chapter: 4,
  },
  {
    id: 152,
    type: 'code-completion',
    questionText: '补全代码，实现累加器A的内容左移一位。',
    code: `; A寄存器左移一位
___  A`,
    correctAnswer: 'RL',
    ka: '3',
    chapter: 4,
  },
  {
    id: 153,
    type: 'multiple-choice',
    questionText: '指令SWAP A的功能是什么？',
    options: ['A的高4位和低4位交换', 'A与B寄存器交换', 'A的内容取反', 'A的内容清零'],
    correctAnswer: 'A的高4位和低4位交换',
    ka: '3',
    chapter: 4,
  },
  {
    id: 154,
    type: 'code-completion',
    questionText: '补全代码，实现BCD码调整。',
    code: `; BCD加法调整
ADD A, R0    ; 两个BCD数相加
___          ; BCD调整`,
    correctAnswer: 'DA A',
    ka: '3',
    chapter: 4,
  },
  {
    id: 155,
    type: 'multiple-choice',
    questionText: '相对跳转指令的跳转范围是？',
    options: ['-128到+127字节', '-256到+255字节', '-64到+63字节', '-32到+31字节'],
    correctAnswer: '-128到+127字节',
    ka: '3',
    chapter: 4,
  },

  // === 定时器/计数器进阶题 ===
  {
    id: 156,
    type: 'multiple-choice',
    questionText: '定时器工作在模式3时，定时器0被分成几个独立的定时器？',
    options: ['1个', '2个', '3个', '4个'],
    correctAnswer: '2个',
    ka: '6',
    chapter: 5,
  },
  {
    id: 157,
    type: 'code-completion',
    questionText: '补全代码，设置定时器0工作在计数器模式。',
    code: `; T0工作在计数器模式
MOV TMOD, #___   ; 设置T0为计数器模式1`,
    correctAnswer: '05H',
    ka: '6',
    chapter: 5,
  },
  {
    id: 158,
    type: 'multiple-choice',
    questionText: '定时器的计数脉冲来源可以是？',
    options: ['只能是内部时钟', '只能是外部脉冲', '内部时钟或外部脉冲', '只能是晶振'],
    correctAnswer: '内部时钟或外部脉冲',
    ka: '6',
    chapter: 5,
  },
  {
    id: 159,
    type: 'code-completion',
    questionText: '补全代码，检查定时器1是否溢出。',
    code: `; 检查T1溢出标志
___  TF1, T1_OVERFLOW  ; 如果TF1=1则跳转`,
    correctAnswer: 'JB',
    ka: '6',
    chapter: 5,
  },
  {
    id: 160,
    type: 'multiple-choice',
    questionText: '在12MHz晶振下，定时器的计数频率是多少？',
    options: ['12MHz', '6MHz', '1MHz', '500KHz'],
    correctAnswer: '1MHz',
    ka: '6',
    chapter: 5,
  },

  // === 中断系统进阶题 ===
  {
    id: 161,
    type: 'multiple-choice',
    questionText: '8051共有几个中断源？',
    options: ['3个', '4个', '5个', '6个'],
    correctAnswer: '5个',
    ka: '5',
    chapter: 6,
  },
  {
    id: 162,
    type: 'code-completion',
    questionText: '补全代码，禁止所有中断。',
    code: `; 禁止所有中断
___  EA`,
    correctAnswer: 'CLR',
    ka: '5',
    chapter: 6,
  },
  {
    id: 163,
    type: 'multiple-choice',
    questionText: '中断服务程序的入口地址是固定的吗？',
    options: ['是，由硬件决定', '否，可以任意设置', '部分固定，部分可设置', '由软件完全决定'],
    correctAnswer: '是，由硬件决定',
    ka: '5',
    chapter: 6,
  },
  {
    id: 164,
    type: 'code-completion',
    questionText: '补全代码，设置串口中断为高优先级。',
    code: `; 设置串口中断优先级
___  PS`,
    correctAnswer: 'SETB',
    ka: '5',
    chapter: 6,
  },
  {
    id: 165,
    type: 'multiple-choice',
    questionText: '当同时有多个同优先级中断请求时，CPU如何处理？',
    options: ['随机选择', '按中断号顺序', '按默认优先级顺序', '拒绝所有中断'],
    correctAnswer: '按默认优先级顺序',
    ka: '5',
    chapter: 6,
  },

  // === LED动态扫描进阶题 ===
  {
    id: 166,
    type: 'multiple-choice',
    questionText: 'LED数码管动态扫描的扫描频率通常应该大于多少？',
    options: ['10Hz', '25Hz', '50Hz', '100Hz'],
    correctAnswer: '50Hz',
    ka: '8.1',
    chapter: 7,
  },
  {
    id: 167,
    type: 'code-completion',
    questionText: '补全代码，显示数字"8"的段码。',
    code: `; 显示数字8
MOV P0, #___H   ; 7段数码管段码`,
    correctAnswer: '7F',
    ka: '8.1',
    chapter: 7,
  },
  {
    id: 168,
    type: 'multiple-choice',
    questionText: '共阴极数码管和共阳极数码管的主要区别是什么？',
    options: ['显示亮度不同', '段码定义相反', '功耗不同', '响应速度不同'],
    correctAnswer: '段码定义相反',
    ka: '8.1',
    chapter: 7,
  },
  {
    id: 169,
    type: 'code-completion',
    questionText: '补全代码，实现8位数码管全部熄灭。',
    code: `; 熄灭所有数码管
MOV P2, #___H   ; 位选全部关闭`,
    correctAnswer: '00',
    ka: '8.1',
    chapter: 7,
  },
  {
    id: 170,
    type: 'multiple-choice',
    questionText: '在LED点阵显示中，行扫描和列扫描的作用是什么？',
    options: ['都是选择显示位置', '行选择，列控制亮灭', '列选择，行控制亮灭', '行列都控制亮灭'],
    correctAnswer: '行选择，列控制亮灭',
    ka: '8.1',
    chapter: 7,
  },

  // === 矩阵键盘扫描进阶题 ===
  {
    id: 171,
    type: 'multiple-choice',
    questionText: '4×4矩阵键盘需要占用多少个I/O口线？',
    options: ['4根', '6根', '8根', '16根'],
    correctAnswer: '8根',
    ka: '8.2.2',
    chapter: 8,
  },
  {
    id: 172,
    type: 'code-completion',
    questionText: '补全代码，扫描矩阵键盘的第一行。',
    code: `; 扫描第一行
MOV P1, #___H   ; 第一行输出低电平，其他行高电平`,
    correctAnswer: 'FE',
    ka: '8.2.2',
    chapter: 8,
  },
  {
    id: 173,
    type: 'multiple-choice',
    questionText: '矩阵键盘扫描中，为什么要进行按键消抖？',
    options: ['提高扫描速度', '消除机械抖动', '节省功耗', '增加按键寿命'],
    correctAnswer: '消除机械抖动',
    ka: '8.2.2',
    chapter: 8,
  },
  {
    id: 174,
    type: 'code-completion',
    questionText: '补全代码，检测矩阵键盘是否有按键按下。',
    code: `; 检测是否有按键按下
MOV P1, #0F0H   ; 行线输出0，列线输入
MOV A, P1
___  A, #0F0H   ; 检查列线状态`,
    correctAnswer: 'CJNE',
    ka: '8.2.2',
    chapter: 8,
  },
  {
    id: 175,
    type: 'multiple-choice',
    questionText: '键盘扫描程序中，延时消抖的时间通常是多少？',
    options: ['1-5ms', '10-20ms', '50-100ms', '200-500ms'],
    correctAnswer: '10-20ms',
    ka: '8.2.2',
    chapter: 8,
  },

  // === 串行通信进阶题 ===
  {
    id: 176,
    type: 'multiple-choice',
    questionText: '8051串口工作在模式0时的特点是什么？',
    options: ['异步通信', '同步通信', '9位数据', '可变波特率'],
    correctAnswer: '同步通信',
    ka: '7',
    chapter: 9,
  },
  {
    id: 177,
    type: 'code-completion',
    questionText: '补全代码，等待串口发送完成。',
    code: `; 等待发送完成
WAIT_SEND:
___  TI, SEND_OK   ; 检查发送中断标志
SJMP WAIT_SEND
SEND_OK:
CLR TI`,
    correctAnswer: 'JB',
    ka: '7',
    chapter: 9,
  },
  {
    id: 178,
    type: 'multiple-choice',
    questionText: '串口模式2和模式3的数据位数分别是多少？',
    options: ['8位和8位', '9位和9位', '8位和9位', '9位和8位'],
    correctAnswer: '9位和9位',
    ka: '7',
    chapter: 9,
  },
  {
    id: 179,
    type: 'code-completion',
    questionText: '补全代码，设置串口工作在模式3。',
    code: `; 串口模式3设置
MOV SCON, #___H   ; SM0=1, SM1=1`,
    correctAnswer: 'F0',
    ka: '7',
    chapter: 9,
  },
  {
    id: 180,
    type: 'multiple-choice',
    questionText: '在串行通信中，校验位的作用是什么？',
    options: ['提高传输速度', '检测传输错误', '同步数据', '控制流量'],
    correctAnswer: '检测传输错误',
    ka: '7',
    chapter: 9,
  },

  // === ADC应用进阶题 ===
  {
    id: 181,
    type: 'multiple-choice',
    questionText: '8位ADC的分辨率是多少？',
    options: ['1/128', '1/256', '1/512', '1/1024'],
    correctAnswer: '1/256',
    ka: '8.3',
    chapter: 10,
  },
  {
    id: 182,
    type: 'code-completion',
    questionText: '补全代码，启动ADC0809的转换。',
    code: `; 启动ADC转换
SETB ALE     ; 地址锁存
CLR ALE
___  START   ; 启动转换
CLR START`,
    correctAnswer: 'SETB',
    ka: '8.3',
    chapter: 10,
  },
  {
    id: 183,
    type: 'multiple-choice',
    questionText: 'ADC转换时间主要取决于什么？',
    options: ['输入电压', '参考电压', '时钟频率', '温度'],
    correctAnswer: '时钟频率',
    ka: '8.3',
    chapter: 10,
  },
  {
    id: 184,
    type: 'code-completion',
    questionText: '补全代码，等待ADC转换完成。',
    code: `; 等待转换完成
WAIT_EOC:
___  EOC, READ_data   ; 检查转换结束信号
SJMP WAIT_EOC`,
    correctAnswer: 'JB',
    ka: '8.3',
    chapter: 10,
  },
  {
    id: 185,
    type: 'multiple-choice',
    questionText: '在温度测量系统中，通常需要进行什么处理？',
    options: ['只需ADC转换', 'ADC转换+线性化', 'ADC转换+滤波', 'ADC转换+线性化+滤波'],
    correctAnswer: 'ADC转换+线性化+滤波',
    ka: '8.3',
    chapter: 10,
  },

  // === 综合应用题 ===
  {
    id: 186,
    type: 'multiple-choice',
    questionText: '设计一个数字时钟系统，主要需要哪些功能模块？',
    options: ['定时器+数码管', '定时器+数码管+键盘', '定时器+数码管+键盘+存储器', '所有功能模块'],
    correctAnswer: '定时器+数码管+键盘+存储器',
    ka: '综合应用',
    chapter: 9,
  },
  {
    id: 187,
    type: 'code-completion',
    questionText: '补全代码，实现简单的看门狗功能。',
    code: `; 看门狗喂狗
WATCHDOG_FEED:
___  WDT_PIN   ; 输出脉冲喂狗
CALL DELAY_1MS
CLR WDT_PIN
RET`,
    correctAnswer: 'SETB',
    ka: '综合应用',
    chapter: 9,
  },
  {
    id: 188,
    type: 'multiple-choice',
    questionText: '在多传感器数据采集系统中，如何提高系统可靠性？',
    options: ['增加采样频率', '使用多重校验', '提高处理速度', '增加存储容量'],
    correctAnswer: '使用多重校验',
    ka: '综合应用',
    chapter: 9,
  },
  {
    id: 189,
    type: 'code-completion',
    questionText: '补全代码，实现系统复位功能。',
    code: `; 软件复位
SOFT_RESET:
MOV SP, #07H     ; 重置堆栈指针
MOV PSW, #00H    ; 清除状态字
___  MAIN        ; 跳转到主程序`,
    correctAnswer: 'LJMP',
    ka: '综合应用',
    chapter: 9,
  },
  {
    id: 190,
    type: 'multiple-choice',
    questionText: '在实时控制系统中，最重要的性能指标是什么？',
    options: ['处理速度', '存储容量', '响应时间', '功耗'],
    correctAnswer: '响应时间',
    ka: '综合应用',
    chapter: 9,
  },

  // === 高级应用题 ===
  {
    id: 191,
    type: 'multiple-choice',
    questionText: '在工业控制中，PID控制算法的三个参数分别代表什么？',
    options: ['比例、积分、微分', '功率、电流、电压', '频率、相位、幅度', '输入、输出、反馈'],
    correctAnswer: '比例、积分、微分',
    ka: '综合应用',
    chapter: 9,
  },
  {
    id: 192,
    type: 'code-completion',
    questionText: '补全代码，实现简单的PID控制算法。',
    code: `; PID控制计算
MOV A, SETPOINT
SUBB A, FEEDBACK  ; 计算误差
MOV ERROR, A
; 比例项计算
MOV B, KP
___               ; 误差×比例系数
MOV P_TERM, A`,
    correctAnswer: 'MUL AB',
    ka: '综合应用',
    chapter: 9,
  },
  {
    id: 193,
    type: 'multiple-choice',
    questionText: '在通信协议设计中，帧头的主要作用是什么？',
    options: ['数据校验', '帧同步', '错误纠正', '流量控制'],
    correctAnswer: '帧同步',
    ka: '7',
    chapter: 9,
  },
  {
    id: 194,
    type: 'code-completion',
    questionText: '补全代码，实现CRC校验计算。',
    code: `; CRC校验计算
CRC_CALC:
MOV A, DATA
XRL A, CRC_REG    ; 异或运算
___  A            ; 循环左移
MOV CRC_REG, A
RET`,
    correctAnswer: 'RL',
    ka: '7',
    chapter: 9,
  },
  {
    id: 195,
    type: 'multiple-choice',
    questionText: '在嵌入式系统设计中，低功耗设计的主要方法有哪些？',
    options: ['降低时钟频率', '使用睡眠模式', '优化算法', '以上都是'],
    correctAnswer: '以上都是',
    ka: '综合应用',
    chapter: 10,
  },
  {
    id: 196,
    type: 'code-completion',
    questionText: '补全代码，进入低功耗模式。',
    code: `; 进入空闲模式
MOV PCON, #___H   ; 设置IDL位`,
    correctAnswer: '01',
    ka: '综合应用',
    chapter: 10,
  },
  {
    id: 197,
    type: 'multiple-choice',
    questionText: '在多任务系统中，任务调度的基本原则是什么？',
    options: ['先来先服务', '优先级调度', '时间片轮转', '根据系统需求选择'],
    correctAnswer: '根据系统需求选择',
    ka: '综合应用',
    chapter: 9,
  },
  {
    id: 198,
    type: 'code-completion',
    questionText: '补全代码，实现任务状态切换。',
    code: `; 任务状态切换
TASK_SWITCH:
PUSH ACC
PUSH PSW
; 保存当前任务状态
___  CURRENT_TASK  ; 调用任务调度器
POP PSW
POP ACC
RET`,
    correctAnswer: 'CALL',
    ka: '综合应用',
    chapter: 9,
  },
  {
    id: 199,
    type: 'multiple-choice',
    questionText: '在系统调试中，最有效的调试方法是什么？',
    options: ['单步执行', '断点调试', '逻辑分析仪', '综合使用多种方法'],
    correctAnswer: '综合使用多种方法',
    ka: '综合应用',
    chapter: 9,
  },
  {
    id: 200,
    type: 'code-completion',
    questionText: '补全代码，实现系统自检功能。',
    code: `; 系统自检
SELF_TEST:
CALL RAM_TEST     ; RAM测试
CALL ROM_TEST     ; ROM测试
CALL IO_TEST      ; I/O测试
___  TEST_OK      ; 所有测试通过
MOV A, #0FFH      ; 测试失败标志
RET
TEST_OK:
MOV A, #00H       ; 测试成功标志
RET`,
    correctAnswer: 'JC',
    ka: '综合应用',
    chapter: 9,
  },

  // ---- CH7 串行通信 (扩充) ----------------------------------------------
  // 每题的 ka 字段对应 src/lib/knowledge-points.ts 中的节点 id；
  // 题面与答案均直接基于该节点 description 字段所述事实。
  {
    id: 201,
    type: 'multiple-choice',
    questionText: '相比并行通信，串行通信最主要的优势是什么？',
    options: ['传输速度更快', '传输距离更远、连线更少', '抗噪声能力更强', '硬件电路最简单'],
    correctAnswer: '传输距离更远、连线更少',
    ka: '7.1.1',
    chapter: 7,
  },
  {
    id: 202,
    type: 'multiple-choice',
    questionText: '异步通信的数据帧中，下列哪一项不是必须的？',
    options: ['起始位', '数据位', '停止位', '同步时钟线'],
    correctAnswer: '同步时钟线',
    ka: '7.1.2',
    chapter: 7,
  },
  {
    id: 203,
    type: 'multiple-choice',
    questionText: '波特率的定义是什么？',
    options: ['每秒传输的字节数', '每秒传输的位数（包括起止位）', '每秒传输的字符数', '每秒传输的有效数据位数'],
    correctAnswer: '每秒传输的位数（包括起止位）',
    ka: '7.1.3',
    chapter: 7,
  },
  {
    id: 204,
    type: 'multiple-choice',
    questionText: '通信双方可以同时收发数据的工作模式称为？',
    options: ['单工', '半双工', '全双工', '广播'],
    correctAnswer: '全双工',
    ka: '7.1.5',
    chapter: 7,
  },
  {
    id: 205,
    type: 'multiple-choice',
    questionText: '89C51串口控制寄存器 SCON 中，REN 位的作用是？',
    options: ['选择串口工作模式', '允许串口接收使能', '发送中断请求标志', '接收中断请求标志'],
    correctAnswer: '允许串口接收使能',
    ka: '7.2.1',
    chapter: 7,
  },
  {
    id: 206,
    type: 'multiple-choice',
    questionText: '关于 SBUF 寄存器的描述，正确的是？',
    options: ['只能用于发送数据', '只能用于接收数据', '物理上是同一寄存器，发送和接收共用', '物理上是两个独立寄存器，分别用于发送和接收'],
    correctAnswer: '物理上是两个独立寄存器，分别用于发送和接收',
    ka: '7.2.2',
    chapter: 7,
  },
  {
    id: 207,
    type: 'multiple-choice',
    questionText: '89C51 串口的标准波特率通常使用哪个定时器、哪种工作模式产生？',
    options: ['T0 模式 0', 'T0 模式 1', 'T1 模式 2（自动重装）', 'T1 模式 3'],
    correctAnswer: 'T1 模式 2（自动重装）',
    ka: '7.2.3',
    chapter: 7,
  },
  {
    id: 208,
    type: 'multiple-choice',
    questionText: '采用查询方式发送一字节数据后，软件应做什么处理？',
    options: ['等待 RI 置 1 后清零', '等待 TI 置 1 后清零', '直接写下一字节即可', '禁止串口中断'],
    correctAnswer: '等待 TI 置 1 后清零',
    ka: '7.3.2',
    chapter: 7,
  },
  {
    id: 209,
    type: 'multiple-choice',
    questionText: 'RS-232 通信中，常用 MAX232 芯片的主要作用是？',
    options: ['提高波特率', '电平转换（TTL ↔ RS-232）', '增强抗干扰', '实现全双工'],
    correctAnswer: '电平转换（TTL ↔ RS-232）',
    ka: '7.4.1',
    chapter: 7,
  },
  {
    id: 210,
    type: 'multiple-choice',
    questionText: 'RS-485 相比 RS-232 最主要的特点是？',
    options: ['传输距离更短', '使用差分信号传输，抗干扰强、距离远，支持多机通信', '只支持单工通信', '完全替代 SPI 协议'],
    correctAnswer: '使用差分信号传输，抗干扰强、距离远，支持多机通信',
    ka: '7.4.2',
    chapter: 7,
  },
  {
    id: 211,
    type: 'multiple-choice',
    questionText: 'SPI 协议的四根标准信号线是？',
    options: ['SDA / SCL / VCC / GND', 'TX / RX / CTS / RTS', 'MOSI / MISO / SCK / CS', 'D+ / D- / VBUS / GND'],
    correctAnswer: 'MOSI / MISO / SCK / CS',
    ka: '7.4.3',
    chapter: 7,
  },
  {
    id: 212,
    type: 'multiple-choice',
    questionText: 'I2C 总线只用两根信号线，分别是？',
    options: ['MOSI 和 MISO', 'TX 和 RX', 'SDA 和 SCL', 'D+ 和 D-'],
    correctAnswer: 'SDA 和 SCL',
    ka: '7.4.4',
    chapter: 7,
  },

  // ---- CH10 前沿应用 (扩充) --------------------------------------------
  {
    id: 213,
    type: 'multiple-choice',
    questionText: 'ESP8266 模块通常通过什么接口与单片机通信？',
    options: ['SPI', 'I2C', '串口（UART）+ AT 指令', '直接连 P0 口并行总线'],
    correctAnswer: '串口（UART）+ AT 指令',
    ka: '10.1.1',
    chapter: 10,
  },
  {
    id: 214,
    type: 'multiple-choice',
    questionText: 'HC-05 蓝牙模块的"透传"含义是？',
    options: ['加密透明的数据传输', '不修改数据内容，串口数据直接通过蓝牙转发', '只能透传 ASCII 字符', '仅在主从配对成功后能传'],
    correctAnswer: '不修改数据内容，串口数据直接通过蓝牙转发',
    ka: '10.1.2',
    chapter: 10,
  },
  {
    id: 215,
    type: 'multiple-choice',
    questionText: 'LoRa 通信技术最突出的特点是？',
    options: ['超高速率短距离传输', '低功耗、远距离、低速率', '高功耗大带宽', '需要持续电源不能电池供电'],
    correctAnswer: '低功耗、远距离、低速率',
    ka: '10.1.3',
    chapter: 10,
  },
  {
    id: 216,
    type: 'multiple-choice',
    questionText: 'MQTT 协议采用的通信模型是？',
    options: ['客户端/服务器请求-响应', '点对点直连', '发布 / 订阅（Publish/Subscribe）', '广播'],
    correctAnswer: '发布 / 订阅（Publish/Subscribe）',
    ka: '10.1.4',
    chapter: 10,
  },
  {
    id: 217,
    type: 'multiple-choice',
    questionText: 'NB-IoT 属于哪一类无线技术？',
    options: ['短距离高速通信', '低功耗广域网（LPWAN）', '工业以太网', '可见光通信'],
    correctAnswer: '低功耗广域网（LPWAN）',
    ka: '10.1.5',
    chapter: 10,
  },
  {
    id: 218,
    type: 'multiple-choice',
    questionText: 'TinyML 主要解决的问题是？',
    options: ['在云端服务器训练大模型', '在资源受限的微控制器上部署机器学习推理', '替代所有传统算法', '降低 PC 的算力需求'],
    correctAnswer: '在资源受限的微控制器上部署机器学习推理',
    ka: '10.2.1',
    chapter: 10,
  },
  {
    id: 219,
    type: 'multiple-choice',
    questionText: '边缘计算相比把数据全部上传云端处理，主要优势是？',
    options: ['完全替代云端', '降低传输延迟、节约带宽、保护本地数据隐私', '硬件成本更高', '只适合视频处理'],
    correctAnswer: '降低传输延迟、节约带宽、保护本地数据隐私',
    ka: '10.2.2',
    chapter: 10,
  },
  {
    id: 220,
    type: 'multiple-choice',
    questionText: 'RISC-V 指令集架构的核心特点是？',
    options: ['闭源商业架构，需付授权费', '开源、模块化、精简指令集', '仅适用于桌面 CPU', '不能用于 MCU'],
    correctAnswer: '开源、模块化、精简指令集',
    ka: '10.3.1',
    chapter: 10,
  },
  {
    id: 221,
    type: 'multiple-choice',
    questionText: '下列哪款是国产基于 RISC-V 架构的微控制器？',
    options: ['STM32F103', 'AT89C51', '兆易 GD32V 系列', 'ATmega328'],
    correctAnswer: '兆易 GD32V 系列',
    ka: '10.3.2',
    chapter: 10,
  },
  {
    id: 222,
    type: 'multiple-choice',
    questionText: '相比 8051，RISC-V 在架构上的主要差异是？',
    options: ['8051 是 RISC，RISC-V 是 CISC', '两者完全相同', 'RISC-V 是开源精简指令集，寄存器更多、扩展性更强', 'RISC-V 不支持中断'],
    correctAnswer: 'RISC-V 是开源精简指令集，寄存器更多、扩展性更强',
    ka: '10.3.3',
    chapter: 10,
  },
  {
    id: 223,
    type: 'multiple-choice',
    questionText: '智慧农业系统中，单片机最常承担的角色是？',
    options: ['仅做云端数据可视化', '采集温湿度等传感数据并控制执行机构（如灌溉阀）', '替代农作物', '不参与数据采集'],
    correctAnswer: '采集温湿度等传感数据并控制执行机构（如灌溉阀）',
    ka: '10.4.2',
    chapter: 10,
  },
  {
    id: 224,
    type: 'multiple-choice',
    questionText: '可穿戴健康监测设备对所选 MCU 的最关键要求是？',
    options: ['超大主频', '低功耗以延长电池续航', '大尺寸封装', '不需要无线通信'],
    correctAnswer: '低功耗以延长电池续航',
    ka: '10.4.4',
    chapter: 10,
  }
];
