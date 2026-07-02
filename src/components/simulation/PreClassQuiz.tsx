'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, Beaker, BookOpen } from 'lucide-react';

/* ── Types ── */
interface PreClassQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface PreClassQuizData {
  experimentId: string;
  title: string;
  description: string;
  questions: PreClassQuestion[];
  passingScore: number;
}

interface PreClassQuizProps {
  experimentId: string;
  onPass?: () => void;
  onSkip?: () => void;
  className?: string;
}

/* ── Quiz Data (27 questions, 3 per experiment) ── */
const quizBank: PreClassQuizData[] = [
  {
    experimentId: 'exp01',
    title: 'LED控制实验 — 课前预习检测',
    description: '检查P1端口、数据传送指令等基础知识',
    passingScore: 67,
    questions: [
      {
        id: 'exp01-q1', question: '8051单片机P1口属于哪种类型的I/O端口？',
        options: ['开漏输出', '准双向口', '推挽输出', '三态输出'],
        correctAnswer: 1, explanation: 'P1口是准双向口，内部有上拉电阻，既可输入也可输出。',
      },
      {
        id: 'exp01-q2', question: '要使P1口8个LED中仅LED0点亮（低电平有效），P1应输出什么值？',
        options: ['0x01', '0xFE', '0x00', '0xFF'],
        correctAnswer: 1, explanation: 'LED0对应P1.0，低电平点亮，因此P1=1111_1110B=0xFE。',
      },
      {
        id: 'exp01-q3', question: '指令 "MOV P1, #0FEH" 的作用是什么？',
        options: ['从P1读取数据到累加器', '将立即数0xFE送入P1端口', '将P1清零', '将累加器内容送入P1'],
        correctAnswer: 1, explanation: 'MOV P1, #0FEH 是将立即数0xFE直接写入P1端口寄存器。',
      },
    ],
  },
  {
    experimentId: 'exp02',
    title: '指令系统实验 — 课前预习检测',
    description: '检查寻址方式、寄存器组等核心概念',
    passingScore: 67,
    questions: [
      {
        id: 'exp02-q1', question: '8051单片机有几种寻址方式？',
        options: ['5种', '7种', '4种', '6种'],
        correctAnswer: 1, explanation: '8051有7种寻址方式：立即、直接、寄存器、间接、变址、相对、位寻址。',
      },
      {
        id: 'exp02-q2', question: '指令 "MOV A, #30H" 使用的是哪种寻址方式？',
        options: ['直接寻址', '立即寻址', '寄存器寻址', '间接寻址'],
        correctAnswer: 1, explanation: '#30H带#号，表示立即数30H，所以是立即寻址方式。',
      },
      {
        id: 'exp02-q3', question: '执行 MOV A,#87H → ADD A,#95H → DA A 之后，A 和 CY 的结果是？',
        options: ['A=1CH，CY=1', 'A=82H，CY=1', 'A=22H，CY=0', 'A=82H，CY=0'],
        correctAnswer: 1, explanation: '87H+95H二进制相加得1CH且CY=1，不是合法BCD；DA A按"低半字节>9或AC=1补06H、高半字节>9或CY=1补60H"修正为82H、CY保持1，即十进制87+95=182。',
      },
    ],
  },
  {
    experimentId: 'exp03',
    title: '定时/计数器实验 — 课前预习检测',
    description: '检查TMOD寄存器、定时器模式等知识',
    passingScore: 67,
    questions: [
      {
        id: 'exp03-q1', question: 'TMOD寄存器的低4位控制的是哪个定时器？',
        options: ['定时器1', '定时器0', '定时器2', '看门狗定时器'],
        correctAnswer: 1, explanation: 'TMOD低4位（D3-D0）控制定时器0，高4位（D7-D4）控制定时器1。',
      },
      {
        id: 'exp03-q2', question: '定时器模式1（16位定时器）的最大计数值是多少？',
        options: ['256', '8192', '65536', '16384'],
        correctAnswer: 2, explanation: '模式1为16位定时/计数器，最大计数值为2^16=65536。',
      },
      {
        id: 'exp03-q3', question: '要启动定时器0，需要将TCON中的哪一位置1？',
        options: ['TF0', 'TR0', 'IE0', 'IT0'],
        correctAnswer: 1, explanation: 'TR0（Timer Run 0）置1后定时器0开始运行，TF0是溢出标志位。',
      },
    ],
  },
  {
    experimentId: 'exp04',
    title: '数码管显示实验 — 课前预习检测',
    description: '检查七段码编码、动态扫描等知识',
    passingScore: 67,
    questions: [
      {
        id: 'exp04-q1', question: '共阴极七段数码管显示数字"0"时，段码应为？',
        options: ['0x3F', '0x06', '0x7F', '0x00'],
        correctAnswer: 0, explanation: '数字0需要点亮a-f段（不含g和dp），对应二进制0011_1111=0x3F。',
      },
      {
        id: 'exp04-q2', question: '动态扫描显示多位数码管时，每位的刷新间隔通常应小于多少毫秒？',
        options: ['100ms', '50ms', '10ms', '1ms'],
        correctAnswer: 2, explanation: '为避免闪烁，人眼视觉暂留约10-20ms，每位扫描间隔应<10ms，总刷新率>50Hz。',
      },
      {
        id: 'exp04-q3', question: '在动态扫描中，"消隐"操作的目的是什么？',
        options: ['节省功耗', '防止鬼影串扰', '增加亮度', '延长寿命'],
        correctAnswer: 1, explanation: '消隐是在切换位选之前先关闭段码输出，防止切换瞬间产生的鬼影/串扰现象。',
      },
    ],
  },
  {
    experimentId: 'exp05',
    title: '按键输入与消抖 — 课前预习检测',
    description: '检查矩阵键盘行列扫描、准双向口输入与消抖原理',
    passingScore: 67,
    questions: [
      {
        id: 'exp05-q1', question: '本实验矩阵键盘列线接P3低4位，读取列状态前程序先执行 MOV P3,#0FH，目的是什么？',
        options: ['把列线全部拉低触发扫描', '向准双向口写1，使低4位可作输入读取真实电平', '清除上一次的键值缓存', '关闭P3口的第二功能'],
        correctAnswer: 1, explanation: '准双向口读引脚前必须先写1：若锁存器为0，引脚被内部钳在低电平，读不到按键真实状态。MOV P3,#0FH 正是让低4位列线处于输入态。',
      },
      {
        id: 'exp05-q2', question: '机械按键的抖动时间通常为多长？',
        options: ['1-2ms', '5-10ms', '50-100ms', '100-200ms'],
        correctAnswer: 1, explanation: '机械按键抖动时间一般为5-10ms，软件消抖延时通常取10-20ms。',
      },
      {
        id: 'exp05-q3', question: 'P1输出行扫描码0FEH（第0行为低）时，读得P3低4位为1011B。按"键值=行号×4+列号"（低电平有效），键值是多少？',
        options: ['0', '2', '4', '8'],
        correctAnswer: 1, explanation: '1011B中bit2为0，说明第2列被按下的键拉低；当前扫描的是第0行，键值=0×4+2=2。',
      },
    ],
  },
  {
    experimentId: 'exp06',
    title: '定时器中断实验 — 课前预习检测',
    description: '检查中断向量、优先级、ISR编写规则',
    passingScore: 67,
    questions: [
      {
        id: 'exp06-q1', question: '定时器0的中断入口地址是多少？',
        options: ['0003H', '000BH', '0013H', '001BH'],
        correctAnswer: 1, explanation: '中断入口：INT0=0003H, T0=000BH, INT1=0013H, T1=001BH, 串口=0023H。',
      },
      {
        id: 'exp06-q2', question: '要使能定时器0中断，IE寄存器需要设置哪些位？',
        options: ['仅ET0', 'EA和ET0', '仅EA', 'ET0和TR0'],
        correctAnswer: 1, explanation: '必须同时将EA（总中断允许）和ET0（T0中断允许）置1，中断才能响应。',
      },
      {
        id: 'exp06-q3', question: '中断服务程序（ISR）结尾必须使用哪条指令返回？',
        options: ['RET', 'RETI', 'SJMP', 'LJMP'],
        correctAnswer: 1, explanation: 'RETI（Return from Interrupt）不仅返回断点还清除中断优先级触发器，RET不会。',
      },
    ],
  },
  {
    experimentId: 'exp07',
    title: '蜂鸣器音频控制 — 课前预习检测',
    description: '检查方波频率、音调与定时器初值的关系',
    passingScore: 67,
    questions: [
      {
        id: 'exp07-q1', question: '产生1kHz方波音频，其周期应为多少？',
        options: ['1ms', '0.1ms', '10ms', '100us'],
        correctAnswer: 0, explanation: '频率f=1kHz，周期T=1/f=1ms，半周期500us（高低各占一半）。',
      },
      {
        id: 'exp07-q2', question: '指令 "CPL P2.0" 的作用是什么？',
        options: ['将P2.0置1', '将P2.0清0', '将P2.0取反', '测试P2.0的值'],
        correctAnswer: 2, explanation: 'CPL（Complement）指令将指定位取反。本实验在T0中断中执行CPL P2.0，两次翻转构成一个方波周期。',
      },
      {
        id: 'exp07-q3', question: '本实验用T0中断翻转P2.0发声，要提高音调（频率），定时器初值应如何变化？',
        options: ['减小初值，让中断间隔更长', '增大初值，让中断间隔更短', '初值不变，加大节拍基准', '初值与音调无关'],
        correctAnswer: 1, explanation: '初值=65536−500000/f：频率越高所需半周期越短，装入的初值越大、越接近65536，溢出翻转就越快。节拍基准只影响音长，不影响音调。',
      },
    ],
  },
  {
    experimentId: 'exp08',
    title: '步进电机控制 — 课前预习检测',
    description: '检查步进电机相序、控制节拍',
    passingScore: 67,
    questions: [
      {
        id: 'exp08-q1', question: '四相步进电机采用4拍驱动方式时，每步转过的角度为多少？（假设步距角为1.8°）',
        options: ['0.9°', '1.8°', '3.6°', '7.2°'],
        correctAnswer: 1, explanation: '4拍驱动（单四拍或双四拍），每拍转过一个步距角1.8°。',
      },
      {
        id: 'exp08-q2', question: '步进电机转速与什么参数成正比？',
        options: ['供电电压', '脉冲频率', '线圈电阻', '负载大小'],
        correctAnswer: 1, explanation: '步进电机转速=脉冲频率×步距角/360°，与脉冲频率成正比。',
      },
      {
        id: 'exp08-q3', question: '如果步进电机的驱动序列为 1000→1100→0100→0110→0010→0011→0001→1001，这是什么驱动方式？',
        options: ['单四拍', '双四拍', '八拍（半步）', '微步驱动'],
        correctAnswer: 2, explanation: '交替出现单相和双相激励，共8拍为一个循环，称为八拍（半步）驱动。',
      },
    ],
  },
  {
    experimentId: 'exp09',
    title: '串口通信实验 — 课前预习检测',
    description: '检查SCON、波特率、SBUF等知识',
    passingScore: 67,
    questions: [
      {
        id: 'exp09-q1', question: 'SCON=0x50 设置的串口工作模式是什么？',
        options: ['模式0（同步移位）', '模式1（8位UART）', '模式2（9位固定波特率）', '模式3（9位可变波特率）'],
        correctAnswer: 1, explanation: 'SCON=0101_0000B，SM0=0,SM1=1为模式1（10位异步，8位数据），REN=1允许接收。',
      },
      {
        id: 'exp09-q2', question: '串口模式1下，波特率由哪个定时器产生？',
        options: ['定时器0', '定时器1', '定时器2', '专用波特率发生器'],
        correctAnswer: 1, explanation: '标准8051中，串口模式1和模式3的波特率由定时器1的溢出率决定。',
      },
      {
        id: 'exp09-q3', question: '通过SBUF发送数据后，如何判断发送完成？',
        options: ['检查RI标志', '检查TI标志', '检查TR1标志', '检查TF1标志'],
        correctAnswer: 1, explanation: 'TI（Transmit Interrupt）在一帧数据发送完毕后由硬件自动置1，需软件清零。',
      },
    ],
  },
];

