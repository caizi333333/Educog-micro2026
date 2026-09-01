/**
 * 简化的AI客户端，避免复杂的依赖问题
 */
import { DeepSeekClient } from './deepseek-client';
import { chaptersFromContext, retrieveContext } from './knowledge-context';

export const AI_ANSWER_MODES = ['generated', 'retrieved', 'fallback'] as const;
export type AiAnswerMode = (typeof AI_ANSWER_MODES)[number];

export interface SimpleAiResponse {
  answer: string;
  /** Public response provenance. Kept alongside mode for API consumers. */
  source: AiAnswerMode;
  /** How the answer text itself was produced. */
  mode: AiAnswerMode;
  relevantChapters: { chapter: string; title: string }[];
  relevantVideos: unknown[];
}

function createResponse(
  mode: AiAnswerMode,
  response: Omit<SimpleAiResponse, 'source' | 'mode'>,
): SimpleAiResponse {
  return { ...response, source: mode, mode };
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class SimpleAiClient {
  private deepseekClient: DeepSeekClient;
  
  constructor() {
    this.deepseekClient = new DeepSeekClient(
      process.env.DEEPSEEK_API_KEY ?? ''
    );
  }
  
  async chat(question: string, courseContext?: string, history?: ChatHistoryMessage[]): Promise<SimpleAiResponse> {
    try {
      const baseSystem =
        '你是"芯智育才"8051单片机课程的AI助教。学生提问时请优先依据下面提供的"课程知识库检索结果"作答，' +
        '引用时用 [#id] 标注节点编号（如 [#7.2.3]）；若检索结果与问题无关或为空，再结合通用知识回答，' +
        '但务必明确指出依据来源。用精炼的中文回答（先结论、再原理、必要时给极简代码示例），不要编造任何数据或实验结果。';
      const systemPrompt = courseContext
        ? `${baseSystem}\n\n${courseContext}`
        : baseSystem;

      // 携带最近几轮对话，支持多轮追问
      const historyMessages = (history ?? []).slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...historyMessages,
        { role: 'user' as const, content: question }
      ];

      const response = await this.deepseekClient.chat(messages);
      const responseContent = response.choices[0]?.message?.content;
      const answer = responseContent?.trim();

      if (!answer) {
        return createResponse('fallback', {
          answer: '抱歉，我无法提供答案。',
          relevantChapters: [],
          relevantVideos: [],
        });
      }

      return createResponse('generated', {
        answer,
        relevantChapters: [],
        relevantVideos: []
      });
    } catch (error) {
      console.error('SimpleAiClient error:', error);
      return this.getLocalFallbackResponse(question, courseContext);
    }
  }
  
  /**
   * Deterministic local fallback used when the external generator is unavailable.
   * Kept public so the fixed benchmark can exercise the exact production path
   * without making a network request.
   */
  getLocalFallbackResponse(question: string, courseContext?: string): SimpleAiResponse {
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('定时器') || lowerQuestion.includes('timer')) {
      return createResponse('fallback', {
        answer: `关于8051定时器：\n\n8051内置2个16位定时器/计数器（T0和T1），支持4种工作模式。\n常用于延时、计数、串口波特率生成等。\n\n建议查看第6章了解详细内容。`,
        relevantChapters: [{ chapter: '6', title: '第 6 章：定时器/计数器' }],
        relevantVideos: []
      });
    }

    if (lowerQuestion.includes('中断') || lowerQuestion.includes('interrupt')) {
      return createResponse('fallback', {
        answer: `关于8051中断系统：\n\n8051有5个中断源，通过IE和IP寄存器控制。\n中断向量表位于程序存储器低端。\n\n建议查看第5章了解详细内容。`,
        relevantChapters: [{ chapter: '5', title: '第 5 章：中断系统' }],
        relevantVideos: []
      });
    }
    
    if (lowerQuestion.includes('寻址')) {
      return createResponse('fallback', {
        answer: `关于8051的寻址方式：\n\n8051 共有 7 种寻址方式：\n1. 立即寻址 MOV A,#30H（操作数在指令里，最快但值固定）\n2. 直接寻址 MOV A,30H（直接给地址）\n3. 寄存器寻址 MOV A,R3（R0~R7，很快）\n4. 寄存器间接寻址 MOV A,@R0（地址可变，适合批量处理）\n5. 变址寻址 MOVC A,@A+DPTR（查表最灵活）\n6. 相对寻址 SJMP LOOP（跳转）\n7. 位寻址 SETB P1.0（MCS-51 特色功能）\n\n一句话：没有最好的寻址方式，只有最合适的。注意 MOV A,#30H 与 MOV A,30H 只差一个“#”号——一个取数据、一个取地址，结果天差地别。\n\n可在仿真页 exp02 结合“寻址方式星级对比表”理解。`,
        relevantChapters: [{ chapter: '3', title: '第 3 章：指令系统' }],
        relevantVideos: []
      });
    }

    if (lowerQuestion.includes('io') || lowerQuestion.includes('端口') || lowerQuestion.includes('p0') || lowerQuestion.includes('p1') || lowerQuestion.includes('p2') || lowerQuestion.includes('p3')) {
      return createResponse('fallback', {
        answer: `关于8051的 I/O 端口：\n\n8051 有 4 个 8 位 I/O 端口：\n- P0：开漏输出，需外接上拉，可复用为地址/数据总线\n- P1：准双向口，内带上拉，无第二功能\n- P2：准双向口，可输出高 8 位地址\n- P3：准双向口，每位有第二功能（RXD/TXD/INT0/INT1 等）\n\n基本操作：MOV P1,#0FFH（输出高）、MOV A,P1（读取）、SETB P1.0 / CLR P1.0（置位/清零单个位）。\n\n详见第2章硬件结构。`,
        relevantChapters: [{ chapter: '2', title: '第 2 章：硬件结构' }],
        relevantVideos: []
      });
    }

    if (lowerQuestion.includes('串口') || lowerQuestion.includes('uart') || lowerQuestion.includes('通信')) {
      return createResponse('fallback', {
        answer: `关于8051串行通信：\n\n8051 内置全双工串行口，4 种工作模式（模式1 最常用：8位UART、波特率可变）。\n关键寄存器：SCON（控制）、SBUF（数据缓冲）、PCON（波特率倍增）。\n波特率常用定时器1 方式2 产生，如 9600@11.0592MHz 时 TH1=0FDH。\n\n详见第7章。`,
        relevantChapters: [{ chapter: '7', title: '第 7 章：串行通信' }],
        relevantVideos: []
      });
    }

    if (lowerQuestion.includes('led') || lowerQuestion.includes('流水灯') || lowerQuestion.includes('点亮') || lowerQuestion.includes('数码管')) {
      return createResponse('fallback', {
        answer: `关于 LED 与数码管显示：\n\n- LED 低电平点亮：I/O 口输出 0 时对应 LED 亮。MOV P1,#0FEH 即点亮 P1.0。\n- 流水灯：用循环移位 RL A / RR A 让亮点逐位移动，配延时控制速度。\n- 数码管：用段码表 + 查表 MOVC A,@A+DPTR 显示字符；多位显示靠动态扫描（位选+段选快速轮流）。\n\n可在仿真页 exp01(流水灯)、exp04(数码管) 边写边看。`,
        relevantChapters: [{ chapter: '3', title: '第 3 章：指令系统' }],
        relevantVideos: []
      });
    }

    if (lowerQuestion.includes('指令') || lowerQuestion.includes('汇编') || lowerQuestion.includes('mov')) {
      return createResponse('fallback', {
        answer: `关于8051指令系统：\n\n按功能分 5 大类：\n1. 数据传送 MOV/MOVC/MOVX/PUSH/POP\n2. 算术运算 ADD/ADDC/SUBB/INC/DEC/MUL/DIV/DA\n3. 逻辑运算 ANL/ORL/XRL/CLR/CPL/RL/RR\n4. 控制转移 LJMP/AJMP/SJMP/LCALL/ACALL/RET/CJNE/DJNZ\n5. 位操作 SETB/CLR/CPL/JB/JNB/JBC（MCS-51 特色）\n\n学习要点：先掌握寻址方式，再理解每条指令“对谁、做什么、影响哪些标志位”。配合仿真页单步调试观察寄存器变化。`,
        relevantChapters: [{ chapter: '3', title: '第 3 章：指令系统' }],
        relevantVideos: []
      });
    }

    // 只有上层已经完成课程内容检索时，才把检索结果组织成本地回答。
    // 这条路径不调用生成模型，也不对测验、实验或教师评价作任何判定。
    if (courseContext?.trim()) {
      const context = retrieveContext(question, { maxKnowledge: 3, maxExperiments: 1 });
      if (context.knowledgePoints.length > 0) {
        const facts = context.knowledgePoints.map((point) => (
          `- [#${point.id}] ${point.name}：${point.description?.trim() || '课程节点已建立，详细内容请进入图谱查看。'}`
        ));
        const experiment = context.experiments[0];
        return createResponse('retrieved', {
          answer: [
            '当前外部生成服务不可用，以下内容由平台课程检索直接返回：',
            '',
            ...facts,
            '',
            experiment
              ? `可结合实验 ${experiment.id}“${experiment.title}”验证；完成状态仍以实验服务端记录为准。`
              : '可点击上方节点进入知识图谱核对上下文；学习记录与测评判定仍以服务端结果为准。',
          ].join('\n'),
          relevantChapters: chaptersFromContext(context),
          relevantVideos: [],
        });
      }
    }

    return createResponse('fallback', {
      answer: `感谢您的提问！建议您查阅相关章节内容，或通过仿真实验加深理解。`,
      relevantChapters: [],
      relevantVideos: []
    });
  }
}
