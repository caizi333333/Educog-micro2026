
'use client';

import React, { useState, useMemo } from 'react';
import { Search, Copy, Share2, Lightbulb, Siren, FlaskConical, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

// 关键词链接组件
const KeywordLink = ({ nodeId, children }: { nodeId: string; children: React.ReactNode }) => (
  <Link 
    href={`/knowledge-graph?node=${nodeId}`} 
    className="text-primary hover:text-primary/80 underline decoration-dotted underline-offset-2"
  >
    {children}
  </Link>
);

// 丰富内容卡片组件
const EnrichmentCard = ({ icon, title, children }: { 
  icon: React.ReactNode; 
  title: string; 
  children: React.ReactNode 
}) => (
  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-4 my-4 border border-blue-200 dark:border-blue-800">
    <div className="flex items-center gap-2 mb-2">
      <div className="text-blue-600 dark:text-blue-400">{icon}</div>
      <h4 className="font-semibold text-blue-900 dark:text-blue-100">{title}</h4>
    </div>
    <div className="text-blue-800 dark:text-blue-200 text-sm">{children}</div>
  </div>
);

// 模块级复制函数（在chaptersData静态定义中使用）
const handleCopy = async (code: string, e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    // silently fail
  }
};

// 章节数据
const chaptersData = [
  {
    id: "item-1",
    title: "第 1 章：微控制器概述",
    estimatedTime: "约 10 分钟",
    goals: {
      knowledge: ['了解微控制器的基本概念和应用领域', '理解8051微控制器的基本结构', '掌握微控制器与微处理器的区别'],
      skills: ['能够识别8051微控制器的主要组成部分', '能够理解微控制器在嵌入式系统中的作用'],
      ideology: '通过学习微控制器技术，培养学生的创新精神和实践能力，为中国制造2025和智能制造发展贡献力量。'
    },
    content: (
      <>
        <p>
          <KeywordLink nodeId="microcontroller">微控制器</KeywordLink>（MCU, Microcontroller Unit）是一种集成了CPU、存储器、I/O接口和各种外设于一体的单芯片计算机。与需要外接大量芯片才能工作的微处理器不同，微控制器是一个"麻雀虽小，五脏俱全"的完整系统。
        </p>
        <p>
          <KeywordLink nodeId="8051">8051微控制器</KeywordLink>由Intel公司于1980年推出，是最经典和影响最深远的8位微控制器架构之一。它采用<KeywordLink nodeId="harvard">哈佛结构</KeywordLink>，程序存储器和数据存储器分离，这种设计让它能够同时取指令和访问数据，提高了执行效率。
        </p>
        <ul className="list-disc list-inside space-y-2 my-2">
          <li><strong>CPU核心:</strong> 8位算术逻辑单元（ALU），能处理8位数据</li>
          <li><strong>存储器:</strong> 4KB程序存储器(ROM)，128字节内部数据存储器(RAM)</li>
          <li><strong><KeywordLink nodeId="io">I/O端口</KeywordLink>:</strong> 4个8位并行I/O端口（P0-P3），共32个引脚</li>
          <li><strong>定时器:</strong> 2个16位定时器/计数器（T0, T1）</li>
          <li><strong>中断系统:</strong> 5个中断源，2级中断优先级</li>
          <li><strong>串行口:</strong> 1个全双工串行通信接口</li>
        </ul>
        <p>
          8051的成功不仅在于其完善的功能，更在于其开放的架构。全世界数百家公司都推出了兼容8051指令集的产品，形成了庞大的8051家族，这种标准化极大地推动了嵌入式技术的普及和发展。
        </p>
        <EnrichmentCard icon={<Lightbulb className="w-5 h-5" />} title="深度思考：为什么8051至今仍被广泛使用？">
          <p>在ARM、RISC-V等现代架构大行其道的今天，8051这个40多年前的"老古董"为什么还能占据重要地位？</p>
          <ul className="list-disc list-inside mt-2 space-y-1 pl-4">
            <li><strong>简单可靠:</strong> 指令集精简，易于学习和调试，在对可靠性要求极高的工业控制领域备受青睐。</li>
            <li><strong>成本优势:</strong> 经过几十年的工艺优化，8051系列芯片的制造成本极低，在大批量应用中具有显著的价格优势。</li>
            <li><strong>生态完善:</strong> 拥有成熟的开发工具链、丰富的代码库和大量的技术人才储备。</li>
            <li><strong>功耗控制:</strong> 现代8051变种在低功耗设计方面表现出色，适合电池供电的物联网设备。</li>
          </ul>
        </EnrichmentCard>
        <div className="mt-6 flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href="/knowledge-graph?chapter=ch1">
              <Share2 className="mr-2 h-4 w-4" />
              在知识图谱中探索
            </Link>
          </Button>
        </div>
      </>
    ),
    highlights: {
      keyPoints: [
        <>微控制器是集成了CPU、存储器、I/O接口的单芯片计算机。</>,
        <>8051采用<KeywordLink nodeId="harvard">哈佛结构</KeywordLink>，程序和数据存储器分离。</>,
        <>8051具有4个I/O端口、2个定时器、5个中断源和1个串行口。</>,
      ],
      difficultPoints: [
        <>理解哈佛结构与冯·诺依曼结构的区别及其对性能的影响。</>,
        <>掌握8051内部各功能模块之间的协调工作机制。</>,
      ],
      commonMistakes: [
        <>混淆微控制器和微处理器的概念。</>,
        <>不理解I/O端口的双重功能（通用I/O和特殊功能）。</>,
      ],
      examPoints: [
        <>8051微控制器的基本组成和各部分功能。</>,
        <>哈佛结构的特点和优势。</>,
        <>微控制器与微处理器的主要区别。</>,
      ],
    },
  },

  {
    id: "item-2",
    title: "第 2 章：8051 存储器结构",
    estimatedTime: "约 20 分钟",
    goals: {
      knowledge: ['深入理解8051的哈佛结构存储器组织', '掌握内部RAM的三个区域划分', '理解SFR（特殊功能寄存器）的作用和地址映射'],
      skills: ['能够正确使用直接寻址和间接寻址访问不同的存储区域', '能够编写代码操作工作寄存器、可位寻址区和通用RAM', '能够理解和使用堆栈操作'],
      ideology: '存储器的精巧设计体现了工程师的智慧结晶。学习存储器结构，培养学生严谨的逻辑思维和对复杂系统的抽象理解能力。'
    },
    content: (
      <>
        <p>
          如果说CPU是8051的"大脑"，那么存储器就是它的"记忆系统"。8051采用<KeywordLink nodeId="harvard">哈佛结构</KeywordLink>，最显著的特征是程序存储器和数据存储器在物理上完全分离，拥有独立的地址空间和数据总线。这种设计让CPU可以同时访问指令和数据，大大提高了执行效率。
        </p>
        <p>
          <strong>程序存储器（ROM/Flash）</strong>用于存放程序代码和常量数据，地址空间为64KB（0000H-FFFFH）。而<strong>数据存储器</strong>则分为内部和外部两部分，内部数据存储器是我们需要重点掌握的。
        </p>
        <p>
          <KeywordLink nodeId="internal_ram">内部数据存储器</KeywordLink>虽然只有256字节，但被精心划分为几个功能区域，每个区域都有其特定的用途：
        </p>
        <ul className="list-disc list-inside space-y-2 my-2">
          <li><strong><KeywordLink nodeId="register_banks">工作寄存器区</KeywordLink>（00H-1FH，32字节）:</strong> 这里存放着4组工作寄存器（R0-R7），每组8个。通过PSW寄存器中的RS1和RS0位可以选择当前使用哪一组，这为程序的模块化和中断处理提供了极大便利。</li>
          <li><strong><KeywordLink nodeId="bit_addr_ram">可位寻址区</KeywordLink>（20H-2FH，16字节）:</strong> 这16个字节的每一位都可以单独寻址，共提供128个可位寻址的位（位地址00H-7FH）。这对于需要大量开关量控制的应用来说是极其宝贵的资源。</li>
          <li><strong>通用RAM区（30H-7FH，80字节）:</strong> 这是用户可以自由使用的数据存储区域，通常用于存放变量、数组和临时数据。</li>
          <li><strong><KeywordLink nodeId="sfr">SFR区</KeywordLink>（80H-FFH，128字节）:</strong> 特殊功能寄存器区，这里存放着控制各种外设和CPU功能的寄存器，如端口寄存器（P0-P3）、定时器寄存器（TMOD、TCON）、串口寄存器（SCON、SBUF）等。</li>
        </ul>
        <div className="rounded-lg bg-background/50 my-6">
          <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="text-sm font-semibold text-primary">汇编代码示例：堆栈操作演示</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleCopy(`ORG 0000H\n; 初始化堆栈指针\nMOV SP, #30H    ; 将堆栈指针设置到30H，堆栈将从31H开始\n\n; 演示PUSH操作\nMOV A, #55H     ; A = 55H\nMOV R0, #0AAH   ; R0 = AAH\nPUSH ACC        ; 将累加器A的内容压入堆栈，SP变为31H，31H单元 = 55H\nPUSH 00H        ; 将R0（地址00H）的内容压入堆栈，SP变为32H，32H单元 = AAH\n\n; 演示POP操作\nPOP 01H         ; 从堆栈弹出到R1，R1 = AAH，SP变为31H\nPOP ACC         ; 从堆栈弹出到累加器，A = 55H，SP变为30H\n\nHERE: SJMP HERE\nEND`, e)}>
                  <Copy className="h-4 w-4"/>
                  <span className="sr-only">复制代码</span>
              </Button>
          </div>
          <pre className="font-code text-sm p-4 overflow-x-auto">
            <code className="language-asm">
{`ORG 0000H
; 初始化堆栈指针
MOV SP, #30H    ; 将堆栈指针设置到30H，堆栈将从31H开始

; 演示PUSH操作
MOV A, #55H     ; A = 55H
MOV R0, #0AAH   ; R0 = AAH
PUSH ACC        ; 将累加器A的内容压入堆栈，SP变为31H，31H单元 = 55H
PUSH 00H        ; 将R0（地址00H）的内容压入堆栈，SP变为32H，32H单元 = AAH

; 演示POP操作
POP 01H         ; 从堆栈弹出到R1，R1 = AAH，SP变为31H
POP ACC         ; 从堆栈弹出到累加器，A = 55H，SP变为30H

HERE: SJMP HERE
END`}
            </code>
          </pre>
        </div>
        <p>
          需要特别注意的是，内部RAM的高128字节（80H-FFH）存在地址二义性：使用<KeywordLink nodeId="direct_addr">直接寻址</KeywordLink>时访问的是SFR，而使用<KeywordLink nodeId="indirect_addr">间接寻址</KeywordLink>时访问的是通用RAM。这个设计虽然节省了地址空间，但也是初学者容易犯错的地方。
        </p>
        <EnrichmentCard icon={<FlaskConical className="w-5 h-5" />} title="实践案例：多任务系统中的寄存器组切换">
            <p>在实际的嵌入式系统开发中，8051的4组工作寄存器为实现简单的多任务系统提供了硬件支持。</p>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-4">
                <li><strong>任务切换机制:</strong> 每个任务可以使用一组独立的工作寄存器（R0-R7），任务切换时只需要改变PSW中的寄存器组选择位（RS1、RS0），无需保存和恢复大量的寄存器内容。</li>
                <li><strong>中断处理优化:</strong> 可以为不同优先级的中断分配不同的寄存器组，这样中断服务程序就不会破坏主程序的寄存器内容，提高了系统的响应速度和可靠性。</li>
                <li><strong>学习价值:</strong> 这种设计思想在现代的ARM Cortex-M系列微控制器中得到了进一步发展，理解8051的寄存器组概念有助于掌握更高级的处理器架构。</li>
            </ul>
        </EnrichmentCard>
         <div className="mt-6 flex justify-end">
            <Button asChild variant="outline" size="sm">
                <Link href="/knowledge-graph?chapter=ch2">
                    <Share2 className="mr-2 h-4 w-4" />
                    在知识图谱中探索
                </Link>
            </Button>
        </div>
      </>
    ),
    highlights: {
      keyPoints: [
        <>程序存储器（ROM）和数据存储器（RAM）地址空间独立，这是<KeywordLink nodeId="harvard">哈佛结构</KeywordLink>的核心。</>,
        <>内部RAM分为三个区域：<KeywordLink nodeId="register_banks">工作寄存器区</KeywordLink>、<KeywordLink nodeId="bit_addr_ram">可位寻址区</KeywordLink>和通用RAM区。</>,
        <><KeywordLink nodeId="sfr">SFR (特殊功能寄存器)</KeywordLink>用于控制外设，地址映射在内部RAM的高128字节。</>,
      ],
      difficultPoints: [
        <>高区地址二义性：内部RAM高128字节(80H-FFH)与<KeywordLink nodeId="sfr">SFR</KeywordLink>地址空间重叠。必须牢记：使用<KeywordLink nodeId="direct_addr">直接寻址</KeywordLink>（如 `MOV A, 80H`）访问的是SFR（P0口），而使用<KeywordLink nodeId="indirect_addr">间接寻址</KeywordLink>（如 `MOV R0, #80H; MOV A, @R0`）访问的是通用RAM。</>,
        <>堆栈操作的本质：堆栈指针SP永远指向"下一个可用的空位置"。`PUSH`操作是先将SP加一，再存入数据；`POP`操作是先取出数据，再将SP减一。</>,
      ],
      commonMistakes: [
        <>立即数与地址混淆：忘记立即数前的'#'号。`MOV A, #30H` 是将数值 30H 放入 A，而`MOV A, 30H`是将内部 RAM 30H 地址单元的内容放入 A。</>,
        <>高区RAM寻址错误：试图用 `MOV 81H, #55H` 向RAM的81H单元写数据，这实际上会错误地写入<KeywordLink nodeId="sfr">SFR</KeywordLink>（这里是SP堆栈指针），可能导致程序崩溃。必须用间接寻址。</>,
      ],
      examPoints: [
        <>8051内部RAM的三个区域及其地址范围和功能。</>,
        <>什么是SFR？它有什么作用？</>,
        <>数据指针<KeywordLink nodeId="dptr">DPTR</KeywordLink>是多少位的寄存器？（16位），它由哪两个8位SFR组成？（DPH和DPL）</>,
      ],
    },
  },

  {
    id: "item-3",
    title: "第 3 章：I/O 端口编程",
    estimatedTime: "约 15 分钟",
    goals: {
      knowledge: ['掌握8051四个I/O端口（P0-P3）的特性和区别', '理解"准双向口"和"漏极开路"的概念', '了解P3口的第二功能'],
      skills: ['能够编写代码实现对I/O口的读写操作', '能够正确连接外部上拉电阻以使用P0口', '能够通过编程点亮LED、读取按键状态'],
      ideology: 'I/O端口是连接数字世界与物理世界的桥梁。以此为引，探讨"一带一路"中的"数字丝绸之路"建设，理解信息基础设施互联互通对构建人类命运共同体的重大意义。'
    },
    content: (
      <>
        <p>
          如果说CPU是微控制器的大脑，那么四个8位的并行 <KeywordLink nodeId="io">I/O 端口</KeywordLink>（P0, P1, P2, P3）就是它的"感官和四肢"。它们是微控制器与外部世界（如按键、LED、传感器）进行信息交换和物理交互的桥梁，共提供了32个引脚。
        </p>
        <p>
          除了P1口，其他端口都身兼数职，拥有第二功能。在作为通用I/O口使用时，P1、P2、P3口都是**准双向口**，内部自带一个弱上拉电阻。这意味着，当你想从外部读取信号（作输入）时，必须先向该端口写入'1'，以"松开"内部的控制，让外部信号能够主导引脚的电平。
        </p>
        <ul className="list-disc list-inside space-y-2 my-2">
            <li><strong><KeywordLink nodeId="p0">P0 口 (地址 80H)</KeywordLink>:</strong> 这是一个"性格开放"的漏极开路口。用作通用I/O时，它需要外接上拉电阻才能可靠地输出高电平。它的主要第二职业是作为地址/数据复用总线，在访问外部存储器时非常繁忙。</li>
            <li><strong><KeywordLink nodeId="p1">P1 口 (地址 90H)</KeywordLink>:</strong> 这是最"单纯"的一个端口，是一个纯粹的8位准双向I/O口，没有其他第二功能。非常适合用于简单的开关控制和信号读取任务。</li>
            <li><strong><KeywordLink nodeId="p2">P2 口 (地址 A0H)</KeywordLink>:</strong> 性格与P1类似，但有第二功能：在访问大容量外部存储器时，它负责提供高8位的地址信息(A8-A15)。</li>
            <li><strong><KeywordLink nodeId="p3">P3 口 (地址 B0H)</KeywordLink>:</strong> 这是最"多才多艺"的端口。它的每个引脚都有一个重要的第二功能，是串行通信 (RXD, TXD)、外部中断 (INT0, INT1)、定时器脉冲输入 (T0, T1) 等关键任务的指定端口。</li>
        </ul>
        <div className="rounded-lg bg-background/50 my-6">
          <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="text-sm font-semibold text-primary">汇编代码示例：使P1口的LED闪烁</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleCopy(`ORG 0000H\nLOOP:\n  MOV P1, #0FFH ; P1口输出高电平，熄灭所有LED（假设共阴极）\n  ACALL DELAY   ; 调用延时\n  MOV P1, #00H  ; P1口输出低电平，点亮所有LED\n  ACALL DELAY   ; 调用延时\n  SJMP LOOP\n\n; 简单的软件延时子程序\nDELAY:\n  MOV R6, #200\nD1:\n  MOV R7, #250\n  DJNZ R7, $  ; 此处循环，消耗时间\n  DJNZ R6, D1\n  RET\n\nEND`, e)}>
                  <Copy className="h-4 w-4"/>
                  <span className="sr-only">复制代码</span>
              </Button>
          </div>
          <pre className="font-code text-sm p-4 overflow-x-auto">
            <code className="language-asm">
{`ORG 0000H
LOOP:
  MOV P1, #0FFH ; P1口输出高电平，熄灭所有LED（假设共阴极）
  ACALL DELAY   ; 调用延时
  MOV P1, #00H  ; P1口输出低电平，点亮所有LED
  ACALL DELAY   ; 调用延时
  SJMP LOOP

; 简单的软件延时子程序
DELAY:
  MOV R6, #200
D1:
  MOV R7, #250
  DJNZ R7, $  ; 此处循环，消耗时间
  DJNZ R6, D1
  RET

END`}
            </code>
          </pre>
        </div>
        <p>
          记住一个关键原则：对端口进行写操作时，是改变端口锁存器的值；进行读操作时，是读取引脚的实际电平状态。读引脚前，先对该位写'1'，是确保输入功能正常的标准做法。
        </p>
        <EnrichmentCard icon={<FlaskConical className="w-5 h-5" />} title="Mini-Project 构想：交通信号灯">
            <p>这是一个经典的I/O应用项目，非常适合练习端口操作和延时编程。</p>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-4">
                <li><strong>硬件连接:</strong> 将三个LED（红、黄、绿）分别连接到P1口的三个不同引脚，如P1.0, P1.1, P1.2。</li>
                <li><strong>逻辑流程:</strong> 编写一个主循环，按照"绿灯亮 → 绿灯闪烁 → 黄灯亮 → 红灯亮"的顺序来控制三个LED。</li>
                <li><strong>精髓所在:</strong> 你需要为不同的亮灯和闪烁阶段编写精确的延时子程序。</li>
                <li><strong>学习价值:</strong> 完美地练习了对I/O口的位操作、循环编程和软件延时，是许多复杂时序控制系统的基础。</li>
            </ul>
        </EnrichmentCard>
         <div className="mt-6 flex justify-end">
            <Button asChild variant="outline" size="sm">
                <Link href="/knowledge-graph?chapter=ch3">
                    <Share2 className="mr-2 h-4 w-4" />
                    在知识图谱中探索
                </Link>
            </Button>
        </div>
      </>
    ),
    highlights: {
      keyPoints: [
        <>四个8位I/O端口（<KeywordLink nodeId="p0">P0</KeywordLink>, <KeywordLink nodeId="p1">P1</KeywordLink>, <KeywordLink nodeId="p2">P2</KeywordLink>, <KeywordLink nodeId="p3">P3</KeywordLink>）是MCU与外部世界交互的接口。</>,
        <>P0口是漏极开路，用作输出时需外接上拉电阻才能输出高电平。</>,
        <>P1, P2, P3是准双向口，内部有弱上拉，作输入时需先对该位写1。</>,
      ],
      difficultPoints: [
        <>"读-修改-写"操作的潜在问题：对端口的部分位进行操作时（如`SETB P1.0`），CPU会先读整个P1口，修改第0位后再整个写回。如果此时P1.1引脚被外部电路拉低，这个低电平会被读回并最终被"固化"，导致P1.1意外变为低电平输出。这是准双向口的一个固有缺陷。</>,
      ],
      commonMistakes: [
        <>使用P0口作通用I/O时，忘记外接上拉电阻，导致无法输出高电平。</>,
        <>将P1/P2/P3口用作输入时，忘记先向该端口位写入'1'，导致读到错误的低电平。</>,
      ],
      examPoints: [
        <>P0, P1, P2, P3四个端口的结构特性和主要区别。</>,
        <>P3口各引脚的第二功能？（P3.0:RXD, P3.1:TXD, P3.2:INT0, P3.3:INT1, P3.4:T0, P3.5:T1, P3.6:WR, P3.7:RD）</>,
      ],
    },
  },

  {
    id: "item-4",
    title: "第 4 章：8051 汇编语言基础",
    estimatedTime: "约 30 分钟",
    goals: {
      knowledge: ['理解汇编语言的作用和基本格式', '掌握五种核心寻址方式（立即、直接、寄存器、间接、变址）', '熟悉常用伪指令（ORG, END, DB）的用法'],
      skills: ['能够阅读简单的汇编代码', '能够使用MOV, ADD等基本指令编写简单的数据操作程序', '能够使用DJNZ指令构建循环'],
      ideology: '学习汇编语言需要极致的严谨和对细节的精确把控。以此培养学生的"工匠精神"，理解在核心技术领域精益求精、追求卓越的时代价值。'
    },
    content: (
      <>
         <p>
           <KeywordLink nodeId="assembly">汇编语言</KeywordLink>是CPU能直接理解的机器指令的文本表示，是硬件的"母语"。虽然C语言等高级语言更易于编写和维护，但学习汇编能让你深入微控制器的内心，理解每一条指令如何影响硬件，从而在性能和代码体积要求极致的场景下写出最精炼高效的代码。
        </p>
        <p>
            指令的核心在于如何找到它要操作的数据，这就是<strong><KeywordLink nodeId="addressing_modes">寻址方式</KeywordLink></strong>。8051提供了多种灵活的寻址方式，就像给了你不同的方法去获取一个东西：
        </p>
         <div className="rounded-lg bg-background/50 my-6">
          <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="text-sm font-semibold text-primary">寻址方式示例</h3>
          </div>
          <ul className="list-disc list-inside p-4 font-code text-sm">
            <li><strong><KeywordLink nodeId="immediate_addr">立即寻址</KeywordLink>:</strong> "我直接给你钱"，操作数就跟在指令后面。 e.g., <code className="language-asm">MOV A, #30H</code></li>
            <li><strong><KeywordLink nodeId="direct_addr">直接寻址</KeywordLink>:</strong> "钱在XX号信箱里"，指令里直接给出了数据所在的内存地址。 e.g., <code className="language-asm">MOV A, 30H</code></li>
            <li><strong><KeywordLink nodeId="register_addr">寄存器寻址</KeywordLink>:</strong> "钱在你的左边口袋（R0）里"，数据就在指定的寄存器中。 e.g., <code className="language-asm">MOV A, R0</code></li>
            <li><strong><KeywordLink nodeId="indirect_addr">寄存器间接寻址</KeywordLink>:</strong> "存放钱的信箱号码写在了你的左手心（R0）里"，数据地址存储在R0或R1寄存器中。 e.g., <code className="language-asm">MOV A, @R0</code></li>
            <li><strong>变址寻址:</strong> "去书架（DPTR）上第A本书里找"，常用于查表。 e.g., <code className="language-asm">MOVC A, @A+DPTR</code></li>
          </ul>
        </div>
        <div className="rounded-lg bg-background/50 my-6">
          <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="text-sm font-semibold text-primary">代码示例：汇编实现加法</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleCopy(`ORG 0000H     ; 程序起始地址\nMOV A, #25H   ; 立即寻址: 将立即数 25H 载入累加器 A\nMOV R0, #34H  ; 立即寻址: 将立即数 34H 载入寄存器 R0\nADD A, R0     ; 寄存器寻址: 将累加器 A 和寄存器 R0 的内容相加，结果存回 A\n              ; A 结果为 59H\nHERE: SJMP HERE ; 无限循环，停在此处\nEND           ; 程序结束`, e)}>
                  <Copy className="h-4 w-4"/>
                  <span className="sr-only">复制代码</span>
              </Button>
          </div>
          <pre className="font-code text-sm p-4 overflow-x-auto">
            <code className="language-asm">
{`ORG 0000H     ; 程序起始地址
MOV A, #25H   ; 立即寻址: 将立即数 25H 载入累加器 A
MOV R0, #34H  ; 立即寻址: 将立即数 34H 载入寄存器 R0
ADD A, R0     ; 寄存器寻址: 将累加器 A 和寄存器 R0 的内容相加，结果存回 A
              ; A 结果为 59H
HERE: SJMP HERE ; 无限循环，停在此处
END           ; 程序结束`}
            </code>
          </pre>
        </div>
        <p>
            在汇编中，`MOV` 是最基本的数据搬运工。`#` 符号是立即数的标志，千万不能漏掉。`ORG` 和 `END` 这种被称为伪指令，它们不被CPU执行，而是给汇编器看的"注释"，用于指导编译过程。
        </p>
        <EnrichmentCard icon={<FlaskConical className="w-5 h-5" />} title="真实世界案例：高性能引导加载程序 (Bootloader)">
            <p>虽然现代嵌入式开发多用C语言，但在对性能和体积要求极为苛刻的场景，汇编语言仍是王者，最典型的就是Bootloader。</p>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-4">
                <li><strong>极致速度:</strong> Bootloader是设备上电后运行的第一段代码，它的任务是快速初始化最基本的硬件（如时钟、内存），然后加载主应用程序。这个过程必须快，汇编能实现最直接的硬件控制，无任何额外开销。</li>
                <li><strong>极致体积:</strong> Bootloader通常存放在一个容量很小的专用Flash区域，代码必须极度精简。汇编指令与机器码一一对应，能让开发者对每一个字节都了如指掌。</li>
                <li><strong>学习价值:</strong> 理解汇编的重要性，不在于用它写整个项目，而在于拥有在关键时刻深入底层、榨干硬件性能的"杀手锏"能力。</li>
            </ul>
        </EnrichmentCard>
         <div className="mt-6 flex justify-end">
            <Button asChild variant="outline" size="sm">
                <Link href="/knowledge-graph?chapter=ch4">
                    <Share2 className="mr-2 h-4 w-4" />
                    在知识图谱中探索
                </Link>
            </Button>
        </div>
      </>
    ),
    highlights: {
      keyPoints: [
        <>掌握五种核心<KeywordLink nodeId="addressing_modes">寻址方式</KeywordLink>：立即、直接、寄存器、寄存器间接、变址。</>,
        <>熟悉常用指令：数据传送(`MOV`, `MOVC`, `PUSH`, `POP`)、算术运算(`ADD`, `ADDC`, `INC`, `DEC`)、逻辑运算(`ANL`, `ORL`, `XRL`, `CPL`, `RR`)、控制转移(`SJMP`, `LJMP`, `ACALL`, `LCALL`, `RET`, `RETI`, `DJNZ`, `CJNE`)。</>,
      ],
      difficultPoints: [
        <>理解<KeywordLink nodeId="indirect_addr">寄存器间接寻址</KeywordLink>（`@R0`）和变址寻址（`@A+DPTR`）的区别和应用场景，后者常用于查表。</>,
        <>`MOVC` vs `MOV`：`MOVC`的'C'代表'Code'，专门用于从程序存储器（ROM）中读取数据，如查七段码表。 `MOV` 则用于RAM和SFR之间的数据转移。</>,
      ],
      commonMistakes: [
        <>直接寻址和立即寻址混淆，特别是`#`号的使用。</>,
        <>在需要从ROM查表（如七段码）时，错误地使用`MOV`指令代替`MOVC`。</>,
      ],
      examPoints: [
        <>根据给定的指令，判断其采用的寻址方式。</>,
        <>`DJNZ`指令的功能和应用（常用于构建延时循环）。</>,
        <>伪指令`ORG`, `END`, `DB`的作用。</>,
      ],
    },
  },

  {
    id: "item-5",
    title: "第 5 章：定时器/计数器",
    estimatedTime: "约 25 分钟",
    goals: {
      knowledge: ['理解定时器/计数器的基本工作原理', '掌握TMOD和TCON寄存器的配置方法', '熟悉定时器四种工作模式，重点是模式1和模式2'],
      skills: ['能够计算不同晶振频率下的定时初值', '能够编写代码使用定时器产生精确的延时', '能够使用定时器生成指定频率的方波'],
      ideology: '精确的定时是许多"大国重器"如高铁、电网、北斗导航系统的基石。学习定时器，感悟"分秒不差"的严谨作风对国家重大工程的决定性作用。'
    },
    content: (
      <>
        <p>
          <KeywordLink nodeId="timers">定时器/计数器</KeywordLink>是微控制器的"节拍器"和"计数器"。它既可以用来产生精确到微秒的时间延迟（定时器模式），也可以用来对外部发生的脉冲事件进行计数（计数器模式）。标准的8051内置了两个16位的定时器/计数器：T0和T1。
        </p>
        <p>
          它们的工作模式由<strong><KeywordLink nodeId="tmod">TMOD</KeywordLink></strong>寄存器这个"模式选择旋钮"来设定。TMOD是一个8位寄存器，高4位控制T1，低4位控制T0。其中的C/T位决定了它是作为定时器（C/T=0，对内部机器周期计数）还是计数器（C/T=1，对外部T0/T1引脚的脉冲计数）。
        </p>
        <ul className="list-disc list-inside ml-4 my-2">
          <li><strong>模式0:</strong> 13位定时器/计数器模式，较少使用。</li>
          <li><strong><KeywordLink nodeId="timer_mode1">模式1</KeywordLink>:</strong> 16位定时器/计数器模式。这是最灵活、最常用的模式，计数范围可达65536。</li>
          <li><strong><KeywordLink nodeId="timer_mode2">模式2</KeywordLink>:</strong> 8位自动重装载模式。当计数溢出后，能自动从THx寄存器中重新加载初值，非常适合用于生成周期性的信号，比如串口通信的波特率。</li>
          <li><strong>模式3:</strong> T0可拆分为两个独立的8位定时器，而T1在此模式下停止工作。</li>
        </ul>
        <p>
          定时器的启动、停止（TRx位）以及溢出状态的查询（TFx位）则由<strong><KeywordLink nodeId="tcon">TCON</KeywordLink></strong>这个"启停开关和状态指示灯"来管理。
        </p>
        <EnrichmentCard icon={<FlaskConical className="w-5 h-5" />} title="Mini-Project 构想：呼吸灯">
            <p>挑战自己，将本章所学的定时器中断与I/O操作结合，利用PWM（脉冲宽度调制）技术，创造一个让LED亮度平滑变化的"呼吸灯"效果。</p>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-4">
                <li><strong>核心思路:</strong> 在一个固定的短周期内（如10ms），通过改变高电平持续的时间（占空比）来控制LED的平均亮度。</li>
                <li><strong>实现方法:</strong> 使用一个高速的定时器中断。在中断服务程序中，用一个变量来控制引脚电平的翻转时刻，从而动态调整占空比。</li>
                <li><strong>学习价值:</strong> 这是电机速度控制、模拟信号输出等高级应用的基础，能极大加深对定时器精确控制能力的理解。</li>
            </ul>
        </EnrichmentCard>
         <div className="mt-6 flex justify-end">
            <Button asChild variant="outline" size="sm">
                <Link href="/knowledge-graph?chapter=ch5">
                    <Share2 className="mr-2 h-4 w-4" />
                    在知识图谱中探索
                </Link>
            </Button>
        </div>
      </>
    ),
    highlights: {
      keyPoints: [
        <>定时器/计数器的本质是加1计数器，其核心工作方式是"计数溢出"。</>,
        <>通过配置 <KeywordLink nodeId="tmod">TMOD</KeywordLink> 寄存器来选择工作模式，通过 <KeywordLink nodeId="tcon">TCON</KeywordLink> 寄存器来控制启停和查询溢出标志。</>,
        <>模式1是16位定时器，模式2是8位自动重装载定时器，后者常用于生成波特率。</>,
      ],
      difficultPoints: [
        <>定时初值的精确计算：`定时时间 = (2^位数 - 初值) × 机器周期`。对于12MHz晶振，机器周期为1μs。若要定时1ms（1000μs），16位模式(65536)下的初值 = 65536 - 1000 = 64536 (FC18H)。</>,
        <>晶振频率、机器周期和定时时间三者之间的换算关系。</>,
      ],
      commonMistakes: [
        <>忘记在启动定时器（`SETB TRx`）之前加载初值到`THx`和`TLx`。</>,
        <>在查询法中使用溢出标志`TFx`后，忘记用软件将其清零（`CLR TFx`）。</>,
        <>在中断法中使用模式1时，忘记在<KeywordLink nodeId="isr">中断服务程序</KeywordLink>里为THx和TLx重装初值，导致后续定时周期不准确。</>,
      ],
      examPoints: [
        <>`TMOD`寄存器各位的定义和功能。</>,
        <>定时器模式1和模式2的区别及各自的应用场景。</>,
        <>给定晶振频率和定时时间，计算16位模式下的定时初值`THx`和`TLx`。</>,
      ],
    },
  }
];

