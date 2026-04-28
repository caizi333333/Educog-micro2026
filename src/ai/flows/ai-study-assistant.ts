'use server';
/**
 * @fileOverview A conversational AI assistant for the "芯智育才" course.
 *
 * - aiStudyAssistant - The main flow for the AI assistant.
 * - AiStudyAssistantInput - The input type for the flow.
 * - AiStudyAssistantOutput - The return type for the flow.
 */
import { videoLibrary } from '@/lib/video-library';
import { SimpleAiClient } from '@/ai/simple-ai-client';
import {
  chaptersFromContext,
  formatContextForPrompt,
  retrieveContext,
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

const AiStudyAssistantOutputSchema = z.object({
    answer: z.string().describe('The AI assistant\'s direct answer to the question.'),
    relevantChapters: z.array(z.object({
        chapter: z.string(),
        title: z.string(),
    })).optional().describe('A list of relevant chapters to recommend for further reading.'),
    relevantVideos: z.array(z.object({
        title: z.string(),
        embedUrl: z.string(),
    })).optional().describe('A list of relevant videos to recommend.'),
});
export type AiStudyAssistantOutput = z.infer<typeof AiStudyAssistantOutputSchema>;

// 使用 DeepSeek 替代 Genkit prompt
// DeepSeekClient is now handled within SimpleAiClient

// 新的助手流程，直接使用 DeepSeek
async function aiStudyAssistantFlow(input: AiStudyAssistantInput): Promise<AiStudyAssistantOutput> {
  try {
    const { question: userMessage } = input;

    // RAG: pull the most relevant knowledge points + experiments from the
    // canonical course content and inject them into the AI's system prompt
    // so the answer is grounded.
    const ctx = retrieveContext(userMessage);
    const courseContext = formatContextForPrompt(ctx);

    const aiClient = new SimpleAiClient();
    const response = await aiClient.chat(userMessage, courseContext);

    // relevantChapters now reflects the actual retrieval hit set instead of
    // the previous stale 9-chapter keyword map.
    const relevantChapters = chaptersFromContext(ctx);
    const relevantVideos = findRelevantVideos(userMessage);

    return {
      answer: response.answer,
      relevantChapters,
      relevantVideos,
    };
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

8051微控制器内置2个16位定时器/计数器（T0和T1），主要特点：
- 工作模式：模式0(13位)、模式1(16位)、模式2(8位自动重装)、模式3(双8位)
- 控制寄存器：TMOD(模式控制)、TCON(控制寄存器)
- 常用于串口波特率生成、延时、计数等

示例代码：
\`\`\`asm
; 配置定时器1工作模式2，用于串口波特率
MOV TMOD, #20H    ; T1模式2
MOV TH1, #0FDH    ; 9600波特率@11.0592MHz
SETB TR1          ; 启动定时器1
\`\`\`

如需更详细信息，建议阅读第6章相关内容。`,
            relevantChapters: [{ chapter: '6', title: '第 6 章：定时器/计数器' }],
            relevantVideos: []
        };
    }

    if (lowerQuestion.includes('中断') || lowerQuestion.includes('interrupt')) {
        return {
            answer: `关于8051中断系统：

8051有5个中断源：
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

建议查看第5章了解详细的中断编程。`,
            relevantChapters: [{ chapter: '5', title: '第 5 章：中断系统' }],
            relevantVideos: []
        };
    }

    if (lowerQuestion.includes('io') || lowerQuestion.includes('端口') || lowerQuestion.includes('p0') || lowerQuestion.includes('p1')) {
        return {
            answer: `关于8051 I/O端口：

8051有4个8位I/O端口：
- P0：开漏输出，需外接上拉电阻，可用作地址/数据复用总线
- P1：准双向口，内带上拉电阻，无第二功能
- P2：准双向口，可输出高8位地址
- P3：准双向口，每位都有第二功能（RXD、TXD、INT0、INT1等）

基本操作：
\`\`\`asm
MOV P1, #0FFH    ; P1全部输出高电平
MOV A, P1        ; 读取P1状态
SETB P1.0        ; P1.0输出高电平
CLR P1.0         ; P1.0输出低电平
\`\`\`

详细内容请参考第2章 2.3 I/O 接口与第8章接口技术。`,
            relevantChapters: [{ chapter: '2', title: '第 2 章：硬件结构' }],
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
; 配置串口模式1，9600波特率
MOV SCON, #50H    ; 模式1，允许接收
MOV TMOD, #20H    ; T1模式2
MOV TH1, #0FDH    ; 9600@11.0592MHz
SETB TR1          ; 启动T1
\`\`\`

建议学习第7章获得完整的串行通信知识。`,
            relevantChapters: [{ chapter: '7', title: '第 7 章：串行通信' }],
            relevantVideos: []
        };
    }
    
    // 默认通用回答
    return {
        answer: `感谢您的提问！虽然AI助教暂时无法提供详细回答，但我建议您：

1. 查阅相关章节的理论知识
2. 通过仿真实验加深理解
3. 参与在线测评检验学习效果

如果是关于8051微控制器的具体问题，您可以尝试：
- 重新表述问题，使用更具体的关键词
- 查看相关章节内容
- 通过仿真页面进行实际操作

常见主题包括：CPU结构、存储器、I/O端口、指令系统、定时器、中断、LED显示、串行通信等。`,
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
