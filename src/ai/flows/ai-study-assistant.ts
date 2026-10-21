'use server';
/**
 * @fileOverview A conversational AI assistant for the "芯智育才" course.
 *
 * - aiStudyAssistant - The main flow for the AI assistant.
 * - AiStudyAssistantInput - The input type for the flow.
 * - AiStudyAssistantOutput - The return type for the flow.
 */
import { videoLibrary } from '@/lib/video-library';
import { SimpleAiClient, type AiAnswerMode } from '@/ai/simple-ai-client';
import {
  chaptersFromContext,
  formatContextForPrompt,
  retrieveContext,
  retrieveCourseSlides,
} from '@/ai/knowledge-context';
import { z } from 'zod';

// 查找相关视频的辅助函数
const findRelevantVideos = (query: string) => {
    const lowerCaseQuery = query.toLowerCase();
    const relevantVideos = videoLibrary.filter(video =>
        video.keywords.some(videoKw => 
            lowerCaseQuery.includes(videoKw.toLowerCase()) || 
            videoKw.toLowerCase().includes(lowerCaseQuery)
        )
    );
    return relevantVideos;
};

const AiStudyAssistantInputSchema = z.object({
    question: z.string().describe('The student\'s question.'),
    history: z.array(z.object({
        role: z.enum(['user', 'model']),
        content: z.array(z.object({text: z.string()})),
    })).optional().describe('The conversation history.'),
});
export type AiStudyAssistantInput = z.infer<typeof AiStudyAssistantInputSchema>;

const AI_ANSWER_MODES = ['generated', 'retrieved', 'fallback'] as const satisfies readonly AiAnswerMode[];
const AiAnswerModeSchema = z.enum(AI_ANSWER_MODES);

const AiStudyAssistantOutputSchema = z.object({
    answer: z.string().describe('The AI assistant\'s direct answer to the question.'),
    source: AiAnswerModeSchema.describe('Stable public provenance for the answer text.'),
    mode: AiAnswerModeSchema.describe('How the answer text was produced.'),
    relevantChapters: z.array(z.object({
        chapter: z.string(),
        title: z.string(),
    })).optional().describe('A list of relevant chapters to recommend for further reading.'),
    relevantVideos: z.array(z.object({
        title: z.string(),
        embedUrl: z.string(),
    })).optional().describe('A list of relevant videos to recommend.'),
    relatedNodes: z.array(z.object({
        id: z.string(),
        name: z.string(),
        chapter: z.number(),
        level: z.number(),
    })).optional().describe('Knowledge-graph node ids the answer relies on; UI can deep-link to /knowledge-graph?node=X.'),
    courseSources: z.array(z.object({
      id: z.string(), title: z.string(), page: z.number().int(), sourcePage: z.number().int(),
      href: z.string(), excerpt: z.string(),
      readingNotes: z.array(z.object({ text: z.string(), title: z.string(), url: z.string() })).optional(),
    })).optional().describe('Actual course PDF page text supplied for reference, not proof of a generated claim.'),
    usage: z.object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    }).optional().describe('Token usage of the underlying model call; absent for local fallback answers.'),
});
export type AiStudyAssistantOutput = z.infer<typeof AiStudyAssistantOutputSchema>;

function assertMatchingProvenance(source: unknown, mode: unknown): asserts source is AiAnswerMode {
  if (!AI_ANSWER_MODES.includes(source as AiAnswerMode) || source !== mode) {
    throw new Error('SimpleAiClient returned invalid answer provenance');
  }
}

// 使用 智谱 GLM 替代 Genkit prompt
// 智谱 GLMClient is now handled within SimpleAiClient