/* ── Component ── */
const PreClassQuiz: React.FC<PreClassQuizProps> = ({ experimentId, onPass, onSkip, className }) => {
  const quiz = useMemo(() => quizBank.find(q => q.experimentId === experimentId), [experimentId]);

  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const handleAnswer = useCallback((idx: number) => {
    if (answered || !quiz) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === quiz.questions[currentQ].correctAnswer) {
      setScore(s => s + 1);
    }
  }, [answered, quiz, currentQ]);

  const handleNext = useCallback(() => {
    if (!quiz) return;
    if (currentQ < quiz.questions.length - 1) {
      setCurrentQ(q => q + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      setFinished(true);
    }
  }, [quiz, currentQ]);

  const handleRetry = useCallback(() => {
    setCurrentQ(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
  }, []);

  if (!quiz) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground text-sm', className)}>
        暂无此实验的课前测试
      </div>
    );
  }

  const totalQ = quiz.questions.length;
  const pct = Math.round(score / totalQ * 100);
  const passed = pct >= quiz.passingScore;

  if (finished) {
    return (
      <Card className={cn('border-[#313244]', className)}>
        <CardContent className="pt-6 text-center space-y-4">
          <div className={cn(
            'w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl font-black',
            passed ? 'bg-emerald-500/15 text-emerald-400 ring-2 ring-emerald-500/30' : 'bg-red-500/15 text-red-400 ring-2 ring-red-500/30'
          )}>
            {pct}%
          </div>
          <div>
            <p className="font-semibold text-lg">{passed ? '预习达标！' : '需要再复习一下'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              答对 {score}/{totalQ} 题，{passed ? '可以开始实验了' : `需要 ${quiz.passingScore}% 以上才能通过`}
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            {passed ? (
              <Button onClick={onPass} className="bg-emerald-600 hover:bg-emerald-700">
                <Beaker className="w-4 h-4 mr-1.5" /> 开始实验
              </Button>
            ) : (
              <Button onClick={handleRetry} variant="outline">
                <RotateCcw className="w-4 h-4 mr-1.5" /> 重新测试
              </Button>
            )}
            {onSkip && (
              <Button onClick={onSkip} variant="ghost" size="sm" className="text-muted-foreground">
                跳过测试
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const q = quiz.questions[currentQ];

  return (
    <Card className={cn('border-[#313244]', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#89b4fa]" />
            {quiz.title}
          </CardTitle>
          {onSkip && (
            <Button onClick={onSkip} variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">
              跳过
            </Button>
          )}
        </div>
        <Progress value={(currentQ + 1) / totalQ * 100} className="h-1 mt-2" />
        <p className="text-[10px] text-muted-foreground mt-1">第 {currentQ + 1}/{totalQ} 题</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium leading-relaxed">{q.question}</p>

        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const isCorrect = i === q.correctAnswer;
            const isSelected = i === selected;
            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={answered}
                className={cn(
                  'w-full text-left p-3 rounded-lg border text-sm transition-all flex items-start gap-2.5',
                  !answered && 'hover:bg-[#313244]/50 hover:border-[#45475a] cursor-pointer border-[#313244]',
                  answered && isCorrect && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
                  answered && isSelected && !isCorrect && 'bg-red-500/10 border-red-500/30 text-red-300',
                  answered && !isSelected && !isCorrect && 'opacity-40 border-[#313244]',
                )}
              >
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5',
                  answered && isCorrect ? 'bg-emerald-500/30 text-emerald-300' :
                  answered && isSelected ? 'bg-red-500/30 text-red-300' :
                  'bg-[#313244] text-[#6c7086]'
                )}>
                  {answered && isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                   answered && isSelected ? <XCircle className="w-3.5 h-3.5" /> :
                   letter}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="p-3 rounded-lg bg-[#313244]/30 border border-[#45475a]/50">
            <p className="text-xs text-[#a6adc8] leading-relaxed">
              <span className="font-semibold text-[#89b4fa]">解析：</span>{q.explanation}
            </p>
          </div>
        )}

        {answered && (
          <div className="flex justify-end">
            <Button onClick={handleNext} size="sm">
              {currentQ < totalQ - 1 ? '下一题' : '查看结果'}
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PreClassQuiz;
export { quizBank, type PreClassQuizData, type PreClassQuestion };
