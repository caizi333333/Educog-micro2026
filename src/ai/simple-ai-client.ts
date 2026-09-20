/**
 * 简化的AI客户端，避免复杂的依赖问题
 */
import { ZhipuClient, resolveZhipuModel } from './model-client';
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
  private modelClient: ZhipuClient;
  
  constructor() {
    this.modelClient = new ZhipuClient(
      process.env.ZHIPU_API_KEY ?? ''
    );
  }
  
  async chat(question: string, courseContext?: string, history?: ChatHistoryMessage[]): Promise<SimpleAiResponse> {
    try {
      const baseSystem =
        '你是"芯智育才"8051单片机课程的AI助教。学生提问时请优先依据下面提供的"课程知识库检索结果"作答，' +
        '引用时用 [#id] 标注节点编号（如 [#7.2.3]）；若检索结果与问题无关或为空，再结合通用知识回答，' +
        '检索结果中的 CH 和节点首级编号表示平台单元，引用学习位置时称“平台单元”，不得当作教学大纲章号。' +
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

      const response = await this.modelClient.chat(messages, resolveZhipuModel());
      const responseContent = response.choices[0]?.message?.content;
      const answer = responseContent?.trim();

      if (!answer || response.choices[0]?.finish_reason !== 'stop') {
        return this.getLocalFallbackResponse(question, courseContext);
      }

      return createResponse('generated', {
        answer,
        relevantChapters: [],
        relevantVideos: []
      });
    } catch (error) {
      // Only record a bounded status category; provider/network error text can
      // contain the teacher's prompt or student work.
      const message = error instanceof Error ? error.message : '';
      const status = message.match(/^Zhipu API error: (\d{3})$/)?.[1];
      console.error('SimpleAiClient unavailable:', status ? `HTTP ${status}` : 'request_failed');
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
        answer: `关于8051定时器：\n\n经典8051内置2个16位定时器/计数器（T0和T1）。T0支持4种工作模式；方式3把T0拆为两个8位计时部分，T1的使用会受到限制。\n常用于延时、计数、串口波特率生成等。\n\n建议查看平台单元6；它对应教学大纲第5章的定时/计数器部分。`,
        relevantChapters: [{ chapter: '6', title: '平台单元 6：定时器/计数器' }],
        relevantVideos: []
      });
    }

    if (lowerQuestion.includes('中断') || lowerQuestion.includes('interrupt')) {
      return createResponse('fallback', {
        answer: `关于8051中断系统：\n\n经典8051有5个中断源，通过IE和IP寄存器控制。\n中断向量表位于程序存储器低端。\n\n建议查看平台单元5；它对应教学大纲第5章的中断系统部分。`,
        relevantChapters: [{ chapter: '5', title: '平台单元 5：中断系统' }],
        relevantVideos: []
      });
    }
    
    if (lowerQuestion.includes('寻址')) {
      return createResponse('fallback', {
        answer: `关于8051的寻址方式：\n\n8051 共有 7 种寻址方式：\n1. 立即寻址 MOV A,#30H（把指令中的常数30H送入累加器A）\n2. 直接寻址 MOV A,30H（把内部RAM地址30H单元中的数据送入A）\n3. 寄存器寻址 MOV A,R3（把当前寄存器组R3中的数据送入A）\n4. 寄存器间接寻址 MOV A,@R0（地址可变，适合批量处理）\n5. 变址寻址 MOVC A,@A+DPTR（读取程序存储器中地址A+DPTR处的数据）\n6. 相对寻址 SJMP LOOP（跳转）\n7. 位寻址 SETB P1.0（MCS-51 特色功能）\n\n两条MOV都把数据送入A，区别在于数据来源。先执行 MOV 30H,#55H：MOV A,#30H 后 A=30H；MOV A,30H 后 A=55H。后一条读取30H地址中的数据，不是把地址30H本身送入A。\n\n可在实验2中单步运行上述指令，观察A和内部RAM的变化。`,
        relevantChapters: [{ chapter: '3', title: '平台单元 3：指令系统' }],
        relevantVideos: []
      });
    }

    if (/\bi\s*\/?\s*o\b|\bp[0-3](?:\.[0-7])?\b/i.test(lowerQuestion) || lowerQuestion.includes('端口')) {
      return createResponse('fallback', {
        answer: `关于8051的 I/O 端口：\n\n经典8051 有 4 个 8 位输入/输出（I/O）端口：\n- P0：用作通用输出时为开漏输出，需外接上拉；访问外部存储器时可复用为地址/数据总线\n- P1：准双向口，内带上拉，无第二功能\n- P2：准双向口，可输出高 8 位地址\n- P3：准双向口，每位有第二功能（RXD/TXD/INT0/INT1 等）\n\n基本操作：MOV P1,#0FFH（向端口锁存器写1，供读取外部输入）、MOV A,P1（读取）、SETB P1.0 / CLR P1.0（置位/清零单个位）。\n\n详见平台单元2“硬件结构”。`,
        relevantChapters: [{ chapter: '2', title: '平台单元 2：硬件结构' }],
        relevantVideos: []
      });
    }

    if (lowerQuestion.includes('串口') || lowerQuestion.includes('uart') || lowerQuestion.includes('通信')) {
      return createResponse('fallback', {
        answer: `关于8051串行通信：\n\n8051 内置全双工串行口，4 种工作模式（模式1 最常用：8位UART、波特率可变）。\n关键寄存器：SCON（控制）、SBUF（数据缓冲）、PCON（波特率倍增）。\n按经典12T内核（每机器周期12个晶振周期）、定时器1方式2、PCON.SMOD=0计算：晶振11.0592MHz、TH1=TL1=0FDH，对应9600bit/s。改变晶振、内核时序或SMOD后须重新计算。\n\n详见平台单元7；串行通信对应教学大纲与授课课件第6章。`,
        relevantChapters: [{ chapter: '7', title: '平台单元 7：串行通信' }],
        relevantVideos: []
      });
    }

    if (lowerQuestion.includes('led') || lowerQuestion.includes('流水灯') || lowerQuestion.includes('点亮') || lowerQuestion.includes('数码管')) {
      return createResponse('fallback', {
        answer: `关于 LED 与数码管显示：\n\n- 按课程实验的低电平点亮接线，I/O 口输出0时对应发光二极管（LED）亮；MOV P1,#0FEH 点亮接在P1.0的LED。其他接线须先确认有效电平。\n- 流水灯：用循环移位 RL A / RR A 让亮点逐位移动，配延时控制速度。\n- 数码管：用段码表 + 查表 MOVC A,@A+DPTR 显示字符；多位显示靠动态扫描（位选+段选快速轮流）。\n\n可在仿真页 exp01(流水灯)、exp04(数码管) 边写边看。`,
        relevantChapters: [{ chapter: '3', title: '平台单元 3：指令系统' }],
        relevantVideos: []
      });
    }

    if (lowerQuestion.includes('指令') || lowerQuestion.includes('汇编') || lowerQuestion.includes('mov')) {
      return createResponse('fallback', {
        answer: `关于8051指令系统：\n\n按功能分 5 大类：\n1. 数据传送 MOV/MOVC/MOVX/PUSH/POP\n2. 算术运算 ADD/ADDC/SUBB/INC/DEC/MUL/DIV/DA\n3. 逻辑运算 ANL/ORL/XRL/CLR/CPL/RL/RR\n4. 控制转移 LJMP/AJMP/SJMP/LCALL/ACALL/RET/CJNE/DJNZ\n5. 位操作 SETB/CLR/CPL/JB/JNB/JBC（MCS-51 特色）\n\n学习要点：先掌握寻址方式，再理解每条指令“对谁、做什么、影响哪些标志位”。配合仿真页单步调试观察寄存器变化。`,
        relevantChapters: [{ chapter: '3', title: '平台单元 3：指令系统' }],
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
      answer: `感谢您的提问！建议您查阅相关平台单元内容，或通过仿真实验加深理解。`,
      relevantChapters: [],
      relevantVideos: []
    });
  }
}
