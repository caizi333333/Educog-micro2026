'use server';
/**
 * @fileOverview Generates a personalized learning plan based on weak areas.
 *
 * - generateLearningPlan - The main flow for generating a learning plan.
 */

import { SimpleAiClient } from '@/ai/simple-ai-client';
import { z } from 'zod';

const LearningPlanInputSchema = z.object({
  weakKnowledgeAreas: z.array(z.string()).describe('A list of knowledge areas where the student is weak.'),
});
export type LearningPlanInput = z.infer<typeof LearningPlanInputSchema>;

const LearningPlanOutputSchema = z.object({
  plan: z.array(z.object({
    step: z.number().describe('The step number in the learning plan.'),
    type: z.enum(['read', 'simulate', 'watch', 'quiz']).describe("The type of learning activity. 'read' for course content, 'simulate' for experiments, 'watch' for videos, 'quiz' for tests."),
    title: z.string().describe('A short title for the learning step.'),
    description: z.string().describe('A detailed description of the activity and its goal.'),
    resource: z.object({
      text: z.string().describe('The text to display for the resource link (e.g., "阅读第5章", "开始仿真实验").'),
      href: z.string().describe("The URL or path for the resource (e.g., '/#item-5', '/simulation')."),
    }),
  })).describe('A list of steps in the personalized learning plan.'),
});
export type LearningPlanOutput = z.infer<typeof LearningPlanOutputSchema>;

// 简化的学习计划生成实现
async function learningPlanFlow(input: LearningPlanInput): Promise<LearningPlanOutput> {
  const { weakKnowledgeAreas } = input;
  
  try {
    const aiClient = new SimpleAiClient();
    const prompt = `你是一位专业的8051微控制器课程导师。请为学生的薄弱知识领域制定个性化的学习计划。

薄弱领域：${weakKnowledgeAreas.join('、')}

请制定3-5个学习步骤，包括：
1. 阅读相关章节
2. 进行仿真实验
3. 重新测试

请用中文回答，提供具体实用的建议。`;
    
    const response = await aiClient.chat(prompt);
    
    // 生成基本的学习计划
    return generateBasicLearningPlan(weakKnowledgeAreas, response.answer);
  } catch (error) {
    console.error('Learning plan generation error:', error);
    return generateFallbackLearningPlan(weakKnowledgeAreas);
  }
}

// 生成基本学习计划
function generateBasicLearningPlan(weakAreas: string[], _aiResponse: string): LearningPlanOutput {
  const plan: LearningPlanOutput['plan'] = [];
  let stepNumber = 1;
  
  // 为每个薄弱领域生成学习步骤
  weakAreas.forEach(area => {
    const chapterMap: Record<string, string> = {
      '定时器': '5',
      '中断': '6', 
      'I/O端口': '3',
      '串行通信': '9',
      '汇编语言': '4',
      '存储器': '2'
    };
    
    const chapterNum = Object.keys(chapterMap).find(key => area.includes(key)) ? 
      chapterMap[Object.keys(chapterMap).find(key => area.includes(key))!] : '1';
    
    // 阅读章节
    plan.push({
      step: stepNumber++,
      type: 'read',
      title: `复习${area}理论知识`,
      description: `仔细阅读相关章节，理解${area}的基本概念和工作原理。`,
      resource: {
        text: `阅读第${chapterNum}章`,
        href: `/#item-${chapterNum}`
      }
    });
    
    // 仿真实验
    plan.push({
      step: stepNumber++,
      type: 'simulate',
      title: `${area}仿真实验`,
      description: `通过仿真实验加深对${area}的理解，观察实际运行效果。`,
      resource: {
        text: '开始仿真实验',
        href: '/simulation'
      }
    });
  });
  
  // 最后添加测试步骤
  plan.push({
    step: stepNumber,
    type: 'quiz',
    title: '重新测试',
    description: '完成学习后，重新进行测试以检验学习效果。',
    resource: {
      text: '开始测试',
      href: '/quiz'
    }
  });
  
  return { plan };
}

// 生成备用学习计划
function generateFallbackLearningPlan(weakAreas: string[]): LearningPlanOutput {
  return {
    plan: [
      {
        step: 1,
        type: 'read',
        title: '复习基础理论',
        description: `针对薄弱领域（${weakAreas.join('、')}），建议先复习相关理论知识。`,
        resource: {
          text: '阅读课程内容',
          href: '/#item-1'
        }
      },
      {
        step: 2,
        type: 'simulate',
        title: '实践仿真',
        description: '通过仿真实验加深理解，将理论知识应用到实际操作中。',
        resource: {
          text: '开始仿真实验',
          href: '/simulation'
        }
      },
      {
        step: 3,
        type: 'quiz',
        title: '重新测试',
        description: '完成学习后重新测试，检验学习效果。',
        resource: {
          text: '开始测试',
          href: '/quiz'
        }
      }
    ]
  };
}

export async function generateLearningPlan(input: LearningPlanInput): Promise<LearningPlanOutput> {
  return learningPlanFlow(input);
}