// 新的助手流程，直接使用 智谱 GLM
async function aiStudyAssistantFlow(input: AiStudyAssistantInput): Promise<AiStudyAssistantOutput> {
  try {
    const { question: userMessage } = input;

    // RAG: pull the most relevant knowledge points + experiments from the
    // canonical course content and inject them into the AI's system prompt
    // so the answer is grounded.
    // 学生端只展示最相关的三个节点和一个实验，避免把低相关结果包装成推荐。
    const ctx = {
      ...retrieveContext(userMessage, { maxKnowledge: 3, maxExperiments: 1 }),
      slides: retrieveCourseSlides(userMessage, { limit: 3 }),
    };
    const courseContext = formatContextForPrompt(ctx);

    // 把最近几轮对话转成 智谱 GLM 消息格式，支持多轮追问
    const history = (input.history ?? []).slice(-6).map((h) => ({
      role: h.role === 'model' ? ('assistant' as const) : ('user' as const),
      content: h.content.map((c) => c.text).join('\n'),
    }));

    const aiClient = new SimpleAiClient();
    const response = await aiClient.chat(userMessage, courseContext, history);
    assertMatchingProvenance(response.source, response.mode);

    const requestedPage = userMessage.match(/(?:PDF\s*第?\s*|课件\s*P\s*)(\d{1,3})(?:\s*页)?/i);
    const exactPage = requestedPage ? ctx.slides.find((page) => page.page === Number(requestedPage[1])) : undefined;
    const pageFallback = response.mode === 'fallback' && exactPage
      ? {
          source: 'retrieved' as const, mode: 'retrieved' as const,
          answer: `以下为指定课件页的${exactPage.readingNotes.length ? '阅读提示' : '原页文字'}，供直接对照；本次未取得生成式解释。\n\n[课件P${exactPage.page}] ${exactPage.deckTitle}（原课件第${exactPage.sourcePage}页）\n\n${exactPage.readingNotes.length ? exactPage.readingNotes.map((note) => note.text).join('\n\n') : exactPage.text}\n\n完整原页和参考出处见下方“对照授课课件”。`
        }
      : null;

    // relevantChapters now reflects the actual retrieval hit set instead of
    // the previous stale 9-chapter keyword map.
    const relevantChapters = chaptersFromContext(ctx);
    const relevantVideos = findRelevantVideos(userMessage);
    const relatedNodes = response.mode === 'fallback'
      ? []
      : ctx.knowledgePoints.map((p) => ({
          id: p.id,
          name: p.name,
          chapter: p.chapter,
          level: p.level,
        }));

    return AiStudyAssistantOutputSchema.parse({
      usage: pageFallback ? undefined : aiClient.lastUsage,
      answer: pageFallback?.answer ?? response.answer,
      source: pageFallback?.source ?? response.source,
      mode: pageFallback?.mode ?? response.mode,
      relevantChapters: pageFallback ? [] : relevantChapters,
      relevantVideos: pageFallback ? [] : relevantVideos,
      relatedNodes,
      courseSources: ctx.slides.map((page) => ({
        id: page.id, title: page.deckTitle, page: page.page, sourcePage: page.sourcePage,
        href: page.href, excerpt: page.text, readingNotes: page.readingNotes,
      })),
    });
  } catch (error) {
    console.error('SimpleAiClient error:', error);
    throw error;
  }
}

