
export type QuestionSource = {
  kind?: 'slide';
  title: string;
  page: number; // 合并课件 PDF 的物理页码，从 1 开始
  url: string;
} | {
  kind: 'guide';
  title: string;
  experimentId: string;
  section: string; // 现有网页指导中的准确章节标题
  url: string;
  page?: never;
};

/** Accept only the two implemented, local teaching-source routes. */
export function isQuestionSource(value: unknown): value is QuestionSource {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  if (typeof source.title !== 'string' || !source.title.trim()) return false;
  if (source.kind === 'guide') {
    return typeof source.experimentId === 'string'
      && /^(exp0[1-9]|proj0[1-4])$/.test(source.experimentId)
      && typeof source.section === 'string' && Boolean(source.section.trim())
      && source.page === undefined
      && source.url === `/simulation?experiment=${source.experimentId}&view=guide`;
  }
  return (source.kind === undefined || source.kind === 'slide')
    && typeof source.page === 'number' && Number.isInteger(source.page)
    && source.page >= 1 && source.page <= 167
    && source.url === `/resources/course/course-slides.pdf#page=${source.page}`;
}

type QuestionSupplement = {
  explanation?: string;
  source?: QuestionSource;
};

export type MultipleChoiceQuestion = QuestionSupplement & {
  id: number;
  type: 'multiple-choice';
  questionText: string;
  options: string[];
  correctAnswer: string;
  ka: string; // Knowledge Atom
  chapter: number;
};

export type CodeCompletionQuestion = QuestionSupplement & {
  id: number;
  type: 'code-completion';
  questionText: string;
  code: string; // Contains a placeholder like '___'
  correctAnswer: string;
  ka: string;
  chapter: number;
};

export type Question = MultipleChoiceQuestion | CodeCompletionQuestion;
export type PublicQuestion =
  | Omit<MultipleChoiceQuestion, 'correctAnswer' | 'explanation'>
  | Omit<CodeCompletionQuestion, 'correctAnswer' | 'explanation'>;