// 代码片段
const codeSnippets = {
  ch1: `; 8051 基本程序结构示例
ORG 0000H          ; 程序起始地址
LJMP MAIN          ; 跳转到主程序

ORG 0030H          ; 主程序起始地址
MAIN:
    MOV P1, #0FFH  ; 初始化P1口为输入
    MOV A, P1      ; 读取P1口状态
    CPL A          ; 取反
    MOV P2, A      ; 输出到P2口
    SJMP MAIN      ; 无限循环

END               ; 程序结束`
};

export default function Home() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const handleCopy = async (code: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "代码已复制",
        description: "代码已成功复制到剪贴板",
      });
    } catch (err) {
      toast({
        title: "复制失败",
        description: "无法复制代码到剪贴板",
        variant: "destructive",
      });
    }
  };

  const filteredChapters = useMemo(() => {
    if (!searchTerm) return chaptersData;
    return chaptersData.filter(chapter => 
      chapter.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chapter.content.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-primary mb-4">8051 微控制器学习指南</h1>
        <p className="text-lg text-muted-foreground mb-6">
          从基础概念到实际应用，系统掌握8051微控制器编程
        </p>
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="搜索章节内容..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Accordion type="single" collapsible className="space-y-4">
        {filteredChapters.map((chapter) => (
          <AccordionItem key={chapter.id} value={chapter.id} className="border rounded-lg">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center justify-between w-full">
                <div className="text-left">
                  <h2 className="text-xl font-semibold">{chapter.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{chapter.estimatedTime}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">知识目标</h3>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      {chapter.goals.knowledge.map((goal, index) => (
                        <li key={index}>• {goal}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">技能目标</h3>
                    <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
                      {chapter.goals.skills.map((skill, index) => (
                        <li key={index}>• {skill}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg">
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">思政目标</h3>
                    <p className="text-sm text-purple-800 dark:text-purple-200">{chapter.goals.ideology}</p>
                  </div>
                </div>
                
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {chapter.content}
                </div>

                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 text-primary">学习要点总结</h3>
                  <div className="grid gap-4">
                    <div>
                      <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">✓ 关键知识点</h4>
                      <ul className="space-y-1 text-sm">
                        {chapter.highlights.keyPoints.map((point, index) => (
                          <li key={index}>• {point}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-orange-700 dark:text-orange-300 mb-2">⚠ 难点解析</h4>
                      <ul className="space-y-1 text-sm">
                        {chapter.highlights.difficultPoints.map((point, index) => (
                          <li key={index}>• {point}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">❌ 常见错误</h4>
                      <ul className="space-y-1 text-sm">
                        {chapter.highlights.commonMistakes.map((mistake, index) => (
                          <li key={index}>• {mistake}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">📝 考试要点</h4>
                      <ul className="space-y-1 text-sm">
                        {chapter.highlights.examPoints.map((point, index) => (
                          <li key={index}>• {point}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