// 生成备用回答的辅助函数
const generateFallbackAnswer = (question: string): AiStudyAssistantOutput => {
    const lowerQuestion = question.toLowerCase();
    
    // 常见问题的直接回答
    if (lowerQuestion.includes('定时器') || lowerQuestion.includes('timer')) {
        return {
            answer: `关于8051定时器的问题：

经典8051微控制器内置2个16位定时器/计数器（T0和T1），主要特点：
- T0工作模式：模式0(13位)、模式1(16位)、模式2(8位自动重装)、模式3(双8位)；T0方式3会限制T1的使用
- 控制寄存器：TMOD(模式控制)、TCON(控制寄存器)
- 常用于串口波特率生成、延时、计数等

示例代码：
\`\`\`asm
; 配置片段：经典12T内核、11.0592MHz，用T1方式2产生波特率
ANL PCON, #7FH   ; SMOD=0
MOV TMOD, #20H    ; T1模式2
MOV TH1, #0FDH    ; 自动重装初值
MOV TL1, #0FDH    ; 首次计数初值
SETB TR1          ; 启动定时器1
\`\`\`

如需更详细信息，建议阅读平台单元6（对应大纲第5章的定时/计数器部分）。`,
            source: 'fallback',
            mode: 'fallback',
            relevantChapters: [{ chapter: '6', title: '平台单元 6：定时器/计数器' }],
            relevantVideos: []
        };
    }

    if (lowerQuestion.includes('中断') || lowerQuestion.includes('interrupt')) {
        return {
            answer: `关于8051中断系统：

经典8051有5个中断源：
1. 外部中断0 (INT0)
2. 定时器0溢出 (TF0)  
3. 外部中断1 (INT1)
4. 定时器1溢出 (TF1)
5. 串行口中断 (TI/RI)

关键寄存器：
- IE：中断允许寄存器
- IP：中断优先级寄存器

示例代码：
\`\`\`asm
; 允许总中断和定时器0中断
SETB EA    ; 开总中断
SETB ET0   ; 允许T0中断

; 中断服务程序
ORG 000BH  ; T0中断向量
    ; 中断处理代码
    RETI   ; 中断返回
\`\`\`

建议查看平台单元5了解详细的中断编程。`,
            source: 'fallback',
            mode: 'fallback',
            relevantChapters: [{ chapter: '5', title: '平台单元 5：中断系统' }],
            relevantVideos: []
        };
    }

    if (/\bi\s*\/?\s*o\b|\bp[0-3](?:\.[0-7])?\b/i.test(lowerQuestion) || lowerQuestion.includes('端口')) {
        return {
            answer: `关于8051 I/O端口：

经典8051有4个8位I/O端口：
- P0：用作通用输出时为开漏输出，需外接上拉电阻；访问外部存储器时可用作地址/数据复用总线
- P1：准双向口，内带上拉电阻，无第二功能
- P2：准双向口，可输出高8位地址
- P3：准双向口，每位都有第二功能（RXD、TXD、INT0、INT1等）

基本操作：
\`\`\`asm
MOV P1, #0FFH    ; 向锁存器写1，供读取外部输入
MOV A, P1        ; 读取P1状态
SETB P1.0        ; P1.0输出高电平
CLR P1.0         ; P1.0输出低电平
\`\`\`

详细内容请参考平台单元2的 2.3 I/O 接口与平台单元8接口技术。`,
            source: 'fallback',
            mode: 'fallback',
            relevantChapters: [{ chapter: '2', title: '平台单元 2：硬件结构' }],
            relevantVideos: []
        };
    }

    if (lowerQuestion.includes('串口') || lowerQuestion.includes('uart') || lowerQuestion.includes('通信')) {
        return {
            answer: `关于8051串行通信：

8051内置全双工串行口，支持4种工作模式：
- 模式0：同步移位寄存器
- 模式1：8位UART，波特率可变
- 模式2：9位UART，波特率固定
- 模式3：9位UART，波特率可变

关键寄存器：
- SCON：串行控制寄存器
- SBUF：串行数据缓冲器
- PCON：波特率倍增控制

示例代码：
\`\`\`asm
; 配置片段：经典12T内核、11.0592MHz，串口模式1、9600bit/s
ANL PCON, #7FH   ; SMOD=0
MOV SCON, #50H    ; 模式1，允许接收
MOV TMOD, #20H    ; T1模式2
MOV TH1, #0FDH    ; 自动重装初值
MOV TL1, #0FDH    ; 首次计数初值
SETB TR1          ; 启动T1
\`\`\`

建议学习平台单元7，串行通信对应大纲及授课课件第6章。`,
            source: 'fallback',
            mode: 'fallback',
            relevantChapters: [{ chapter: '7', title: '平台单元 7：串行通信' }],
            relevantVideos: []
        };
    }
    
    // 默认通用回答
    return {
        answer: `感谢您的提问！虽然AI助教暂时无法提供详细回答，但我建议您：

1. 查阅相关平台单元的理论知识
2. 通过仿真实验加深理解
3. 参与在线测评检验学习效果

如果是关于8051微控制器的具体问题，您可以尝试：
- 重新表述问题，使用更具体的关键词
- 查看相关平台单元内容
- 通过仿真页面进行实际操作

常见主题包括：CPU结构、存储器、I/O端口、指令系统、定时器、中断、LED显示、串行通信等。`,
        source: 'fallback',
        mode: 'fallback',
        relevantChapters: [],
        relevantVideos: []
    };
};

export async function aiStudyAssistant(input: AiStudyAssistantInput): Promise<AiStudyAssistantOutput> {
    // AI Study Assistant called with input question
    try {
        const result = await aiStudyAssistantFlow(input);
        // AI Study Assistant response received
        return result;
    } catch (error) {
        console.error('AI Study Assistant Error:', error);
        
        // 检查是否是API密钥错误
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isApiKeyError = errorMessage.includes('API key not valid') || 
                             errorMessage.includes('API_KEY_INVALID') ||
                             errorMessage.includes('your_actual_google_ai_api_key_here');
        
        if (isApiKeyError) {
            // API key invalid, using fallback response
            return generateFallbackAnswer(input.question);
        } else {
            // 对于其他错误，尝试一次重试
            try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await aiStudyAssistantFlow(input);
            } catch (retryError) {
                // Retry failed, using fallback response
                return generateFallbackAnswer(input.question);
            }
        }
    }
}