export function toPublicQuestion(question: Question): PublicQuestion {
  const { correctAnswer: _correctAnswer, explanation: _explanation, ...publicQuestion } = question;
  void _correctAnswer;
  void _explanation;
  return publicQuestion;
}

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
    chapter: 2,
  },
  {
    id: 3,
    type: 'multiple-choice',
    questionText: '哪个I/O端口是纯粹的准双向口，没有第二功能？',
    options: ['P0', 'P1', 'P2', 'P3'],
    correctAnswer: 'P1',
    ka: '2.3',
    chapter: 2,
  },
  {
    id: 4,
    type: 'multiple-choice',
    questionText: '指令 `MOV A, #30H` 采用的是哪种寻址方式？',
    options: ['直接寻址', '寄存器寻址', '立即寻址', '寄存器间接寻址'],
    correctAnswer: '立即寻址',
    ka: '3.1.1',
    chapter: 3,
  },
  {
    id: 5,
    type: 'multiple-choice',
    questionText: '为了生成精确的串口波特率，通常使用定时器的哪种工作模式？',
    options: ['模式0 (13位定时器)', '模式1 (16位定时器)', '模式2 (8位自动重装)', '模式3 (双8位定时器)'],
    correctAnswer: '模式2 (8位自动重装)',
    ka: '6.2',
    chapter: 6,
  },
  {
    id: 6,
    type: 'multiple-choice',
    questionText: '在8051的中断系统中，哪个中断源的默认优先级最高？',
    options: ['定时器0溢出 (TF0)', '外部中断0 (IE0)', '定时器1溢出 (TF1)', '串行口中断 (TI/RI)'],
    correctAnswer: '外部中断0 (IE0)',
    ka: '5.2',
    chapter: 5,
  },
  {
    id: 7,
    type: 'multiple-choice',
    questionText: 'LED数码管动态扫描利用了人眼的什么效应？',
    options: ['视觉暂留效应', '近大远小效应', '色彩对比效应', '光圈效应'],
    correctAnswer: '视觉暂留效应',
    ka: '8.1',
    chapter: 8,
  },
  {
    id: 8,
    type: 'multiple-choice',
    questionText: '当中断服务程序执行完毕后，应该使用哪条指令返回？',
    options: ['RET', 'RETI', 'SJMP', 'LJMP'],
    correctAnswer: 'RETI',
    ka: '5.4',
    chapter: 5,
  },
  {
    id: 9,
    type: 'multiple-choice',
    questionText: '哪个SFR（特殊功能寄存器）用于配置定时器的工作模式？',
    options: ['TCON', 'SCON', 'TMOD', 'PCON'],
    correctAnswer: 'TMOD',
    ka: '6.2',
    chapter: 6,
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
    chapter: 2,
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
    ka: '3.5',
    chapter: 3,
  },
  {
    id: 14,
    type: 'multiple-choice',
    questionText: '在串行通信中，写入SBUF寄存器的数据会进入哪个缓冲器？',
    options: ['接收缓冲器', '发送缓冲器', '通用缓冲器', '标志寄存器'],
    correctAnswer: '发送缓冲器',
    ka: '7.2',
    chapter: 7,
  },
  {
    id: 15,
    type: 'multiple-choice',
    questionText: '哪个寄存器用于设置中断源的优先级？',
    options: ['IE', 'IP', 'TCON', 'SCON'],
    correctAnswer: 'IP',
    ka: '5.2',
    chapter: 5,
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
    ka: '5.2',
    chapter: 5,
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
    ka: '6.2',
    chapter: 6,
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
    ka: '3.5',
    chapter: 3,
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
    ka: '5.2',
    chapter: 5,
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
    chapter: 2,
  },
  {
    id: 23,
    type: 'multiple-choice',
    questionText: '指令 `MOVC A, @A+DPTR` 主要用于什么场合？',
    options: ['访问内部RAM', '访问外部RAM', '从程序存储器查表', '访问特殊功能寄存器'],
    correctAnswer: '从程序存储器查表',
    ka: '3.1.5',
    chapter: 3,
  },
  {
    id: 24,
    type: 'code-completion',
    questionText: '补全代码，使用寄存器间接寻址，将R0指向的内部RAM单元内容送到A。',
    code: `MOV R0, #40H
___`,
    correctAnswer: 'MOV A, @R0',
    ka: '3.1.4',
    chapter: 3,
  },
  {
    id: 25,
    type: 'multiple-choice',
    questionText: '在数码管动态扫描程序中，“消隐”操作的主要目的是什么？',
    options: ['节省功耗', '提高亮度', '防止切换时产生“鬼影”', '简化代码'],
    correctAnswer: '防止切换时产生“鬼影”',
    ka: '8.1',
    chapter: 8,
  },
  {
    id: 26,
    type: 'multiple-choice',
    questionText: '为了让动态扫描的显示看起来稳定无闪烁，扫描频率通常需要高于多少？',
    options: ['10Hz', '24Hz', '50Hz', '1000Hz'],
    correctAnswer: '50Hz',
    ka: '8.1',
    chapter: 8,
  },
  {
    id: 27,
    type: 'multiple-choice',
    questionText: '`ACALL` 和 `LCALL` 指令的主要区别是什么？',
    options: ['目标地址的跳转范围不同', '执行速度不同', '消耗的机器周期数相同', '对堆栈的影响不同'],
    correctAnswer: '目标地址的跳转范围不同',
    ka: '3.5',
    chapter: 3,
  },
  {
    id: 28,
    type: 'multiple-choice',
    questionText: '在串行通信中，当SCON寄存器中的TI标志位被硬件置1时，表示什么？',
    options: ['已成功接收一个字节', '已成功发送一个字节', '接收发生错误', '发送发生错误'],
    correctAnswer: '已成功发送一个字节',
    ka: '7.3',
    chapter: 7,
  },
  {
    id: 29,
    type: 'multiple-choice',
    questionText: '8051微控制器的CPU是多少位的？',
    options: ['4位', '8位', '16位', '32位'],
    correctAnswer: '8位',
    ka: '2.1',
    chapter: 2,
  },
  {
    id: 30,
    type: 'multiple-choice',
    questionText: '下列哪个不是8051微控制器的内部组件？',
    options: ['ALU', 'RAM', 'ROM', 'DMA控制器'],
    correctAnswer: 'DMA控制器',
    ka: '2.1',
    chapter: 2,
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
    ka: '3.2',
    chapter: 3,
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
    ka: '3.2',
    chapter: 3,
  },
  {
    id: 35,
    type: 'multiple-choice',
    questionText: '访问地址为90H的SFR，实际上是访问哪个端口？',
    options: ['P0', 'P1', 'P2', 'P3'],
    correctAnswer: 'P1',
    ka: '2.3',
    chapter: 2,
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
    ka: '3.2',
    chapter: 3,
  },
  {
    id: 38,
    type: 'multiple-choice',
    questionText: '8051执行读-修改-写指令（如 ANL P1,#0FH、CPL P1.0）时，读取的是端口的哪一部分？',
    options: ['引脚上的外部电平', '端口锁存器的内容', '累加器A的内容', 'SBUF缓冲器'],
    correctAnswer: '端口锁存器的内容',
    ka: '2.3',
    chapter: 2,
    explanation: '读-修改-写指令先读端口锁存器、修改后再写回锁存器，不读引脚，可避免引脚被外部负载钳位时把错误电平写回；只有 MOV A,P1 这类读端口指令才读引脚。',
  },
  {
    id: 39,
    type: 'code-completion',
    questionText: '补全代码：P3为带内部上拉的准双向口，作输入前须先向锁存器写1（引脚由上拉保持高电平、可被外部拉低），以便读取外部信号。',
    code: `INIT_P3:
    ___
    RET`,
    correctAnswer: 'MOV P3, #0FFH',
    ka: '2.3',
    chapter: 2,
  },
  {
    id: 40,
    type: 'multiple-choice',
    questionText: 'P3口的哪个引脚用作外部中断1 (INT1)？',
    options: ['P3.0', 'P3.1', 'P3.2', 'P3.3'],
    correctAnswer: 'P3.3',
    ka: '2.3',
    chapter: 2,
  },
  {
    id: 41,
    type: 'multiple-choice',
    questionText: '使用P0口作为地址/数据复用总线时，需要配合哪个信号来分离地址和数据？',
    options: ['PSEN', 'EA', 'ALE', 'RST'],
    correctAnswer: 'ALE',
    ka: '2.6',
    chapter: 2,
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
    ka: '3.4',
    chapter: 3,
  },
  {
    id: 43,
    type: 'multiple-choice',
    questionText: '指令 `XRL A, #0FFH` 等效于什么操作？',
    options: ['SETB A', 'CLR A', 'CPL A', 'NOP'],
    correctAnswer: 'CPL A',
    ka: '3.4',
    chapter: 3,
  },
  {
    id: 44,
    type: 'code-completion',
    questionText: '补全代码，实现将A寄存器的内容乘以B寄存器的内容。',
    code: `MOV A, #10
MOV B, #20
___ ; A*B -> 结果低8位在A,高8位在B`,
    correctAnswer: 'MUL AB',
    ka: '3.3',
    chapter: 3,
  },
  {
    id: 45,
    type: 'multiple-choice',
    questionText: '`CJNE A, #data, rel` 指令执行时，如果A不等于#data，会发生什么？',
    options: ['程序跳转到rel指定的地址', 'A的值被修改为#data', 'CY标志位置位', '程序停止'],
    correctAnswer: '程序跳转到rel指定的地址',
    ka: '3.5',
    chapter: 3,
  },
  {
    id: 46,
    type: 'multiple-choice',
    questionText: '`DA A` 指令的作用是什么？',
    options: ['对A进行逻辑与操作', '对A进行十进制调整', '将A右移一位', '将A除以2'],
    correctAnswer: '对A进行十进制调整',
    ka: '3.3',
    chapter: 3,
  },
  {
    id: 47,
    type: 'multiple-choice',
    questionText: '`RR A` 和 `RRC A` 指令的主要区别是什么？',
    options: ['旋转方向不同', '旋转速度不同', '是否包含进位位CY一起旋转', '操作的寄存器不同'],
    correctAnswer: '是否包含进位位CY一起旋转',
    ka: '3.4',
    chapter: 3,
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
    ka: '3.5',
    chapter: 3,
  },
  {
    id: 49,
    type: 'multiple-choice',
    questionText: '访问内部RAM地址为60H的单元，属于哪种寻址方式？',
    options: ['立即寻址', '直接寻址', '寄存器寻址', '间接寻址'],
    correctAnswer: '直接寻址',
    ka: '3.1.2',
    chapter: 3,
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
    ka: '6.2',
    chapter: 6,
  },
  {
    id: 51,
    type: 'multiple-choice',
    questionText: '假设晶振为12MHz，在定时器模式1下，若要定时50ms，THx和TLx的初值应为多少？',
    options: ['B8H, 3EH', '3CH, B0H', 'FCH, 18H', 'FFH, FFH'],
    correctAnswer: '3CH, B0H',
    ka: '6.2',
    chapter: 6,
  },
  {
    id: 52,
    type: 'multiple-choice',
    questionText: 'TMOD寄存器的GATE位的作用是什么？',
    options: ['选择定时器或计数器模式', '控制定时器是否受外部引脚INTx控制启动', '启动或停止定时器', '设置定时器工作模式'],
    correctAnswer: '控制定时器是否受外部引脚INTx控制启动',
    ka: '6.2',
    chapter: 6,
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
    ka: '6.2',
    chapter: 6,
  },
  {
    id: 54,
    type: 'multiple-choice',
    questionText: '将定时器用作计数器模式时，TMOD寄存器的C/T位应设置为？',
    options: ['0', '1', '不关心', '由GATE位决定'],
    correctAnswer: '1',
    ka: '6.2',
    chapter: 6,
  },
  {
    id: 55,
    type: 'multiple-choice',
    questionText: '中断响应后，CPU会自动将哪个寄存器的内容压入堆栈？',
    options: ['A', 'PSW', 'PC', 'SP'],
    correctAnswer: 'PC',
    ka: '5.4',
    chapter: 5,
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
    ka: '5.3',
    chapter: 5,
  },
  {
    id: 57,
    type: 'multiple-choice',
    questionText: '当一个低优先级中断正在服务时，如果一个高优先级中断请求到来，会发生什么？',
    options: ['高优先级中断被忽略', '低优先级中断被暂停，CPU响应高优先级中断', '系统复位', '两个中断轮流执行'],
    correctAnswer: '低优先级中断被暂停，CPU响应高优先级中断',
    ka: '5.2',
    chapter: 5,
  },
  {
    id: 58,
    type: 'multiple-choice',
    questionText: '串行口中断的向量地址是多少？',
    options: ['0003H', '000BH', '001BH', '0023H'],
    correctAnswer: '0023H',
    ka: '5.3',
    chapter: 5,
  },
  {
    id: 59,
    type: 'code-completion',
    questionText: '补全代码，在IE寄存器中，屏蔽（禁止）除总开关EA外的所有中断。',
    code: `; 关断所有中断源，仅保留总开关开启
___`,
    correctAnswer: 'MOV IE, #80H',
    ka: '5.2',
    chapter: 5,
  },
  {
    id: 60,
    type: 'multiple-choice',
    questionText: '共阳极数码管的公共端应连接到什么电平？',
    options: ['VCC (高电平)', 'GND (低电平)', '数据线', '悬空'],
    correctAnswer: 'VCC (高电平)',
    ka: '8.1',
    chapter: 8,
  },
  {
    id: 61,
    type: 'multiple-choice',
    questionText: '在矩阵键盘扫描中，判断是否有键按下的基本方法是？',
    options: ['先输出行线高电平，再检测列线电平', '先输出行线低电平，再检测列线电平', '同时检测行列电平', '测量端口电阻'],
    correctAnswer: '先输出行线低电平，再检测列线电平',
    ka: '8.2',
    chapter: 8,
  },
  {
    id: 62,
    type: 'code-completion',
    questionText: '补全代码，获取数字\'8\'的共阴极七段码（gfedcba=01111111b=7FH），并送到P0口。',
    code: `MOV P0, ___`,
    correctAnswer: '#7FH',
    ka: '8.1',
    chapter: 8,
  },
  {
    id: 63,
    type: 'multiple-choice',
    questionText: '数码管动态扫描显示中，决定每位数码管平均亮度的主要因素是什么？',
    options: ['刷新频率越高亮度越高', '每位点亮时间占比（占空比）与段驱动电流', '段码数值的大小', '晶振频率'],
    correctAnswer: '每位点亮时间占比（占空比）与段驱动电流',
    ka: '8.1',
    chapter: 8,
    explanation: '动态扫描中每位平均电流≈峰值电流×占空比(1/N)，与刷新频率无关；提高刷新频率的作用是消除闪烁，换位消隐开销增大时亮度还会略降。',
  },
  {
    id: 64,
    type: 'multiple-choice',
    questionText: '驱动一个4x4的矩阵键盘，最少需要多少个I/O口？',
    options: ['4', '8', '16', '1'],
    correctAnswer: '8',
    ka: '8.2',
    chapter: 8,
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
    ka: '7.2',
    chapter: 7,
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
    ka: '7.3',
    chapter: 7,
  },
  {
    id: 72,
    type: 'multiple-choice',
    questionText: '波特率的单位是什么？',
    options: ['Hz', 'ms', 'bps', 'B/s'],
    correctAnswer: 'bps',
    ka: '7.1',
    chapter: 7,
    explanation: '波特率是每秒传送的二进制位数，单位 bps（位/秒）；B/s 是字节/秒，Hz 是频率单位。',
  },
  {
    id: 73,
    type: 'multiple-choice',
    questionText: '使用11.0592MHz晶振而不是12MHz晶振进行串行通信，主要是为了什么？',
    options: ['功耗更低', '价格更便宜', '可以无误差地生成标准波特率', '速度更快'],
    correctAnswer: '可以无误差地生成标准波特率',
    ka: '7.1',
    chapter: 7,
  },
  {
    id: 74,
    type: 'multiple-choice',
    questionText: 'SBUF寄存器在物理上是几个寄存器？',
    options: ['1个', '2个', '4个', '8个'],
    correctAnswer: '2个',
    ka: '7.2',
    chapter: 7,
  },
  {
    id: 75,
    type: 'multiple-choice',
    questionText: '8051复位后，默认使用的工作寄存器组是哪一组？',
    options: ['Bank 0', 'Bank 1', 'Bank 2', 'Bank 3'],
    correctAnswer: 'Bank 0',
    ka: '2.5',
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
    ka: '3.6',
    chapter: 3,
  },
  {
    id: 77,
    type: 'multiple-choice',
    questionText: '`SUBB A, R1` 指令执行的是什么运算？',
    options: ['A = A - R1', 'A = A - R1 - CY', 'R1 = A - R1', 'A = R1 - A'],
    correctAnswer: 'A = A - R1 - CY',
    ka: '3.3',
    chapter: 3,
  },
  {
    id: 78,
    type: 'multiple-choice',
    questionText: '在定时器模式2中，当TLx溢出后，从哪里自动重装初值？',
    options: ['TLx自身', 'THx', 'ROM', '一个固定的内部寄存器'],
    correctAnswer: 'THx',
    ka: '6.2',
    chapter: 6,
  },
  {
    id: 79,
    type: 'multiple-choice',
    questionText: '`RETI` 指令除了返回主程序，还执行了什么关键操作？',
    options: ['清除所有中断标志', '恢复中断优先级逻辑状态', '将SP指针清零', '使能所有中断'],
    correctAnswer: '恢复中断优先级逻辑状态',
    ka: '5.4',
    chapter: 5,
  },
  {
    id: 80,
    type: 'multiple-choice',
    questionText: '在一个标准的UART数据帧中，起始位是什么电平？',
    options: ['高电平', '低电平', '高阻态', '不确定'],
    correctAnswer: '低电平',
    ka: '7.1',
    chapter: 7,
  },
  {
    id: 81,
    type: 'multiple-choice',
    questionText: '“冯·诺依曼”结构的主要特点是什么？',
    options: ['程序和数据有独立的存储空间和总线', '程序和数据共享同一存储空间和总线', '只有数据存储器', '只能执行预设程序'],
    correctAnswer: '程序和数据共享同一存储空间和总线',
    ka: '2.2',
    chapter: 2,
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
    ka: '3.2',
    chapter: 3,
  },
  {
    id: 83,
    type: 'multiple-choice',
    questionText: 'P3.7引脚的第二功能是什么？',
    options: ['/INT1', '/T0', 'TXD', '/RD'],
    correctAnswer: '/RD',
    ka: '2.3',
    chapter: 2,
  },
  {
    id: 84,
    type: 'multiple-choice',
    questionText: '指令 `LJMP` 的跳转范围是多少？',
    options: ['2K', '4K', '32K', '64K'],
    correctAnswer: '64K',
    ka: '3.5',
    chapter: 3,
  },
  {
    id: 85,
    type: 'code-completion',
    questionText: '补全代码，将定时器0设置为计数器模式（模式1）。',
    code: `; 设置T0为16位计数器模式
___`,
    correctAnswer: 'MOV TMOD, #05H',
    ka: '6.2',
    chapter: 6,
  },
  {
    id: 86,
    type: 'multiple-choice',
    questionText: '如果IP寄存器的值为00001001B，哪个中断的优先级最高？',
    options: ['外部中断0 (IE0)', '定时器0 (TF0)', '外部中断1 (IE1)', '定时器1 (TF1)'],
    correctAnswer: '外部中断0 (IE0)',
    ka: '5.2',
    chapter: 5,
  },
  {
    id: 87,
    type: 'multiple-choice',
    questionText: '在共阴极数码管中，要显示数字\'1\'(段码06H)，应该让哪些段点亮？',
    options: ['a, b', 'b, c', 'e, d', 'f, g'],
    correctAnswer: 'b, c',
    ka: '8.1',
    chapter: 8,
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
    ka: '7.3',
    chapter: 7,
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
    ka: '3.2',
    chapter: 3,
  },
  {
    id: 92,
    type: 'multiple-choice',
    questionText: '如果一个定时器的溢出标志TFx被置1，但对应的中断没有被允许（ETx=0），会发生什么？',
    options: ['什么都不会发生', '仅标志位置位，不会产生中断', '系统复位', 'CPU进入空闲状态'],
    correctAnswer: '仅标志位置位，不会产生中断',
    ka: '6.2',
    chapter: 6,
  },
  {
    id: 93,
    type: 'multiple-choice',
    questionText: '中断向量表位于哪个存储器空间？',
    options: ['内部RAM', '外部RAM', '程序存储器ROM', 'SFR区'],
    correctAnswer: '程序存储器ROM',
    ka: '5.3',
    chapter: 5,
  },
  {
    id: 94,
    type: 'multiple-choice',
    questionText: '在串行通信中，奇偶校验位的作用是什么？',
    options: ['标记数据结束', '标记数据开始', '用于简单的差错检测', '提高传输速度'],
    correctAnswer: '用于简单的差错检测',
    ka: '7.1',
    chapter: 7,
  },
  {
    id: 95,
    type: 'multiple-choice',
    questionText: '指令 `MOV A, R3` 中源操作数采用的寻址方式是？',
    options: ['立即寻址', '直接寻址', '寄存器寻址', '寄存器间接寻址'],
    correctAnswer: '寄存器寻址',
    ka: '3.1.3',
    chapter: 3,
  },
  {
    id: 96,
    type: 'code-completion',
    questionText: '补全代码，将累加器A的内容循环左移一位（不通过进位位）。',
    code: `MOV A, #81H ; A = 10000001B
___       ; 执行后 A = 00000011B`,
    correctAnswer: 'RL A',
    ka: '3.4',
    chapter: 3,
  },
  {
    id: 97,
    type: 'multiple-choice',
    questionText: 'TCON寄存器中的IT1位用于设置什么？',
    options: ['定时器1的工作模式', '外部中断1的触发方式', '启动定时器1', '定时器1的溢出标志'],
    correctAnswer: '外部中断1的触发方式',
    ka: '5.3',
    chapter: 5,
  },
  {
    id: 98,
    type: 'multiple-choice',
    questionText: '中断服务程序的入口地址称为？',
    options: ['中断向量', '中断标志', '中断请求', '中断优先级'],
    correctAnswer: '中断向量',
    ka: '5.3',
    chapter: 5,
  },
  {
    id: 99,
    type: 'code-completion',
    questionText: '补全代码，将位地址 20H 对应的位清零。',
    code: `; 使用位操作指令清除位地址20H
___`,
    correctAnswer: 'CLR 20H',
    ka: '3.1.7',
    chapter: 3,
  },
  {
    id: 100,
    type: 'multiple-choice',
    questionText: 'SCON寄存器中的SM2位在什么模式下起作用，主要用于什么场景？',
    options: ['模式1，提高波特率精度', '模式0，兼容老设备', '模式2和3，用于多机通信', '所有模式，用于错误检测'],
    correctAnswer: '模式2和3，用于多机通信',
    ka: '7.2',
    chapter: 7,
  },

  // === 矩阵键盘扫描 (补充8题) ===
  {
    id: 101,
    type: 'multiple-choice',
    questionText: '4x4矩阵键盘通常需要多少根I/O线？',
    options: ['4根', '6根', '8根', '16根'],
    correctAnswer: '8根',
    ka: '8.2',
    chapter: 8,
  },
  {
    id: 102,
    type: 'code-completion',
    questionText: '补全代码，扫描矩阵键盘的第1行（设定该行为低电平，其他行为高电平）。',
    code: `; 扫描矩阵键盘第1行
MOV P1, #___  ; P1.7-P1.4控制行，P1.3-P1.0读取列`,
    correctAnswer: '0EFH',
    ka: '8.2',
    chapter: 8,
  },
  {
    id: 103,
    type: 'multiple-choice',
    questionText: '矩阵键盘扫描中（行线接P1.7–P1.4、第1行接P1.4；列线接P1.3–P1.0、第1列接P1.0），若扫描第1行时读到P1口为0EEH（11101110B），表示什么？',
    options: ['第1行第2列按键被按下', '第1行第1列按键被按下', '第2行第2列按键被按下', '没有按键按下'],
    correctAnswer: '第1行第1列按键被按下',
    ka: '8.2',
    chapter: 8,
    explanation: '0EEH=1110 1110B，P1.4=0 表示当前扫描的是第1行，P1.0=0 表示第1列被拉低，即第1行第1列按键按下。',
  },
  {
    id: 104,
    type: 'code-completion',
    questionText: '补全代码，消除按键抖动的延时子程序（约10ms，12MHz晶振）。',
    code: `DELAY_10MS:
    MOV R6, #10    ; 外层循环
D1: MOV R7, #___   ; 内层循环，约1ms
D2: NOP
    NOP
    DJNZ R7, D2    ; NOP+NOP+DJNZ 共4个机器周期=4μs
    DJNZ R6, D1
    RET`,
    correctAnswer: '250',
    ka: '8.2',
    chapter: 8,
    explanation: '12MHz 下 1 机器周期=1μs，内层每轮 NOP(1)+NOP(1)+DJNZ(2)=4μs，250×4μs=1ms，外层10次约10ms。',
  },
  {
    id: 105,
    type: 'multiple-choice',
    questionText: '键盘扫描中的"去抖动"处理通常采用什么方法？',
    options: ['硬件滤波', '软件延时', '中断处理', '硬件滤波和软件延时'],
    correctAnswer: '硬件滤波和软件延时',
    ka: '8.2',
    chapter: 8,
  },
  {
    id: 106,
    type: 'code-completion',
    questionText: '补全代码，等待按键释放的检测循环。',
    code: `WAIT_RELEASE:
    MOV P1, #0FH     ; 行线(P1.7-P1.4)全输出低电平，列线(P1.3-P1.0)置1准备读入
    MOV A, P1        ; 读取按键状态
    ANL A, #0FH      ; 只保留列信息
    CJNE A, #___, WAIT_RELEASE  ; 等待所有按键释放
    RET`,
    correctAnswer: '0FH',
    ka: '8.2',
    chapter: 8,
    explanation: '准双向口读引脚前须先写1；列线全为1即 0FH 表示无键按下，按键释放后退出循环。',
  },
  {
    id: 107,
    type: 'multiple-choice',
    questionText: '4x4矩阵键盘的扫描频率一般设置为多少比较合适？',
    options: ['1Hz', '10Hz', '100Hz', '1kHz'],
    correctAnswer: '100Hz',
    ka: '8.2',
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
    RL A            ; A = 行号 * 2
    ___             ; A = 行号 * 4
    ADD A, R3       ; A = 行号*4 + 列号
    MOV R4, A       ; 保存键值到R4
    RET`,
    correctAnswer: 'RL A',
    ka: '8.2',
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
    chapter: 8,
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
    chapter: 8,
  },
  {
    id: 111,
    type: 'multiple-choice',
    questionText: 'ADC0809的转换时间大约是多少？',
    options: ['10μs', '100μs', '1ms', '10ms'],
    correctAnswer: '100μs',
    ka: '8.3',
    chapter: 8,
  },
  {
    id: 112,
    type: 'code-completion',
    questionText: '补全代码，等待ADC转换完成的检测循环。',
    code: `; P0: 接ADC0809的OE（高电平有效）
WAIT_ADC:
    JNB P2.4, WAIT_ADC  ; 等待EOC变高（转换结束）
    MOV P0, #___        ; OE=1，允许输出
    MOV A, P1           ; 读取转换结果
    MOV P0, #00H        ; OE=0，输出高阻
    RET`,
    correctAnswer: '0FFH',
    ka: '8.3',
    chapter: 8,
    explanation: 'ADC0809 的 OE 为高电平有效：OE=1 时输出锁存器数据送到 D0–D7，读完后拉低 OE 使数据线回到高阻。',
  },
  {
    id: 113,
    type: 'multiple-choice',
    questionText: '如果ADC的参考电压是5V，8位ADC读到的数值是128，实际电压是多少？',
    options: ['1.25V', '2.5V', '3.75V', '5V'],
    correctAnswer: '2.5V',
    ka: '8.3',
    chapter: 8,
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
    chapter: 8,
  },

  // === 寻址方式 (补充5题) ===
  {
    id: 115,
    type: 'multiple-choice',
    questionText: '`SJMP LOOP` 的目标地址由当前PC与偏移量共同形成，这属于哪种寻址方式？',
    options: ['立即寻址', '直接寻址', '相对寻址', '位寻址'],
    correctAnswer: '相对寻址',
    ka: '3.1.6',
    chapter: 3,
  },
  {
    id: 116,
    type: 'code-completion',
    questionText: '补全代码，将P1.0置1，要求使用位寻址指令。',
    code: `; 使用位操作指令将P1.0置1
___`,
    correctAnswer: 'SETB P1.0',
    ka: '3.1.7',
    chapter: 3,
  },
  {
    id: 117,
    type: 'multiple-choice',
    questionText: '指令"MOV A, #20H"使用的是什么寻址方式？',
    options: ['直接寻址', '立即寻址', '寄存器寻址', '间接寻址'],
    correctAnswer: '立即寻址',
    ka: '3.1.1',
    chapter: 3,
  },
  {
    id: 118,
    type: 'code-completion',
    questionText: '补全短跳转指令，使程序以相对寻址方式跳回 LOOP。',
    code: `LOOP:
    INC A
    ___`,
    correctAnswer: 'SJMP LOOP',
    ka: '3.1.6',
    chapter: 3,
  },
  {
    id: 119,
    type: 'multiple-choice',
    questionText: '指令 `ADD A, R6` 中的 R6 采用什么寻址方式？',
    options: ['直接寻址', '寄存器寻址', '寄存器间接寻址', '相对寻址'],
    correctAnswer: '寄存器寻址',
    ka: '3.1.3',
    chapter: 3,
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
    ka: '3.2',
    chapter: 3,
  },
  {
    id: 121,
    type: 'code-completion',
    questionText: '补全代码，设置PSW寄存器选择第2组工作寄存器（内部RAM 10H–17H）。',
    code: `; 选择第2组工作寄存器
MOV PSW, #___   ; RS1=1, RS0=0`,
    correctAnswer: '10H',
    ka: '2.1',
    chapter: 2,
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
    questionText: '补全代码，用位操作指令将内部RAM字节地址24H单元的bit3置1（提示：位地址=(24H−20H)×8+3）。',
    code: `; 设置24H单元的bit3为1
SETB ___`,
    correctAnswer: '23H',
    ka: '3.6',
    chapter: 3,
    explanation: '位寻址区 20H–2FH 每字节8个位地址，字节24H 对应位地址20H–27H，bit3 即 23H。',
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
    chapter: 2,
  },
  {
    id: 125,
    type: 'multiple-choice',
    questionText: 'P0口作为地址/数据复用总线时，需要外接什么器件？',
    options: ['上拉电阻', '锁存器', '缓冲器', '锁存器和上拉电阻'],
    correctAnswer: '锁存器',
    ka: '2.6',
    chapter: 2,
    explanation: 'P0 作地址/数据复用总线时输出级为推挽，不需外接上拉电阻，只需地址锁存器（如74LS373）在 ALE 下降沿锁存低8位地址；作通用 I/O 时因漏极开路才需上拉。',
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
    ka: '3.3',
    chapter: 3,
  },

  // === 定时器/计数器 (补充题) ===
  {
    id: 127,
    type: 'multiple-choice',
    questionText: '定时器工作在模式2时的特点是什么？',
    options: ['13位定时器', '16位定时器', '8位自动重装定时器', '分频定时器'],
    correctAnswer: '8位自动重装定时器',
    ka: '6.2',
    chapter: 6,
  },
  {
    id: 128,
    type: 'code-completion',
    questionText: '补全代码，设置定时器1工作在模式2，定时250微秒（12MHz晶振）。',
    code: `; T1模式2，定时250us
    MOV TMOD, #20H   ; T1模式2
    MOV TH1, #06H    ; 重装载值(256-250=6)
    MOV TL1, #___    ; 初值与重装载值相同
    SETB TR1         ; 启动T1`,
    correctAnswer: '06H',
    ka: '6.2',
    chapter: 6,
  },

  // === 中断系统 (补充题) ===
  {
    id: 129,
    type: 'code-completion',
    questionText: '补全代码，设置外部中断0为边沿触发方式。',
    code: `; 设置INT0为边沿触发
    SETB ___        ; IT0=1`,
    correctAnswer: 'IT0',
    ka: '5.3',
    chapter: 5,
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
    chapter: 8,
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
    ka: '7.2',
    chapter: 7,
  },

  // === 综合应用题 ===
  {
    id: 132,
    type: 'multiple-choice',
    questionText: '在设计一个数字温度计系统时，需要用到哪些8051的功能模块？',
    options: ['ADC + 数码管显示', 'ADC + 数码管显示 + 定时器', 'ADC + 数码管显示 + 定时器 + 串口', '所有功能模块'],
    correctAnswer: 'ADC + 数码管显示 + 定时器 + 串口',
    ka: '9.1',
    chapter: 9,
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
    ___              ; 比较当前位，不相等则跳转WRONG
    INC R0
    INC R1
    DJNZ R2, LOOP
    ; 密码正确处理
    RET
WRONG:
    ; 密码错误处理
    RET`,
    correctAnswer: 'CJNE A, @R1, WRONG',
    ka: '8.2',
    chapter: 8,
    explanation: 'CJNE A,@R1,rel 直接比较并在不相等时转移，无需再用 JNZ；若用 XRL A,@R1 做比较则相等时A=0，才配 JNZ。',
  },
  {
    id: 134,
    type: 'multiple-choice',
    questionText: '在多任务系统中，使用定时器中断进行任务切换的主要优点是什么？',
    options: ['节省存储空间', '提高运行速度', '实现实时性', '降低功耗'],
    correctAnswer: '实现实时性',
    ka: '6.3',
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
    // 由定时中断驱动的轮询调度，归入“定时器应用”，不误标为系统调试。
    ka: '6.3',
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
    chapter: 2,
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
    ka: '3.3',
    chapter: 3,
  },
  {
    id: 138,
    type: 'multiple-choice',
    questionText: '8051的堆栈指针SP初始值是多少？',
    options: ['06H', '07H', '08H', '09H'],
    correctAnswer: '07H',
    ka: '2.2',
    chapter: 2,
  },
  {
    id: 139,
    type: 'code-completion',
    questionText: '补全代码，将累加器A的内容压入堆栈。',
    code: `; 保存A寄存器到堆栈
___  ACC`,
    correctAnswer: 'PUSH',
    ka: '3.2',
    chapter: 3,
    explanation: 'PUSH direct 只接受直接地址，累加器作直接地址须写 ACC（地址E0H），PUSH A 不是合法写法。',
  },
  {
    id: 140,
    type: 'multiple-choice',
    questionText: 'PSW寄存器中的CY位表示什么？',
    options: ['奇偶校验位', '进位标志位', '辅助进位位', '溢出标志位'],
    correctAnswer: '进位标志位',
    ka: '2.1',
    chapter: 2,
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
    chapter: 2,
  },
  {
    id: 147,
    type: 'code-completion',
    questionText: '补全代码，只改变P1.3的状态，其他位保持不变。',
    code: `; 将P1.3置1，其他位不变
___  P1.3`,
    correctAnswer: 'SETB',
    ka: '3.6',
    chapter: 3,
  },
  {
    id: 148,
    type: 'multiple-choice',
    questionText: '当P0口用作地址总线时，输出的是什么？',
    options: ['数据总线', '低8位地址', '高8位地址', '控制信号'],
    correctAnswer: '低8位地址',
    ka: '2.6',
    chapter: 2,
  },
  {
    id: 149,
    type: 'code-completion',
    questionText: '补全代码，检测P1.0是否为低电平。',
    code: `; 检测P1.0状态
___  P1.0, HIGH_LEVEL  ; 如果P1.0=1则跳转`,
    correctAnswer: 'JB',
    ka: '3.6',
    chapter: 3,
  },
  {
    id: 150,
    type: 'multiple-choice',
    questionText: 'P2口在访问外部存储器时输出什么信号？',
    options: ['数据信号', '低8位地址', '高8位地址', '控制信号'],
    correctAnswer: '高8位地址',
    ka: '2.6',
    chapter: 2,
  },

  // === 指令系统进阶题 ===
  {
    id: 151,
    type: 'multiple-choice',
    questionText: '指令CJNE A, #50H, NEXT的功能是什么？',
    options: ['比较A与50H，相等则跳转', '比较A与50H，不相等则跳转', '将50H送入A', '将A与50H相加'],
    correctAnswer: '比较A与50H，不相等则跳转',
    ka: '3.5',
    chapter: 3,
  },
  {
    id: 152,
    type: 'code-completion',
    questionText: '补全代码，实现累加器A的内容左移一位。',
    code: `; A寄存器左移一位
___  A`,
    correctAnswer: 'RL',
    ka: '3.4',
    chapter: 3,
  },
  {
    id: 153,
    type: 'multiple-choice',
    questionText: '指令SWAP A的功能是什么？',
    options: ['A的高4位和低4位交换', 'A与B寄存器交换', 'A的内容取反', 'A的内容清零'],
    correctAnswer: 'A的高4位和低4位交换',
    ka: '3.2',
    chapter: 3,
  },
  {
    id: 154,
    type: 'code-completion',
    questionText: '补全代码，实现BCD码调整。',
    code: `; BCD加法调整
ADD A, R0    ; 两个BCD数相加
___          ; BCD调整`,
    correctAnswer: 'DA A',
    ka: '3.3',
    chapter: 3,
  },
  {
    id: 155,
    type: 'multiple-choice',
    questionText: '相对跳转指令的跳转范围是？',
    options: ['-128到+127字节', '-256到+255字节', '-64到+63字节', '-32到+31字节'],
    correctAnswer: '-128到+127字节',
    ka: '3.5',
    chapter: 3,
  },

  // === 定时器/计数器进阶题 ===
  {
    id: 156,
    type: 'multiple-choice',
    questionText: '定时器工作在模式3时，定时器0被分成几个独立的定时器？',
    options: ['1个', '2个', '3个', '4个'],
    correctAnswer: '2个',
    ka: '6.2',
    chapter: 6,
  },
  {
    id: 157,
    type: 'code-completion',
    questionText: '补全代码，设置定时器0工作在计数器模式。',
    code: `; T0工作在计数器模式
MOV TMOD, #___   ; 设置T0为计数器模式1`,
    correctAnswer: '05H',
    ka: '6.2',
    chapter: 6,
  },
  {
    id: 158,
    type: 'multiple-choice',
    questionText: '定时器的计数脉冲来源可以是？',
    options: ['只能是内部时钟', '只能是外部脉冲', '内部时钟或外部脉冲', '只能是晶振'],
    correctAnswer: '内部时钟或外部脉冲',
    ka: '6.1',
    chapter: 6,
  },
  {
    id: 159,
    type: 'code-completion',
    questionText: '补全代码，检查定时器1是否溢出。',
    code: `; 检查T1溢出标志
___  TF1, T1_OVERFLOW  ; 如果TF1=1则跳转`,
    correctAnswer: 'JB',
    ka: '6.2',
    chapter: 6,
  },
  {
    id: 160,
    type: 'multiple-choice',
    questionText: '在12MHz晶振下，定时器的计数频率是多少？',
    options: ['12MHz', '6MHz', '1MHz', '500KHz'],
    correctAnswer: '1MHz',
    ka: '6.1',
    chapter: 6,
  },

  // === 中断系统进阶题 ===
  {
    id: 161,
    type: 'multiple-choice',
    questionText: '8051共有几个中断源？',
    options: ['3个', '4个', '5个', '6个'],
    correctAnswer: '5个',
    ka: '5.2.1',
    chapter: 5,
  },
  {
    id: 162,
    type: 'code-completion',
    questionText: '补全代码，禁止所有中断。',
    code: `; 禁止所有中断
___  EA`,
    correctAnswer: 'CLR',
    ka: '5.2',
    chapter: 5,
  },
  {
    id: 163,
    type: 'multiple-choice',
    questionText: '中断服务程序的入口地址是固定的吗？',
    options: ['是，由硬件决定', '否，可以任意设置', '部分固定，部分可设置', '由软件完全决定'],
    correctAnswer: '是，由硬件决定',
    ka: '5.3',
    chapter: 5,
  },
  {
    id: 164,
    type: 'code-completion',
    questionText: '补全代码，设置串口中断为高优先级。',
    code: `; 设置串口中断优先级
___  PS`,
    correctAnswer: 'SETB',
    ka: '5.2',
    chapter: 5,
  },
  {
    id: 165,
    type: 'multiple-choice',
    questionText: '当同时有多个同优先级中断请求时，CPU如何处理？',
    options: ['随机选择', '按中断号顺序', '按默认优先级顺序', '拒绝所有中断'],
    correctAnswer: '按默认优先级顺序',
    ka: '5.2',
    chapter: 5,
  },

  // === LED动态扫描进阶题 ===
  {
    id: 166,
    type: 'multiple-choice',
    questionText: 'LED数码管动态扫描的扫描频率通常应该大于多少？',
    options: ['10Hz', '25Hz', '50Hz', '100Hz'],
    correctAnswer: '50Hz',
    ka: '8.1',
    chapter: 8,
  },
  {
    id: 167,
    type: 'code-completion',
    questionText: '补全代码，显示数字"8"的段码。',
    code: `; 显示数字8
MOV P0, #___H   ; 7段数码管段码`,
    correctAnswer: '7F',
    ka: '8.1',
    chapter: 8,
  },
  {
    id: 168,
    type: 'multiple-choice',
    questionText: '共阴极数码管和共阳极数码管的主要区别是什么？',
    options: ['显示亮度不同', '段码定义相反', '功耗不同', '响应速度不同'],
    correctAnswer: '段码定义相反',
    ka: '8.1',
    chapter: 8,
  },
  {
    id: 169,
    type: 'code-completion',
    questionText: '补全代码，实现8位数码管全部熄灭。',
    code: `; 熄灭所有数码管（共阴极，位选低电平有效，与第4位选通0F7H的约定一致）
MOV P2, #___H   ; 位选全部关闭`,
    correctAnswer: 'FF',
    ka: '8.1',
    chapter: 8,
    explanation: '共阴极数码管位选低电平有效，全部置1即全部熄灭；若经反相驱动则极性相反，题目已注明直接驱动。',
  },
  {
    id: 170,
    type: 'multiple-choice',
    questionText: '在LED点阵显示中，行扫描和列扫描的作用是什么？',
    options: ['都是选择显示位置', '行选择，列控制亮灭', '列选择，行控制亮灭', '行列都控制亮灭'],
    correctAnswer: '行选择，列控制亮灭',
    ka: '8.1',
    chapter: 8,
  },

  // === 矩阵键盘扫描进阶题 ===
  {
    id: 171,
    type: 'multiple-choice',
    questionText: '4×4矩阵键盘需要占用多少个I/O口线？',
    options: ['4根', '6根', '8根', '16根'],
    correctAnswer: '8根',
    ka: '8.2',
    chapter: 8,
  },
  {
    id: 172,
    type: 'code-completion',
    questionText: '补全代码，扫描矩阵键盘的第一行。',
    code: `; 扫描第一行
MOV P1, #___H   ; 第一行输出低电平，其他行高电平`,
    correctAnswer: 'FE',
    ka: '8.2',
    chapter: 8,
  },
  {
    id: 173,
    type: 'multiple-choice',
    questionText: '矩阵键盘扫描中，为什么要进行按键消抖？',
    options: ['提高扫描速度', '消除机械抖动', '节省功耗', '增加按键寿命'],
    correctAnswer: '消除机械抖动',
    ka: '8.2',
    chapter: 8,
  },
  {
    id: 174,
    type: 'code-completion',
    questionText: '补全代码，检测矩阵键盘是否有按键按下。',
    code: `; 检测是否有按键按下
MOV P1, #0F0H   ; 行线(P1.3-P1.0)输出0，列线(P1.7-P1.4)置1输入
MOV A, P1
___  A, #0F0H, KEY_DOWN   ; 列线不全为1则有键按下
; 无键按下
RET
KEY_DOWN:`,
    correctAnswer: 'CJNE',
    ka: '8.2',
    chapter: 8,
    explanation: 'CJNE A,#data,rel 为三操作数指令，A≠0F0H 说明有列线被拉低，即有键按下。',
  },
  {
    id: 175,
    type: 'multiple-choice',
    questionText: '键盘扫描程序中，延时消抖的时间通常是多少？',
    options: ['1-5ms', '10-20ms', '50-100ms', '200-500ms'],
    correctAnswer: '10-20ms',
    ka: '8.2',
    chapter: 8,
  },

  // === 串行通信进阶题 ===
  {
    id: 176,
    type: 'multiple-choice',
    questionText: '8051串口工作在模式0时的特点是什么？',
    options: ['异步通信', '同步通信', '9位数据', '可变波特率'],
    correctAnswer: '同步通信',
    ka: '7.2',
    chapter: 7,
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
    ka: '7.3',
    chapter: 7,
  },
  {
    id: 178,
    type: 'multiple-choice',
    questionText: '串口模式2和模式3的数据位数分别是多少？',
    options: ['8位和8位', '9位和9位', '8位和9位', '9位和8位'],
    correctAnswer: '9位和9位',
    ka: '7.2',
    chapter: 7,
  },
  {
    id: 179,
    type: 'code-completion',
    questionText: '补全代码，设置串口工作在模式3。',
    code: `; 串口模式3设置（多机通信从机，允许接收）
MOV SCON, #___H   ; SM0=1, SM1=1, SM2=1, REN=1，其余位为0`,
    correctAnswer: 'F0',
    ka: '7.2',
    chapter: 7,
    explanation: 'SCON 位序 SM0 SM1 SM2 REN TB8 RB8 TI RI，1111 0000B=F0H。',
  },
  {
    id: 180,
    type: 'multiple-choice',
    questionText: '在串行通信中，校验位的作用是什么？',
    options: ['提高传输速度', '检测传输错误', '同步数据', '控制流量'],
    correctAnswer: '检测传输错误',
    ka: '7.1',
    chapter: 7,
  },

  // === ADC应用进阶题 ===
  {
    id: 181,
    type: 'multiple-choice',
    questionText: '8位ADC的分辨率是多少？',
    options: ['1/128', '1/256', '1/512', '1/1024'],
    correctAnswer: '1/256',
    ka: '8.3',
    chapter: 8,
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
    chapter: 8,
  },
  {
    id: 183,
    type: 'multiple-choice',
    questionText: 'ADC转换时间主要取决于什么？',
    options: ['输入电压', '参考电压', '时钟频率', '温度'],
    correctAnswer: '时钟频率',
    ka: '8.3',
    chapter: 8,
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
    chapter: 8,
  },
  {
    id: 185,
    type: 'multiple-choice',
    questionText: '在温度测量系统中，通常需要进行什么处理？',
    options: ['只需ADC转换', 'ADC转换+线性化', 'ADC转换+滤波', 'ADC转换+线性化+滤波'],
    correctAnswer: 'ADC转换+线性化+滤波',
    ka: '8.4',
    chapter: 8,
  },

  // === 综合应用题 ===
  {
    id: 186,
    type: 'multiple-choice',
    questionText: '设计一个数字时钟系统，主要需要哪些功能模块？',
    options: ['定时器+数码管', '定时器+数码管+键盘', '定时器+数码管+键盘+存储器', '所有功能模块'],
    correctAnswer: '定时器+数码管+键盘+存储器',
    ka: '9.1',
    chapter: 9,
  },
  {
    id: 187,
    type: 'code-completion',
    questionText: '经典8051片内没有看门狗，需外接看门狗芯片（如MAX813L，WDI接WDT_PIN）。补全代码，输出一个喂狗脉冲。',
    code: `; 外部看门狗喂狗
WATCHDOG_FEED:
___  WDT_PIN   ; 输出脉冲喂狗
CALL DELAY_1MS
CLR WDT_PIN
RET`,
    correctAnswer: 'SETB',
    ka: '2.5.3',
    chapter: 2,
  },
  {
    id: 188,
    type: 'multiple-choice',
    questionText: '系统方案设计阶段，为提高多传感器采集的可靠性，应优先采取哪项措施？',
    options: ['只提高采样频率', '定义校验、异常值处理和冗余策略', '只增加存储容量', '取消传感器状态检查'],
    correctAnswer: '定义校验、异常值处理和冗余策略',
    ka: '9.1.2',
    chapter: 9,
  },
  {
    id: 189,
    type: 'code-completion',
    questionText: '8051复位后PC=0000H。补全复位入口的伪指令地址，使复位后先跳过中断向量区再进入主程序。',
    code: `ORG ___H        ; 复位入口
    LJMP MAIN
ORG 0030H       ; 主程序避开 0003H–0023H 中断向量区
MAIN:`,
    correctAnswer: '0000',
    ka: '2.5',
    chapter: 2,
    explanation: '复位使PC=0000H、SP=07H、各SFR回到初值。注意：在程序里执行 LJMP 0000H 并不等同于硬件复位——SFR不会恢复初值，若在中断服务程序中跳转，中断优先级状态也不会被清除。',
  },
  {
    id: 190,
    type: 'multiple-choice',
    questionText: '对具有明确截止时间的实时控制系统，性能测试时首先要核对哪项指标？',
    options: ['处理速度', '存储容量', '响应时间', '功耗'],
    correctAnswer: '响应时间',
    ka: '9.3.4',
    chapter: 9,
  },

  // === 高级应用题 ===
  {
    id: 191,
    type: 'multiple-choice',
    questionText: '系统软件按“采集—判断—执行”拆分为独立模块，主要工程目的是什么？',
    options: ['降低模块耦合，便于独立测试与联调', '提高晶振频率', '增加存储器容量', '取消软硬件接口定义'],
    correctAnswer: '降低模块耦合，便于独立测试与联调',
    ka: '9.1.4',
    chapter: 9,
  },
  {
    id: 192,
    type: 'code-completion',
    questionText: '补全主循环代码，按模块顺序调用采集、控制和显示任务。',
    code: `; 模块化主循环
MAIN_LOOP:
LCALL SAMPLE_TASK
LCALL CONTROL_TASK
___ DISPLAY_TASK
SJMP MAIN_LOOP`,
    correctAnswer: 'LCALL',
    ka: '9.1.4',
    chapter: 9,
  },
  {
    id: 193,
    type: 'multiple-choice',
    questionText: '在通信协议设计中，帧头的主要作用是什么？',
    options: ['数据校验', '帧同步', '错误纠正', '流量控制'],
    correctAnswer: '帧同步',
    ka: '7.4',
    chapter: 7,
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
    ka: '7.4',
    chapter: 7,
  },
  {
    id: 195,
    type: 'multiple-choice',
    questionText: '在8051应用中，降低运行功耗并在空闲时节能的方法有哪些？',
    options: ['降低时钟频率', '进入空闲或掉电模式', '减少无效轮询', '以上都是'],
    correctAnswer: '以上都是',
    ka: '2.7',
    chapter: 2,
  },
  {
    id: 196,
    type: 'code-completion',
    questionText: '补全代码，进入低功耗模式。',
    code: `; 进入空闲模式
MOV PCON, #___H   ; 设置IDL位`,
    correctAnswer: '01',
    ka: '2.7',
    chapter: 2,
  },
  {
    id: 197,
    type: 'multiple-choice',
    questionText: '在多任务系统中，任务调度的基本原则是什么？',
    options: ['先来先服务', '优先级调度', '时间片轮转', '根据系统需求选择'],
    correctAnswer: '根据系统需求选择',
    ka: '9.1.4',
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
___  SCHEDULER     ; 长调用任务调度器
POP PSW
POP ACC
RET`,
    correctAnswer: 'LCALL',
    ka: '9.1.4',
    chapter: 9,
    explanation: '8051 子程序调用只有 ACALL（2KB页内）和 LCALL（64KB全程），CALL 不是指令集中的指令。',
  },
  {
    id: 199,
    type: 'multiple-choice',
    questionText: '在系统调试中，最有效的调试方法是什么？',
    options: ['单步执行', '断点调试', '逻辑分析仪', '综合使用多种方法'],
    correctAnswer: '综合使用多种方法',
    ka: '9.3.3',
    chapter: 9,
  },
  {
    id: 200,
    type: 'code-completion',
    questionText: '补全代码，实现系统自检功能。',
    code: `; 系统自检（约定：各测试子程序通过时 SETB C，失败时 CLR C）
SELF_TEST:
LCALL RAM_TEST     ; RAM测试
JNC TEST_FAIL
LCALL ROM_TEST     ; ROM测试
JNC TEST_FAIL
LCALL IO_TEST      ; I/O测试
___  TEST_OK       ; C=1 说明最后一项也通过
TEST_FAIL:
MOV A, #0FFH       ; 测试失败标志
RET
TEST_OK:
MOV A, #00H        ; 测试成功标志
RET`,
    correctAnswer: 'JC',
    ka: '9.3.5',
    chapter: 9,
    explanation: '按约定子程序通过时 C=1，JC rel 在 CY=1 时转移到 TEST_OK。',
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
    ka: '7.1',
    chapter: 7,
  },
  {
    id: 202,
    type: 'multiple-choice',
    questionText: '异步通信的数据帧中，下列哪一项不是必须的？',
    options: ['起始位', '数据位', '停止位', '同步时钟线'],
    correctAnswer: '同步时钟线',
    ka: '7.1',
    chapter: 7,
  },
  {
    id: 203,
    type: 'multiple-choice',
    questionText: '波特率的定义是什么？',
    options: ['每秒传输的字节数', '每秒传输的位数（包括起止位）', '每秒传输的字符数', '每秒传输的有效数据位数'],
    correctAnswer: '每秒传输的位数（包括起止位）',
    ka: '7.1',
    chapter: 7,
  },
  {
    id: 204,
    type: 'multiple-choice',
    questionText: '通信双方可以同时收发数据的工作模式称为？',
    options: ['单工', '半双工', '全双工', '广播'],
    correctAnswer: '全双工',
    ka: '7.1',
    chapter: 7,
  },
  {
    id: 205,
    type: 'multiple-choice',
    questionText: '89C51串口控制寄存器 SCON 中，REN 位的作用是？',
    options: ['选择串口工作模式', '允许串口接收使能', '发送中断请求标志', '接收中断请求标志'],
    correctAnswer: '允许串口接收使能',
    ka: '7.2',
    chapter: 7,
  },
  {
    id: 206,
    type: 'multiple-choice',
    questionText: '关于 SBUF 寄存器的描述，正确的是？',
    options: ['只能用于发送数据', '只能用于接收数据', '物理上是同一寄存器，发送和接收共用', '物理上是两个独立寄存器，分别用于发送和接收'],
    correctAnswer: '物理上是两个独立寄存器，分别用于发送和接收',
    ka: '7.2',
    chapter: 7,
  },
  {
    id: 207,
    type: 'multiple-choice',
    questionText: '89C51 串口的标准波特率通常使用哪个定时器、哪种工作模式产生？',
    options: ['T0 模式 0', 'T0 模式 1', 'T1 模式 2（自动重装）', 'T1 模式 3'],
    correctAnswer: 'T1 模式 2（自动重装）',
    ka: '7.2',
    chapter: 7,
  },
  {
    id: 208,
    type: 'multiple-choice',
    questionText: '采用查询方式发送一字节数据后，软件应做什么处理？',
    options: ['等待 RI 置 1 后清零', '等待 TI 置 1 后清零', '直接写下一字节即可', '禁止串口中断'],
    correctAnswer: '等待 TI 置 1 后清零',
    ka: '7.3',
    chapter: 7,
  },
  {
    id: 209,
    type: 'multiple-choice',
    questionText: 'RS-232 通信中，常用 MAX232 芯片的主要作用是？',
    options: ['提高波特率', '电平转换（TTL ↔ RS-232）', '增强抗干扰', '实现全双工'],
    correctAnswer: '电平转换（TTL ↔ RS-232）',
    ka: '7.4',
    chapter: 7,
  },
  {
    id: 210,
    type: 'multiple-choice',
    questionText: 'RS-485 相比 RS-232 最主要的特点是？',
    options: ['传输距离更短', '使用差分信号传输，抗干扰强、距离远，支持多机通信', '只支持单工通信', '完全替代 SPI 协议'],
    correctAnswer: '使用差分信号传输，抗干扰强、距离远，支持多机通信',
    ka: '7.4',
    chapter: 7,
  },
  {
    id: 211,
    type: 'multiple-choice',
    questionText: 'SPI 协议的四根标准信号线是？',
    options: ['SDA / SCL / VCC / GND', 'TX / RX / CTS / RTS', 'MOSI / MISO / SCK / CS', 'D+ / D- / VBUS / GND'],
    correctAnswer: 'MOSI / MISO / SCK / CS',
    ka: '7.4',
    chapter: 7,
  },
  {
    id: 212,
    type: 'multiple-choice',
    questionText: 'I2C 总线只用两根信号线，分别是？',
    options: ['MOSI 和 MISO', 'TX 和 RX', 'SDA 和 SCL', 'D+ 和 D-'],
    correctAnswer: 'SDA 和 SCL',
    ka: '7.4',
    chapter: 7,
  },

  // ---- CH10 前沿应用 (扩充) --------------------------------------------
  {
    id: 213,
    type: 'multiple-choice',
    questionText: 'ESP8266 模块通常通过什么接口与单片机通信？',
    options: ['SPI', 'I2C', '串口（UART）+ AT 指令', '直接连 P0 口并行总线'],
    correctAnswer: '串口（UART）+ AT 指令',
    ka: '10.1',
    chapter: 10,
  },
  {
    id: 214,
    type: 'multiple-choice',
    questionText: 'HC-05 蓝牙模块的"透传"含义是？',
    options: ['加密透明的数据传输', '不修改数据内容，串口数据直接通过蓝牙转发', '只能透传 ASCII 字符', '仅在主从配对成功后能传'],
    correctAnswer: '不修改数据内容，串口数据直接通过蓝牙转发',
    ka: '10.1',
    chapter: 10,
  },
  {
    id: 215,
    type: 'multiple-choice',
    questionText: 'LoRa 通信技术最突出的特点是？',
    options: ['超高速率短距离传输', '低功耗、远距离、低速率', '高功耗大带宽', '需要持续电源不能电池供电'],
    correctAnswer: '低功耗、远距离、低速率',
    ka: '10.1',
    chapter: 10,
  },
  {
    id: 216,
    type: 'multiple-choice',
    questionText: 'MQTT 协议采用的通信模型是？',
    options: ['客户端/服务器请求-响应', '点对点直连', '发布 / 订阅（Publish/Subscribe）', '广播'],
    correctAnswer: '发布 / 订阅（Publish/Subscribe）',
    ka: '10.1',
    chapter: 10,
  },
  {
    id: 217,
    type: 'multiple-choice',
    questionText: 'NB-IoT 属于哪一类无线技术？',
    options: ['短距离高速通信', '低功耗广域网（LPWAN）', '工业以太网', '可见光通信'],
    correctAnswer: '低功耗广域网（LPWAN）',
    ka: '10.1',
    chapter: 10,
  },
  {
    id: 218,
    type: 'multiple-choice',
    questionText: 'TinyML 主要解决的问题是？',
    options: ['在云端服务器训练大模型', '在资源受限的微控制器上部署机器学习推理', '替代所有传统算法', '降低 PC 的算力需求'],
    correctAnswer: '在资源受限的微控制器上部署机器学习推理',
    ka: '10.2',
    chapter: 10,
  },
  {
    id: 219,
    type: 'multiple-choice',
    questionText: '边缘计算相比把数据全部上传云端处理，主要优势是？',
    options: ['完全替代云端', '降低传输延迟、节约带宽、保护本地数据隐私', '硬件成本更高', '只适合视频处理'],
    correctAnswer: '降低传输延迟、节约带宽、保护本地数据隐私',
    ka: '10.2',
    chapter: 10,
  },
  {
    id: 220,
    type: 'multiple-choice',
    questionText: 'RISC-V 指令集架构的核心特点是？',
    options: ['闭源商业架构，需付授权费', '开源、模块化、精简指令集', '仅适用于桌面 CPU', '不能用于 MCU'],
    correctAnswer: '开源、模块化、精简指令集',
    ka: '10.3',
    chapter: 10,
  },
  {
    id: 221,
    type: 'multiple-choice',
    questionText: '下列哪款是国产基于 RISC-V 架构的微控制器？',
    options: ['STM32F103', 'AT89C51', '兆易 GD32V 系列', 'ATmega328'],
    correctAnswer: '兆易 GD32V 系列',
    ka: '10.3',
    chapter: 10,
  },
  {
    id: 222,
    type: 'multiple-choice',
    questionText: '相比 8051，RISC-V 在架构上的主要差异是？',
    options: ['8051 是 RISC，RISC-V 是 CISC', '两者完全相同', 'RISC-V 是开源精简指令集，寄存器更多、扩展性更强', 'RISC-V 不支持中断'],
    correctAnswer: 'RISC-V 是开源精简指令集，寄存器更多、扩展性更强',
    ka: '10.3',
    chapter: 10,
  },
  {
    id: 223,
    type: 'multiple-choice',
    questionText: '智慧农业系统中，单片机最常承担的角色是？',
    options: ['仅做云端数据可视化', '采集温湿度等传感数据并控制执行机构（如灌溉阀）', '替代农作物', '不参与数据采集'],
    correctAnswer: '采集温湿度等传感数据并控制执行机构（如灌溉阀）',
    ka: '10.4',
    chapter: 10,
  },
  {
    id: 224,
    type: 'multiple-choice',
    questionText: '可穿戴健康监测设备对所选 MCU 的最关键要求是？',
    options: ['超大主频', '低功耗以延长电池续航', '大尺寸封装', '不需要无线通信'],
    correctAnswer: '低功耗以延长电池续航',
    ka: '10.4',
    chapter: 10,
  },

  // ---- CH1 单片机概述（扩充）------------------------------------------
  // ka 字段对应 src/lib/knowledge-points.ts 中节点 id；题面与答案均依据
  // 该节点 description 字段。
  {
    id: 225,
    type: 'multiple-choice',
    questionText: '历史上第一款被广泛认可的微处理器是哪款？',
    options: ['Intel 4004', 'Intel 8051', 'Motorola 68000', 'Zilog Z80'],
    correctAnswer: 'Intel 4004',
    ka: '1.1',
    chapter: 1,
  },
  {
    id: 226,
    type: 'multiple-choice',
    questionText: '下列哪个国产单片机厂商不属于 1.1.3 节描述的国产 MCU 阵营？',
    options: ['STC（宏晶）', 'GD（兆易）', 'WCH（沁恒）CH32', 'Atmel'],
    correctAnswer: 'Atmel',
    ka: '1.1',
    chapter: 1,
  },
  {
    id: 227,
    type: 'multiple-choice',
    questionText: '在按字长分类的体系中，AT89C51 属于哪一类？',
    options: ['4 位', '8 位', '16 位', '32 位'],
    correctAnswer: '8 位',
    ka: '1.2',
    chapter: 1,
  },
  {
    id: 228,
    type: 'multiple-choice',
    questionText: '下列哪个不是 8051 最小系统的必备组成？',
    options: ['晶振电路', '电源去耦', '复位电路', '以太网控制器'],
    correctAnswer: '以太网控制器',
    ka: '1.4',
    chapter: 1,
  },
  {
    id: 229,
    type: 'multiple-choice',
    questionText: '8051 单片机典型 40 引脚 DIP 封装的主电源 VCC 和 GND 引脚分别是？',
    options: ['Pin 20 / Pin 40', 'Pin 40 / Pin 20', 'Pin 1 / Pin 20', 'Pin 18 / Pin 19'],
    correctAnswer: 'Pin 40 / Pin 20',
    ka: '1.4',
    chapter: 1,
  },
  {
    id: 230,
    type: 'multiple-choice',
    questionText: 'Keil uVision 的主要作用是什么？',
    options: ['绘制原理图', '集成开发：编辑、编译、调试 8051 程序', '物理仿真电路', '烧录 STC 单片机'],
    correctAnswer: '集成开发：编辑、编译、调试 8051 程序',
    ka: '1.5',
    chapter: 1,
  },
  {
    id: 231,
    type: 'multiple-choice',
    questionText: 'Proteus 软件最突出的能力是？',
    options: ['只能编辑 PCB', '电路仿真 + 单片机程序联合仿真', '编译 C 代码', '生成 BOM 表'],
    correctAnswer: '电路仿真 + 单片机程序联合仿真',
    ka: '1.5',
    chapter: 1,
  },

  // ---- CH3 指令系统（扩充）-------------------------------------------
  {
    id: 232,
    type: 'multiple-choice',
    questionText: '指令 `MOV A, 30H` 中操作数 30H 采用的寻址方式是？',
    options: ['立即寻址', '直接寻址', '寄存器寻址', '寄存器间接寻址'],
    correctAnswer: '直接寻址',
    ka: '3.1.2',
    chapter: 3,
  },
  {
    id: 233,
    type: 'multiple-choice',
    questionText: '指令 `MOV A, @R0` 中 @R0 表示？',
    options: ['立即数', '直接地址', 'R0 中存放的是操作数地址（间接寻址）', '寄存器 R0 本身的内容'],
    correctAnswer: 'R0 中存放的是操作数地址（间接寻址）',
    ka: '3.1.4',
    chapter: 3,
  },
  {
    id: 234,
    type: 'multiple-choice',
    questionText: '查 ROM 表时常用 `MOVC A, @A+DPTR`，这种寻址方式称为？',
    options: ['寄存器寻址', '相对寻址', '变址寻址（基址 + 变址）', '位寻址'],
    correctAnswer: '变址寻址（基址 + 变址）',
    ka: '3.1.5',
    chapter: 3,
  },
  {
    id: 235,
    type: 'multiple-choice',
    questionText: '访问外部数据存储器使用哪条指令？',
    options: ['MOV', 'MOVC', 'MOVX', 'PUSH'],
    correctAnswer: 'MOVX',
    ka: '3.2',
    chapter: 3,
  },
  {
    id: 236,
    type: 'multiple-choice',
    questionText: '`SWAP A` 指令的功能是？',
    options: ['交换 A 和 B 的内容', '交换 A 中高 4 位与低 4 位', '交换 A 与栈顶', 'A 取反'],
    correctAnswer: '交换 A 中高 4 位与低 4 位',
    ka: '3.2',
    chapter: 3,
  },
  {
    id: 237,
    type: 'multiple-choice',
    questionText: '关于堆栈指针 SP 的描述正确的是？',
    options: ['8051 复位后 SP 为 0', '8051 复位后 SP 默认指向 07H，PUSH 操作先 SP+1 再写入', 'SP 是 16 位寄存器', 'PUSH 操作先写入再 SP+1'],
    correctAnswer: '8051 复位后 SP 默认指向 07H，PUSH 操作先 SP+1 再写入',
    ka: '3.2',
    chapter: 3,
  },

  // ---- CH5 中断系统（扩充）------------------------------------------
  {
    id: 238,
    type: 'multiple-choice',
    questionText: '相比轮询方式，中断方式的核心优势是？',
    options: ['代码更简单', 'CPU 不必频繁查询，外设事件能即时响应', '不需要硬件支持', '执行速度更快'],
    correctAnswer: 'CPU 不必频繁查询，外设事件能即时响应',
    ka: '5.1',
    chapter: 5,
  },
  {
    id: 239,
    type: 'multiple-choice',
    questionText: '8051 的 5 个中断源中，哪一个的中断请求标志在 CPU 响应后不会被硬件自动清除，必须由服务程序软件清除？',
    options: ['定时器0溢出（TF0）', '定时器1溢出（TF1）', '边沿触发的外部中断0（IE0）', '串行口中断（TI/RI）'],
    correctAnswer: '串行口中断（TI/RI）',
    ka: '5.2',
    chapter: 5,
    explanation: 'TF0、TF1 与边沿触发的 IE0/IE1 在转向中断入口时由硬件清除；TI、RI 共用一个中断入口，硬件无法判断是哪个事件，必须由软件判别并清除，否则退出后会再次进入中断。',
  },
  {
    id: 240,
    type: 'multiple-choice',
    questionText: 'IE 寄存器中 EA 位的作用是？',
    options: ['控制定时器 0 中断', '控制串口中断', '总中断使能', '设置中断优先级'],
    correctAnswer: '总中断使能',
    ka: '5.2',
    chapter: 5,
  },
  {
    id: 241,
    type: 'multiple-choice',
    questionText: '8051 中断向量表里，外部中断 0（INT0）的入口地址是？',
    options: ['0000H', '0003H', '000BH', '0013H'],
    correctAnswer: '0003H',
    ka: '5.3',
    chapter: 5,
  },
  {
    id: 242,
    type: 'multiple-choice',
    questionText: '外部中断采用下降沿触发时，要把 TCON 中对应的 IT 位设置为？',
    options: ['0（电平触发）', '1（边沿触发）', 'X（任意）', '不需要设置'],
    correctAnswer: '1（边沿触发）',
    ka: '5.3',
    chapter: 5,
  },
  {
    id: 243,
    type: 'multiple-choice',
    questionText: '中断服务程序 ISR 的标准结尾指令是？',
    options: ['RET', 'RETI', 'SJMP $', 'NOP'],
    correctAnswer: 'RETI',
    ka: '5.4',
    chapter: 5,
  },

  // ---- CH8 接口技术（扩充：AD/DA + 传感器 + 电机）-----------------
  {
    id: 244,
    type: 'multiple-choice',
    questionText: 'ADC0809 一次可采集的模拟通道数是？',
    options: ['1', '4', '8', '16'],
    correctAnswer: '8',
    ka: '8.3',
    chapter: 8,
  },
  {
    id: 245,
    type: 'multiple-choice',
    questionText: 'DAC0832 之所以被称为"双缓冲"，是因为？',
    options: ['有两个 ADC', '内含输入寄存器和 DAC 寄存器两级数据缓冲', '使用双电源', '能并联两片增加分辨率'],
    correctAnswer: '内含输入寄存器和 DAC 寄存器两级数据缓冲',
    ka: '8.3',
    chapter: 8,
  },
  {
    id: 246,
    type: 'multiple-choice',
    questionText: 'DS18B20 与单片机通信采用的协议是？',
    options: ['I2C', 'SPI', '单总线（1-Wire）', 'UART'],
    correctAnswer: '单总线（1-Wire）',
    ka: '8.4',
    chapter: 8,
  },
  {
    id: 247,
    type: 'multiple-choice',
    questionText: 'HC-SR04 超声波模块测距时，单片机给的 Trig 触发脉冲宽度典型值是？',
    options: ['不少于 10us', '至少 100us', '1ms', '与回波同时长'],
    correctAnswer: '不少于 10us',
    ka: '8.4',
    chapter: 8,
  },
  {
    id: 248,
    type: 'multiple-choice',
    questionText: 'L298N 芯片的核心电路结构是？',
    options: ['单边驱动', 'H 桥', '推挽放大', '光耦隔离'],
    correctAnswer: 'H 桥',
    ka: '8.5',
    chapter: 8,
  },
  {
    id: 249,
    type: 'multiple-choice',
    questionText: 'SG90 舵机控制信号的周期一般是？',
    options: ['1ms', '20ms', '100ms', '1s'],
    correctAnswer: '20ms',
    ka: '8.5',
    chapter: 8,
  },
  // ============================================================
  // 补充题 id 250-298：补齐各二级知识点 ≥3 题（2026 备赛重建）
  // ============================================================
  {
    id: 250,
    type: 'multiple-choice',
    questionText: '单片机(MCU)与通用微处理器(MPU)最本质的区别是什么？',
    options: ['字长一定不同', '把CPU、存储器、I/O等集成在一块芯片上', 'MPU不能做运算', 'MCU只能用汇编编程'],
    correctAnswer: '把CPU、存储器、I/O等集成在一块芯片上',
    ka: '1.1',
    chapter: 1,
  },
  {
    id: 251,
    type: 'multiple-choice',
    questionText: '为单片机应用系统选型时，下列哪一项通常不是主要考虑因素？',
    options: ['所需I/O口数量', '片内存储器容量', '芯片外壳的颜色', '运行速度与功耗'],
    correctAnswer: '芯片外壳的颜色',
    ka: '1.2',
    chapter: 1,
  },
  {
    id: 252,
    type: 'multiple-choice',
    questionText: '下列哪种属于按“用途”对单片机进行的分类？',
    options: ['通用型与专用型', '4位与8位', 'CMOS型与HMOS型', 'DIP与QFP封装'],
    correctAnswer: '通用型与专用型',
    ka: '1.2',
    chapter: 1,
  },
  {
    id: 253,
    type: 'multiple-choice',
    questionText: '下列哪个领域通常不是单片机的典型应用？',
    options: ['智能家电控制', '汽车电子', '大型数据中心服务器主CPU', '工业过程控制'],
    correctAnswer: '大型数据中心服务器主CPU',
    ka: '1.3',
    chapter: 1,
  },
  {
    id: 254,
    type: 'multiple-choice',
    questionText: '单片机在智能仪表中主要承担什么作用？',
    options: ['仅提供电源', '数据采集、处理与控制', '机械支撑', '散热'],
    correctAnswer: '数据采集、处理与控制',
    ka: '1.3',
    chapter: 1,
  },
  {
    id: 255,
    type: 'multiple-choice',
    questionText: '下列家用电器中，内部通常含有单片机的是？',
    options: ['全自动洗衣机', '普通白炽灯', '机械闹钟', '普通保温杯'],
    correctAnswer: '全自动洗衣机',
    ka: '1.3',
    chapter: 1,
  },
  {
    id: 256,
    type: 'multiple-choice',
    questionText: '89C51单片机内部不包含下列哪一部分？',
    options: ['CPU', 'RAM/ROM', '定时器/计数器', '机械硬盘'],
    correctAnswer: '机械硬盘',
    ka: '1.4',
    chapter: 1,
  },
  {
    id: 257,
    type: 'multiple-choice',
    questionText: '将C51源程序编译后、用于烧录到单片机的目标文件，标准格式是？',
    options: ['.hex', '.docx', '.mp3', '.bmp'],
    correctAnswer: '.hex',
    ka: '1.5',
    chapter: 1,
  },
  {
    id: 258,
    type: 'multiple-choice',
    questionText: '89C51在12MHz晶振下，一个机器周期的时间约为？',
    options: ['1μs', '6μs', '12μs', '0.5μs'],
    correctAnswer: '1μs',
    ka: '2.4',
    chapter: 2,
  },
  {
    id: 259,
    type: 'multiple-choice',
    questionText: '89C51正常工作时，ALE引脚输出信号的频率是振荡频率的？',
    options: ['1/6', '1/2', '1/12', '与振荡频率相同'],
    correctAnswer: '1/6',
    ka: '2.4',
    chapter: 2,
  },
  {
    id: 260,
    type: 'multiple-choice',
    questionText: '时钟电路中，与晶振并联的两个微调电容的典型取值约为？',
    options: ['30pF', '30μF', '30Ω', '30mF'],
    correctAnswer: '30pF',
    ka: '2.4',
    chapter: 2,
  },
  {
    id: 261,
    type: 'multiple-choice',
    questionText: '89C51要可靠复位，应在RST引脚施加？',
    options: ['至少2个机器周期的高电平', '持续低电平', '一个下降沿', '一个负脉冲'],
    correctAnswer: '至少2个机器周期的高电平',
    ka: '2.5',
    chapter: 2,
  },
  {
    id: 262,
    type: 'multiple-choice',
    questionText: '89C51复位后，程序计数器PC的值为？',
    options: ['0000H', '0003H', 'FFFFH', '随机值'],
    correctAnswer: '0000H',
    ka: '2.5',
    chapter: 2,
  },
  {
    id: 263,
    type: 'multiple-choice',
    questionText: '在Keil μVision中新建工程后，必须完成的关键设置是？',
    options: ['选择目标单片机型号', '更换界面主题', '关闭自动保存', '调整字体大小'],
    correctAnswer: '选择目标单片机型号',
    ka: '4.1',
    chapter: 4,
  },
  {
    id: 264,
    type: 'multiple-choice',
    questionText: '在Keil中要生成可烧录的HEX文件，需在Options中勾选？',
    options: ['Create HEX File', 'Browse Information', '仅Warnings', 'Use Simulator'],
    correctAnswer: 'Create HEX File',
    ka: '4.1',
    chapter: 4,
  },
  {
    id: 265,
    type: 'multiple-choice',
    questionText: 'Keil中用于单步执行、观察寄存器与变量变化的是？',
    options: ['Debug(调试)模式', 'Build', 'Find in Files', 'Print'],
    correctAnswer: 'Debug(调试)模式',
    ka: '4.1',
    chapter: 4,
  },
  {
    id: 266,
    type: 'multiple-choice',
    questionText: 'C51中，unsigned char 类型的取值范围是？',
    options: ['0~255', '-128~127', '0~65535', '0~9'],
    correctAnswer: '0~255',
    ka: '4.2',
    chapter: 4,
  },
  {
    id: 267,
    type: 'multiple-choice',
    questionText: 'C51中用于声明可位寻址位变量的特有数据类型是？',
    options: ['bit', 'float', 'long', 'double'],
    correctAnswer: 'bit',
    ka: '4.2',
    chapter: 4,
  },
  {
    id: 268,
    type: 'multiple-choice',
    questionText: 'C51中 unsigned int 类型通常占用多少字节？',
    options: ['2', '1', '4', '8'],
    correctAnswer: '2',
    ka: '4.2',
    chapter: 4,
  },
  {
    id: 269,
    type: 'multiple-choice',
    questionText: '下列C51语句中，不属于循环结构的是？',
    options: ['switch', 'for', 'while', 'do-while'],
    correctAnswer: 'switch',
    ka: '4.3',
    chapter: 4,
  },
  {
    id: 270,
    type: 'multiple-choice',
    questionText: 'C51中执行 for(i=0; i<8; i++) 时，循环体共执行多少次？',
    options: ['8', '7', '9', '无限次'],
    correctAnswer: '8',
    ka: '4.3',
    chapter: 4,
  },
  {
    id: 271,
    type: 'multiple-choice',
    questionText: 'C51中 break 语句的作用是？',
    options: ['跳出当前循环或switch', '结束整个程序', '产生延时', '复位单片机'],
    correctAnswer: '跳出当前循环或switch',
    ka: '4.3',
    chapter: 4,
  },
  {
    id: 272,
    type: 'multiple-choice',
    questionText: 'C51中定义可独立寻址的特殊功能位(如P1^0)，使用关键字？',
    options: ['sbit', 'bit', 'char', 'void'],
    correctAnswer: 'sbit',
    ka: '4.4',
    chapter: 4,
  },
  {
    id: 273,
    type: 'multiple-choice',
    questionText: 'C51中编写中断服务函数时用 interrupt 后接中断号，外部中断0的中断号是？',
    options: ['0', '1', '2', '4'],
    correctAnswer: '0',
    ka: '4.4',
    chapter: 4,
  },
  {
    id: 274,
    type: 'multiple-choice',
    questionText: 'C51中定时器0(T0)中断服务函数，interrupt 后应填写的中断号是？',
    options: ['1', '0', '2', '3'],
    correctAnswer: '1',
    ka: '4.4',
    chapter: 4,
  },
  {
    id: 275,
    type: 'multiple-choice',
    questionText: 'C51中要使用循环移位函数 _crol_，应包含哪个头文件？',
    options: ['<intrins.h>', '<stdio.h>', '<math.h>', '<string.h>'],
    correctAnswer: '<intrins.h>',
    ka: '4.5',
    chapter: 4,
  },
  {
    id: 276,
    type: 'multiple-choice',
    questionText: 'C51库函数 _nop_() 的作用是？',
    options: ['产生一个机器周期的空操作(延时)', '复位单片机', '关闭中断', '清屏'],
    correctAnswer: '产生一个机器周期的空操作(延时)',
    ka: '4.5',
    chapter: 4,
  },
  {
    id: 277,
    type: 'multiple-choice',
    questionText: 'C51中字符串复制函数 strcpy() 声明在哪个头文件中？',
    options: ['<string.h>', '<math.h>', '<reg51.h>', '<intrins.h>'],
    correctAnswer: '<string.h>',
    ka: '4.5',
    chapter: 4,
  },
  {
    id: 278,
    type: 'multiple-choice',
    questionText: '下列哪一项不符合良好的C51编程规范？',
    options: ['使用有意义的变量名', '适当添加注释', '把所有功能堆在一个函数里、不分模块', '统一的缩进风格'],
    correctAnswer: '把所有功能堆在一个函数里、不分模块',
    ka: '4.6',
    chapter: 4,
  },
  {
    id: 279,
    type: 'multiple-choice',
    questionText: '对于程序中反复出现的“幻数”(magic number)，推荐做法是？',
    options: ['用#define定义为有意义的符号常量', '直接散布在代码各处', '越多越好', '用随机数代替'],
    correctAnswer: '用#define定义为有意义的符号常量',
    ka: '4.6',
    chapter: 4,
  },
  {
    id: 280,
    type: 'multiple-choice',
    questionText: '模块化编程的主要好处是？',
    options: ['提高可读性、可维护性与复用性', '让程序运行更慢', '增加芯片功耗', '减少必要注释'],
    correctAnswer: '提高可读性、可维护性与复用性',
    ka: '4.6',
    chapter: 4,
  },
  {
    id: 281,
    type: 'multiple-choice',
    questionText: '相比查询方式，采用中断方式处理外设的最大优点是？',
    options: ['CPU无需一直轮询，效率高、实时性好', '程序代码更长', '完全不需要硬件', '功耗更高'],
    correctAnswer: 'CPU无需一直轮询，效率高、实时性好',
    ka: '5.1',
    chapter: 5,
  },
  {
    id: 282,
    type: 'multiple-choice',
    questionText: '8051发生中断嵌套的条件是？',
    options: ['高优先级中断可打断正在执行的低优先级中断服务', '任意中断都能相互打断', '同级中断可互相嵌套', '中断之间不能嵌套'],
    correctAnswer: '高优先级中断可打断正在执行的低优先级中断服务',
    ka: '5.5',
    chapter: 5,
  },
  {
    id: 283,
    type: 'multiple-choice',
    questionText: '8051(基本型)的中断优先级由IP寄存器设置，共分为几级？',
    options: ['2级(高/低)', '3级', '4级', '8级'],
    correctAnswer: '2级(高/低)',
    ka: '5.5',
    chapter: 5,
  },
  {
    id: 284,
    type: 'multiple-choice',
    questionText: '8051中，两个同优先级的中断之间？',
    options: ['不能互相嵌套，按自然优先级排队响应', '可以随意嵌套', '请求都被丢弃', '随机执行'],
    correctAnswer: '不能互相嵌套，按自然优先级排队响应',
    ka: '5.5',
    chapter: 5,
  },
  {
    id: 285,
    type: 'multiple-choice',
    questionText: '用外部中断检测按键，应把按键信号接到哪个引脚？',
    options: ['INT0(P3.2)或INT1(P3.3)', 'VCC', 'XTAL1', 'ALE'],
    correctAnswer: 'INT0(P3.2)或INT1(P3.3)',
    ka: '5.6',
    chapter: 5,
  },
  {
    id: 286,
    type: 'multiple-choice',
    questionText: '要开放外部中断0，需要置位IE寄存器中的哪两位？',
    options: ['EA 和 EX0', 'EA 和 ES', 'ET0 和 EX1', 'PX0 和 PT0'],
    correctAnswer: 'EA 和 EX0',
    ka: '5.6',
    chapter: 5,
  },
  {
    id: 287,
    type: 'multiple-choice',
    questionText: '中断服务程序(ISR)设计的一般原则是？',
    options: ['尽量短小、快进快出', '越长越好', '在ISR里做大量延时', '关闭所有现场保护'],
    correctAnswer: '尽量短小、快进快出',
    ka: '5.6',
    chapter: 5,
  },
  {
    id: 288,
    type: 'multiple-choice',
    questionText: '8051定时器/计数器作“定时”使用时，是对什么进行计数？',
    options: ['内部机器周期', '外部引脚脉冲', '中断次数', '电源电压'],
    correctAnswer: '内部机器周期',
    ka: '6.1',
    chapter: 6,
  },
  {
    id: 289,
    type: 'multiple-choice',
    questionText: '用定时器实现1秒长定时，常用的方法是？',
    options: ['定时50ms并用中断累计20次', '一次性定时1秒', '用软件延时循环', '无法实现'],
    correctAnswer: '定时50ms并用中断累计20次',
    ka: '6.3',
    chapter: 6,
  },
  {
    id: 290,
    type: 'multiple-choice',
    questionText: '用定时器在引脚输出方波，改变方波频率的方法是？',
    options: ['改变定时器的定时初值/周期', '改变晶振颜色', '改变电源电压', '无法改变'],
    correctAnswer: '改变定时器的定时初值/周期',
    ka: '6.3',
    chapter: 6,
  },
  {
    id: 291,
    type: 'multiple-choice',
    questionText: '8051定时器工作于“计数”模式时，计数脉冲来自？',
    options: ['外部引脚T0(P3.4)/T1(P3.5)', '内部振荡器', 'ALE信号', 'RST引脚'],
    correctAnswer: '外部引脚T0(P3.4)/T1(P3.5)',
    ka: '6.4',
    chapter: 6,
  },
  {
    id: 292,
    type: 'multiple-choice',
    questionText: '8051中，选择“计数器”还是“定时器”模式，由TMOD中的哪一位决定？',
    options: ['C/T位', 'GATE位', 'M1位', 'TR0位'],
    correctAnswer: 'C/T位',
    ka: '6.4',
    chapter: 6,
  },
  {
    id: 293,
    type: 'multiple-choice',
    questionText: '8051计数器对外部脉冲计数时，可靠计数的最高频率约为振荡频率的？',
    options: ['1/24', '1/2', '与振荡频率相同', '2倍'],
    correctAnswer: '1/24',
    ka: '6.4',
    chapter: 6,
  },
  {
    id: 294,
    type: 'multiple-choice',
    questionText: '用单片机PWM控制直流电机调速时，实际调节的是？',
    options: ['PWM占空比(等效平均电压)', '电源极性', '晶振频率', '电机外壳颜色'],
    correctAnswer: 'PWM占空比(等效平均电压)',
    ka: '8.5',
    chapter: 8,
  },
  {
    id: 295,
    type: 'multiple-choice',
    questionText: '单片机应用系统开发的一般流程，正确顺序是？',
    options: ['需求分析→硬件设计→软件设计→联调测试', '先量产再设计', '先调试再做需求', '只写代码即可'],
    correctAnswer: '需求分析→硬件设计→软件设计→联调测试',
    ka: '9.1',
    chapter: 9,
  },
  {
    id: 296,
    type: 'multiple-choice',
    questionText: '单片机PCB设计中，为提高抗干扰，晶振电路应如何布局？',
    options: ['尽量靠近单片机引脚、走线尽量短', '离单片机越远越好', '走线越长越好', '放在大电流器件旁'],
    correctAnswer: '尽量靠近单片机引脚、走线尽量短',
    ka: '9.2',
    chapter: 9,
  },
  {
    id: 297,
    type: 'multiple-choice',
    questionText: '在“AI+单片机”的边缘智能中，TinyML指的是？',
    options: ['在资源受限的微控制器上运行的轻量机器学习', '大型云端AI模型', '一种晶振', '一种电机'],
    correctAnswer: '在资源受限的微控制器上运行的轻量机器学习',
    ka: '10.2',
    chapter: 10,
  },
  {
    id: 298,
    type: 'multiple-choice',
    questionText: 'AIoT 是指？',
    options: ['人工智能与物联网的融合', '一种单片机型号', '一种编程语言', '一种焊接工艺'],
    correctAnswer: '人工智能与物联网的融合',
    ka: '10.4',
    chapter: 10,
  },
  {
    id: 299,
    type: 'multiple-choice',
    questionText: 'AI助教给出一个8051寄存器结论时，最合适的处理是？',
    options: ['直接复制进报告', '用教材或数据手册核对，并通过仿真验证关键结果', '只看回答是否流畅', '让AI再次回答相同问题即可'],
    correctAnswer: '用教材或数据手册核对，并通过仿真验证关键结果',
    ka: '10.5.1',
    chapter: 10,
  },
  {
    id: 300,
    type: 'multiple-choice',
    questionText: '下列哪项不应提交给外部AI服务？',
    options: ['公开的8051指令名称', '已脱敏的示例代码', '平台登录令牌和学生身份信息', '教材中的公开概念'],
    correctAnswer: '平台登录令牌和学生身份信息',
    ka: '10.5.2',
    chapter: 10,
  },
  {
    id: 301,
    type: 'multiple-choice',
    questionText: '为了让AI辅助分析更可控，提示中最应包含什么？',
    options: ['明确对象、输入输出、约束和验收条件', '只写“帮我做好”', '要求模型保证百分之百正确', '省略课程和硬件条件'],
    correctAnswer: '明确对象、输入输出、约束和验收条件',
    ka: '10.5.3',
    chapter: 10,
  },
  {
    id: 302,
    type: 'multiple-choice',
    questionText: 'AI解释一段程序“没有错误”，最终应以什么作为正确性依据？',
    options: ['AI的语气是否肯定', '编译、仿真、测试记录和教师评价', '代码行数', '生成速度'],
    correctAnswer: '编译、仿真、测试记录和教师评价',
    ka: '10.5.4',
    chapter: 10,
  },
  {
    id: 303,
    type: 'multiple-choice',
    questionText: '在课程项目中使用AI辅助后，符合学术诚信的做法是？',
    options: ['隐去AI参与并直接提交', '保留个人推理、核验记录并说明AI辅助范围', '让AI代替全部实验', '删除所有版本记录'],
    correctAnswer: '保留个人推理、核验记录并说明AI辅助范围',
    ka: '10.5.5',
    chapter: 10,
  },

  // === 2026 备赛覆盖补题：53 个二级知识点每个至少 3 题 ===
  {
    id: 304,
    type: 'multiple-choice',
    questionText: '标准8051进入空闲模式后，下列哪项描述正确？',
    options: ['CPU停止执行而中断等外设可继续工作', '内部RAM立即丢失数据', '所有外设时钟都被关闭', '只能断电后才能退出'],
    correctAnswer: 'CPU停止执行而中断等外设可继续工作',
    ka: '2.7',
    chapter: 2,
  },
  {
    id: 305,
    type: 'multiple-choice',
    questionText: '用8051控制无源蜂鸣器演奏不同音高时，程序应主要改变哪个参数？',
    options: ['输出方波的频率', '单片机的复位时间', '蜂鸣器的安装方向', '程序存储器容量'],
    correctAnswer: '输出方波的频率',
    ka: '8.6',
    chapter: 8,
  },
  {
    id: 306,
    type: 'multiple-choice',
    questionText: '下列哪项最准确地区分有源蜂鸣器和无源蜂鸣器的控制方式？',
    options: ['有源型通断控制即可发声，无源型需外部方波激励', '两者都只能输出固定音高', '有源型必须使用ADC驱动', '无源型加直流电平即可持续发出指定音高'],
    correctAnswer: '有源型通断控制即可发声，无源型需外部方波激励',
    ka: '8.6',
    chapter: 8,
  },
  {
    id: 307,
    type: 'multiple-choice',
    questionText: '蜂鸣器所需电流超过8051 I/O口安全驱动能力时，较合理的接口方案是？',
    options: ['用带限流电阻的三极管或MOS管做开关驱动', '直接并联多个I/O口提供电流', '去掉所有限流元件', '将蜂鸣器接到晶振引脚'],
    correctAnswer: '用带限流电阻的三极管或MOS管做开关驱动',
    ka: '8.6',
    chapter: 8,
  },
  {
    id: 308,
    type: 'multiple-choice',
    questionText: '在生成Gerber文件前执行PCB设计规则检查（DRC），其主要目的是？',
    options: ['检查线宽、间距、未连接网络等是否违反制造规则', '自动证明所有软件功能正确', '替代原理图的电气设计', '确定程序的执行时间'],
    correctAnswer: '检查线宽、间距、未连接网络等是否违反制造规则',
    ka: '9.2',
    chapter: 9,
  },
  {
    id: 309,
    type: 'multiple-choice',
    questionText: '在8051最小系统PCB布局中，0.1 μF去耦电容应优先如何放置？',
    options: ['紧靠芯片电源与地引脚，使回路尽量短', '统一放在PCB边缘', '与晶振走线并行走长线', '放在大电流电机驱动器旁'],
    correctAnswer: '紧靠芯片电源与地引脚，使回路尽量短',
    ka: '9.2',
    chapter: 9,
  },
  {
    id: 310,
    type: 'multiple-choice',
    questionText: '为使单片机项目测试结果可复核，技术报告至少应同时记录什么？',
    options: ['软硬件版本、测试条件、步骤、期望与实际结果', '只记录最终结论', '只放置成功截图', '删除与预期不一致的记录'],
    correctAnswer: '软硬件版本、测试条件、步骤、期望与实际结果',
    ka: '9.4',
    chapter: 9,
  },
  {
    id: 311,
    type: 'multiple-choice',
    questionText: '团队协作开发中，哪种版本记录最有利于追溯问题？',
    options: ['每次提交聚焦一项变更，写明原因并关联测试结果', '所有成员长期直接覆盖同一文件', '只在答辩前一次性备份', '发现失败即删除对应历史'],
    correctAnswer: '每次提交聚焦一项变更，写明原因并关联测试结果',
    ka: '9.4',
    chapter: 9,
  },
  {
    id: 312,
    type: 'multiple-choice',
    questionText: '项目答辩时现场演示出现与预期不一致的现象，较规范的处理方式是？',
    options: ['说明当前现象、展示原始测试记录并给出已验证的备用演示', '隐藏问题并声称功能正常', '临时修改数据使画面符合预期', '删除报告中的相关验证条件'],
    correctAnswer: '说明当前现象、展示原始测试记录并给出已验证的备用演示',
    ka: '9.4',
    chapter: 9,
  },
  {
    id: 313,
    type: 'multiple-choice',
    questionText: '按中断请求的来源分类，8051定时器溢出中断属于哪一类？',
    options: ['内部中断', '外部中断', '不可屏蔽中断', '软件复位'],
    correctAnswer: '内部中断',
    ka: '5.1.2',
    chapter: 5,
  },

  // 基于第6章、第10章课件编写的补充练习；页码指向合并PDF物理页。
  {
    id: 314,
    type: "multiple-choice",
    questionText: "只统计从甲设备到乙设备的数据线，不计地线与控制线。一次传送8位数据时，8位并行传输与逐位串行传输分别至少使用几根数据线？",
    options: ["1根、8根", "8根、1根", "8根、8根", "1根、1根"],
    correctAnswer: "8根、1根",
    ka: "7.1.1",
    chapter: 7,
    explanation: "8位并行传输让8位同时占用8根数据线；单方向串行传输让各位依次复用1根数据线。这里的数据线数量不包括信号地和握手线。",
    source: {
      title: "第6章 串行口（课件第4页）",
      page: 4,
      url: "/resources/course/course-slides.pdf#page=4",
    },
  },
  {
    id: 315,
    type: "multiple-choice",
    questionText: "假设每根数据线传送一位均需2 μs，忽略帧头、校验和握手开销。传送同一字节，单线串行与8位并行分别需要多久？",
    options: ["2 μs、2 μs", "16 μs、16 μs", "2 μs、16 μs", "16 μs、2 μs"],
    correctAnswer: "16 μs、2 μs",
    ka: "7.1.1",
    chapter: 7,
    explanation: "一字节为8位，串行依次发送需8×2=16 μs；8位并行同时发送只需一个2 μs时段。结论只适用于题设的相同单线速率与无额外开销条件。",
    source: {
      title: "第6章 串行口（课件第4页）",
      page: 4,
      url: "/resources/course/course-slides.pdf#page=4",
    },
  },
  {
    id: 316,
    type: "multiple-choice",
    questionText: "某采集节点的数据量很小，但需要减少设备之间的电缆芯数。仅从串行与并行的数据线组织方式比较，串行传输的哪项特点直接符合需求？",
    options: ["多位数据依次复用数据线", "每个数据位占用一根独立数据线", "不需要任何信号参考地", "在所有实现中都比并行传输更快"],
    correctAnswer: "多位数据依次复用数据线",
    ka: "7.1.1",
    chapter: 7,
    explanation: "串行传输让不同位依次使用数据线，因此通常可减少数据线数量。它并不自动免除参考地，也不能据此断言任何串行接口都更快。",
    source: {
      title: "第6章 串行口（课件第5页）",
      page: 5,
      url: "/resources/course/course-slides.pdf#page=5",
    },
  },
  {
    id: 317,
    type: "multiple-choice",
    questionText: "两个设备使用各自的时钟，按“起始位—数据位—停止位”逐帧传输字符。这最符合哪种通信方式？",
    options: ["8位并行通信", "同步字符块传输", "异步串行通信", "仅能单向传输的通信"],
    correctAnswer: "异步串行通信",
    ka: "7.1.2",
    chapter: 7,
    explanation: "课件中的异步串行通信由双方独立计时，并通过字符帧中的起始位识别接收起点；是否可双向通信是另一个分类维度。",
    source: {
      title: "第6章 串行口（课件第7页）",
      page: 7,
      url: "/resources/course/course-slides.pdf#page=7",
    },
  },
  {
    id: 318,
    type: "multiple-choice",
    questionText: "按课件给出的同步字符块格式，一批字符连续发送时，哪种组织方式符合该格式？",
    options: ["每个字符前后都必须附加独立的起始位和停止位", "同步字符后连续安排数据字符及校验字符", "仅发送数据，接收端不需要任何同步信息", "相邻两个数据字符之间必须空闲一个字符时间"],
    correctAnswer: "同步字符后连续安排数据字符及校验字符",
    ka: "7.1.2",
    chapter: 7,
    explanation: "该页以同步字符开头，随后连续传送数据和校验字符。它与每个字符均采用起始位、停止位的异步帧不同。",
    source: {
      title: "第6章 串行口（课件第9页）",
      page: 9,
      url: "/resources/course/course-slides.pdf#page=9",
    },
  },
  {
    id: 319,
    type: "multiple-choice",
    questionText: "异步串口的两帧之间存在不定长空闲。接收下一帧时，哪一事件用于确定本帧开始，而无需把上一帧后的空闲时长预先约定为固定值？",
    options: ["检测新的起始位", "等待固定数量的空闲字符", "等待每一位都附带的同步字符", "根据上一帧数据值直接推算"],
    correctAnswer: "检测新的起始位",
    ka: "7.1.2",
    chapter: 7,
    explanation: "异步帧包含起始位。接收端识别新帧的起始位后，按已约定的波特率采样本帧；空闲间隔不必固定，但双方仍须约定波特率和帧格式。",
    source: {
      title: "第6章 串行口（课件第7页）",
      page: 7,
      url: "/resources/course/course-slides.pdf#page=7",
    },
  },
  {
    id: 320,
    type: "multiple-choice",
    questionText: "二进制异步串口每个字符含1位起始位、8位数据和1位停止位。若连续发送1920个字符/秒，且无帧间空闲，所需波特率是多少？",
    options: ["15360 Baud", "1920 Baud", "38400 Baud", "19200 Baud"],
    correctAnswer: "19200 Baud",
    ka: "7.1.3",
    chapter: 7,
    explanation: "每字符共10位，1920×10=19200 bit/s。题设为每个码元携带1位的二进制串口，因此码元速率为19200 Baud。",
    source: {
      title: "第6章 串行口（课件第11页）",
      page: 11,
      url: "/resources/course/course-slides.pdf#page=11",
    },
  },
  {
    id: 321,
    type: "multiple-choice",
    questionText: "二进制串口每个码元携带1位，以4800 Baud发送时，一个数据位的持续时间约为多少？",
    options: ["20.83 μs", "208.33 μs", "4800 μs", "2.083 ms"],
    correctAnswer: "208.33 μs",
    ka: "7.1.3",
    chapter: 7,
    explanation: "位时间为1/4800 s≈0.00020833 s，即208.33 μs。题设的一位一码元条件使波特率与比特率数值相同。",
    source: {
      title: "第6章 串行口（课件第11页）",
      page: 11,
      url: "/resources/course/course-slides.pdf#page=11",
    },
  },
  {
    id: 322,
    type: "multiple-choice",
    questionText: "二进制串口采用9600 Baud和8N1格式，即8位数据、无校验、1位停止位，另有1位起始位。连续发送240字节且无帧间空闲，线路传输时间是多少？",
    options: ["0.20 s", "2.50 s", "0.25 s", "0.025 s"],
    correctAnswer: "0.25 s",
    ka: "7.1.3",
    chapter: 7,
    explanation: "每字节占10个位时间，总共240×10=2400位；2400/9600=0.25 s。结果不包括软件准备时间或额外协议开销。",
    source: {
      title: "第6章 串行口（课件第11页）",
      page: 11,
      url: "/resources/course/course-slides.pdf#page=11",
    },
  },
  {
    id: 323,
    type: "multiple-choice",
    questionText: "按8051异步串口低位先发的规则，发送96H时，仅观察8个数据位，线路上的先后顺序是？",
    options: ["0、1、1、0、1、0、0、1", "1、0、0、1、0、1、1、0", "0、1、0、1、1、0、0、1", "1、0、1、0、0、1、1、0"],
    correctAnswer: "0、1、1、0、1、0、0、1",
    ka: "7.1.4",
    chapter: 7,
    explanation: "96H写成D7到D0为10010110；按D0到D7发送得到0、1、1、0、1、0、0、1。题目不包含起始位和停止位。",
    source: {
      title: "第6章 串行口（课件第7页）",
      page: 7,
      url: "/resources/course/course-slides.pdf#page=7",
    },
  },
  {
    id: 324,
    type: "multiple-choice",
    questionText: "8051串口方式1发送8位数据，帧中还有1位起始位和1位停止位。若所有数据位均为有效载荷且无帧间空闲，有效数据位占总传输位数的比例是多少？",
    options: ["100%", "87.5%", "72.7%", "80%"],
    correctAnswer: "80%",
    ka: "7.1.4",
    chapter: 7,
    explanation: "方式1一帧共10位，其中8位为题设有效数据，比例为8/10=80%。额外的上层协议字段会进一步改变实际应用的有效载荷比例。",
    source: {
      title: "第6章 串行口（课件第32页）",
      page: 32,
      url: "/resources/course/course-slides.pdf#page=32",
    },
  },
  {
    id: 325,
    type: "multiple-choice",
    questionText: "课件用串口方式1发送7位ASCII码，并由软件把奇校验位写入ACC.7。此时一个完整串口帧包含多少位？",
    options: ["9位", "10位", "11位", "12位"],
    correctAnswer: "10位",
    ka: "7.1.4",
    chapter: 7,
    explanation: "方式1的数据字段固定为8位：其中7位放ASCII码，D7放软件生成的校验位；再加起始位和停止位，共1+8+1=10位。校验位没有额外增加在方式1帧之外。",
    source: {
      title: "第6章 串行口（课件第56页）",
      page: 56,
      url: "/resources/course/course-slides.pdf#page=56",
    },
  },
  {
    id: 326,
    type: "multiple-choice",
    questionText: "单向广播装置只允许主机向显示终端发送内容，终端没有向主机发送数据的通道。按传输方向分类，这属于？",
    options: ["全双工", "半双工", "单工", "同步"],
    correctAnswer: "单工",
    ka: "7.1.5",
    chapter: 7,
    explanation: "单工通信只允许固定方向的数据传送。同步与异步描述同步方式，不是单向或双向的分类。",
    source: {
      title: "第6章 串行口（课件第6页）",
      page: 6,
      url: "/resources/course/course-slides.pdf#page=6",
    },
  },
  {
    id: 327,
    type: "multiple-choice",
    questionText: "两台设备共用一条传输通道，双方均能发送，但必须轮流占用通道，不能同时发送。这属于？",
    options: ["半双工", "单工", "全双工", "仅接收模式"],
    correctAnswer: "半双工",
    ka: "7.1.5",
    chapter: 7,
    explanation: "半双工允许双向传输，但两个方向不能同时进行。题设的轮流占用通道正是这一限制。",
    source: {
      title: "第6章 串行口（课件第6页）",
      page: 6,
      url: "/resources/course/course-slides.pdf#page=6",
    },
  },
  {
    id: 328,
    type: "multiple-choice",
    questionText: "两个串行终端使用各自的发送和接收通道，甲向乙发送时，乙也能同时向甲发送。这属于？",
    options: ["单工", "半双工", "单向广播", "全双工"],
    correctAnswer: "全双工",
    ka: "7.1.5",
    chapter: 7,
    explanation: "全双工允许两个方向同时传送数据；能双向但必须轮流传输才是半双工。",
    source: {
      title: "第6章 串行口（课件第6页）",
      page: 6,
      url: "/resources/course/course-slides.pdf#page=6",
    },
  },
  {
    id: 329,
    type: "multiple-choice",
    questionText: "标准8051执行MOV SCON,#90H后，SM0、SM1和REN分别为1、0、1。串口处于什么状态？",
    options: ["方式1，允许接收", "方式2，允许接收", "方式3，禁止接收", "方式0，禁止接收"],
    correctAnswer: "方式2，允许接收",
    ka: "7.2.1",
    chapter: 7,
    explanation: "90H=10010000B，SM0/SM1=10选择方式2，D4即REN=1允许接收。能否实际接收到一帧还取决于波特率、输入信号及接收标志状态。",
    source: {
      title: "第6章 串行口（课件第23页）",
      page: 23,
      url: "/resources/course/course-slides.pdf#page=23",
    },
  },
  {
    id: 330,
    type: "multiple-choice",
    questionText: "已正确配置串口方式和波特率，但SCON中的REN仍为0。若要允许串口接收，应修改哪个控制位？",
    options: ["将TI置1", "将TB8置1", "将REN置1", "将RI置1"],
    correctAnswer: "将REN置1",
    ka: "7.2.1",
    chapter: 7,
    explanation: "REN是允许接收位，置1才允许串行接收。TI和RI是收发标志，TB8为方式2、3发送的第9位数据，不能替代REN。",
    source: {
      title: "第6章 串行口（课件第24页）",
      page: 24,
      url: "/resources/course/course-slides.pdf#page=24",
    },
  },
  {
    id: 331,
    type: "multiple-choice",
    questionText: "需要读取SCON后仅保留TI、RI两个标志位，其他位清零。应对读出的字节与哪个立即数进行按位与？",
    options: ["03H", "30H", "C0H", "0CH"],
    correctAnswer: "03H",
    ka: "7.2.1",
    chapter: 7,
    explanation: "TI位于D1、RI位于D0，掩码为00000011B，即03H。本题是对读出的副本进行掩码，不要求改写SCON。",
    source: {
      title: "第6章 串行口（课件第23页）",
      page: 23,
      url: "/resources/course/course-slides.pdf#page=23",
    },
  },
  {
    id: 332,
    type: "multiple-choice",
    questionText: "程序执行MOV SBUF,A后，又执行MOV A,SBUF。后一条指令读取的对象是？",
    options: ["刚写入的发送缓冲器", "SCON控制寄存器", "发送移位寄存器的最高位", "接收缓冲器"],
    correctAnswer: "接收缓冲器",
    ka: "7.2.2",
    chapter: 7,
    explanation: "SBUF的收发缓冲器物理独立、共用符号和字节地址。写SBUF访问发送缓冲器，读SBUF访问接收缓冲器，因此不能把后一条指令当作读取刚写入的发送数据。",
    source: {
      title: "第6章 串行口（课件第22页）",
      page: 22,
      url: "/resources/course/course-slides.pdf#page=22",
    },
  },
  {
    id: 333,
    type: "multiple-choice",
    questionText: "8051的发送缓冲器与接收缓冲器使用同一SBUF地址，CPU如何区分访问哪一个？",
    options: ["用DPTR最高位区分", "由读指令或写指令区分", "每次先改变SBUF地址", "只能通过SMOD区分"],
    correctAnswer: "由读指令或写指令区分",
    ka: "7.2.2",
    chapter: 7,
    explanation: "SBUF的写访问送往发送缓冲器，读访问来自接收缓冲器。两个物理缓冲器共享地址，由访问方向区分。",
    source: {
      title: "第6章 串行口（课件第22页）",
      page: 22,
      url: "/resources/course/course-slides.pdf#page=22",
    },
  },
  {
    id: 334,
    type: "multiple-choice",
    questionText: "调试8051时，要检查SBUF的字节地址。应在特殊功能寄存器区查看哪个地址？",
    options: ["98H", "87H", "99H", "89H"],
    correctAnswer: "99H",
    ka: "7.2.2",
    chapter: 7,
    explanation: "SBUF的字节地址为99H。98H是SCON，87H是PCON；不要把SCON中TI位的位地址99H与SBUF的字节地址含义混淆。",
    source: {
      title: "第6章 串行口（课件第22页）",
      page: 22,
      url: "/resources/course/course-slides.pdf#page=22",
    },
  },
  {
    id: 335,
    type: "multiple-choice",
    questionText: "每机器周期含12个晶振周期的8051使用11.0592 MHz晶振，串口方式1、SMOD=0，T1作定时器并采用方式2。若目标为4800 Baud，TH1应装入什么值？",
    options: ["FAH", "FDH", "F4H", "E8H"],
    correctAnswer: "FAH",
    ka: "7.2.3",
    chapter: 7,
    explanation: "波特率=fosc/[384×(256−TH1)]。256−TH1=11059200/(384×4800)=6，所以TH1=250=FAH；初始化时TL1也应装入相同初值。",
    source: {
      title: "第6章 串行口（课件第43页）",
      page: 43,
      url: "/resources/course/course-slides.pdf#page=43",
    },
  },
  {
    id: 336,
    type: "multiple-choice",
    questionText: "每机器周期含12个晶振周期的8051在11.0592 MHz晶振下，用T1方式2、TH1=FDH产生串口方式1波特率。原SMOD=0时为9600 Baud，仅将SMOD改为1后是多少？",
    options: ["4800 Baud", "9600 Baud", "38400 Baud", "19200 Baud"],
    correctAnswer: "19200 Baud",
    ka: "7.2.3",
    chapter: 7,
    explanation: "在方式1且T1溢出率不变时，SMOD从0变1使波特率乘2，9600×2=19200 Baud。",
    source: {
      title: "第6章 串行口（课件第26页）",
      page: 26,
      url: "/resources/course/course-slides.pdf#page=26",
    },
  },
  {
    id: 337,
    type: "multiple-choice",
    questionText: "每机器周期含12个晶振周期的8051误把晶振换为12 MHz，仍用串口方式1、SMOD=0，T1以内部时钟采用定时方式2且TH1=FDH。相对目标9600 Baud，实际波特率和相对误差约为？",
    options: ["9600 Baud，0%", "10416.67 Baud，+8.51%", "10416.67 Baud，−8.51%", "9216 Baud，−4.00%"],
    correctAnswer: "10416.67 Baud，+8.51%",
    ka: "7.2.3",
    chapter: 7,
    explanation: "256−FDH=3，实际值=12000000/(384×3)≈10416.67 Baud。相对误差=(10416.67−9600)/9600×100%≈+8.51%，不能把该配置视为12 MHz下的精确9600 Baud。",
    source: {
      title: "第6章 串行口（课件第45页）",
      page: 45,
      url: "/resources/course/course-slides.pdf#page=45",
    },
  },
  {
    id: 338,
    type: "multiple-choice",
    questionText: "每机器周期含12个晶振周期的8051串口方式0使用6 MHz振荡时钟。按方式0的时钟关系，其移位速率是多少？",
    options: ["93750 bit/s", "187500 bit/s", "500000 bit/s", "6000000 bit/s"],
    correctAnswer: "500000 bit/s",
    ka: "7.2.4",
    chapter: 7,
    explanation: "方式0的移位速率为fosc/12，6000000/12=500000 bit/s；它不由T1重装值决定，也不受SMOD影响。",
    source: {
      title: "第6章 串行口（课件第29页）",
      page: 29,
      url: "/resources/course/course-slides.pdf#page=29",
    },
  },
  {
    id: 339,
    type: "multiple-choice",
    questionText: "8051串口方式2需要发送8位数据和TB8中的附加数据位。一帧连同起始位、停止位共多少位？",
    options: ["11位", "8位", "9位", "10位"],
    correctAnswer: "11位",
    ka: "7.2.4",
    chapter: 7,
    explanation: "方式2采用9位数据字段，即D0—D7及TB8，再加1位起始位、1位停止位，共11位。",
    source: {
      title: "第6章 串行口（课件第36页）",
      page: 36,
      url: "/resources/course/course-slides.pdf#page=36",
    },
  },
  {
    id: 340,
    type: "multiple-choice",
    questionText: "某应用要求保留第9位数据，同时用定时器T1调整串口波特率。应选择8051串口的哪种方式？",
    options: ["方式0", "方式1", "方式2", "方式3"],
    correctAnswer: "方式3",
    ka: "7.2.4",
    chapter: 7,
    explanation: "方式2和方式3都提供9位数据；方式2由振荡频率及SMOD决定固定波特率，方式3可由T1提供可调波特率。",
    source: {
      title: "第6章 串行口（课件第23页）",
      page: 23,
      url: "/resources/course/course-slides.pdf#page=23",
    },
  },
  {
    id: 341,
    type: "multiple-choice",
    questionText: "T1用方式2为串口提供波特率。希望启动后的第一次计数与后续自动重装周期一致，初始化时应如何设置TH1、TL1？",
    options: ["只给TH1赋重装值，TL1任意", "TH1和TL1都装入计算得到的重装值", "只给TL1赋值，TH1清零", "TH1、TL1必须分别装入高低两个字节"],
    correctAnswer: "TH1和TL1都装入计算得到的重装值",
    ka: "7.3.1",
    chapter: 7,
    explanation: "方式2中TL1负责计数，溢出后由TH1重装。初始TL1若与TH1相同，第一周期与后续周期一致；它不是16位高低字节拼接的方式1。",
    source: {
      title: "第6章 串行口（课件第48页）",
      page: 48,
      url: "/resources/course/course-slides.pdf#page=48",
    },
  },
  {
    id: 342,
    type: "multiple-choice",
    questionText: "已设置TMOD、TH1、TL1、SCON和SMOD，但为串口提供时钟的T1尚未运行。应执行哪项操作启动T1？",
    options: ["SETB TI", "SETB RI", "SETB TR1", "SETB TF1"],
    correctAnswer: "SETB TR1",
    ka: "7.3.1",
    chapter: 7,
    explanation: "TR1是T1运行控制位，SETB TR1启动计数。TI、RI是串口标志；软件置TF1并不等于启动定时器。",
    source: {
      title: "第6章 串行口（课件第48页）",
      page: 48,
      url: "/resources/course/course-slides.pdf#page=48",
    },
  },
  {
    id: 343,
    type: "multiple-choice",
    questionText: "初始化串口时，需要清除PCON的SMOD位并保持其余7位原值。考虑PCON不可位寻址，应使用哪条指令？",
    options: ["ANL PCON,#7FH", "CLR PCON.7", "MOV PCON,#00H", "ORL PCON,#80H"],
    correctAnswer: "ANL PCON,#7FH",
    ka: "7.3.1",
    chapter: 7,
    explanation: "SMOD位于PCON的D7。按字节与7FH可仅清D7并保留其余位；PCON不能用位寻址清位，直接写00H会同时改动其他位。",
    source: {
      title: "第6章 串行口（课件第26页）",
      page: 26,
      url: "/resources/course/course-slides.pdf#page=26",
    },
  },
  {
    id: 344,
    type: "multiple-choice",
    questionText: "查询发送程序执行MOV SBUF,A之后，使用JBC TI,NEXT配合循环等待。TI为1时，JBC TI,NEXT会执行什么操作？",
    options: ["仅跳转，TI保持1", "清除RI后跳转", "只清除TI，不跳转", "清除TI并跳转到NEXT"],
    correctAnswer: "清除TI并跳转到NEXT",
    ka: "7.3.2",
    chapter: 7,
    explanation: "JBC是位为1则转移并清位的指令。该发送例程用它在检测到TI后同时清除TI，再处理后续字节，避免旧标志影响下一次查询。",
    source: {
      title: "第6章 串行口（课件第57页）",
      page: 57,
      url: "/resources/course/course-slides.pdf#page=57",
    },
  },
  {
    id: 345,
    type: "multiple-choice",
    questionText: "用C51查询方式逐字节发送：SBUF=data; while(!TI); 随后还需执行哪一步，才能避免下一次查询误用旧标志？",
    options: ["RI=1;", "TI=0;", "REN=0;", "SMOD=1;"],
    correctAnswer: "TI=0;",
    ka: "7.3.2",
    chapter: 7,
    explanation: "TI由硬件置位，必须由软件清零。若保留TI=1，下一次while(!TI)将直接结束，不能正确等待新的发送标志。",
    source: {
      title: "第6章 串行口（课件第59页）",
      page: 59,
      url: "/resources/course/course-slides.pdf#page=59",
    },
  },
  {
    id: 346,
    type: "multiple-choice",
    questionText: "示波器观察8051串口方式1发送时序。TI置1发生在本帧的哪个时刻？",
    options: ["起始位开始时", "D0发送开始时", "停止位开始时", "停止位完全结束之后"],
    correctAnswer: "停止位开始时",
    ka: "7.3.2",
    chapter: 7,
    explanation: "课件方式1发送时序将TI置位时刻标在停止位开始处。因此检测到TI不能用于断言停止位已全部发送完毕，例如控制外部半双工驱动器方向时还需考虑剩余停止位时间。",
    source: {
      title: "第6章 串行口（课件第33页）",
      page: 33,
      url: "/resources/course/course-slides.pdf#page=33",
    },
  },
  {
    id: 347,
    type: "multiple-choice",
    questionText: "查询到RI=1后，要把收到的字节存入R0指向的内部RAM单元。哪组数据传送指令方向正确？",
    options: ["MOV A,SBUF；MOV @R0,A", "MOV A,@R0；MOV SBUF,A", "MOV SBUF,R0；MOV A,@R0", "MOV R0,SBUF；MOV A,R0"],
    correctAnswer: "MOV A,SBUF；MOV @R0,A",
    ka: "7.3.3",
    chapter: 7,
    explanation: "读SBUF取得接收缓冲器中的字节，再通过MOV @R0,A写入内部RAM。标志RI还应由软件清零；课件例程使用JBC RI在转入读取分支时清零。",
    source: {
      title: "第6章 串行口（课件第58页）",
      page: 58,
      url: "/resources/course/course-slides.pdf#page=58",
    },
  },
  {
    id: 348,
    type: "multiple-choice",
    questionText: "串口方式1已接收一个字节并令RI=1。软件读走SBUF后一直不清RI，即使REN仍为1，也不能满足下一帧写入接收缓冲器的哪项条件？",
    options: ["SMOD必须为1", "TR1必须为0", "TI必须为1", "RI必须为0"],
    correctAnswer: "RI必须为0",
    ka: "7.3.3",
    chapter: 7,
    explanation: "方式1把新帧交给接收缓冲器的条件包含RI=0。读SBUF不会自动清RI，程序需要软件清零，以免后续帧无法被正常接收。",
    source: {
      title: "第6章 串行口（课件第34页）",
      page: 34,
      url: "/resources/course/course-slides.pdf#page=34",
    },
  },
  {
    id: 349,
    type: "multiple-choice",
    questionText: "8051串口方式1接收时，REN=1、RI=0、SM2=1，但采样到的停止位为0。按课件给出的接收条件，该帧会怎样？",
    options: ["照常写入SBUF并置RI=1", "不满足接收条件，不置RI为1", "自动改为方式0接收", "自动把SMOD清零后重收"],
    correctAnswer: "不满足接收条件，不置RI为1",
    ka: "7.3.3",
    chapter: 7,
    explanation: "方式1要求RI=0，并且停止位为1或SM2=0。题设SM2=1且停止位为0，不满足后一条件，接收数据不会据此更新SBUF并置RI。",
    source: {
      title: "第6章 串行口（课件第34页）",
      page: 34,
      url: "/resources/course/course-slides.pdf#page=34",
    },
  },
  {
    id: 350,
    type: "multiple-choice",
    questionText: "标准8051的串口中断入口应在程序存储器哪个地址放置入口指令？",
    options: ["0003H", "000BH", "0023H", "001BH"],
    correctAnswer: "0023H",
    ka: "7.3.4",
    chapter: 7,
    explanation: "课件串口中断例程在ORG 0023H处放置跳转指令。TI和RI共用这个串口中断向量，进入服务程序后再区分来源。",
    source: {
      title: "第6章 串行口（课件第54页）",
      page: 54,
      url: "/resources/course/course-slides.pdf#page=54",
    },
  },
  {
    id: 351,
    type: "multiple-choice",
    questionText: "已经完成串口与T1配置。要允许CPU响应串口中断，还必须同时满足哪两个中断允许位为1？",
    options: ["ES和EA", "ET1和EA", "EX0和ES", "TR1和TI"],
    correctAnswer: "ES和EA",
    ka: "7.3.4",
    chapter: 7,
    explanation: "ES允许串口中断，EA为总中断允许。T1用于产生波特率时，不需要以ET1作为串口中断的使能条件。",
    source: {
      title: "第6章 串行口（课件第64页）",
      page: 64,
      url: "/resources/course/course-slides.pdf#page=64",
    },
  },
  {
    id: 352,
    type: "multiple-choice",
    questionText: "进入串口中断服务程序时，发现TI=1且RI=1。为在本次服务中处理两个已发生的事件，哪种写法合理？",
    options: ["只检查TI，认为它会自动清RI", "只检查RI，返回时硬件会自动清TI", "把两个标志都当作同一个接收事件", "分别检查TI和RI，处理对应事件并软件清除各自标志"],
    correctAnswer: "分别检查TI和RI，处理对应事件并软件清除各自标志",
    ka: "7.3.4",
    chapter: 7,
    explanation: "收发共用中断向量，但TI与RI表示不同事件，且都需要软件清零。若要求本次服务处理两者，应分别判断，避免互斥分支使其中一个事件被忽略。",
    source: {
      title: "第6章 串行口（课件第25页）",
      page: 25,
      url: "/resources/course/course-slides.pdf#page=25",
    },
  },
  {
    id: 353,
    type: "multiple-choice",
    questionText: "测得RS-232接收线上相对信号地的电压为−8 V。按课件的数据电平约定，它表示哪个逻辑值？",
    options: ["逻辑0", "逻辑1", "电压处于未定义区间", "可直接作为8051的0 V输入"],
    correctAnswer: "逻辑1",
    ka: "7.4.1",
    chapter: 7,
    explanation: "RS-232数据采用负逻辑：−15 V至−3 V表示逻辑1，+3 V至+15 V表示逻辑0。−8 V在逻辑1的有效区间内，且不是8051可直接接受的TTL电平。",
    source: {
      title: "第6章 串行口（课件第12页）",
      page: 12,
      url: "/resources/course/course-slides.pdf#page=12",
    },
  },
  {
    id: 354,
    type: "multiple-choice",
    questionText: "把8051的TTL串口接到真正的RS-232接口时，除交叉连接收发方向，还需要什么接口处理？",
    options: ["只交换TXD和RXD即可", "只把波特率提高一倍", "使用RS-232电平转换电路", "把8051输入脚直接接到负电压"],
    correctAnswer: "使用RS-232电平转换电路",
    ka: "7.4.1",
    chapter: 7,
    explanation: "8051侧与RS-232侧的电压范围、逻辑极性不同，应使用合适的电平转换电路。仅交换收发线不能解决电气标准不兼容。",
    source: {
      title: "第6章 串行口（课件第12页）",
      page: 12,
      url: "/resources/course/course-slides.pdf#page=12",
    },
  },
  {
    id: 355,
    type: "multiple-choice",
    questionText: "两台设备采用最简三线方式进行双向串口连接，且各自的接口电平均已匹配。按信号方向，应怎样连接？",
    options: ["甲TXD接乙RXD，甲RXD接乙TXD，并连接信号地", "两端TXD相连、两端RXD相连，不接地", "两端TXD相连，RXD均悬空", "只连接两端信号地即可传输"],
    correctAnswer: "甲TXD接乙RXD，甲RXD接乙TXD，并连接信号地",
    ka: "7.4.1",
    chapter: 7,
    explanation: "发送端TXD应接对方的接收端RXD，另一方向同理，并提供信号参考地。题设已排除电平不匹配问题；具体连接器针号还需核对设备定义。",
    source: {
      title: "第6章 串行口（课件第14页）",
      page: 14,
      url: "/resources/course/course-slides.pdf#page=14",
    },
  },
  {
    id: 356,
    type: "multiple-choice",
    questionText: "在课件的一对差分线RS-485半双工总线上，主机请求后从机再应答。为什么需要安排发送时段？",
    options: ["因为只能永久固定一端发送", "因为发送一次后必须重新上电", "因为每个字节必须走不同线对", "因为双方共用线对，不能同时驱动发送"],
    correctAnswer: "因为双方共用线对，不能同时驱动发送",
    ka: "7.4.2",
    chapter: 7,
    explanation: "这一RS-485连接采用一对差分线进行半双工传输，需要协调各设备的发送使能和占用时段，避免多个发送器同时驱动总线。",
    source: {
      title: "第6章 串行口（课件第16页）",
      page: 16,
      url: "/resources/course/course-slides.pdf#page=16",
    },
  },
  {
    id: 357,
    type: "multiple-choice",
    questionText: "比较课件中的标准RS-232与RS-485连接形式，多个采集节点共用总线时，哪项是RS-485更契合该拓扑的特征？",
    options: ["单端传输且仅支持点对点", "采用差分传输，可组织多点总线", "无需任何设备寻址或发送协调", "无论线长和负载如何，速率都不受限制"],
    correctAnswer: "采用差分传输，可组织多点总线",
    ka: "7.4.2",
    chapter: 7,
    explanation: "课件比较了RS-232的单端点对点连接与RS-485的差分多点连接。多点总线仍需上层协议协调，设备数、距离和速率也受具体电气条件限制。",
    source: {
      title: "第6章 串行口（课件第17页）",
      page: 17,
      url: "/resources/course/course-slides.pdf#page=17",
    },
  },
  {
    id: 358,
    type: "multiple-choice",
    questionText: "用两根线之间的电压差理解RS-485差分传输。若某时刻V1−V2=2 V，两根线上同时叠加相同的+0.4 V干扰，理想情况下新的电压差是多少？",
    options: ["2.8 V", "2.4 V", "2.0 V", "1.6 V"],
    correctAnswer: "2.0 V",
    ka: "7.4.2",
    chapter: 7,
    explanation: "两线电压同增0.4 V，差值为(V1+0.4)−(V2+0.4)=V1−V2=2 V。这只说明理想同幅共模干扰在差分量中抵消；实际接收器仍有共模范围与不平衡限制。",
    source: {
      title: "第6章 串行口（课件第16页）",
      page: 16,
      url: "/resources/course/course-slides.pdf#page=16",
    },
  },
  {
    id: 359,
    type: "multiple-choice",
    questionText: "按课件图10-22的开关编号，SW1与SW4闭合时电机正转。若其他开关均断开，要反转应闭合哪一对？",
    options: ["SW2与SW3", "SW1与SW2", "SW3与SW4", "SW2与SW4"],
    correctAnswer: "SW2与SW3",
    ka: "8.5.1",
    chapter: 8,
    explanation: "图10-22以对角开关组控制电机两端的电压方向：SW1、SW4为正转，SW2、SW3为反转。本题只采用该H桥编号，不对应某一L298N模块的引脚编号。",
    source: {
      title: "第10章 常用外部电路控制程序的设计（课件第41页）",
      page: 118,
      url: "/resources/course/course-slides.pdf#page=118",
    },
  },
  {
    id: 360,
    type: "multiple-choice",
    questionText: "按课件H桥的开关编号，哪种误操作会使同一桥臂上下开关同时导通，造成电源短路？",
    options: ["仅SW1与SW4同时闭合", "仅SW2与SW3同时闭合", "四个开关全部断开", "SW1与SW2同时闭合"],
    correctAnswer: "SW1与SW2同时闭合",
    ka: "8.5.1",
    chapter: 8,
    explanation: "课件明确指出SW1与SW2或SW3与SW4同时闭合会形成同一桥臂直通。对角导通用于驱动电机，全部断开对应滑行状态。",
    source: {
      title: "第10章 常用外部电路控制程序的设计（课件第42页）",
      page: 119,
      url: "/resources/course/course-slides.pdf#page=119",
    },
  },
  {
    id: 361,
    type: "multiple-choice",
    questionText: "直流电机的脉宽调制（PWM）控制信号周期为2 ms，每周期有效导通时间为0.6 ms。其占空比是多少？",
    options: ["3%", "30%", "60%", "70%"],
    correctAnswer: "30%",
    ka: "8.5.1",
    chapter: 8,
    explanation: "占空比=有效导通时间/周期=0.6/2=0.30，即30%。占空比可改变电机端的平均施加电压，但不能据此直接断言实际转速恰为满速的30%。",
    source: {
      title: "第10章 常用外部电路控制程序的设计（课件第36页）",
      page: 113,
      url: "/resources/course/course-slides.pdf#page=113",
    },
  },
  {
    id: 362,
    type: "multiple-choice",
    questionText: "按课件给出的反应式步进电机公式，转子齿数Z=40，采用六拍工作方式N=6。每拍的步距角为多少？",
    options: ["9°", "3°", "1.5°", "0.15°"],
    correctAnswer: "1.5°",
    ka: "8.5.2",
    chapter: 8,
    explanation: "步距角=360°/(Z×N)=360°/(40×6)=1.5°。这里采用课件指定的电机结构与工作拍数，不把该公式直接套到含减速器的其他型号。",
    source: {
      title: "第10章 常用外部电路控制程序的设计（课件第56页）",
      page: 133,
      url: "/resources/course/course-slides.pdf#page=133",
    },
  },
  {
    id: 363,
    type: "multiple-choice",
    questionText: "三相步进电机按A→B→C→A循环通电时正转。保持相同工作方式和步进频率，要反转应采用哪种顺序？",
    options: ["A→C→B→A", "A→B→C→A，但只提高频率", "A→A→A→A", "A、B、C三相一直同时通电"],
    correctAnswer: "A→C→B→A",
    ka: "8.5.2",
    chapter: 8,
    explanation: "逆转相序即可改变旋转方向：A→C→B→A。仅改变频率并未改变相序，持续给同一相或全部相通电也不等同于连续反向步进。",
    source: {
      title: "第10章 常用外部电路控制程序的设计（课件第61页）",
      page: 138,
      url: "/resources/course/course-slides.pdf#page=138",
    },
  },
  {
    id: 364,
    type: "multiple-choice",
    questionText: "课件拓展中的四线双极型步进电机需要改变两个绕组内的电流方向。与这一要求匹配的驱动结构是？",
    options: ["只用一个单向开关控制全部绕组", "把四根线直接接到8051端口", "只需单向灌电流阵列即可完成电流反向", "每个绕组配置一个H桥，共两个H桥"],
    correctAnswer: "每个绕组配置一个H桥，共两个H桥",
    ka: "8.5.2",
    chapter: 8,
    explanation: "四线双极型电机的两个绕组都需要电流反向，因此课件采用两个H桥。这不能与带公共端、可用单向开关换相的单极型电机驱动混用。",
    source: {
      title: "第10章 常用外部电路控制程序的设计（课件第68页）",
      page: 145,
      url: "/resources/course/course-slides.pdf#page=145",
    },
  },
  {
    id: 365,
    type: "multiple-choice",
    questionText: "在课件采用三极管驱动的蜂鸣器报警接口中，单片机I/O承担的主要职责是什么？",
    options: ["直接承担蜂鸣器的全部负载电流", "向驱动级提供控制信号", "代替蜂鸣器把电能转换为声音", "通过改变晶振连接来接通报警"],
    correctAnswer: "向驱动级提供控制信号",
    ka: "8.6.1",
    chapter: 8,
    explanation: "I/O输出控制信号，三极管驱动级根据该信号通断蜂鸣器的负载支路。控制端负责发出指令，驱动级承担负载驱动，不能把两者承担的电流混为一谈。",
    source: {
      title: "第10章 常用外部电路控制程序的设计（课件第28页）",
      page: 105,
      url: "/resources/course/course-slides.pdf#page=105",
    },
  },

  // 现有实验网页指导补充题；每题保留具体正文标题，既有题号和专项试卷不变。
  {
    "id": 366,
    "type": "multiple-choice",
    "questionText": "在项目1给出的40引脚DIP封装AT89C51图中，电源与地分别接哪两个引脚？",
    "options": [
      "20脚VCC、40脚GND",
      "9脚VCC、31脚GND",
      "40脚VCC、20脚GND",
      "18脚VCC、19脚GND"
    ],
    "correctAnswer": "40脚VCC、20脚GND",
    "ka": "1.4.1",
    "chapter": 1,
    "explanation": "本题限定项目1所示40引脚DIP封装。图中40脚标为VCC、20脚标为GND，不能将其他封装的脚号直接套用。",
    "source": {
      "kind": "guide",
      "title": "项目1网页指导",
      "experimentId": "proj01",
      "section": "AT89C51 芯片引脚功能",
      "url": "/simulation?experiment=proj01&view=guide"
    }
  },
  {
    "id": 367,
    "type": "multiple-choice",
    "questionText": "项目1把P3.0和P3.1分别标为RXD和TXD，这说明什么？",
    "options": [
      "P3.0和P3.1只能作为电源引脚",
      "P3.0和P3.1分别是晶振的两个引脚",
      "P3口只有地址总线功能",
      "这两个端口引脚兼有串口接收与发送功能"
    ],
    "correctAnswer": "这两个端口引脚兼有串口接收与发送功能",
    "ka": "1.4.1",
    "chapter": 1,
    "explanation": "RXD表示串行接收，TXD表示串行发送。引脚图把这两个第二功能与P3.0、P3.1并列标出，连接外设前应核对复用用途。",
    "source": {
      "kind": "guide",
      "title": "项目1网页指导",
      "experimentId": "proj01",
      "section": "AT89C51 芯片引脚功能",
      "url": "/simulation?experiment=proj01&view=guide"
    }
  },
  {
    "id": 368,
    "type": "multiple-choice",
    "questionText": "连接AT89C51外部地址锁存器时，项目1引脚图中哪个信号用于地址锁存？",
    "options": [
      "ALE",
      "RST",
      "TXD",
      "GND"
    ],
    "correctAnswer": "ALE",
    "ka": "1.4.1",
    "chapter": 1,
    "explanation": "项目1把ALE标为地址锁存信号；RST是复位输入，TXD为串行发送，GND是参考地，各信号不能互相替代。",
    "source": {
      "kind": "guide",
      "title": "项目1网页指导",
      "experimentId": "proj01",
      "section": "AT89C51 芯片引脚功能",
      "url": "/simulation?experiment=proj01&view=guide"
    }
  },
  {
    "id": 369,
    "type": "multiple-choice",
    "questionText": "项目1的最小系统示例把晶振连接在哪里？",
    "options": [
      "P1.0与P1.1之间",
      "XTAL1与XTAL2之间",
      "RXD与TXD之间",
      "ALE与PSEN之间"
    ],
    "correctAnswer": "XTAL1与XTAL2之间",
    "ka": "1.4.3",
    "chapter": 1,
    "explanation": "指导中的晶振电路接在XTAL1和XTAL2之间，用于提供时钟；P1和串口引脚在该示例中不是晶振连接端。",
    "source": {
      "kind": "guide",
      "title": "项目1网页指导",
      "experimentId": "proj01",
      "section": "最小系统电路",
      "url": "/simulation?experiment=proj01&view=guide"
    }
  },
  {
    "id": 370,
    "type": "multiple-choice",
    "questionText": "按项目1示例，RST节点用于哪项功能？",
    "options": [
      "存放流水灯段码",
      "持续输出串口数据",
      "上电或手动触发复位",
      "替代程序存储器"
    ],
    "correctAnswer": "上电或手动触发复位",
    "ka": "1.4.3",
    "chapter": 1,
    "explanation": "项目1列出RST上的上电复位电路及可选手动按钮。复位电路负责使控制器进入规定初始状态，不承担程序存储。",
    "source": {
      "kind": "guide",
      "title": "项目1网页指导",
      "experimentId": "proj01",
      "section": "最小系统电路",
      "url": "/simulation?experiment=proj01&view=guide"
    }
  },
  {
    "id": 371,
    "type": "multiple-choice",
    "questionText": "复用项目1的12MHz晶振示例到另一款兼容芯片时，哪个做法合理？",
    "options": [
      "所有兼容芯片都必须使用30pF电容",
      "忽略目标芯片的时钟要求",
      "用任意I/O引脚代替XTAL引脚",
      "依据目标芯片手册重新核对晶振与负载电容"
    ],
    "correctAnswer": "依据目标芯片手册重新核对晶振与负载电容",
    "ka": "1.4.3",
    "chapter": 1,
    "explanation": "指导中的12MHz和30pF属于该示例电路取值，不能据此推断所有兼容芯片的推荐参数相同；实际连接须结合目标器件要求。",
    "source": {
      "kind": "guide",
      "title": "项目1网页指导",
      "experimentId": "proj01",
      "section": "最小系统电路",
      "url": "/simulation?experiment=proj01&view=guide"
    }
  },
  {
    "id": 372,
    "type": "multiple-choice",
    "questionText": "项目1在片内程序地址范围使用AT89C51内部Flash时，EA引脚应如何连接？",
    "options": [
      "接VCC",
      "接GND",
      "接蜂鸣器输出",
      "接收发数据线"
    ],
    "correctAnswer": "接VCC",
    "ka": "1.4.4",
    "chapter": 1,
    "explanation": "项目1用EA接VCC选择片内程序存储器。本题限定片内程序地址范围；EA接地则要求从外部程序存储器取指。",
    "source": {
      "kind": "guide",
      "title": "项目1网页指导",
      "experimentId": "proj01",
      "section": "最小系统电路",
      "url": "/simulation?experiment=proj01&view=guide"
    }
  },
  {
    "id": 373,
    "type": "multiple-choice",
    "questionText": "项目1中EA接GND时，程序应从哪里取得？",
    "options": [
      "内部数据RAM",
      "外部程序存储器",
      "串口接收缓冲器",
      "端口P1锁存器"
    ],
    "correctAnswer": "外部程序存储器",
    "ka": "1.4.4",
    "chapter": 1,
    "explanation": "指导把EA接GND对应到外部ROM。程序存储器和数据RAM的用途不同，不能把选择程序来源理解为选择数据缓冲器。",
    "source": {
      "kind": "guide",
      "title": "项目1网页指导",
      "experimentId": "proj01",
      "section": "最小系统电路",
      "url": "/simulation?experiment=proj01&view=guide"
    }
  },
  {
    "id": 374,
    "type": "multiple-choice",
    "questionText": "项目1列出的最小系统四部分中，哪一组完整对应指导内容？",
    "options": [
      "数码管、蜂鸣器、蓝牙和电机",
      "LCD、键盘、ADC和DAC",
      "电源、晶振、复位和EA连接",
      "串口、网口、USB和无线模块"
    ],
    "correctAnswer": "电源、晶振、复位和EA连接",
    "ka": "1.4.4",
    "chapter": 1,
    "explanation": "指导按电源、晶振、复位及EA连接组织最小系统；显示、传感器和电机是应用外设，不是该示例列出的四个基础部分。",
    "source": {
      "kind": "guide",
      "title": "项目1网页指导",
      "experimentId": "proj01",
      "section": "最小系统电路",
      "url": "/simulation?experiment=proj01&view=guide"
    }
  },
  {
    "id": 375,
    "type": "multiple-choice",
    "questionText": "经典8051的P0口作普通数字输出、需要获得稳定高电平时，应注意什么？",
    "options": [
      "P0内部上拉始终与P1完全相同",
      "P0不能输出低电平",
      "把P0所有引脚短接到地即可",
      "开漏结构需要按电路配置外接上拉电阻"
    ],
    "correctAnswer": "开漏结构需要按电路配置外接上拉电阻",
    "ka": "2.3.1",
    "chapter": 2,
    "explanation": "实验1说明P0为开漏输出。作为普通I/O使用时，高电平能力依赖相应上拉电路，不能套用P1内部上拉的描述。",
    "source": {
      "kind": "guide",
      "title": "实验1网页指导",
      "experimentId": "exp01",
      "section": "8051 并行 I/O 口结构",
      "url": "/simulation?experiment=exp01&view=guide"
    }
  },
  {
    "id": 376,
    "type": "multiple-choice",
    "questionText": "在外部存储器总线功能下，P0口复用承担什么？",
    "options": [
      "低8位地址与8位数据",
      "仅高8位地址",
      "仅复位信号",
      "仅串口时钟"
    ],
    "correctAnswer": "低8位地址与8位数据",
    "ka": "2.3.1",
    "chapter": 2,
    "explanation": "实验1把P0说明为低8位地址和数据的复用端口。P2才承担高8位地址，区分两者才能理解地址锁存的用途。",
    "source": {
      "kind": "guide",
      "title": "实验1网页指导",
      "experimentId": "exp01",
      "section": "8051 并行 I/O 口结构",
      "url": "/simulation?experiment=exp01&view=guide"
    }
  },
  {
    "id": 377,
    "type": "multiple-choice",
    "questionText": "有人把AT89C51手册中的P0整口26mA限值当作每个引脚可用电流，判断是否正确？",
    "options": [
      "正确，8个引脚均可同时灌入26mA",
      "不正确，整口上限不能当成单引脚额定驱动能力",
      "正确，而且无需限流电阻",
      "只要程序运行就不必检查电流"
    ],
    "correctAnswer": "不正确，整口上限不能当成单引脚额定驱动能力",
    "ka": "2.3.1",
    "chapter": 2,
    "explanation": "实验1明确26mA为P0整口灌电流上限，并要求按手册测试条件校核；单脚能力、整口总电流和低电平电压保证是不同约束。",
    "source": {
      "kind": "guide",
      "title": "实验1网页指导",
      "experimentId": "exp01",
      "section": "8051 并行 I/O 口结构",
      "url": "/simulation?experiment=exp01&view=guide"
    }
  },
  {
    "id": 378,
    "type": "multiple-choice",
    "questionText": "实验1中P1被描述为哪种端口？",
    "options": [
      "没有上拉的纯模拟输入口",
      "专用高压电机功率端口",
      "带内部上拉的准双向口",
      "只能发送串行数据的端口"
    ],
    "correctAnswer": "带内部上拉的准双向口",
    "ka": "2.3.2",
    "chapter": 2,
    "explanation": "实验1的P1说明包含准双向结构和内部上拉。它仍受数字I/O电气规格约束，不能直接视为电机功率输出端。",
    "source": {
      "kind": "guide",
      "title": "实验1网页指导",
      "experimentId": "exp01",
      "section": "8051 并行 I/O 口结构",
      "url": "/simulation?experiment=exp01&view=guide"
    }
  },
  {
    "id": 379,
    "type": "multiple-choice",
    "questionText": "按实验1的经典8051复位说明，P1端口锁存器的初始值是什么？",
    "options": [
      "00H",
      "55H",
      "80H",
      "FFH"
    ],
    "correctAnswer": "FFH",
    "ka": "2.3.2",
    "chapter": 2,
    "explanation": "指导说明P1复位后默认各位为高，即8位全1，十六进制为FFH。锁存器初态与外部负载下实测引脚电压还应区分。",
    "source": {
      "kind": "guide",
      "title": "实验1网页指导",
      "experimentId": "exp01",
      "section": "8051 并行 I/O 口结构",
      "url": "/simulation?experiment=exp01&view=guide"
    }
  },
  {
    "id": 380,
    "type": "multiple-choice",
    "questionText": "仅控制P1.0而希望保持P1其他位的锁存状态，哪类操作更合适？",
    "options": [
      "对P1.0执行位操作",
      "每次给P1写入00H",
      "每次给P1写入FFH",
      "只修改串口SBUF"
    ],
    "correctAnswer": "对P1.0执行位操作",
    "ka": "2.3.2",
    "chapter": 2,
    "explanation": "实验1说明P1可逐位操作。位操作可选择目标位，整字节写00H或FFH会同时改变多个位，SBUF则不控制P1.0。",
    "source": {
      "kind": "guide",
      "title": "实验1网页指导",
      "experimentId": "exp01",
      "section": "8051 并行 I/O 口结构",
      "url": "/simulation?experiment=exp01&view=guide"
    }
  },
  {
    "id": 381,
    "type": "multiple-choice",
    "questionText": "外部存储器扩展使用16位地址时，P2负责哪一部分？",
    "options": [
      "低8位地址和数据复用",
      "高8位地址",
      "串口帧中的停止位",
      "中断向量中的全部指令"
    ],
    "correctAnswer": "高8位地址",
    "ka": "2.3.3",
    "chapter": 2,
    "explanation": "实验1把P2的第二功能说明为地址总线高8位；低8位地址与数据复用由P0承担，不能交换这两组端口用途。",
    "source": {
      "kind": "guide",
      "title": "实验1网页指导",
      "experimentId": "exp01",
      "section": "8051 并行 I/O 口结构",
      "url": "/simulation?experiment=exp01&view=guide"
    }
  },
  {
    "id": 382,
    "type": "multiple-choice",
    "questionText": "项目使用外部存储器高位地址后，又将同一组P2引脚直接作为独立LED控制口，有什么问题？",
    "options": [
      "P2会自动提供两套互不影响的引脚",
      "只要LED数量少就绝无冲突",
      "存在引脚功能冲突，需要重新分配接口",
      "修改LED颜色即可解决总线冲突"
    ],
    "correctAnswer": "存在引脚功能冲突，需要重新分配接口",
    "ka": "2.3.3",
    "chapter": 2,
    "explanation": "P2普通I/O与高8位地址功能使用同一组物理引脚。对同一时段的不同用途必须安排接口，不能认为复用等于并行独立使用。",
    "source": {
      "kind": "guide",
      "title": "实验1网页指导",
      "experimentId": "exp01",
      "section": "8051 并行 I/O 口结构",
      "url": "/simulation?experiment=exp01&view=guide"
    }
  },
  {
    "id": 383,
    "type": "multiple-choice",
    "questionText": "比较实验1中的P0与P2结构，哪项符合指导？",
    "options": [
      "P0与P2都没有第二功能",
      "P0承担高8位地址而P2承担低8位数据",
      "P2是专用模拟输入端口",
      "P0为开漏口，P2为准双向口"
    ],
    "correctAnswer": "P0为开漏口，P2为准双向口",
    "ka": "2.3.3",
    "chapter": 2,
    "explanation": "指导分别给出P0开漏结构与P2准双向结构，并列出各自总线功能；结构差异会影响普通I/O电路的连接方法。",
    "source": {
      "kind": "guide",
      "title": "实验1网页指导",
      "experimentId": "exp01",
      "section": "8051 并行 I/O 口结构",
      "url": "/simulation?experiment=exp01&view=guide"
    }
  },
  {
    "id": 384,
    "type": "multiple-choice",
    "questionText": "按项目1引脚图，外部中断0信号INT0对应哪个端口位？",
    "options": [
      "P3.2",
      "P3.0",
      "P1.2",
      "P2.0"
    ],
    "correctAnswer": "P3.2",
    "ka": "2.3.4",
    "chapter": 2,
    "explanation": "项目1将INT0与P3.2标在同一引脚位置；P3.0的第二功能是RXD。连接外部中断按键前必须核对该映射。",
    "source": {
      "kind": "guide",
      "title": "项目1网页指导",
      "experimentId": "proj01",
      "section": "AT89C51 芯片引脚功能",
      "url": "/simulation?experiment=proj01&view=guide"
    }
  },
  {
    "id": 385,
    "type": "multiple-choice",
    "questionText": "按项目1引脚图，计数器T1的外部输入对应哪个端口位？",
    "options": [
      "P3.1",
      "P3.5",
      "P2.5",
      "P1.5"
    ],
    "correctAnswer": "P3.5",
    "ka": "2.3.4",
    "chapter": 2,
    "explanation": "引脚图中T0对应P3.4、T1对应P3.5。它们是外部计数输入，不应与定时器软件编号或普通端口序号混淆。",
    "source": {
      "kind": "guide",
      "title": "项目1网页指导",
      "experimentId": "proj01",
      "section": "AT89C51 芯片引脚功能",
      "url": "/simulation?experiment=proj01&view=guide"
    }
  },
  {
    "id": 386,
    "type": "multiple-choice",
    "questionText": "项目1将P3.6和P3.7分别标为WR和RD，这两个第二功能用于什么？",
    "options": [
      "晶振输入和输出",
      "芯片电源与地",
      "外部数据存储器的写与读控制",
      "数码管段码的个位和十位"
    ],
    "correctAnswer": "外部数据存储器的写与读控制",
    "ka": "2.3.4",
    "chapter": 2,
    "explanation": "引脚图给出WR和RD控制信号，分别承担外部数据存储器写、读选通；这与P3.0、P3.1的串口功能不同。",
    "source": {
      "kind": "guide",
      "title": "项目1网页指导",
      "experimentId": "proj01",
      "section": "AT89C51 芯片引脚功能",
      "url": "/simulation?experiment=proj01&view=guide"
    }
  },
  {
    "id": 387,
    "type": "multiple-choice",
    "questionText": "实验1采用LED阳极接VCC、阴极经电阻接P1的灌电流接法，P1.x为何值时LED点亮？",
    "options": [
      "1",
      "只有交替写入0和1才可能亮",
      "与端口电平无关",
      "0"
    ],
    "correctAnswer": "0",
    "ka": "2.3.5",
    "chapter": 2,
    "explanation": "该接法在P1.x输出低电平时形成从VCC经LED和电阻流入端口的电流路径，因此实验1的LED控制为低有效。",
    "source": {
      "kind": "guide",
      "title": "实验1网页指导",
      "experimentId": "exp01",
      "section": "LED 驱动原理",
      "url": "/simulation?experiment=exp01&view=guide"
    }
  },
  {
    "id": 388,
    "type": "multiple-choice",
    "questionText": "按实验1示例，VCC=5V、LED压降2V、忽略VOL、目标电流不超过1.5mA时，限流电阻至少应为多少？",
    "options": [
      "2kΩ",
      "200Ω",
      "20Ω",
      "20kΩ才是最小值"
    ],
    "correctAnswer": "2kΩ",
    "ka": "2.3.5",
    "chapter": 2,
    "explanation": "按R≥(5−2)/0.0015计算得2000Ω。这里采用题设示例条件，实物还须核对供电、LED压降、电阻公差和端口总电流。",
    "source": {
      "kind": "guide",
      "title": "实验1网页指导",
      "experimentId": "exp01",
      "section": "LED 驱动原理",
      "url": "/simulation?experiment=exp01&view=guide"
    }
  },
  {
    "id": 389,
    "type": "multiple-choice",
    "questionText": "希望把实验1LED电流增大到端口规格不能保证的范围，正确的下一步是什么？",
    "options": [
      "仅把延时循环写得更长",
      "采用外置驱动器并校核器件与总电流",
      "去掉限流电阻",
      "把软件运行速度调快即可提高额定电流"
    ],
    "correctAnswer": "采用外置驱动器并校核器件与总电流",
    "ka": "2.3.5",
    "chapter": 2,
    "explanation": "实验1要求较大负载电流使用外置驱动器。程序延时或仿真速度不会改变芯片的电气额定能力，也不能替代限流措施。",
    "source": {
      "kind": "guide",
      "title": "实验1网页指导",
      "experimentId": "exp01",
      "section": "LED 驱动原理",
      "url": "/simulation?experiment=exp01&view=guide"
    }
  },
  {
    "id": 390,
    "type": "multiple-choice",
    "questionText": "若内部RAM[55H]=A6H，执行MOV A,#55H后A是什么？",
    "options": [
      "A6H",
      "00H",
      "55H",
      "由RAM[55H]决定"
    ],
    "correctAnswer": "55H",
    "ka": "3.1.1",
    "chapter": 3,
    "explanation": "#表示立即数，操作数55H包含在指令中；本条指令不读取55H地址的RAM，因此不会取得其中的A6H。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "8051 寻址方式",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 391,
    "type": "multiple-choice",
    "questionText": "若RAM[30H]=72H，执行MOV A,30H后A是什么？",
    "options": [
      "30H",
      "00H",
      "直接地址不能用于MOV",
      "72H"
    ],
    "correctAnswer": "72H",
    "ka": "3.1.2",
    "chapter": 3,
    "explanation": "指令没有#号，30H是内部RAM直接地址。MOV把该地址中的72H送入A，不能把地址值误当作操作数。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "8051 寻址方式",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 392,
    "type": "multiple-choice",
    "questionText": "当前寄存器组R3=28H，执行MOV A,R3时使用哪个数据？",
    "options": [
      "当前寄存器组R3中的28H",
      "RAM[28H]中的内容",
      "立即数03H",
      "程序存储器地址0003H中的内容"
    ],
    "correctAnswer": "当前寄存器组R3中的28H",
    "ka": "3.1.3",
    "chapter": 3,
    "explanation": "寄存器寻址直接使用指定工作寄存器的内容；本例读当前组R3，不把28H再次解释为间接地址。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "8051 寻址方式",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 393,
    "type": "multiple-choice",
    "questionText": "R0=40H且RAM[40H]=9AH，执行MOV A,@R0后A是什么？",
    "options": [
      "40H",
      "9AH",
      "00H",
      "R0的编号0"
    ],
    "correctAnswer": "9AH",
    "ka": "3.1.4",
    "chapter": 3,
    "explanation": "@R0表示把R0作为地址指针，先取得地址40H，再读取该RAM单元中的9AH，和MOV A,R0的结果不同。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "8051 寻址方式",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 394,
    "type": "multiple-choice",
    "questionText": "DPTR=1200H且A=03H时，MOVC A,@A+DPTR读取哪个程序存储器地址？",
    "options": [
      "0003H",
      "1200H",
      "1203H",
      "内部RAM的03H"
    ],
    "correctAnswer": "1203H",
    "ka": "3.1.5",
    "chapter": 3,
    "explanation": "变址寻址将表基址DPTR与A中的偏移相加，1200H+03H=1203H；MOVC读取代码空间，不能换成内部RAM访问。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "8051 寻址方式",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 395,
    "type": "multiple-choice",
    "questionText": "SJMP指令位于0100H，指令长度2字节，相对偏移为+5时目标地址是什么？",
    "options": [
      "0105H",
      "0102H",
      "0005H",
      "0107H"
    ],
    "correctAnswer": "0107H",
    "ka": "3.1.6",
    "chapter": 3,
    "explanation": "实验2给出PC←PC+2+偏移。相对位移以这条两字节指令之后的0102H为基准，加5后到0107H。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "8051 寻址方式",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 396,
    "type": "multiple-choice",
    "questionText": "执行SETB P1.0，目标对象是什么？",
    "options": [
      "P1端口的第0位",
      "整个P1端口的全部8位",
      "内部RAM地址01H的整个字节",
      "程序计数器的第0位"
    ],
    "correctAnswer": "P1端口的第0位",
    "ka": "3.1.7",
    "chapter": 3,
    "explanation": "位寻址把P1.0作为单个位目标，SETB将该位置1；这不同于给整个端口写入一个字节。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "8051 寻址方式",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 397,
    "type": "multiple-choice",
    "questionText": "执行MOV 30H,#6CH时，数据流向是什么？",
    "options": [
      "把30H写入RAM[6CH]",
      "把立即数6CH写入内部RAM的30H单元",
      "把A写入代码地址306CH",
      "把RAM[30H]写入A"
    ],
    "correctAnswer": "把立即数6CH写入内部RAM的30H单元",
    "ka": "3.2.1",
    "chapter": 3,
    "explanation": "MOV的第一个操作数为目的，第二个为源。本题30H是直接目的地址，#6CH为立即数，因此写入RAM[30H]。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "数据传送指令详解",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 398,
    "type": "multiple-choice",
    "questionText": "MOV A,#01H与MOV A,#03H执行后，奇偶标志P分别是多少？",
    "options": [
      "先0，后1",
      "两次都保持旧P",
      "先1，后0",
      "两次都为1"
    ],
    "correctAnswer": "先1，后0",
    "ka": "3.2.1",
    "chapter": 3,
    "explanation": "指导说明硬件按A中1的数量更新奇偶标志：01H含一个1，03H含两个1，因此P依次为1和0。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "数据传送指令详解",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 399,
    "type": "multiple-choice",
    "questionText": "把“所有MOV指令都不改变PSW”作为规则是否正确？",
    "options": [
      "正确，包括直接写PSW的MOV",
      "正确，因为MOV不会访问任何寄存器",
      "只要使用立即数就绝不改变P",
      "不正确，写A可改变P，MOV C,bit可改变CY"
    ],
    "correctAnswer": "不正确，写A可改变P，MOV C,bit可改变CY",
    "ka": "3.2.1",
    "chapter": 3,
    "explanation": "指导明确普通传送不按算术结果更新CY、AC、OV，但A的奇偶性会影响P，且MOV C,bit或直接写PSW可改变状态位。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "数据传送指令详解",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 400,
    "type": "multiple-choice",
    "questionText": "TAB定义为DB 3FH,06H,5BH，DPTR指向TAB且A=02H，MOVC A,@A+DPTR后A是什么？",
    "options": [
      "5BH",
      "3FH",
      "06H",
      "02H"
    ],
    "correctAnswer": "5BH",
    "ka": "3.2.3",
    "chapter": 3,
    "explanation": "查表索引从0开始：0对应3FH、1对应06H、2对应5BH。MOVC用基址加索引读取代码空间，并以表值替换A。",
    "source": {
      "kind": "guide",
      "title": "实验4网页指导",
      "experimentId": "exp04",
      "section": "MOVC 查表指令",
      "url": "/simulation?experiment=exp04&view=guide"
    }
  },
  {
    "id": 401,
    "type": "multiple-choice",
    "questionText": "实验4用DB定义数码管段码表，MOVC从哪个空间读取这张表？",
    "options": [
      "外部数据RAM空间",
      "程序存储器空间",
      "P0端口引脚",
      "串口接收缓冲器"
    ],
    "correctAnswer": "程序存储器空间",
    "ka": "3.2.3",
    "chapter": 3,
    "explanation": "指导明确DB在代码空间定义常数表，MOVC读取程序存储器；内部MOV和外部数据MOVX不能代替这条查表指令。",
    "source": {
      "kind": "guide",
      "title": "实验4网页指导",
      "experimentId": "exp04",
      "section": "MOVC 查表指令",
      "url": "/simulation?experiment=exp04&view=guide"
    }
  },
  {
    "id": 402,
    "type": "multiple-choice",
    "questionText": "连续查表时为什么不能把上一次MOVC执行后的A直接当作下一个索引？",
    "options": [
      "MOVC会永久清零DPTR",
      "MOVC会自动停止程序",
      "A已被替换为表中数据，需重新设置所需索引",
      "A始终保持原索引，不需要处理"
    ],
    "correctAnswer": "A已被替换为表中数据，需重新设置所需索引",
    "ka": "3.2.3",
    "chapter": 3,
    "explanation": "MOVC的结果写回A，原索引不再保留。下一次访问应依据需要重新装入索引，避免把段码误当成偏移。",
    "source": {
      "kind": "guide",
      "title": "实验4网页指导",
      "experimentId": "exp04",
      "section": "MOVC 查表指令",
      "url": "/simulation?experiment=exp04&view=guide"
    }
  },
  {
    "id": 403,
    "type": "multiple-choice",
    "questionText": "实验5延时入口先保存R6再保存R7，返回前应按什么顺序恢复？",
    "options": [
      "先恢复R6，再恢复R7",
      "只恢复R6",
      "恢复顺序与保存顺序完全无关",
      "先恢复R7，再恢复R6"
    ],
    "correctAnswer": "先恢复R7，再恢复R6",
    "ka": "3.2.4",
    "chapter": 3,
    "explanation": "堆栈按后进先出工作。指导要求入口保存、出口按相反顺序恢复，因此最后压入的R7必须先弹出。",
    "source": {
      "kind": "guide",
      "title": "实验5网页指导",
      "experimentId": "exp05",
      "section": "消抖延时的条件与寄存器保护",
      "url": "/simulation?experiment=exp05&view=guide"
    }
  },
  {
    "id": 404,
    "type": "multiple-choice",
    "questionText": "实验5把SP初始化为2FH，首个压栈字节从哪里开始存放？",
    "options": [
      "30H",
      "2FH",
      "20H",
      "00H"
    ],
    "correctAnswer": "30H",
    "ka": "3.2.4",
    "chapter": 3,
    "explanation": "8051压栈时先增加SP再存数据。SP设为2FH后首个字节进入30H，从而避开该程序20H—22H的变量区域。",
    "source": {
      "kind": "guide",
      "title": "实验5网页指导",
      "experimentId": "exp05",
      "section": "消抖延时的条件与寄存器保护",
      "url": "/simulation?experiment=exp05&view=guide"
    }
  },
  {
    "id": 405,
    "type": "multiple-choice",
    "questionText": "实验5延时程序使用寄存器组0，PUSH 06H保存的是什么？",
    "options": [
      "无论当前组如何都自动选择当前R6",
      "组0的R6对应的直接地址单元",
      "立即数06H",
      "第6条程序指令"
    ],
    "correctAnswer": "组0的R6对应的直接地址单元",
    "ka": "3.2.4",
    "chapter": 3,
    "explanation": "PUSH采用直接地址，06H是寄存器组0中R6的地址。程序明确选择组0后，这条指令才与保存所用R6的目标一致。",
    "source": {
      "kind": "guide",
      "title": "实验5网页指导",
      "experimentId": "exp05",
      "section": "消抖延时的条件与寄存器保护",
      "url": "/simulation?experiment=exp05&view=guide"
    }
  },
  {
    "id": 406,
    "type": "multiple-choice",
    "questionText": "多字节无符号加法在低字节ADD之后，高字节为什么使用ADDC？",
    "options": [
      "自动跳过高字节",
      "把高字节移到外部RAM",
      "把低字节产生的进位加入高字节运算",
      "将二进制数自动转成ASCII"
    ],
    "correctAnswer": "把低字节产生的进位加入高字节运算",
    "ka": "3.3.1",
    "chapter": 3,
    "explanation": "ADDC执行带进位加法，将CY纳入当前字节计算。因此低字节进位才能继续传到高字节，形成多字节加法。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 407,
    "type": "multiple-choice",
    "questionText": "A=FFH，执行ADD A,#01H后，8位结果A及CY是什么？",
    "options": [
      "A=00H，CY=0",
      "A=FFH，CY=1",
      "A=01H，CY=0",
      "A=00H，CY=1"
    ],
    "correctAnswer": "A=00H，CY=1",
    "ka": "3.3.1",
    "chapter": 3,
    "explanation": "FFH+01H=100H，低8位保存在A中为00H，超出的第9位形成CY=1；不能只看A而漏掉进位。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 408,
    "type": "multiple-choice",
    "questionText": "高字节运算前A=12H、CY=1，执行ADDC A,#20H后A是什么？",
    "options": [
      "33H",
      "32H",
      "21H",
      "13H"
    ],
    "correctAnswer": "33H",
    "ka": "3.3.1",
    "chapter": 3,
    "explanation": "带进位加法计算12H+20H+1=33H。若改用ADD将得到32H，丢失来自前一字节的进位。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 409,
    "type": "multiple-choice",
    "questionText": "要用SUBB完成不含前次借位的单字节减法，开始前通常应做什么？",
    "options": [
      "SETB C",
      "CLR C",
      "CLR A",
      "只增加SP"
    ],
    "correctAnswer": "CLR C",
    "ka": "3.3.2",
    "chapter": 3,
    "explanation": "SUBB计算A减源操作数再减CY。单字节独立减法需先清除旧CY，避免把前次借位带入当前运算。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 410,
    "type": "multiple-choice",
    "questionText": "A=10H、CY=1，执行SUBB A,#03H后的A是什么？",
    "options": [
      "0DH",
      "0EH",
      "0CH",
      "13H"
    ],
    "correctAnswer": "0CH",
    "ka": "3.3.2",
    "chapter": 3,
    "explanation": "SUBB会计入入口CY，本例计算10H−03H−1=0CH；0DH是忽略借位时的结果。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 411,
    "type": "multiple-choice",
    "questionText": "先CLR C，A=20H，再执行SUBB A,#30H，结果和借位如何？",
    "options": [
      "A=10H，CY=0",
      "A=F0H，CY=0",
      "A=00H，CY=1",
      "A=F0H，CY=1"
    ],
    "correctAnswer": "A=F0H，CY=1",
    "ka": "3.3.2",
    "chapter": 3,
    "explanation": "20H−30H为−16，8位结果按模256保存为F0H。无符号数不够减，借位标志CY因此置1。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 412,
    "type": "multiple-choice",
    "questionText": "MUL AB完成乘法后，16位积的低字节和高字节分别存在哪里？",
    "options": [
      "低字节在A，高字节在B",
      "低字节在B，高字节在A",
      "全部存入DPTR",
      "只保留A中的低4位"
    ],
    "correctAnswer": "低字节在A，高字节在B",
    "ka": "3.3.3",
    "chapter": 3,
    "explanation": "指导说明MUL AB用两个8位无符号操作数相乘，低字节返回A、高字节返回B，读取完整乘积时要同时检查两者。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 413,
    "type": "multiple-choice",
    "questionText": "A=20H、B=10H，执行MUL AB后A与B是什么？",
    "options": [
      "A=02H，B=00H",
      "A=00H，B=02H",
      "A=30H，B=00H",
      "A=10H，B=20H"
    ],
    "correctAnswer": "A=00H，B=02H",
    "ka": "3.3.3",
    "chapter": 3,
    "explanation": "20H×10H=0200H，即32×16=512。低字节00H放A，高字节02H放B，而不是按加法得到30H。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 414,
    "type": "multiple-choice",
    "questionText": "按实验2说明，MUL AB的无符号乘积大于255时，OV表示什么？",
    "options": [
      "发生有符号加法借位",
      "电源电压超限",
      "乘积超出单个8位字节，OV=1",
      "定时器T0已经溢出"
    ],
    "correctAnswer": "乘积超出单个8位字节，OV=1",
    "ka": "3.3.3",
    "chapter": 3,
    "explanation": "MUL的OV在乘积不能仅由A的8位容纳时置1，完整积仍在B:A中；它不表示定时器或电源状态。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 415,
    "type": "multiple-choice",
    "questionText": "DIV AB执行合法的无符号除法后，商和余数分别放在哪里？",
    "options": [
      "商在B，余数在A",
      "都放入CY",
      "都放入DPTR",
      "商在A，余数在B"
    ],
    "correctAnswer": "商在A，余数在B",
    "ka": "3.3.4",
    "chapter": 3,
    "explanation": "实验2明确DIV AB以A为被除数、B为除数，结果商回到A、余数回到B，后续显示应据此读取。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 416,
    "type": "multiple-choice",
    "questionText": "A=29、B=10，执行DIV AB后A和B的十进制值分别是什么？",
    "options": [
      "A=2，B=9",
      "A=9，B=2",
      "A=19，B=0",
      "A=3，B=1"
    ],
    "correctAnswer": "A=2，B=9",
    "ka": "3.3.4",
    "chapter": 3,
    "explanation": "29除以10得到商2、余数9，因此A=2、B=9。这种分解可用于把两位十进制数分成十位和个位。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 417,
    "type": "multiple-choice",
    "questionText": "在用DIV AB把小时23拆成十位和个位时，B应先装入哪个十进制数？",
    "options": [
      "2",
      "10",
      "16",
      "23"
    ],
    "correctAnswer": "10",
    "ka": "3.3.4",
    "chapter": 3,
    "explanation": "按十进制位数分解应除以10。商是十位、余数是个位，若除以16得到的是十六进制半字节分解。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 418,
    "type": "multiple-choice",
    "questionText": "DA A十进制调整应配合哪类运算使用？",
    "options": [
      "任意SUBB减法后均可套用",
      "MOVC读取字符串后",
      "压缩BCD数的ADD或ADDC加法",
      "定时器溢出后无需检查A"
    ],
    "correctAnswer": "压缩BCD数的ADD或ADDC加法",
    "ka": "3.3.5",
    "chapter": 3,
    "explanation": "实验2把DA A限定在ADD或ADDC之后，用于把BCD加法的二进制结果调整为合法十进制数字，不能当作通用数制转换。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 419,
    "type": "multiple-choice",
    "questionText": "压缩BCD数09H与01H相加后执行DA A，A应是什么？",
    "options": [
      "0AH",
      "01H",
      "90H",
      "10H"
    ],
    "correctAnswer": "10H",
    "ka": "3.3.5",
    "chapter": 3,
    "explanation": "09H+01H先得到0AH，低半字节超出BCD数字0—9，十进制调整补6后得到10H，表示十进制10。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 420,
    "type": "multiple-choice",
    "questionText": "实验2中压缩BCD数87H和95H相加并调整后A=82H、CY=1，完整十进制结果是什么？",
    "options": [
      "182",
      "82",
      "130",
      "282"
    ],
    "correctAnswer": "182",
    "ka": "3.3.5",
    "chapter": 3,
    "explanation": "调整后的82H表示低两位十进制82，CY提供百位进位1，合起来是182；不能把82H直接按普通十六进制解释。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "算术运算与标志位（第二段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 421,
    "type": "multiple-choice",
    "questionText": "要保留A的低4位并清除高4位，应使用哪条指令？",
    "options": [
      "ORL A,#0FH",
      "ANL A,#0FH",
      "XRL A,#0FH",
      "ANL A,#F0H"
    ],
    "correctAnswer": "ANL A,#0FH",
    "ka": "3.4.1",
    "chapter": 3,
    "explanation": "与掩码0FH相与时，低4位与1相与保留，高4位与0相与清除；F0H会反过来保留高4位。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 422,
    "type": "multiple-choice",
    "questionText": "A=A5H，执行ANL A,#3CH后A是什么？",
    "options": [
      "BDH",
      "99H",
      "24H",
      "3CH"
    ],
    "correctAnswer": "24H",
    "ka": "3.4.1",
    "chapter": 3,
    "explanation": "A5H为10100101B，3CH为00111100B；逐位与只保留两数同时为1的位，结果00100100B即24H。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 423,
    "type": "multiple-choice",
    "questionText": "对A执行ANL A,#00H后结果是什么？",
    "options": [
      "保持原值",
      "FFH",
      "只清除最低位",
      "00H"
    ],
    "correctAnswer": "00H",
    "ka": "3.4.1",
    "chapter": 3,
    "explanation": "任意位与0相与都得到0，因此全零掩码会清除整个A，而不是仅清除最低位或保留原数据。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 424,
    "type": "multiple-choice",
    "questionText": "希望将A的第3位置1、其余位保持，应选择什么？",
    "options": [
      "ORL A,#08H",
      "ANL A,#08H",
      "XRL A,#08H",
      "MOV A,#08H"
    ],
    "correctAnswer": "ORL A,#08H",
    "ka": "3.4.2",
    "chapter": 3,
    "explanation": "或运算遇1置1、遇0保留原位。08H只有第3位为1，因而可实现指定位置1而保留其余位。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 425,
    "type": "multiple-choice",
    "questionText": "A=40H，执行ORL A,#05H后A是什么？",
    "options": [
      "00H",
      "45H",
      "05H",
      "35H"
    ],
    "correctAnswer": "45H",
    "ka": "3.4.2",
    "chapter": 3,
    "explanation": "40H与05H没有重叠的置1位，逐位或后同时保留第6位、第2位和第0位，结果为45H。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 426,
    "type": "multiple-choice",
    "questionText": "对同一个字节连续两次执行ORL A,#08H，第3位如何变化？",
    "options": [
      "每次都翻转",
      "第二次清0",
      "第一次置1，第二次仍为1",
      "第一次不变而第二次清0"
    ],
    "correctAnswer": "第一次置1，第二次仍为1",
    "ka": "3.4.2",
    "chapter": 3,
    "explanation": "ORL用于置位而非翻转；某位一旦与1做或运算就保持1，重复相同置位操作不会把它清零。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 427,
    "type": "multiple-choice",
    "questionText": "A=5AH，执行XRL A,#FFH后A是什么？",
    "options": [
      "5AH",
      "FFH",
      "00H",
      "A5H"
    ],
    "correctAnswer": "A5H",
    "ka": "3.4.3",
    "chapter": 3,
    "explanation": "每一位与1异或都会翻转，因此FFH掩码翻转A的全部8位；5AH的按位反值为A5H。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 428,
    "type": "multiple-choice",
    "questionText": "某段程序连续两次执行XRL A,#08H，最终A与初值有什么关系？",
    "options": [
      "恢复为初值",
      "恒为08H",
      "恒为00H",
      "第3位永久置1"
    ],
    "correctAnswer": "恢复为初值",
    "ka": "3.4.3",
    "chapter": 3,
    "explanation": "同一掩码对同一位连续异或两次会先翻转再翻回，其余位均不变，因此整个A恢复初值。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 429,
    "type": "multiple-choice",
    "questionText": "比较两个字节是否完全相同时，它们逐位异或得到00H说明什么？",
    "options": [
      "两个字节一定互补",
      "两个字节各位都相同",
      "两个字节都必须为00H",
      "只说明最高位相同"
    ],
    "correctAnswer": "两个字节各位都相同",
    "ka": "3.4.3",
    "chapter": 3,
    "explanation": "异或在输入位相同时为0、不同为1。8位结果全0意味着全部对应位相同，不要求原字节本身为0。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 430,
    "type": "multiple-choice",
    "questionText": "A=0FH，执行CPL A后的结果是什么？",
    "options": [
      "10H",
      "00H",
      "F0H",
      "0EH"
    ],
    "correctAnswer": "F0H",
    "ka": "3.4.4",
    "chapter": 3,
    "explanation": "CPL A逐位取反：低4位从1变0，高4位从0变1，所以0FH变成F0H；这不是加1或减1。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 431,
    "type": "multiple-choice",
    "questionText": "CPL A与CLR A的作用有什么区别？",
    "options": [
      "二者对所有输入结果都相同",
      "CPL把A恒置FFH",
      "CLR只翻转最高位",
      "CPL逐位翻转，CLR把A全部清0"
    ],
    "correctAnswer": "CPL逐位翻转，CLR把A全部清0",
    "ka": "3.4.4",
    "chapter": 3,
    "explanation": "取反结果取决于原位状态，清零则不依赖原值。只有特定输入下结果可能相同，不能把这两类操作互换。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 432,
    "type": "multiple-choice",
    "questionText": "A=81H，连续执行两次CPL A，最终A是什么？",
    "options": [
      "81H",
      "7EH",
      "00H",
      "FFH"
    ],
    "correctAnswer": "81H",
    "ka": "3.4.4",
    "chapter": 3,
    "explanation": "每一位经过两次取反恢复原值，所以81H先变为7EH，再变回81H；连续取反不等于清零。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 433,
    "type": "multiple-choice",
    "questionText": "A=80H，执行不带进位的RL A后A是什么？",
    "options": [
      "00H",
      "01H",
      "40H",
      "FFH"
    ],
    "correctAnswer": "01H",
    "ka": "3.4.5",
    "chapter": 3,
    "explanation": "RL是8位循环左移，原bit7移回bit0，因此80H变为01H，而不是把移出的位直接丢弃。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 434,
    "type": "multiple-choice",
    "questionText": "A=80H且CY=0，执行RLC A后A和CY是什么？",
    "options": [
      "A=01H，CY=0",
      "A=40H，CY=0",
      "A=00H，CY=1",
      "A=80H，CY=1"
    ],
    "correctAnswer": "A=00H，CY=1",
    "ka": "3.4.5",
    "chapter": 3,
    "explanation": "RLC把CY纳入9位循环：原bit7进入CY，旧CY进入bit0；本例旧CY为0，因此A为00H而新CY为1。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 435,
    "type": "multiple-choice",
    "questionText": "A=01H，执行RR A后A是什么？",
    "options": [
      "00H",
      "02H",
      "81H",
      "80H"
    ],
    "correctAnswer": "80H",
    "ka": "3.4.5",
    "chapter": 3,
    "explanation": "RR是8位循环右移，原bit0绕回bit7，其余位右移，因此01H变成80H，不能误认为逻辑右移后为0。",
    "source": {
      "kind": "guide",
      "title": "实验2网页指导",
      "experimentId": "exp02",
      "section": "逻辑运算与移位（第三段）",
      "url": "/simulation?experiment=exp02&view=guide"
    }
  },
  {
    "id": 436,
    "type": "multiple-choice",
    "questionText": "仅允许T0溢出中断时，除ET0外还必须使能哪个总开关？",
    "options": [
      "EA",
      "RI",
      "SMOD",
      "TR1"
    ],
    "correctAnswer": "EA",
    "ka": "5.2.2",
    "chapter": 5,
    "explanation": "IE中的EA控制全局中断允许，ET0控制T0这一中断源；只设置分开关而总开关关闭时，仍不能正常响应T0中断。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "中断系统",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 437,
    "type": "multiple-choice",
    "questionText": "经典8051中，将EA清0而保留ET0=1，T0中断允许状态如何？",
    "options": [
      "ET0可绕过EA强制响应",
      "总开关关闭，不能仅凭ET0=1响应中断",
      "只影响串口而不影响T0",
      "自动切换成高优先级"
    ],
    "correctAnswer": "总开关关闭，不能仅凭ET0=1响应中断",
    "ka": "5.2.2",
    "chapter": 5,
    "explanation": "指导把EA定义为总开关、ET0定义为源使能。总开关关闭会禁止中断响应，源使能不会提升优先级或绕过全局控制。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "中断系统",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 438,
    "type": "multiple-choice",
    "questionText": "经典8051的IE.5应如何理解？",
    "options": [
      "所有8051上都是ET2",
      "串口接收标志RI",
      "保留位，不能按8052的ET2使用",
      "定时器运行位TR0"
    ],
    "correctAnswer": "保留位，不能按8052的ET2使用",
    "ka": "5.2.2",
    "chapter": 5,
    "explanation": "本课程限定经典8051的五中断源结构，IE.5为保留位。ET2来自含T2的8052等扩展型号，不能把型号差异混入本题。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "中断系统",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 439,
    "type": "multiple-choice",
    "questionText": "经典8051的T0溢出中断入口地址是什么？",
    "options": [
      "0003H",
      "001BH",
      "0023H",
      "000BH"
    ],
    "correctAnswer": "000BH",
    "ka": "5.2.4",
    "chapter": 5,
    "explanation": "实验3中断表将T0溢出列在000BH；0003H为INT0、001BH为T1、0023H为串口，应按源与入口一一对应。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "中断系统",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 440,
    "type": "multiple-choice",
    "questionText": "串口中断服务程序的入口跳转应放在经典8051哪个中断向量地址？",
    "options": [
      "0023H",
      "0013H",
      "000BH",
      "0000H"
    ],
    "correctAnswer": "0023H",
    "ka": "5.2.4",
    "chapter": 5,
    "explanation": "指导中的UART中断向量是0023H，0013H为INT1、000BH为T0；复位入口0000H不是串口中断向量。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "中断系统",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 441,
    "type": "multiple-choice",
    "questionText": "把T1服务入口误放到000BH而不是001BH，会造成什么对应错误？",
    "options": [
      "两个向量会自动交换",
      "T0向量指向了T1服务代码，T1向量未正确安排",
      "T1时钟频率自动加倍",
      "只是代码字体不同，不影响中断对应"
    ],
    "correctAnswer": "T0向量指向了T1服务代码，T1向量未正确安排",
    "ka": "5.2.4",
    "chapter": 5,
    "explanation": "中断硬件按源进入固定向量地址，不会识别程序员给服务代码取的名字；错误的地址布局会把请求与处理函数错配。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "中断系统",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 442,
    "type": "multiple-choice",
    "questionText": "经典12T内核在12MHz晶振下，定时模式每次计数的理想间隔是多少？",
    "options": [
      "12μs",
      "1ms",
      "1μs",
      "0.1s"
    ],
    "correctAnswer": "1μs",
    "ka": "6.1.1",
    "chapter": 6,
    "explanation": "实验3按每机器周期12个晶振周期计算，12/12MHz=1μs。该结论限定经典12T内核，不可直接套用1T型号。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "8051 定时器/计数器原理",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 443,
    "type": "multiple-choice",
    "questionText": "经典8051选择计数模式时，T0/T1的计数事件来自哪里？",
    "options": [
      "每次读取SBUF",
      "每次执行MOVC",
      "显示页面刷新一次",
      "相应外部引脚的有效下降沿"
    ],
    "correctAnswer": "相应外部引脚的有效下降沿",
    "ka": "6.1.1",
    "chapter": 6,
    "explanation": "指导区分内部定时与外部计数：计数模式依据T0或T1引脚的外部下降沿，不能把浏览器刷新当成硬件事件。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "8051 定时器/计数器原理",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 444,
    "type": "multiple-choice",
    "questionText": "在经典8051的TMOD中，C/T=0与C/T=1分别选择什么？",
    "options": [
      "内部定时与外部计数",
      "串口发送与串口接收",
      "中断开启与中断关闭",
      "高优先级与低优先级"
    ],
    "correctAnswer": "内部定时与外部计数",
    "ka": "6.1.1",
    "chapter": 6,
    "explanation": "C/T选择计时来源，0表示按内部机器周期定时，1表示外部事件计数；中断允许和优先级分别由其他寄存器控制。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "8051 定时器/计数器原理",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 445,
    "type": "multiple-choice",
    "questionText": "经典8051的TMOD低4位控制哪个定时器？",
    "options": [
      "T1",
      "T0",
      "串口SBUF",
      "程序计数器PC"
    ],
    "correctAnswer": "T0",
    "ka": "6.1.2",
    "chapter": 6,
    "explanation": "指导将TMOD分为两个半字节：高4位控制T1，低4位控制T0，配置其中一个时应避免无意覆盖另一个。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "8051 定时器/计数器原理",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 446,
    "type": "multiple-choice",
    "questionText": "已知T1占用TMOD高4位，希望只将T0设为模式1、GATE=0、C/T=0，如何处理TMOD？",
    "options": [
      "无条件写入00H",
      "无条件把高4位清0",
      "保留高4位，低4位改为0001B",
      "只设置串口RI位"
    ],
    "correctAnswer": "保留高4位，低4位改为0001B",
    "ka": "6.1.2",
    "chapter": 6,
    "explanation": "T0配置在低4位，模式1对应M1M0=01；保留高4位可避免破坏T1用途，这比不加判断地重写整个寄存器稳妥。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "8051 定时器/计数器原理",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 447,
    "type": "multiple-choice",
    "questionText": "在TMOD中GATE=1时，定时器运行除TR控制外还受什么条件约束？",
    "options": [
      "A中数据是否为0",
      "PC是否处于0000H",
      "LED颜色是否改变",
      "对应INT引脚电平条件"
    ],
    "correctAnswer": "对应INT引脚电平条件",
    "ka": "6.1.2",
    "chapter": 6,
    "explanation": "实验3将GATE=1定义为TR与对应INT输入共同控制；它不是通过累加器或程序地址决定是否计数。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "8051 定时器/计数器原理",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 448,
    "type": "multiple-choice",
    "questionText": "经典12T、12MHz、T0模式1理想定时1ms，初值应为多少？",
    "options": [
      "FC18H",
      "03E8H",
      "FFFFH",
      "FE0CH"
    ],
    "correctAnswer": "FC18H",
    "ka": "6.1.4",
    "chapter": 6,
    "explanation": "1ms对应1000次计数，16位初值为65536−1000=64536=FC18H。该计算未包含软件重装和中断延迟。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "定时初值计算",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 449,
    "type": "multiple-choice",
    "questionText": "经典12T、12MHz、模式1初值为D8F0H时，理想溢出间隔是多少？",
    "options": [
      "20ms",
      "10ms",
      "50ms",
      "100ms"
    ],
    "correctAnswer": "10ms",
    "ka": "6.1.4",
    "chapter": 6,
    "explanation": "D8F0H=55536，距65536有10000次计数；每次1μs，所以理想间隔10ms，不包含软件开销。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "定时初值计算",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 450,
    "type": "multiple-choice",
    "questionText": "算出16位初值B1E0H后，TH0与TL0应分别装入什么？",
    "options": [
      "TH0=E0H，TL0=B1H",
      "TH0=B1H，TL0=B1H",
      "TH0=B1H，TL0=E0H",
      "TH0=00H，TL0=E0H"
    ],
    "correctAnswer": "TH0=B1H，TL0=E0H",
    "ka": "6.1.4",
    "chapter": 6,
    "explanation": "TH0保存高字节B1H，TL0保存低字节E0H。颠倒高低字节会改变计数起点，使实际间隔与预期不同。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "定时初值计算",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 451,
    "type": "multiple-choice",
    "questionText": "模式1的16位定时器从0000H开始到溢出，一共需要多少次计数？",
    "options": [
      "65535次",
      "256次",
      "8192次",
      "65536次"
    ],
    "correctAnswer": "65536次",
    "ka": "6.2.2",
    "chapter": 6,
    "explanation": "16位状态共有2的16次方即65536个。由0000H计到FFFFH后下一次回到0000H产生溢出，不能少计一次。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "定时初值计算",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 452,
    "type": "multiple-choice",
    "questionText": "经典12T、12MHz的模式1要单次定时100ms，只写一组16位初值是否足够？",
    "options": [
      "不足，100000次计数超出65536，需要分段累计等办法",
      "足够，只要把初值写成负数",
      "足够，16位可以容纳100000个不同计数值",
      "改写SBUF即可延长定时器位数"
    ],
    "correctAnswer": "不足，100000次计数超出65536，需要分段累计等办法",
    "ka": "6.2.2",
    "chapter": 6,
    "explanation": "在题设条件下100ms需100000次计数，超过单个16位计数周期。应采用软件分段等方案，不能把超范围值强装入寄存器。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "定时初值计算",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 453,
    "type": "multiple-choice",
    "questionText": "模式1溢出后要重复得到按同一非零初值计算的周期，通常需要做什么？",
    "options": [
      "硬件必然从原非零初值自动重装",
      "按方案重新装入TH和TL，并计入软件开销",
      "只改串口波特率",
      "关闭EA后所有定时误差自动消失"
    ],
    "correctAnswer": "按方案重新装入TH和TL，并计入软件开销",
    "ka": "6.2.2",
    "chapter": 6,
    "explanation": "模式1不提供模式2那样的自动重装；重复定时通常需软件重新装入初值，实际周期还要考虑中断响应和重装耗时。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "定时初值计算",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 454,
    "type": "multiple-choice",
    "questionText": "模式2的“8位自动重装”主要解决什么问题？",
    "options": [
      "把定时器扩展成32位",
      "把所有中断自动变为高优先级",
      "溢出后由硬件装回预置值以重复计数",
      "自动把二进制转成十进制"
    ],
    "correctAnswer": "溢出后由硬件装回预置值以重复计数",
    "ka": "6.2.3",
    "chapter": 6,
    "explanation": "模式2在8位计数溢出后自动重装，使周期性短定时无需每次软件写回相同初值；它不改变中断优先级或数制。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "定时初值计算",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 455,
    "type": "multiple-choice",
    "questionText": "经典12T、12MHz下，模式2理想定时200μs，重装初值是多少？",
    "options": [
      "C8H",
      "FFH",
      "00H",
      "38H"
    ],
    "correctAnswer": "38H",
    "ka": "6.2.3",
    "chapter": 6,
    "explanation": "模式2每周期有256个计数状态，题设1μs一次，初值256−200=56=38H。C8H是200本身，不是所需初值。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "定时初值计算",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 456,
    "type": "multiple-choice",
    "questionText": "经典12T、12MHz下，模式2单次计数周期最大约是多少？",
    "options": [
      "256μs",
      "65536μs",
      "256ms",
      "12s"
    ],
    "correctAnswer": "256μs",
    "ka": "6.2.3",
    "chapter": 6,
    "explanation": "8位计数最大256次，题设每次1μs，所以最大周期256μs。65536次是模式1的16位计数范围。",
    "source": {
      "kind": "guide",
      "title": "实验3网页指导",
      "experimentId": "exp03",
      "section": "定时初值计算",
      "url": "/simulation?experiment=exp03&view=guide"
    }
  },
  {
    "id": 457,
    "type": "multiple-choice",
    "questionText": "用定时器每次溢出翻转一次引脚，要生成1kHz对称方波，理想翻转间隔应为多少？",
    "options": [
      "1ms",
      "500μs",
      "2ms",
      "250μs"
    ],
    "correctAnswer": "500μs",
    "ka": "6.3.2",
    "chapter": 6,
    "explanation": "翻转一次只完成半个周期，1kHz周期为1ms，因此每500μs翻转一次。把整周期当翻转间隔会使频率减半。",
    "source": {
      "kind": "guide",
      "title": "实验7网页指导",
      "experimentId": "exp07",
      "section": "音频频率与音调",
      "url": "/simulation?experiment=exp07&view=guide"
    }
  },
  {
    "id": 458,
    "type": "multiple-choice",
    "questionText": "把方波引脚的翻转间隔从1ms改为2ms，输出频率如何变化？",
    "options": [
      "由1kHz升为2kHz",
      "保持500Hz",
      "由500Hz降为250Hz",
      "由250Hz升为500Hz"
    ],
    "correctAnswer": "由500Hz降为250Hz",
    "ka": "6.3.2",
    "chapter": 6,
    "explanation": "对称方波周期是两次翻转间隔之和。2×1ms对应500Hz，2×2ms对应250Hz，间隔加倍使频率减半。",
    "source": {
      "kind": "guide",
      "title": "实验7网页指导",
      "experimentId": "exp07",
      "section": "音频频率与音调",
      "url": "/simulation?experiment=exp07&view=guide"
    }
  },
  {
    "id": 459,
    "type": "multiple-choice",
    "questionText": "实验7把无源蜂鸣器的驱动方波频率加倍，按所述音阶关系属于什么变化？",
    "options": [
      "降低一个八度",
      "只改变发声时长而音调不变",
      "自动变成休止符",
      "提高一个八度"
    ],
    "correctAnswer": "提高一个八度",
    "ka": "6.3.2",
    "chapter": 6,
    "explanation": "实验7给出高音为频率乘2、低音为频率除2；频率决定音调，发声持续多久则由节拍控制。",
    "source": {
      "kind": "guide",
      "title": "实验7网页指导",
      "experimentId": "exp07",
      "section": "音频频率与音调",
      "url": "/simulation?experiment=exp07&view=guide"
    }
  },
  {
    "id": 460,
    "type": "multiple-choice",
    "questionText": "周期4ms、每周期高电平1ms的PWM，占空比是多少？",
    "options": [
      "25%",
      "75%",
      "4%",
      "400%"
    ],
    "correctAnswer": "25%",
    "ka": "6.3.3",
    "chapter": 6,
    "explanation": "占空比定义为高电平时间除以完整周期，1ms/4ms=0.25，即25%；低电平所占的75%不是本题定义的占空比。",
    "source": {
      "kind": "guide",
      "title": "项目2网页指导",
      "experimentId": "proj02",
      "section": "PWM 脉宽调制原理",
      "url": "/simulation?experiment=proj02&view=guide"
    }
  },
  {
    "id": 461,
    "type": "multiple-choice",
    "questionText": "理想0—5V方波占空比为40%，按项目2的平均电压公式，平均值是多少？",
    "options": [
      "5V",
      "2V",
      "3V",
      "0.4V"
    ],
    "correctAnswer": "2V",
    "ka": "6.3.3",
    "chapter": 6,
    "explanation": "按理想平均电压Vavg=Vcc×占空比，5×0.4=2V；该算例不等同于实物LED亮度或电机转速的线性保证。",
    "source": {
      "kind": "guide",
      "title": "项目2网页指导",
      "experimentId": "proj02",
      "section": "PWM 脉宽调制原理",
      "url": "/simulation?experiment=proj02&view=guide"
    }
  },
  {
    "id": 462,
    "type": "multiple-choice",
    "questionText": "项目2以1ms中断、256个计数档位演示PWM，一个完整周期及频率约是多少？",
    "options": [
      "1ms、1kHz",
      "256μs、3.91kHz",
      "256ms、3.91Hz",
      "16ms、62.5Hz"
    ],
    "correctAnswer": "256ms、3.91Hz",
    "ka": "6.3.3",
    "chapter": 6,
    "explanation": "256个1ms时间片构成256ms周期，频率约为1000/256=3.91Hz。指导明确该低频用于观察，会闪烁，不能直接当实物照明设计。",
    "source": {
      "kind": "guide",
      "title": "项目2网页指导",
      "experimentId": "proj02",
      "section": "PWM 脉宽调制原理",
      "url": "/simulation?experiment=proj02&view=guide"
    }
  },
  {
    "id": 463,
    "type": "multiple-choice",
    "questionText": "实验6用50ms基础中断合成1s，需要累计多少次？",
    "options": [
      "2次",
      "10次",
      "50次",
      "20次"
    ],
    "correctAnswer": "20次",
    "ka": "6.3.5",
    "chapter": 6,
    "explanation": "1s=1000ms，1000/50=20，因此累计20次基础中断得到名义1s；实际计时还需考虑重装等软件开销。",
    "source": {
      "kind": "guide",
      "title": "实验6网页指导",
      "experimentId": "exp06",
      "section": "双定时器协同工作",
      "url": "/simulation?experiment=exp06&view=guide"
    }
  },
  {
    "id": 464,
    "type": "multiple-choice",
    "questionText": "若50ms软件计数器从0开始，每次先加1，却在等于19时认作1s，会出现什么？",
    "options": [
      "只累计950ms，少一个50ms周期",
      "准确累计1000ms",
      "累计1050ms",
      "无法发生任何中断"
    ],
    "correctAnswer": "只累计950ms，少一个50ms周期",
    "ka": "6.3.5",
    "chapter": 6,
    "explanation": "先加1再判断等于19意味着经历19次中断，即19×50=950ms。计数起点与判断顺序必须一致，不能只看终值名称。",
    "source": {
      "kind": "guide",
      "title": "实验6网页指导",
      "experimentId": "exp06",
      "section": "双定时器协同工作",
      "url": "/simulation?experiment=exp06&view=guide"
    }
  },
  {
    "id": 465,
    "type": "multiple-choice",
    "questionText": "基础50ms定时每次存在同向0.1ms额外开销，累计20次且未补偿时，名义1s约多出多少时间？",
    "options": [
      "0.1ms",
      "2ms",
      "20ms",
      "200ms"
    ],
    "correctAnswer": "2ms",
    "ka": "6.3.5",
    "chapter": 6,
    "explanation": "同向误差会随累计次数相加，20×0.1ms=2ms。软件累计增加可计时范围，但不会自动消除每段周期误差。",
    "source": {
      "kind": "guide",
      "title": "实验6网页指导",
      "experimentId": "exp06",
      "section": "双定时器协同工作",
      "url": "/simulation?experiment=exp06&view=guide"
    }
  },
  {
    "id": 466,
    "type": "multiple-choice",
    "questionText": "按实验4的共阴段码表，数字1需要点亮哪些段？",
    "options": [
      "a和d",
      "f和g",
      "b和c",
      "全部七段"
    ],
    "correctAnswer": "b和c",
    "ka": "8.1.1",
    "chapter": 8,
    "explanation": "实验4用a—g标注七段结构，数字1的段码06H对应b、c两段点亮；段码含义还依赖该表约定的位序。",
    "source": {
      "kind": "guide",
      "title": "实验4网页指导",
      "experimentId": "exp04",
      "section": "七段数码管原理",
      "url": "/simulation?experiment=exp04&view=guide"
    }
  },
  {
    "id": 467,
    "type": "multiple-choice",
    "questionText": "采用实验4相同段位顺序且dp关闭，共阴数字0段码3FH逐位取反后，共阳段码是多少？",
    "options": [
      "3FH",
      "7FH",
      "00H",
      "C0H"
    ],
    "correctAnswer": "C0H",
    "ka": "8.1.1",
    "chapter": 8,
    "explanation": "共阴高电平点亮，共阳在相同位序下低电平点亮；3FH按8位取反为C0H，其中dp位也保持关闭。",
    "source": {
      "kind": "guide",
      "title": "实验4网页指导",
      "experimentId": "exp04",
      "section": "七段数码管原理",
      "url": "/simulation?experiment=exp04&view=guide"
    }
  },
  {
    "id": 468,
    "type": "multiple-choice",
    "questionText": "把共阴数码管表直接用于同位序的共阳数码管，主要需修正什么？",
    "options": [
      "段输出的有效电平极性",
      "数字的十进制值",
      "程序使用的所有RAM地址",
      "只修改屏幕字体"
    ],
    "correctAnswer": "段输出的有效电平极性",
    "ka": "8.1.1",
    "chapter": 8,
    "explanation": "共阴与共阳的差别在公共端和点亮电平极性；相同段位映射下需反转相应段驱动极性，不能只改显示样式。",
    "source": {
      "kind": "guide",
      "title": "实验4网页指导",
      "experimentId": "exp04",
      "section": "七段数码管原理",
      "url": "/simulation?experiment=exp04&view=guide"
    }
  },
  {
    "id": 469,
    "type": "multiple-choice",
    "questionText": "四位数码管每位显示2ms，忽略切换开销，一轮扫描时间与刷新率分别是多少？",
    "options": [
      "2ms、500Hz",
      "8ms、125Hz",
      "4ms、250Hz",
      "16ms、62.5Hz"
    ],
    "correctAnswer": "8ms、125Hz",
    "ka": "8.1.2",
    "chapter": 8,
    "explanation": "一轮要依次经过四位，4×2ms=8ms，刷新率1/0.008=125Hz；不能把单个位显示时间当成整屏周期。",
    "source": {
      "kind": "guide",
      "title": "实验4网页指导",
      "experimentId": "exp04",
      "section": "动态扫描技术",
      "url": "/simulation?experiment=exp04&view=guide"
    }
  },
  {
    "id": 470,
    "type": "multiple-choice",
    "questionText": "实验4在换段码前先关闭所有位选，主要目的是什么？",
    "options": [
      "把程序存储器清空",
      "改变晶振频率",
      "减少切换时错误段码造成的重影",
      "提高LED允许最大电流"
    ],
    "correctAnswer": "减少切换时错误段码造成的重影",
    "ka": "8.1.2",
    "chapter": 8,
    "explanation": "消隐使所有显示位先关闭，再更新段码并打开新位，避免旧位在段码切换期间显示新位数据形成重影。",
    "source": {
      "kind": "guide",
      "title": "实验4网页指导",
      "experimentId": "exp04",
      "section": "动态扫描技术",
      "url": "/simulation?experiment=exp04&view=guide"
    }
  },
  {
    "id": 471,
    "type": "multiple-choice",
    "questionText": "动态扫描时只维持某一位的位选而不再轮换，会怎样？",
    "options": [
      "四位仍自动独立刷新",
      "硬件自动把数值复制到全部位",
      "只影响串口波特率",
      "其余位无法按预定轮流刷新"
    ],
    "correctAnswer": "其余位无法按预定轮流刷新",
    "ka": "8.1.2",
    "chapter": 8,
    "explanation": "动态显示依靠程序轮流输出每位段码并选择对应显示位。停止轮换会破坏其他位的刷新，不存在自动保持整屏的机制。",
    "source": {
      "kind": "guide",
      "title": "实验4网页指导",
      "experimentId": "exp04",
      "section": "动态扫描技术",
      "url": "/simulation?experiment=exp04&view=guide"
    }
  },
  {
    "id": 472,
    "type": "multiple-choice",
    "questionText": "在项目2的LCD1602阅读指导中，RS=0与RS=1分别表示什么？",
    "options": [
      "指令与字符数据",
      "读与写",
      "第一行与第二行",
      "开电源与断电源"
    ],
    "correctAnswer": "指令与字符数据",
    "ka": "8.1.3",
    "chapter": 8,
    "explanation": "指导把RS定义为寄存器选择：0选择指令、1选择数据；读写方向由RW控制，不能将这两个控制信号混淆。",
    "source": {
      "kind": "guide",
      "title": "项目2网页指导",
      "experimentId": "proj02",
      "section": "LCD1602 液晶显示原理",
      "url": "/simulation?experiment=proj02&view=guide"
    }
  },
  {
    "id": 473,
    "type": "multiple-choice",
    "questionText": "按项目2的LCD1602地址表，设置第二行起始显示位置用哪个指令？",
    "options": [
      "80H",
      "C0H",
      "01H",
      "38H"
    ],
    "correctAnswer": "C0H",
    "ka": "8.1.3",
    "chapter": 8,
    "explanation": "第二行显示RAM起始地址为40H，置DDRAM地址指令带80H标志，因此为C0H。80H对应第一行起始位置。",
    "source": {
      "kind": "guide",
      "title": "项目2网页指导",
      "experimentId": "proj02",
      "section": "LCD1602 液晶显示原理",
      "url": "/simulation?experiment=proj02&view=guide"
    }
  },
  {
    "id": 474,
    "type": "multiple-choice",
    "questionText": "按LCD1602指导，清屏指令01H与字符数据应如何区分发送？",
    "options": [
      "两者均必须RS=1",
      "两者均通过修改晶振发送",
      "清屏时RS=0，字符数据时RS=1",
      "用P3.2电平直接替代指令内容"
    ],
    "correctAnswer": "清屏时RS=0，字符数据时RS=1",
    "ka": "8.1.3",
    "chapter": 8,
    "explanation": "同样的总线字节在指令与数据寄存器中的意义不同。清屏是控制指令、字符是显示数据，应以RS选择正确目标；此处是接口阅读题。",
    "source": {
      "kind": "guide",
      "title": "项目2网页指导",
      "experimentId": "proj02",
      "section": "LCD1602 液晶显示原理",
      "url": "/simulation?experiment=proj02&view=guide"
    }
  },
  {
    "id": 475,
    "type": "multiple-choice",
    "questionText": "实验5读取P3低4位为1101B时，对应哪个独立按键？",
    "options": [
      "键0",
      "键2",
      "全部松开",
      "键1"
    ],
    "correctAnswer": "键1",
    "ka": "8.2.1",
    "chapter": 8,
    "explanation": "实验5按位低有效，1101B仅bit1为0，因此对应键1；1111B才表示四路均松开。",
    "source": {
      "kind": "guide",
      "title": "实验5网页指导",
      "experimentId": "exp05",
      "section": "四路独立按键与同键确认",
      "url": "/simulation?experiment=exp05&view=guide"
    }
  },
  {
    "id": 476,
    "type": "multiple-choice",
    "questionText": "实验5中第一次读到键0、延时后读到键1，应如何处理候选？",
    "options": [
      "拒绝本次候选，等待稳定松开后再检测",
      "把两次读数视为同一有效键",
      "自动累计两次按键",
      "将第二次读数强行改成键0"
    ],
    "correctAnswer": "拒绝本次候选，等待稳定松开后再检测",
    "ka": "8.2.1",
    "chapter": 8,
    "explanation": "指导要求两次采样为同一单键，换键不满足确认条件。拒绝后还需等待稳定全松开，避免候选状态串入下一次操作。",
    "source": {
      "kind": "guide",
      "title": "实验5网页指导",
      "experimentId": "exp05",
      "section": "四路独立按键与同键确认",
      "url": "/simulation?experiment=exp05&view=guide"
    }
  },
  {
    "id": 477,
    "type": "multiple-choice",
    "questionText": "实验5读到0011B，即两路输入同时为低，应如何解释？",
    "options": [
      "一定是键0",
      "同时多键，不作为有效单键",
      "一定是全部松开",
      "自动完成16键矩阵扫描"
    ],
    "correctAnswer": "同时多键，不作为有效单键",
    "ka": "8.2.1",
    "chapter": 8,
    "explanation": "当前程序只接受四种单低位组合，0011B含两位低电平，因此属于多键组合。它不等于矩阵键盘的某个独立键码。",
    "source": {
      "kind": "guide",
      "title": "实验5网页指导",
      "experimentId": "exp05",
      "section": "四路独立按键与同键确认",
      "url": "/simulation?experiment=exp05&view=guide"
    }
  },
  {
    "id": 478,
    "type": "multiple-choice",
    "questionText": "4×4矩阵键盘按4行4列接线，共有多少个按键交点、占用多少条行列线？",
    "options": [
      "8个交点、16条线",
      "4个交点、4条线",
      "16个交点、8条线",
      "16个交点、16条线"
    ],
    "correctAnswer": "16个交点、8条线",
    "ka": "8.2.2",
    "chapter": 8,
    "explanation": "四行与四列两两形成4×4=16个交点，行列信号总数4+4=8；这正是矩阵接法节省端口线的原因。",
    "source": {
      "kind": "guide",
      "title": "实验5网页指导",
      "experimentId": "exp05",
      "section": "实物拓展：4×4矩阵键盘",
      "url": "/simulation?experiment=exp05&view=guide"
    }
  },
  {
    "id": 479,
    "type": "multiple-choice",
    "questionText": "按指导以0起算行列编号，键值=行号×4+列号，第2行第3列的键值是多少？",
    "options": [
      "23",
      "10",
      "6",
      "11"
    ],
    "correctAnswer": "11",
    "ka": "8.2.2",
    "chapter": 8,
    "explanation": "采用题设零起算编码，2×4+3=11。若行列用1起算则必须先转换，不能把两种编号规则混用。",
    "source": {
      "kind": "guide",
      "title": "实验5网页指导",
      "experimentId": "exp05",
      "section": "实物拓展：4×4矩阵键盘",
      "url": "/simulation?experiment=exp05&view=guide"
    }
  },
  {
    "id": 480,
    "type": "multiple-choice",
    "questionText": "用当前实验5的四个独立按钮，能否证明16键矩阵扫描接线已经验证？",
    "options": [
      "不能，当前输入没有行列交点联动模型",
      "能，四个按钮代表所有16个交点",
      "能，只需把按钮名字改成矩阵键",
      "能，任何低电平都能证明矩阵扫描正确"
    ],
    "correctAnswer": "不能，当前输入没有行列交点联动模型",
    "ka": "8.2.2",
    "chapter": 8,
    "explanation": "指导明确当前按钮仅向P3注入独立电平，没有P1行线与交点连通模型。矩阵阅读与当前仿真可验证的范围必须区分。",
    "source": {
      "kind": "guide",
      "title": "实验5网页指导",
      "experimentId": "exp05",
      "section": "实物拓展：4×4矩阵键盘",
      "url": "/simulation?experiment=exp05&view=guide"
    }
  },
  {
    "id": 481,
    "type": "multiple-choice",
    "questionText": "实验5同键确认后仍等待松开，并再次延时检查全高，主要避免什么？",
    "options": [
      "所有中断永远关闭",
      "一次持续按住或释放抖动被多次计数",
      "串口波特率改变",
      "寄存器组自动增加"
    ],
    "correctAnswer": "一次持续按住或释放抖动被多次计数",
    "ka": "8.2.3",
    "chapter": 8,
    "explanation": "确认按下后再检查稳定释放，可把一次按压过程与下一次检测分开；仅重复读取按住电平会把同一次动作计成多次。",
    "source": {
      "kind": "guide",
      "title": "实验5网页指导",
      "experimentId": "exp05",
      "section": "四路独立按键与同键确认",
      "url": "/simulation?experiment=exp05&view=guide"
    }
  },
  {
    "id": 482,
    "type": "multiple-choice",
    "questionText": "实验5的延时按12MHz、12T计算约20.313ms，是否可用可调速仿真画面的墙钟时间直接验证？",
    "options": [
      "可以，任何运行速度都等于实物时间",
      "可以，只要浏览器窗口足够大",
      "不能，仿真按机器周期计时但画面速度可调，墙钟时间不等于模型时间",
      "可以，用截图文件大小换算时间"
    ],
    "correctAnswer": "不能，仿真按机器周期计时但画面速度可调，墙钟时间不等于模型时间",
    "ka": "8.2.3",
    "chapter": 8,
    "explanation": "仿真按机器周期计时（12MHz、12T 下 1 机器周期 = 1μs），可用定时器读数核对这段延时的 20313 个机器周期；但画面运行速度可调，屏幕上的墙钟耗时不能作为实物消抖延时的依据。",
    "source": {
      "kind": "guide",
      "title": "实验5网页指导",
      "experimentId": "exp05",
      "section": "消抖延时的条件与寄存器保护",
      "url": "/simulation?experiment=exp05&view=guide"
    }
  },
  {
    "id": 483,
    "type": "multiple-choice",
    "questionText": "两次采样得到相同按键值，能否据此断定实物触点在两次采样之间完全没有抖动？",
    "options": [
      "能，两个采样已覆盖连续波形",
      "能，延时名称含20ms就足够",
      "能，不需要任何实际测量",
      "不能，只能确认两个采样时刻的状态相同"
    ],
    "correctAnswer": "不能，只能确认两个采样时刻的状态相同",
    "ka": "8.2.3",
    "chapter": 8,
    "explanation": "离散的两次相同读数不包含两次采样之间的完整波形。指导要求实物测量触点抖动并据此调整消抖间隔。",
    "source": {
      "kind": "guide",
      "title": "实验5网页指导",
      "experimentId": "exp05",
      "section": "消抖延时的条件与寄存器保护",
      "url": "/simulation?experiment=exp05&view=guide"
    }
  },
  {
    "id": 484,
    "type": "multiple-choice",
    "questionText": "按项目2指导，ADC0809用哪种转换结构处理模拟量？",
    "options": [
      "8位逐次逼近转换",
      "仅用串口停止位计数",
      "16位浮点乘法转换",
      "液晶字符编码转换"
    ],
    "correctAnswer": "8位逐次逼近转换",
    "ka": "8.3.1",
    "chapter": 8,
    "explanation": "指导将ADC0809说明为8位逐次逼近型模数转换器，并列出比较器、DAC和寄存器组成，不能把它当成其他外设。",
    "source": {
      "kind": "guide",
      "title": "项目2网页指导",
      "experimentId": "proj02",
      "section": "ADC0809 模数转换原理",
      "url": "/simulation?experiment=proj02&view=guide"
    }
  },
  {
    "id": 485,
    "type": "multiple-choice",
    "questionText": "ADC0809的START上升沿与下降沿在指导中分别承担什么？",
    "options": [
      "上升沿读数据，下降沿选通LCD",
      "上升沿复位逐次逼近寄存器，下降沿开始转换",
      "两条边沿都只改变UART波特率",
      "下降沿复位、上升沿固定表示转换完成"
    ],
    "correctAnswer": "上升沿复位逐次逼近寄存器，下降沿开始转换",
    "ka": "8.3.1",
    "chapter": 8,
    "explanation": "项目2按器件时序区分START两条边沿的职责，启动与转换完成是不同事件；完成状态由EOC配合时序判断。",
    "source": {
      "kind": "guide",
      "title": "项目2网页指导",
      "experimentId": "proj02",
      "section": "ADC0809 模数转换原理",
      "url": "/simulation?experiment=proj02&view=guide"
    }
  },
  {
    "id": 486,
    "type": "multiple-choice",
    "questionText": "启动ADC0809后立即看到EOC为高，是否足以证明刚启动的这次转换已完成？",
    "options": [
      "足够，EOC没有任何启动延迟",
      "足够，只要OE一直为1",
      "不足，应确认进入忙状态后再等待完成，并设超时",
      "足够，输入通道号就是转换完成标志"
    ],
    "correctAnswer": "不足，应确认进入忙状态后再等待完成，并设超时",
    "ka": "8.3.1",
    "chapter": 8,
    "explanation": "指导说明EOC不会立即变低，开始时高电平可能属于前一状态。应识别本次忙到完成的过程并设置超时，避免读旧数据。",
    "source": {
      "kind": "guide",
      "title": "项目2网页指导",
      "experimentId": "proj02",
      "section": "ADC0809 模数转换原理",
      "url": "/simulation?experiment=proj02&view=guide"
    }
  },
  {
    "id": 487,
    "type": "multiple-choice",
    "questionText": "ADC0809为8位、参考范围0—5V，按指导q=范围/256计算，量化步长约是多少？",
    "options": [
      "5mV",
      "256mV",
      "0.01953μV",
      "19.53mV"
    ],
    "correctAnswer": "19.53mV",
    "ka": "8.3.4",
    "chapter": 8,
    "explanation": "量化步长为5V/256=0.01953125V，约19.53mV。本题采用指导中的256级定义，不以255作步长分母。",
    "source": {
      "kind": "guide",
      "title": "项目2网页指导",
      "experimentId": "proj02",
      "section": "ADC0809 模数转换原理",
      "url": "/simulation?experiment=proj02&view=guide"
    }
  },
  {
    "id": 488,
    "type": "multiple-choice",
    "questionText": "8位ADC的输出码有效范围是什么？",
    "options": [
      "0—255",
      "0—256",
      "1—256",
      "0—65535"
    ],
    "correctAnswer": "0—255",
    "ka": "8.3.4",
    "chapter": 8,
    "explanation": "8位只能表示256种整数状态，从0起算的最大码为255；即使输入达到参考上端，也不能输出不存在的256码。",
    "source": {
      "kind": "guide",
      "title": "项目2网页指导",
      "experimentId": "proj02",
      "section": "ADC0809 模数转换原理",
      "url": "/simulation?experiment=proj02&view=guide"
    }
  },
  {
    "id": 489,
    "type": "multiple-choice",
    "questionText": "ADC0809在给定时钟条件下典型转换时间100μs，能否直接把它当作所有系统的固定采样周期？",
    "options": [
      "能，任何时钟都固定100μs",
      "不能，需考虑时钟、转换条件、控制开销与输入稳定性",
      "能，界面每次刷新就是一次100μs采样",
      "能，通道数越多转换时间自动归零"
    ],
    "correctAnswer": "不能，需考虑时钟、转换条件、控制开销与输入稳定性",
    "ka": "8.3.4",
    "chapter": 8,
    "explanation": "指导把100μs限定为指定时钟下的典型转换时间，不是通用软件等待值；实际采样周期还包含控制与读数开销。",
    "source": {
      "kind": "guide",
      "title": "项目2网页指导",
      "experimentId": "proj02",
      "section": "ADC0809 模数转换原理",
      "url": "/simulation?experiment=proj02&view=guide"
    }
  },
  {
    "id": 490,
    "type": "multiple-choice",
    "questionText": "按项目4的12位DS18B20温度格式，原始值0191H对应多少摄氏度？",
    "options": [
      "401°C",
      "19.1°C",
      "25.0625°C",
      "1.91°C"
    ],
    "correctAnswer": "25.0625°C",
    "ka": "8.4.1",
    "chapter": 8,
    "explanation": "0191H=401，12位配置的单位为0.0625°C，因此401×0.0625=25.0625°C；不能直接把原始整数当摄氏度。",
    "source": {
      "kind": "guide",
      "title": "项目4网页指导",
      "experimentId": "proj04",
      "section": "DS18B20 单总线温度传感器",
      "url": "/simulation?experiment=proj04&view=guide"
    }
  },
  {
    "id": 491,
    "type": "multiple-choice",
    "questionText": "12位DS18B20读到FF5EH，按16位符号扩展补码应得到什么温度？",
    "options": [
      "4085.875°C",
      "10.125°C",
      "−162°C",
      "−10.125°C"
    ],
    "correctAnswer": "−10.125°C",
    "ka": "8.4.1",
    "chapter": 8,
    "explanation": "FF5EH按无符号为65374，先减65536得−162，再乘0.0625得到−10.125°C。必须先正确解释符号，不能直接乘无符号值。",
    "source": {
      "kind": "guide",
      "title": "项目4网页指导",
      "experimentId": "proj04",
      "section": "DS18B20 单总线温度传感器",
      "url": "/simulation?experiment=proj04&view=guide"
    }
  },
  {
    "id": 492,
    "type": "multiple-choice",
    "questionText": "多个DS18B20同挂一根总线读取某一个器件时，应怎样选择ROM命令策略？",
    "options": [
      "按目标地址选择器件，不能把单器件读ROM命令直接套用",
      "所有器件都用33H同时返回即可无冲突",
      "只改变温度单位就能区分器件",
      "不用器件地址，每次结果必然属于同一只"
    ],
    "correctAnswer": "按目标地址选择器件，不能把单器件读ROM命令直接套用",
    "ka": "8.4.1",
    "chapter": 8,
    "explanation": "指导明确33H读ROM只用于单器件，总线上多器件读取须选择目标地址；否则多个响应可能冲突，无法可靠归属温度数据。",
    "source": {
      "kind": "guide",
      "title": "项目4网页指导",
      "experimentId": "proj04",
      "section": "DS18B20 单总线温度传感器",
      "url": "/simulation?experiment=proj04&view=guide"
    }
  },
  {
    "id": 493,
    "type": "multiple-choice",
    "questionText": "按实验7的蜂鸣器类型说明，只通断直流电源即可按固有频率发声的是哪一种？",
    "options": [
      "无源蜂鸣器一定如此",
      "有源蜂鸣器",
      "任何七段数码管",
      "仅LCD1602"
    ],
    "correctAnswer": "有源蜂鸣器",
    "ka": "8.6.1",
    "chapter": 8,
    "explanation": "有源蜂鸣器内置振荡，外部只需控制通断；无源蜂鸣器要由外部方波驱动。两者都还需按负载要求选择驱动级。",
    "source": {
      "kind": "guide",
      "title": "实验7网页指导",
      "experimentId": "exp07",
      "section": "音频频率与音调",
      "url": "/simulation?experiment=exp07&view=guide"
    }
  },
  {
    "id": 494,
    "type": "multiple-choice",
    "questionText": "希望用蜂鸣器输出不同音高，按实验7应优先采用哪种方式？",
    "options": [
      "仅对有源蜂鸣器延长直流通电时间",
      "修改显示页面字体",
      "以不同频率方波驱动无源蜂鸣器",
      "只改变段码表地址"
    ],
    "correctAnswer": "以不同频率方波驱动无源蜂鸣器",
    "ka": "8.6.1",
    "chapter": 8,
    "explanation": "实验7说明无源蜂鸣器的驱动频率决定音调，持续时间控制节拍；延长有源蜂鸣器通电一般不能据此获得任意音高。",
    "source": {
      "kind": "guide",
      "title": "实验7网页指导",
      "experimentId": "exp07",
      "section": "音频频率与音调",
      "url": "/simulation?experiment=exp07&view=guide"
    }
  },
  {
    "id": 495,
    "type": "multiple-choice",
    "questionText": "在项目4的I2C扩展阅读中，SDA与SCL分别承担什么？",
    "options": [
      "电源与地",
      "串口发送与接收两条独立数据线",
      "高8位地址与低8位地址",
      "双向数据与时钟"
    ],
    "correctAnswer": "双向数据与时钟",
    "ka": "7.4.4",
    "chapter": 7,
    "explanation": "指导把SDA作为双向数据线、SCL作为时钟线；它与UART的TXD/RXD两条异步数据线不同。",
    "source": {
      "kind": "guide",
      "title": "项目4网页指导",
      "experimentId": "proj04",
      "section": "扩展参考｜AT24C02 I2C EEPROM 存储",
      "url": "/simulation?experiment=proj04&view=guide"
    }
  },
  {
    "id": 496,
    "type": "multiple-choice",
    "questionText": "按项目4地址示例，AT24C02的A2=A1=A0=0时，写控制字节和读控制字节分别是什么？",
    "options": [
      "A0H与A1H",
      "50H与51H",
      "00H与01H",
      "A1H与A0H"
    ],
    "correctAnswer": "A0H与A1H",
    "ka": "7.4.4",
    "chapter": 7,
    "explanation": "指导给出8位控制字节1010 A2 A1 A0 R/W；地址脚全0时写为A0H、读为A1H，勿与7位器件地址50H混用。",
    "source": {
      "kind": "guide",
      "title": "项目4网页指导",
      "experimentId": "proj04",
      "section": "扩展参考｜AT24C02 I2C EEPROM 存储",
      "url": "/simulation?experiment=proj04&view=guide"
    }
  },
  {
    "id": 497,
    "type": "multiple-choice",
    "questionText": "项目4列出AT24C02读写时序，是否意味着当前仿真已完成EEPROM持久存储验证？",
    "options": [
      "是，只要页面出现芯片名称",
      "不是，该节为独立扩展阅读，不计入当前完成判定",
      "是，UART上报就等同EEPROM写入",
      "是，不需要断电保持或读回检查"
    ],
    "correctAnswer": "不是，该节为独立扩展阅读，不计入当前完成判定",
    "ka": "7.4.4",
    "chapter": 7,
    "explanation": "该节明确属于扩展参考。掌握总线时序与实际完成器件读写、断电保持验证不同，不能把阅读材料当成已运行结果。",
    "source": {
      "kind": "guide",
      "title": "项目4网页指导",
      "experimentId": "proj04",
      "section": "扩展参考｜AT24C02 I2C EEPROM 存储",
      "url": "/simulation?experiment=proj04&view=guide"
    }
  },


  // 主题级整合题：考查同一主题下各知识单元之间的辨析与联系，直接挂在二级主题上。
  {
    "id": 498,
    "type": "multiple-choice",
    "questionText": "下列四条指令中，操作数直接包含在指令内部、不需要再访问存储器的是哪一条？",
    "options": ["MOV A, #30H", "MOV A, 30H", "MOV A, @R0", "MOVC A, @A+DPTR"],
    "correctAnswer": "MOV A, #30H",
    "ka": "3.1",
    "chapter": 3,
    "explanation": "立即寻址的操作数写在指令里（#30H 就是数据本身）；后三条分别是直接寻址、寄存器间接寻址和变址寻址，都要再去存储器取数。"
  },
  {
    "id": 499,
    "type": "multiple-choice",
    "questionText": "指令 `MOV A, 30H` 与 `MOV A, #30H` 的本质区别是什么？",
    "options": ["前者取片内RAM 30H单元的内容，后者取常数30H", "两条完全等价，写法不同而已", "前者取常数30H，后者取30H单元的内容", "前者访问片外RAM，后者访问片内RAM"],
    "correctAnswer": "前者取片内RAM 30H单元的内容，后者取常数30H",
    "ka": "3.1",
    "chapter": 3,
    "explanation": "一个井号之差就改变了寻址方式：不带#是直接寻址，给的是地址；带#是立即寻址，给的是数据本身。"
  },
  {
    "id": 500,
    "type": "multiple-choice",
    "questionText": "访问片外数据存储器时，89C51 只能采用下列哪一类寻址方式？",
    "options": ["寄存器间接寻址", "直接寻址", "立即寻址", "位寻址"],
    "correctAnswer": "寄存器间接寻址",
    "ka": "3.1",
    "chapter": 3,
    "explanation": "片外RAM只能用 MOVX 配合 @DPTR 或 @Ri 访问，属于寄存器间接寻址；直接寻址只能访问片内RAM与SFR。"
  },
  {
    "id": 501,
    "type": "multiple-choice",
    "questionText": "89C51 响应中断时，硬件自动完成的动作是什么？",
    "options": ["把断点地址（PC）压入堆栈，并转向中断入口地址", "把PC和PSW一起压入堆栈", "把累加器A和工作寄存器全部压栈", "清除堆栈指针SP后再跳转"],
    "correctAnswer": "把断点地址（PC）压入堆栈，并转向中断入口地址",
    "ka": "5.1",
    "chapter": 5,
    "explanation": "89C51 中断响应只由硬件压入断点PC；PSW、累加器等现场需要在中断服务程序里用PUSH自行保护。"
  },
  {
    "id": 502,
    "type": "multiple-choice",
    "questionText": "在默认优先级下，89C51 五个中断源的响应顺序由高到低是？",
    "options": ["外部中断0、定时器0、外部中断1、定时器1、串行口", "串行口、定时器1、外部中断1、定时器0、外部中断0", "定时器0、定时器1、外部中断0、外部中断1、串行口", "五个中断源优先级完全相同，按申请先后响应"],
    "correctAnswer": "外部中断0、定时器0、外部中断1、定时器1、串行口",
    "ka": "5.1",
    "chapter": 5,
    "explanation": "这是89C51固定的自然优先级次序；IP寄存器只能把某个中断源提到高优先级组，组内次序仍按此顺序。"
  },
  {
    "id": 503,
    "type": "multiple-choice",
    "questionText": "中断与子程序调用最本质的区别在于什么？",
    "options": ["中断由随机事件触发，调用由程序预先安排", "中断不需要返回指令，调用需要", "中断不能嵌套，调用可以嵌套", "中断只能由软件发起，调用只能由硬件发起"],
    "correctAnswer": "中断由随机事件触发，调用由程序预先安排",
    "ka": "5.1",
    "chapter": 5,
    "explanation": "两者都保护断点并返回，区别在于发生时机：中断请求何时到来不由程序决定，子程序调用的位置是写死在程序里的。"
  },
  {
    "id": 504,
    "type": "multiple-choice",
    "questionText": "单步执行在排查程序错误时的主要作用是什么？",
    "options": ["逐条观察寄存器与存储单元的变化，定位出错指令", "加快程序运行速度", "自动改正语法错误", "替代编译器完成查错"],
    "correctAnswer": "逐条观察寄存器与存储单元的变化，定位出错指令",
    "ka": "9.3",
    "chapter": 9,
    "explanation": "单步把看不见的内部过程变成可观察的：每执行一条指令就核对一次A、PSW、指针和目标单元，与预期不符处即是出错点。"
  },
  {
    "id": 505,
    "type": "multiple-choice",
    "questionText": "程序运行中出现“跑飞”，下列哪一项是常见原因？",
    "options": ["栈指针未初始化，堆栈区与数据区重叠被覆盖", "把注释写得太长", "使用了过多的立即寻址指令", "程序中定义了过多标号"],
    "correctAnswer": "栈指针未初始化，堆栈区与数据区重叠被覆盖",
    "ka": "9.3",
    "chapter": 9,
    "explanation": "复位后SP默认指向07H，若不重设而又使用30H起的数据区，压栈会覆盖数据或返回地址，程序即跳向不可预期的位置。"
  },
  {
    "id": 506,
    "type": "multiple-choice",
    "questionText": "在仿真环境中设置断点的目的是什么？",
    "options": ["让程序运行到指定位置暂停，检查此刻的现场", "永久删除该行代码", "强制跳过该段程序", "把该行指令改为空操作"],
    "correctAnswer": "让程序运行到指定位置暂停，检查此刻的现场",
    "ka": "9.3",
    "chapter": 9,
    "explanation": "断点用于把长程序切成可核对的片段：运行到断点停下后再看寄存器和内存，比从头单步效率高得多。"
  },
  {
    "id": 507,
    "type": "multiple-choice",
    "questionText": "AI 助手给出“这段程序没有错误”的结论后，应当以什么作为正确性的最终依据？",
    "options": ["编译、仿真、测试记录与教师评价", "AI回答的措辞是否肯定", "AI响应的速度", "同学之间的口头确认"],
    "correctAnswer": "编译、仿真、测试记录与教师评价",
    "ka": "10.5",
    "chapter": 10,
    "explanation": "AI输出属于辅助意见，不构成判定。程序是否正确要由可复现的编译与运行结果、以及教师评价来确认。"
  },
  {
    "id": 508,
    "type": "multiple-choice",
    "questionText": "在课程作业中使用 AI 辅助后，符合学术诚信的做法是什么？",
    "options": ["保留个人推理与核验记录，并说明AI辅助的范围", "直接提交AI输出，不作说明", "隐去AI参与的事实以免影响评分", "把AI输出改几个字后当作原创"],
    "correctAnswer": "保留个人推理与核验记录，并说明AI辅助的范围",
    "ka": "10.5",
    "chapter": 10,
    "explanation": "如实说明辅助范围、保留可核验的推理与验证过程，是区分辅助与代做的关键，也是课程对学术诚信的基本要求。"
  },
  {
    "id": 509,
    "type": "multiple-choice",
    "questionText": "向 AI 助手提问时，下列哪类信息不应当提交？",
    "options": ["账号口令、密钥与未授权的学生身份数据", "课本上的公开例题", "自己编写的实验代码片段", "公开的器件数据手册参数"],
    "correctAnswer": "账号口令、密钥与未授权的学生身份数据",
    "ka": "10.5",
    "chapter": 10,
    "explanation": "涉及身份、凭据和未授权数据的内容一旦提交给外部服务即不可撤回，属于隐私与数据安全红线。"
  },
  // 改造入库 v1：往年作业册20221127单项选择，以及本学期作业5/6/7数值切片。
  {
    "id": 510,
    "type": "multiple-choice",
    "questionText": "十进制数92的BCD码是？",
    "options": [
      "11101001B",
      "00101111B",
      "01100111B",
      "10010010B"
    ],
    "correctAnswer": "10010010B",
    "ka": "1",
    "chapter": 1,
    "explanation": "[source: 往年作业册20221127 作业1 单选#1 · P10]\n92的BCD码高4位为1001、低4位为0010，即10010010B。"
  },
  {
    "id": 511,
    "type": "multiple-choice",
    "questionText": "有符号十进制数-1的补码是？",
    "options": [
      "FFH",
      "FCH",
      "FEH",
      "F8H"
    ],
    "correctAnswer": "FFH",
    "ka": "1",
    "chapter": 1,
    "explanation": "[source: 往年作业册20221127 作业1 单选#2 · P11]\n8位补码中-1由00000001取反加1得到FFH。"
  },
  {
    "id": 512,
    "type": "multiple-choice",
    "questionText": "将十进制数48转换成十六进制数为？",
    "options": [
      "30H",
      "31H",
      "32H",
      "48H"
    ],
    "correctAnswer": "30H",
    "ka": "1",
    "chapter": 1,
    "explanation": "[source: 往年作业册20221127 作业1 单选#3 · P9]\n48=3×16+0，十六进制为30H。"
  },
  {
    "id": 513,
    "type": "multiple-choice",
    "questionText": "在计算机科学发展过程中，提出“程序存储”和“二进制计算”的科学家是？",
    "options": [
      "冯·诺依曼",
      "钱学森",
      "特德·霍夫",
      "比利"
    ],
    "correctAnswer": "冯·诺依曼",
    "ka": "1.1",
    "chapter": 1,
    "explanation": "[source: 往年作业册20221127 作业1 单选#4 · P1]\n存储程序和二进制运算是冯·诺依曼计算机模型的核心思想。"
  },
  {
    "id": 514,
    "type": "multiple-choice",
    "questionText": "十进制数67的BCD码是？",
    "options": [
      "11101001B",
      "00101111B",
      "01100111B",
      "10010010B"
    ],
    "correctAnswer": "01100111B",
    "ka": "1",
    "chapter": 1,
    "explanation": "[source: 往年作业册20221127 作业1 单选#5 · P10]\n67的BCD码高4位为0110、低4位为0111，即01100111B。"
  },
  {
    "id": 515,
    "type": "multiple-choice",
    "questionText": "有符号十进制数-4的补码是？",
    "options": [
      "FFH",
      "FCH",
      "FEH",
      "F8H"
    ],
    "correctAnswer": "FCH",
    "ka": "1",
    "chapter": 1,
    "explanation": "[source: 往年作业册20221127 作业1 单选#6 · P11]\n8位补码中-4等于256-4=252，即FCH。"
  },
  {
    "id": 516,
    "type": "multiple-choice",
    "questionText": "将十进制数127转换成二进制数为？",
    "options": [
      "11101001B",
      "00101111B",
      "01111111B",
      "10010010B"
    ],
    "correctAnswer": "01111111B",
    "ka": "1",
    "chapter": 1,
    "explanation": "[source: 往年作业册20221127 作业1 单选#7 · P9]\n127=64+32+16+8+4+2+1，二进制为01111111B。"
  },
  {
    "id": 517,
    "type": "multiple-choice",
    "questionText": "十进制数93的BCD码是？",
    "options": [
      "01000100B",
      "01000101B",
      "01100111B",
      "10010011B"
    ],
    "correctAnswer": "10010011B",
    "ka": "1",
    "chapter": 1,
    "explanation": "[source: 往年作业册20221127 作业1 单选#8 · P10]\n93的BCD码高4位为1001、低4位为0011，即10010011B。"
  },
  {
    "id": 518,
    "type": "multiple-choice",
    "questionText": "有符号十进制数-64的补码是？",
    "options": [
      "EFH",
      "DFH",
      "C0H",
      "E0H"
    ],
    "correctAnswer": "C0H",
    "ka": "1",
    "chapter": 1,
    "explanation": "[source: 往年作业册20221127 作业1 单选#9 · P11]\n8位补码中-64等于256-64=192，即C0H。"
  },
  {
    "id": 519,
    "type": "multiple-choice",
    "questionText": "将十进制数120转换成十六进制数为？",
    "options": [
      "78H",
      "87H",
      "77H",
      "88H"
    ],
    "correctAnswer": "78H",
    "ka": "1",
    "chapter": 1,
    "explanation": "[source: 往年作业册20221127 作业1 单选#10 · P9]\n120=7×16+8，十六进制为78H。"
  },
  {
    "id": 520,
    "type": "multiple-choice",
    "questionText": "在寄存器间接寻址方式中，指定寄存器中存放的是？",
    "options": [
      "操作数",
      "操作数地址",
      "转移地址",
      "地址偏移量"
    ],
    "correctAnswer": "操作数地址",
    "ka": "2.1",
    "chapter": 2,
    "explanation": "[source: 往年作业册20221127 作业2 单选#1 · P36]\n寄存器间接寻址时，Ri或DPTR里放的是操作数所在的地址，不是操作数本身。"
  },
  {
    "id": 521,
    "type": "multiple-choice",
    "questionText": "单片机复位后，程序状态寄存器PSW的内容是？",
    "options": [
      "00H",
      "07H",
      "FFH",
      "31H"
    ],
    "correctAnswer": "00H",
    "ka": "2.5.4",
    "chapter": 2,
    "explanation": "[source: 往年作业册20221127 作业2 单选#2 · P29]\n80C51复位后PSW被清为00H，工作寄存器组、溢出标志和奇偶标志都回到初始状态。"
  },
  {
    "id": 522,
    "type": "multiple-choice",
    "questionText": "80C51单片机内部RAM的位寻址区范围是？",
    "options": [
      "00H-1FH",
      "20H-2FH",
      "30H-7FH",
      "00H-7FH"
    ],
    "correctAnswer": "20H-2FH",
    "ka": "2.2.4",
    "chapter": 2,
    "explanation": "[source: 往年作业册20221127 作业2 单选#3 · P22]\n片内RAM中只有20H-2FH这16个字节共128位可以按位寻址。"
  },
  {
    "id": 523,
    "type": "multiple-choice",
    "questionText": "PC的值是？",
    "options": [
      "当前指令前一条指令的地址",
      "当前正在执行指令的地址",
      "下一条指令的地址",
      "控制器中指令寄存器的地址"
    ],
    "correctAnswer": "下一条指令的地址",
    "ka": "2.1.3",
    "chapter": 2,
    "explanation": "[source: 往年作业册20221127 作业2 单选#4 · P19]\n程序计数器PC指出的是下一条要取的指令地址，不是当前指令本身。"
  },
  {
    "id": 524,
    "type": "multiple-choice",
    "questionText": "MCS-51单片机在复位过程中RST引脚应为？",
    "options": [
      "高电平",
      "低电平",
      "脉冲输入",
      "高阻态"
    ],
    "correctAnswer": "高电平",
    "ka": "2.5",
    "chapter": 2,
    "explanation": "[source: 往年作业册20221127 作业2 单选#5 · P28]\nRST高电平保持两个机器周期以上，80C51进入复位；平时RST应为低。"
  },
  {
    "id": 525,
    "type": "multiple-choice",
    "questionText": "单片机89C51内部ROM的存储空间为？",
    "options": [
      "2k",
      "4k",
      "8k",
      "64k"
    ],
    "correctAnswer": "4k",
    "ka": "2.2.1",
    "chapter": 2,
    "explanation": "[source: 往年作业册20221127 作业2 单选#6 · P14+P20]\n89C51片内程序存储器为4KB Flash，地址0000H-0FFFH。"
  },
  {
    "id": 526,
    "type": "multiple-choice",
    "questionText": "80C51单片机的累加器是？",
    "options": [
      "SBUF",
      "ACC",
      "TMOD",
      "TCON"
    ],
    "correctAnswer": "ACC",
    "ka": "2.2.3",
    "chapter": 2,
    "explanation": "[source: 往年作业册20221127 作业2 单选#7 · P17]\n累加器A的SFR名称为ACC，字节地址E0H，算术和多数传送都经过它。"
  },
  {
    "id": 527,
    "type": "multiple-choice",
    "questionText": "将十进制数127转换成十六进制数为？",
    "options": [
      "7FH",
      "FFH",
      "7EH",
      "71H"
    ],
    "correctAnswer": "7FH",
    "ka": "2",
    "chapter": 2,
    "explanation": "[source: 往年作业册20221127 作业2 单选#8 · P9]\n127=7×16+15，十六进制为7FH。"
  },
  {
    "id": 528,
    "type": "multiple-choice",
    "questionText": "80C51单片机芯片的引脚个数为？",
    "options": [
      "40个",
      "20个",
      "30个",
      "28个"
    ],
    "correctAnswer": "40个",
    "ka": "2.3",
    "chapter": 2,
    "explanation": "[source: 往年作业册20221127 作业2 单选#9 · P15]\n标准80C51采用40引脚双列直插封装。"
  },
  {
    "id": 529,
    "type": "multiple-choice",
    "questionText": "80C51单片机外部的程序存储器ROM的最大可扩展为？",
    "options": [
      "16KB",
      "32KB",
      "64KB",
      "8KB"
    ],
    "correctAnswer": "64KB",
    "ka": "2.2.5",
    "chapter": 2,
    "explanation": "[source: 往年作业册20221127 作业2 单选#10 · P20]\n程序计数器16位，外部程序存储器最大寻址64KB，即0000H-FFFFH。"
  },
  {
    "id": 530,
    "type": "multiple-choice",
    "questionText": "下列寄存器能够进行位寻址的是？",
    "options": [
      "PSW",
      "DPH",
      "TMOD",
      "SBUF"
    ],
    "correctAnswer": "PSW",
    "ka": "2.2.3",
    "chapter": 2,
    "explanation": "[source: 往年作业册20221127 作业2 单选#11 · P23]\nPSW的字节地址D0H，可以按位访问；DPH、TMOD和SBUF只能按字节访问。"
  },
  {
    "id": 531,
    "type": "multiple-choice",
    "questionText": "80C51单片机的定时/计数器T0的工作方式3为？",
    "options": [
      "13位定时/计数器",
      "16位定时/计数器",
      "8位自动重装定时/计数器",
      "两个独立的8位定时/计数器"
    ],
    "correctAnswer": "两个独立的8位定时/计数器",
    "ka": "2",
    "chapter": 2,
    "explanation": "[source: 往年作业册20221127 作业2 单选#12 · P91]\n方式3把T0拆成两个独立的8位定时/计数器；T1没有方式3。"
  },
  {
    "id": 532,
    "type": "multiple-choice",
    "questionText": "假定设置堆栈指针SP的值为37H，在进行子程序调用时把断点地址进栈保护后，SP的值为？",
    "options": [
      "60H",
      "37H",
      "38H",
      "39H"
    ],
    "correctAnswer": "39H",
    "ka": "3.5.3",
    "chapter": 3,
    "explanation": "[source: 往年作业册20221127 作业3 单选#1 · P41]\n调用时硬件把16位断点PC分两次压栈，SP从37H增加到39H。"
  },
  {
    "id": 533,
    "type": "multiple-choice",
    "questionText": "十进制数34的BCD码是？",
    "options": [
      "11101001B",
      "00101111B",
      "00110100B",
      "10010010B"
    ],
    "correctAnswer": "00110100B",
    "ka": "3",
    "chapter": 3,
    "explanation": "[source: 往年作业册20221127 作业3 单选#2 · P10]\n34的BCD码高4位为0011、低4位为0100，即00110100B。"
  },
  {
    "id": 534,
    "type": "multiple-choice",
    "questionText": "有符号十进制数-2的补码是？",
    "options": [
      "FFH",
      "FCH",
      "FEH",
      "F8H"
    ],
    "correctAnswer": "FEH",
    "ka": "3",
    "chapter": 3,
    "explanation": "[source: 往年作业册20221127 作业3 单选#3 · P11]\n8位补码中-2等于256-2=254，即FEH。"
  },
  {
    "id": 535,
    "type": "multiple-choice",
    "questionText": "将十六进制数2FH转换成十进制数为？",
    "options": [
      "47",
      "23",
      "52",
      "49"
    ],
    "correctAnswer": "47",
    "ka": "3",
    "chapter": 3,
    "explanation": "[source: 往年作业册20221127 作业3 单选#4 · P9]\n2FH=2×16+15=47。"
  },
  {
    "id": 536,
    "type": "multiple-choice",
    "questionText": "MCS-51单片机在访问外部数据存储器时，其地址指针可采用？",
    "options": [
      "DPTR",
      "PC",
      "PSW",
      "SP"
    ],
    "correctAnswer": "DPTR",
    "ka": "3.2.2",
    "chapter": 3,
    "explanation": "[source: 往年作业册20221127 作业3 单选#6 · P39]\n外部RAM用MOVX配合DPTR（或Ri）间接寻址，DPTR提供16位地址。"
  },
  {
    "id": 537,
    "type": "multiple-choice",
    "questionText": "80C51单片机内部的数据存储器RAM的存储容量为？",
    "options": [
      "128B",
      "256B",
      "4KB",
      "8KB"
    ],
    "correctAnswer": "128B",
    "ka": "3",
    "chapter": 3,
    "explanation": "[source: 往年作业册20221127 作业3 单选#7 · P21]\n80C51/89C51片内低128字节RAM地址为00H-7FH；256B是52子系列的片内RAM。"
  },
  {
    "id": 538,
    "type": "multiple-choice",
    "questionText": "MCS-51单片机中最繁忙的寄存器是？",
    "options": [
      "PSW",
      "P0",
      "TMOD",
      "A"
    ],
    "correctAnswer": "A",
    "ka": "3",
    "chapter": 3,
    "explanation": "[source: 往年作业册20221127 作业3 单选#8 · P17]\n累加器A参与传送、运算和布尔进位以外的绝大多数操作，教材称之为最繁忙的寄存器。"
  },
  {
    "id": 539,
    "type": "multiple-choice",
    "questionText": "在80C51单片机的某些串口的工作方式中，需要计算T1的溢出率，此时定时/计数器T1的工作方式0为？",
    "options": [
      "13位定时/计数器",
      "16位定时/计数器",
      "8位自动重装定时/计数器",
      "两个独立的8位定时/计数器"
    ],
    "correctAnswer": "13位定时/计数器",
    "ka": "3",
    "chapter": 3,
    "explanation": "[source: 往年作业册20221127 作业3 单选#9 · P91]\n方式0是13位定时/计数器，由TH的高8位和TL的低5位组成。"
  },
  {
    "id": 540,
    "type": "multiple-choice",
    "questionText": "MCS-51指令系统的位地址赋值伪指令为？",
    "options": [
      "ORG",
      "END",
      "EQU",
      "BIT"
    ],
    "correctAnswer": "BIT",
    "ka": "3.6",
    "chapter": 3,
    "explanation": "[source: 往年作业册20221127 作业3 单选#10 · P65]\nBIT把符号名定义到一个位地址，ORG是定位，END是结束，EQU是等值。"
  },
  {
    "id": 541,
    "type": "multiple-choice",
    "questionText": "单片机复位后，堆栈指针SP的内容是？",
    "options": [
      "00H",
      "07H",
      "FFH",
      "31H"
    ],
    "correctAnswer": "07H",
    "ka": "4",
    "chapter": 4,
    "explanation": "[source: 往年作业册20221127 作业4 单选#1 · P19]\n复位后SP=07H，第一次压栈写入08H。"
  },
  {
    "id": 542,
    "type": "multiple-choice",
    "questionText": "80C51单片机内部RAM的工作寄存器区范围是？",
    "options": [
      "00H-1FH",
      "20H-2FH",
      "30H-7FH",
      "00H-7FH"
    ],
    "correctAnswer": "00H-1FH",
    "ka": "4",
    "chapter": 4,
    "explanation": "[source: 往年作业册20221127 作业4 单选#2 · P21]\n00H-1FH共32字节，分成4组工作寄存器，每组R0-R7。"
  },
  {
    "id": 543,
    "type": "multiple-choice",
    "questionText": "80C51单片机的程序状态字控制寄存器是？",
    "options": [
      "PSW",
      "SBUF",
      "TMOD",
      "TCON"
    ],
    "correctAnswer": "PSW",
    "ka": "4",
    "chapter": 4,
    "explanation": "[source: 往年作业册20221127 作业4 单选#3 · P18]\n程序状态字是PSW，其中含CY、AC、RS1、RS0、OV和P。"
  },
  {
    "id": 544,
    "type": "multiple-choice",
    "questionText": "十进制数32的BCD码是？",
    "options": [
      "11101001B",
      "00101111B",
      "00110010B",
      "10010010B"
    ],
    "correctAnswer": "00110010B",
    "ka": "4",
    "chapter": 4,
    "explanation": "[source: 往年作业册20221127 作业4 单选#4 · P10]\n32的BCD码高4位为0011、低4位为0010，即00110010B。"
  },
  {
    "id": 545,
    "type": "multiple-choice",
    "questionText": "有符号十进制数-5的补码是？",
    "options": [
      "FFH",
      "FCH",
      "FEH",
      "FBH"
    ],
    "correctAnswer": "FBH",
    "ka": "4",
    "chapter": 4,
    "explanation": "[source: 往年作业册20221127 作业4 单选#5 · P11]\n8位补码中-5等于256-5=251，即FBH。"
  },
  {
    "id": 546,
    "type": "multiple-choice",
    "questionText": "将十进制数253转换成二进制数为？",
    "options": [
      "11101001B",
      "01111111B",
      "11111101B",
      "10010010B"
    ],
    "correctAnswer": "11111101B",
    "ka": "4",
    "chapter": 4,
    "explanation": "[source: 往年作业册20221127 作业4 单选#6 · P9]\n253=255-2，二进制为11111101B。"
  },
  {
    "id": 547,
    "type": "multiple-choice",
    "questionText": "80C51单片机串口中断的中断服务程序入口地址是？",
    "options": [
      "0003H",
      "000BH",
      "0023H",
      "001BH"
    ],
    "correctAnswer": "0023H",
    "ka": "4",
    "chapter": 4,
    "explanation": "[source: 往年作业册20221127 作业4 单选#7 · P21]\n串口中断入口为0023H；0003H、000BH、0013H、001BH分别是INT0、T0、INT1、T1。"
  },
  {
    "id": 548,
    "type": "multiple-choice",
    "questionText": "80C51单片机汇编语言，定义字节数据表的伪指令是？",
    "options": [
      "DW",
      "DB",
      "EQU",
      "BIT"
    ],
    "correctAnswer": "DB",
    "ka": "4",
    "chapter": 4,
    "explanation": "[source: 往年作业册20221127 作业4 单选#8 · P63]\nDB按字节定义数据表，DW按字定义，EQU是等值，BIT是位地址赋值。"
  },
  {
    "id": 549,
    "type": "multiple-choice",
    "questionText": "80C51单片机外部中断0的中断服务程序入口地址是？",
    "options": [
      "0003H",
      "000BH",
      "0013H",
      "001BH"
    ],
    "correctAnswer": "0003H",
    "ka": "5.2",
    "chapter": 5,
    "explanation": "[source: 往年作业册20221127 作业5 单选#1 · P21]\n外部中断0的入口是0003H。"
  },
  {
    "id": 550,
    "type": "multiple-choice",
    "questionText": "单片机复位后，并行口P3的内容是？",
    "options": [
      "00H",
      "07H",
      "FFH",
      "31H"
    ],
    "correctAnswer": "FFH",
    "ka": "5",
    "chapter": 5,
    "explanation": "[source: 往年作业册20221127 作业5 单选#2 · P29]\n复位后P0-P3的锁存器均为FFH，准双向口对外呈高电平。"
  },
  {
    "id": 551,
    "type": "multiple-choice",
    "questionText": "80C51单片机内部RAM的数据缓冲区范围是？",
    "options": [
      "00H-1FH",
      "20H-2FH",
      "30H-7FH",
      "00H-7FH"
    ],
    "correctAnswer": "30H-7FH",
    "ka": "5",
    "chapter": 5,
    "explanation": "[source: 往年作业册20221127 作业5 单选#3 · P22]\n30H-7FH是用户RAM，可作数据缓冲和堆栈，不能位寻址。"
  },
  {
    "id": 552,
    "type": "multiple-choice",
    "questionText": "对于单片机AT89S52，并行口P0口所有引脚的吸收电流总和不能超过？",
    "options": [
      "10mA",
      "15mA",
      "26mA",
      "71mA"
    ],
    "correctAnswer": "26mA",
    "ka": "5",
    "chapter": 5,
    "explanation": "[source: 往年作业册20221127 作业5 单选#4 · P27]\n作业册给出的答案是P0口吸收电流总和不超过26mA。"
  },
  {
    "id": 553,
    "type": "multiple-choice",
    "questionText": "单片机89C51内部RAM的存储空间为？",
    "options": [
      "2k",
      "3k",
      "128B",
      "256B"
    ],
    "correctAnswer": "128B",
    "ka": "5",
    "chapter": 5,
    "explanation": "[source: 往年作业册20221127 作业5 单选#5 · P21]\n89C51片内低128字节为数据RAM；256B是52子系列。"
  },
  {
    "id": 554,
    "type": "multiple-choice",
    "questionText": "80C51单片机的堆栈指针是？",
    "options": [
      "SP",
      "SBUF",
      "TMOD",
      "TCON"
    ],
    "correctAnswer": "SP",
    "ka": "5",
    "chapter": 5,
    "explanation": "[source: 往年作业册20221127 作业5 单选#6 · P19]\n堆栈指针是SP，复位值为07H。"
  },
  {
    "id": 555,
    "type": "multiple-choice",
    "questionText": "下列寄存器为16位的是？",
    "options": [
      "DPTR",
      "TCON",
      "TMOD",
      "DPH"
    ],
    "correctAnswer": "DPTR",
    "ka": "5",
    "chapter": 5,
    "explanation": "[source: 往年作业册20221127 作业5 单选#7 · P19]\nDPTR由DPH和DPL组成，共16位；TCON、TMOD和DPH都是8位。"
  },
  {
    "id": 556,
    "type": "multiple-choice",
    "questionText": "80C51单片机的定时/计数器T0的工作方式0为？",
    "options": [
      "13位定时/计数器",
      "16位定时/计数器",
      "8位自动重装定时/计数器",
      "两个独立的8位定时/计数器"
    ],
    "correctAnswer": "13位定时/计数器",
    "ka": "6.2.1",
    "chapter": 6,
    "explanation": "[source: 往年作业册20221127 作业5 单选#8 · P91]\n方式0是13位定时/计数器。"
  },
  {
    "id": 557,
    "type": "multiple-choice",
    "questionText": "80C51单片机外部中断0的中断标志为？",
    "options": [
      "IE0",
      "IE1",
      "TF0",
      "TF1"
    ],
    "correctAnswer": "IE0",
    "ka": "5.3",
    "chapter": 5,
    "explanation": "[source: 往年作业册20221127 作业5 单选#9 · P82]\n外部中断0的请求标志是TCON中的IE0；IE1、TF0、TF1分别对应INT1、T0和T1。"
  },
  {
    "id": 558,
    "type": "multiple-choice",
    "questionText": "MCS-51指令系统的定位伪指令为？",
    "options": [
      "ORG",
      "END",
      "DB",
      "BIT"
    ],
    "correctAnswer": "ORG",
    "ka": "5",
    "chapter": 5,
    "explanation": "[source: 往年作业册20221127 作业5 单选#10 · P63]\nORG指定后续目标代码的起始地址；END结束汇编，DB定义字节，BIT定义位地址。"
  },
  {
    "id": 559,
    "type": "multiple-choice",
    "questionText": "采用C51进行中断函数的定义时，外部中断1的中断号是？",
    "options": [
      "0",
      "1",
      "2",
      "3"
    ],
    "correctAnswer": "2",
    "ka": "5.2",
    "chapter": 5,
    "explanation": "[source: 往年作业册20221127 作业5 单选#12 · P21+213]\nC51中断号：外部中断0为0，定时器0为1，外部中断1为2，定时器1为3。"
  },
  {
    "id": 560,
    "type": "multiple-choice",
    "questionText": "80C51单片机的定时/计数器工作方式寄存器是？",
    "options": [
      "PSW",
      "SBUF",
      "TMOD",
      "TCON"
    ],
    "correctAnswer": "TMOD",
    "ka": "7.2",
    "chapter": 7,
    "explanation": "[source: 往年作业册20221127 作业6 单选#1 · P90]\n工作方式由TMOD配置，启停和溢出标志在TCON。"
  },
  {
    "id": 561,
    "type": "multiple-choice",
    "questionText": "80C51单片机外部中断1的中断服务程序入口地址是？",
    "options": [
      "0003H",
      "000BH",
      "0013H",
      "001BH"
    ],
    "correctAnswer": "0013H",
    "ka": "7.1",
    "chapter": 7,
    "explanation": "[source: 往年作业册20221127 作业6 单选#2 · P21]\n外部中断1的入口是0013H。"
  },
  {
    "id": 562,
    "type": "multiple-choice",
    "questionText": "用MCS-51定时/计数器选用8位自动重装方式，定时/计数器工作方式是？",
    "options": [
      "方式0",
      "方式1",
      "方式2",
      "方式3"
    ],
    "correctAnswer": "方式2",
    "ka": "7.2.3",
    "chapter": 7,
    "explanation": "[source: 往年作业册20221127 作业6 单选#3 · P91]\n8位自动重装是方式2；串口波特率发生器通常就用T1的方式2。"
  },
  {
    "id": 563,
    "type": "multiple-choice",
    "questionText": "80C51单片机的定时/计数器控制寄存器是？",
    "options": [
      "PSW",
      "SBUF",
      "TMOD",
      "TCON"
    ],
    "correctAnswer": "TCON",
    "ka": "7.2",
    "chapter": 7,
    "explanation": "[source: 往年作业册20221127 作业6 单选#4 · P91]\nTCON负责TR0/TR1启停以及TF0/TF1、IE0/IE1标志；TMOD只选方式。"
  },
  {
    "id": 564,
    "type": "multiple-choice",
    "questionText": "80C51单片机定时/计数器0溢出中断的中断服务程序入口地址是？",
    "options": [
      "0003H",
      "000BH",
      "0013H",
      "001BH"
    ],
    "correctAnswer": "000BH",
    "ka": "7.1",
    "chapter": 7,
    "explanation": "[source: 往年作业册20221127 作业6 单选#5 · P21]\n定时器0溢出中断入口是000BH。"
  },
  {
    "id": 565,
    "type": "multiple-choice",
    "questionText": "单片机复位后，程序计数器PC的内容是？",
    "options": [
      "0000H",
      "07H",
      "FFFFH",
      "不确定"
    ],
    "correctAnswer": "0000H",
    "ka": "7.1",
    "chapter": 7,
    "explanation": "[source: 往年作业册20221127 作业6 单选#7 · P29]\n复位后PC=0000H，CPU从0000H取第一条指令；07H是SP的复位值。"
  },
  {
    "id": 566,
    "type": "multiple-choice",
    "questionText": "下列寄存器不能进行位寻址的是？",
    "options": [
      "PSW",
      "P0",
      "TMOD",
      "A"
    ],
    "correctAnswer": "TMOD",
    "ka": "7.2",
    "chapter": 7,
    "explanation": "[source: 往年作业册20221127 作业6 单选#8 · P23]\nPSW、P0和累加器A可以位寻址，TMOD不能。"
  },
  {
    "id": 567,
    "type": "multiple-choice",
    "questionText": "80C51单片机的定时/计数器T0的工作方式1为？",
    "options": [
      "13位定时/计数器",
      "16位定时/计数器",
      "8位自动重装定时/计数器",
      "两个独立的8位定时/计数器"
    ],
    "correctAnswer": "16位定时/计数器",
    "ka": "7.2",
    "chapter": 7,
    "explanation": "[source: 往年作业册20221127 作业6 单选#9 · P91]\n方式1是16位定时/计数器，TH和TL组成16位计数器。"
  },
  {
    "id": 568,
    "type": "multiple-choice",
    "questionText": "80C51单片机外部中断1的中断标志为？",
    "options": [
      "IE0",
      "IE1",
      "TF0",
      "TF1"
    ],
    "correctAnswer": "IE1",
    "ka": "7.1",
    "chapter": 7,
    "explanation": "[source: 往年作业册20221127 作业6 单选#10 · P82]\n外部中断1的请求标志是IE1。"
  },
  {
    "id": 569,
    "type": "multiple-choice",
    "questionText": "MCS-51指令系统的结束伪指令为？",
    "options": [
      "ORG",
      "END",
      "DB",
      "BIT"
    ],
    "correctAnswer": "END",
    "ka": "7.1",
    "chapter": 7,
    "explanation": "[source: 往年作业册20221127 作业6 单选#11 · P65]\nEND通知汇编程序源程序结束；ORG定位，DB定义字节，BIT定义位地址。"
  },
  {
    "id": 570,
    "type": "multiple-choice",
    "questionText": "用MCS-51串行口扩展并行I/O口，串行口工作方式应选择？",
    "options": [
      "方式0",
      "方式1",
      "方式2",
      "方式3"
    ],
    "correctAnswer": "方式0",
    "ka": "8",
    "chapter": 8,
    "explanation": "[source: 往年作业册20221127 作业7 单选#3 · P109]\n方式0是同步移位寄存器方式，可外接串入并出或并入串出器件扩展并行口。适用课号：0872专属。"
  },
  {
    "id": 571,
    "type": "multiple-choice",
    "questionText": "当需要从MCS-51单片机程序存储器取数据时，采用的指令为？",
    "options": [
      "MOV A, @R1",
      "MOVC A, @A+DPTR",
      "MOVX A, @R0",
      "MOVX A, @DPTR"
    ],
    "correctAnswer": "MOVC A, @A+DPTR",
    "ka": "8",
    "chapter": 8,
    "explanation": "[source: 往年作业册20221127 作业7 单选#4 · P40]\n读程序存储器常数用MOVC；MOVX读的是外部数据存储器。册内选项为小写，入库按站点指令大写。适用课号：0872专属。"
  },
  {
    "id": 572,
    "type": "multiple-choice",
    "questionText": "对于单片机AT89S52，并行口每根口线能承受的最大（灌）电流是？",
    "options": [
      "10mA",
      "15mA",
      "26mA",
      "71mA"
    ],
    "correctAnswer": "10mA",
    "ka": "8",
    "chapter": 8,
    "explanation": "[source: 往年作业册20221127 作业7 单选#5 · P24]\n作业册给出的答案是每根口线最大灌电流10mA。适用课号：0872专属。"
  },
  {
    "id": 573,
    "type": "multiple-choice",
    "questionText": "单片机复位后，并行口P0的内容是？",
    "options": [
      "00H",
      "07H",
      "FFH",
      "31H"
    ],
    "correctAnswer": "FFH",
    "ka": "8",
    "chapter": 8,
    "explanation": "[source: 往年作业册20221127 作业7 单选#6 · P29]\n复位后P0锁存器为FFH。适用课号：0872专属。"
  },
  {
    "id": 574,
    "type": "multiple-choice",
    "questionText": "采用C51进行中断函数的定义时，外部中断0的中断号是？",
    "options": [
      "0",
      "1",
      "2",
      "3"
    ],
    "correctAnswer": "0",
    "ka": "8",
    "chapter": 8,
    "explanation": "[source: 往年作业册20221127 作业7 单选#8 · P213]\n册内括号写的是中断号0，对应选项0。C51中外部中断0使用interrupt 0。适用课号：0872专属。"
  },
  {
    "id": 575,
    "type": "multiple-choice",
    "questionText": "晶振12 MHz（机器周期1μs），用T0方式1定时20 ms。计数所需的机器周期数N是？",
    "options": [
      "20000",
      "10000",
      "65536",
      "2000"
    ],
    "correctAnswer": "20000",
    "ka": "6.1",
    "chapter": 6,
    "explanation": "[source: 作业5 数值切片 · 同源]\n12 MHz时1个机器周期为1μs，20 ms=20000μs，故N=20000。"
  },
  {
    "id": 576,
    "type": "multiple-choice",
    "questionText": "晶振12 MHz（机器周期1μs），用T0方式1定时20 ms。TH0和TL0应装入？",
    "options": [
      "TH0=D8H，TL0=F0H",
      "TH0=B1H，TL0=E0H",
      "TH0=4EH，TL0=20H",
      "TH0=FCH，TL0=66H"
    ],
    "correctAnswer": "TH0=B1H，TL0=E0H",
    "ka": "6.1",
    "chapter": 6,
    "explanation": "[source: 作业5 数值切片 · 同源]\nN=20000，X=65536-20000=45536=B1E0H，因此TH0=B1H、TL0=E0H。"
  },
  {
    "id": 577,
    "type": "multiple-choice",
    "questionText": "只用T0做定时器、方式1、GATE=0（T1不用）。TMOD应是？",
    "options": [
      "00H",
      "02H",
      "01H",
      "10H"
    ],
    "correctAnswer": "01H",
    "ka": "6.1",
    "chapter": 6,
    "explanation": "[source: 作业5 数值切片 · 同源]\nTMOD低4位是T0。GATE=0、C/T=0、方式1的M1M0=01，高4位T1不用为0000，所以TMOD=01H。"
  },
  {
    "id": 578,
    "type": "multiple-choice",
    "questionText": "晶振12 MHz（机器周期1μs），用T0方式1定时10 ms。TH0和TL0应装入？",
    "options": [
      "TH0=B1H，TL0=E0H",
      "TH0=27H，TL0=10H",
      "TH0=D8H，TL0=F0H",
      "TH0=F0H，TL0=D8H"
    ],
    "correctAnswer": "TH0=D8H，TL0=F0H",
    "ka": "6.1",
    "chapter": 6,
    "explanation": "[source: 作业5 数值切片 · 同源]\nN=10000，X=65536-10000=55536=D8F0H，因此TH0=D8H、TL0=F0H。"
  },
  {
    "id": 579,
    "type": "multiple-choice",
    "questionText": "晶振改为11.0592 MHz，用T0方式1定时约1 ms。机器周期按12/fosc，N先计算再四舍五入到整数个机器周期。TH0和TL0应装入？",
    "options": [
      "TH0=FCH，TL0=67H",
      "TH0=FCH，TL0=65H",
      "TH0=FDH，TL0=00H",
      "TH0=FCH，TL0=66H"
    ],
    "correctAnswer": "TH0=FCH，TL0=66H",
    "ka": "6.1",
    "chapter": 6,
    "explanation": "[source: 作业5 数值切片 · 同源]\nN=11059200/(12×1000)=921.6，按题面四舍五入为922。X=65536-922=64614=FC66H，故TH0=FCH、TL0=66H。"
  },
  {
    "id": 580,
    "type": "multiple-choice",
    "questionText": "晶振11.0592 MHz，SMOD=0，串口方式1，T1方式2，目标波特率9600。TH1（方式2下与TL1相同）应是？",
    "options": [
      "F4H",
      "FAH",
      "FDH",
      "FEH"
    ],
    "correctAnswer": "FDH",
    "ka": "7.2.3",
    "chapter": 7,
    "explanation": "[source: 作业6 数值切片 · 同源]\nSMOD=0时波特率=fosc/(384×(256-TH1))。9600代入得256-TH1=3，TH1=253=FDH。"
  },
  {
    "id": 581,
    "type": "multiple-choice",
    "questionText": "晶振11.0592 MHz，SMOD=0，T1方式2，目标波特率2400。TH1应是？",
    "options": [
      "FDH",
      "F4H",
      "FAH",
      "E8H"
    ],
    "correctAnswer": "F4H",
    "ka": "7.2.3",
    "chapter": 7,
    "explanation": "[source: 作业6 数值切片 · 同源]\n2400代入同一公式得256-TH1=12，TH1=244=F4H。E8H是误按SMOD=1计算的结果。"
  },
  {
    "id": 582,
    "type": "multiple-choice",
    "questionText": "T1用作波特率发生器、方式2（8位自动重装）、定时、GATE=0，T0不用。TMOD应是？",
    "options": [
      "02H",
      "01H",
      "20H",
      "00H"
    ],
    "correctAnswer": "20H",
    "ka": "7.2.3",
    "chapter": 7,
    "explanation": "[source: 作业6 数值切片 · 同源]\nT1方式2、定时、GATE=0占TMOD高4位0010；T0不用则低4位为0000，TMOD=20H。"
  },
  {
    "id": 583,
    "type": "multiple-choice",
    "questionText": "串口波特率发生器为什么常用11.0592 MHz晶振，而不是12 MHz？",
    "options": [
      "分频后重装值常为整数，标准波特率误差可为0",
      "11.0592 MHz使机器周期正好是1μs",
      "80C51只允许使用11.0592 MHz晶振",
      "11.0592 MHz比12 MHz功耗更低"
    ],
    "correctAnswer": "分频后重装值常为整数，标准波特率误差可为0",
    "ka": "7.1.3",
    "chapter": 7,
    "explanation": "[source: 作业6 数值切片 · 同源]\n11.0592 MHz能使常用波特率的(256-TH1)为整数，误差为0。机器周期正好1μs的是12 MHz，不是11.0592 MHz。"
  },
  {
    "id": 584,
    "type": "multiple-choice",
    "questionText": "若晶振误用12 MHz，仍按11.0592 MHz、9600、SMOD=0的表装入TH1=FDH，串口方式1会怎样？",
    "options": [
      "实际波特率仍精确等于9600",
      "实际波特率高于9600，相对误差约+8.5%",
      "实际波特率降为2400",
      "T1方式2不能在12 MHz下计数"
    ],
    "correctAnswer": "实际波特率高于9600，相对误差约+8.5%",
    "ka": "7.1.3",
    "chapter": 7,
    "explanation": "[source: 作业6 数值切片 · 同源]\nTH1=FDH时256-TH1=3。12 MHz下波特率=12000000/(384×3)≈10416.7，相对9600约为+8.5%，不能当作精确9600。"
  },
  {
    "id": 585,
    "type": "multiple-choice",
    "questionText": "串口方式1的一帧按1位起始、8位数据、1位停止共10位。波特率9600时，传送1字节约需多少时间？",
    "options": [
      "104.17μs",
      "833.33μs",
      "1041.67μs",
      "9600μs"
    ],
    "correctAnswer": "1041.67μs",
    "ka": "7.1.4",
    "chapter": 7,
    "explanation": "[source: 作业6 数值切片 · 同源]\n按题面10位计，时间=10/9600 s≈1041.67μs。104.17μs只是1位的时间。"
  },
  {
    "id": 586,
    "type": "multiple-choice",
    "questionText": "一片8KB RAM，A12-A0接芯片地址线，片选CS接系统A15且低有效。A14、A13不参与译码，约定未用高位为0，只算主镜像。主地址范围是？",
    "options": [
      "8000H-9FFFH",
      "0000H-1FFFH",
      "0000H-07FFH",
      "E000H-FFFFH"
    ],
    "correctAnswer": "0000H-1FFFH",
    "ka": "8",
    "chapter": 8,
    "explanation": "[source: 作业7 数值切片 · 同源]\nA15=A14=A13=0且A12-A0覆盖8KB时，主镜像为0000H-1FFFH（含两端）。题面提示即此范围。适用课号：0872专属；3084大纲无并行扩展章。"
  },
  {
    "id": 587,
    "type": "multiple-choice",
    "questionText": "同一片8KB RAM，片选改为A15经非门后接入（A15=1时选中），并约定A14=A13=0。主地址范围是？",
    "options": [
      "0000H-1FFFH",
      "8000H-8FFFH",
      "8000H-9FFFH",
      "E000H-FFFFH"
    ],
    "correctAnswer": "8000H-9FFFH",
    "ka": "8",
    "chapter": 8,
    "explanation": "[source: 作业7 数值切片 · 同源]\nA15=1、A14=A13=0，A12-A0从0到1FFFH，起点8000H，终点8000H+1FFFH=9FFFH（含两端）。适用课号：0872专属；3084大纲无并行扩展章。"
  },
  {
    "id": 588,
    "type": "multiple-choice",
    "questionText": "74HC138的C/B/A接A15/A14/A13，仅A15-A13=000时Y0有效，Y0接2KB ROM的CS（低有效）。ROM只使用A12-A0中的低11根。按未用高位为0的主镜像，该ROM地址范围是？",
    "options": [
      "0000H-1FFFH",
      "0000H-0FFFH",
      "2000H-27FFH",
      "0000H-07FFH"
    ],
    "correctAnswer": "0000H-07FFH",
    "ka": "8",
    "chapter": 8,
    "explanation": "[source: 作业7 数值切片 · 同源]\nY0要求A15-A13=000；2KB只用A10-A0。未参加译码的A12、A11按第1题的主镜像约定取0，范围为0000H-07FFH（含两端）。适用课号：0872专属；3084大纲无并行扩展章。"
  },
];

export const COMPREHENSIVE_QUESTIONS_PER_CHAPTER = 2;

/**
 * 综合测评使用固定、可复现的章节抽样卷，避免把整套题库直接当作一次测评。
 * 每章按正式题库顺序选取前两题；题库变更后仍保持相同的选题规则。
 */
export function getComprehensiveQuestions(): Question[] {
  const selectedByChapter = new Map<number, Question[]>();
  for (const question of quizQuestions) {
    const selected = selectedByChapter.get(question.chapter) ?? [];
    if (selected.length >= COMPREHENSIVE_QUESTIONS_PER_CHAPTER) continue;
    selected.push(question);
    selectedByChapter.set(question.chapter, selected);
  }
  return [...selectedByChapter.entries()]
    .sort(([chapterA], [chapterB]) => chapterA - chapterB)
    .flatMap(([, questions]) => questions);
}
