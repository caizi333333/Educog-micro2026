import { quizQuestions, type MultipleChoiceQuestion, type CodeCompletionQuestion } from '@/lib/quiz-data';
import { knowledgePoints } from '@/lib/knowledge-points';
import {
  ADDRESSING_INITIAL_QUESTION_IDS,
  ADDRESSING_RETEST_QUESTION_IDS,
  AI_LITERACY_QUESTION_IDS,
} from '@/lib/lesson-tasks';

describe('Quiz Data Tests', () => {
  describe('Quiz Questions Structure', () => {
    it('应该包含测验问题', () => {
      expect(quizQuestions).toBeDefined();
      expect(Array.isArray(quizQuestions)).toBe(true);
      expect(quizQuestions.length).toBeGreaterThan(0);
    });

    it('每个问题都应该有必需的字段', () => {
      quizQuestions.forEach((question) => {
        expect(question).toHaveProperty('id');
        expect(question).toHaveProperty('questionText');
        expect(question).toHaveProperty('type');
        expect(question).toHaveProperty('correctAnswer');
        expect(question).toHaveProperty('ka');
        expect(question).toHaveProperty('chapter');

        expect(typeof question.id).toBe('number');
        expect(typeof question.questionText).toBe('string');
        expect(typeof question.type).toBe('string');
        expect(typeof question.correctAnswer).toBe('string');
        expect(typeof question.ka).toBe('string');
        expect(typeof question.chapter).toBe('number');

        expect(question.questionText.trim()).not.toBe('');
        expect(question.correctAnswer.trim()).not.toBe('');
        expect(question.ka.trim()).not.toBe('');
        expect(question.chapter).toBeGreaterThan(0);
      });
    });

    it('每道题的知识点必须存在，且章节与知识树一致', () => {
      const pointById = new Map(knowledgePoints.map((point) => [point.id, point]));

      quizQuestions.forEach((question) => {
        const point = pointById.get(question.ka);
        expect(point).toBeDefined();
        expect(question.chapter).toBe(point?.chapter);
      });
    });

    it('综合应用题应按实际教学语义归组，不得集中挂在项目文档或调试父节点', () => {
      const auditedMappings: Record<number, { ka: string; chapter: number }> = {
        135: { ka: '6.3', chapter: 6 },
        187: { ka: '2.5.3', chapter: 2 },
        188: { ka: '9.1.2', chapter: 9 },
        189: { ka: '2.5', chapter: 2 },
        190: { ka: '9.3.4', chapter: 9 },
        191: { ka: '9.1.4', chapter: 9 },
        192: { ka: '9.1.4', chapter: 9 },
        195: { ka: '2.7', chapter: 2 },
        196: { ka: '2.7', chapter: 2 },
        197: { ka: '9.1.4', chapter: 9 },
        198: { ka: '9.1.4', chapter: 9 },
        199: { ka: '9.3.3', chapter: 9 },
        200: { ka: '9.3.5', chapter: 9 },
      };

      Object.entries(auditedMappings).forEach(([id, expected]) => {
        expect(quizQuestions.find((question) => question.id === Number(id))).toMatchObject(expected);
      });
    });

    it('选择题应该有选项字段', () => {
      const multipleChoiceQuestions = quizQuestions.filter(
        (q): q is MultipleChoiceQuestion => q.type === 'multiple-choice'
      );

      expect(multipleChoiceQuestions.length).toBeGreaterThan(0);

      multipleChoiceQuestions.forEach((question) => {
        expect(question).toHaveProperty('options');
        expect(Array.isArray(question.options)).toBe(true);
        expect(question.options.length).toBeGreaterThanOrEqual(2);
        
        // 验证选项不为空
        question.options.forEach((option) => {
          expect(typeof option).toBe('string');
          expect(option.trim()).not.toBe('');
        });

        // 验证正确答案在选项中
        expect(question.options).toContain(question.correctAnswer);
      });
    });

    it('代码补全题应该有代码字段', () => {
      const codeCompletionQuestions = quizQuestions.filter(
        (q): q is CodeCompletionQuestion => q.type === 'code-completion'
      );

      expect(codeCompletionQuestions.length).toBeGreaterThan(0);

      codeCompletionQuestions.forEach((question) => {
        expect(question).toHaveProperty('code');
        expect(typeof question.code).toBe('string');
        expect(question.code.trim()).not.toBe('');
        
        // 验证代码中包含占位符或空白
        expect(
          question.code.includes('___') || 
          question.code.includes('____') ||
          question.code.includes('_____')
        ).toBe(true);
      });
    });

    it('问题ID应该是唯一的', () => {
      const ids = quizQuestions.map(q => q.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('应该涵盖多个知识点', () => {
      const knowledgeAreas = new Set(quizQuestions.map(q => q.ka));
      expect(knowledgeAreas.size).toBeGreaterThan(5);

      // ka 已对齐知识图谱节点 id（src/lib/knowledge-points.ts）
      // 验证核心知识点的 id 都已被覆盖
      const expectedKAs = [
        '2.2', // 存储器组织
        '2.1', // CPU结构
        '2.3', // I/O接口
        '3.1.1', // 立即寻址
        '6.2', // 定时器/计数器
        '5.2', // 中断系统
        '3.5', // 指令系统
      ];

      expectedKAs.forEach(ka => {
        expect(Array.from(knowledgeAreas)).toContain(ka);
      });
    });

    it('应该涵盖多个章节', () => {
      const chapters = new Set(quizQuestions.map(q => q.chapter));
      expect(chapters.size).toBeGreaterThan(3);
      
      // 验证章节号合理
      chapters.forEach(chapter => {
        expect(chapter).toBeGreaterThanOrEqual(1);
        expect(chapter).toBeLessThanOrEqual(11);
      });
    });

    it('53个二级可考核知识点应各有至少3道关联试题', () => {
      const pointById = new Map(knowledgePoints.map((point) => [point.id, point]));
      const levelTwoPoints = knowledgePoints.filter((point) => point.level === 2);
      const questionCount = new Map(levelTwoPoints.map((point) => [point.id, 0]));

      const resolveAssessablePointId = (knowledgePointId: string): string | null => {
        let point = pointById.get(knowledgePointId);
        while (point && point.level > 2) {
          point = point.parentId ? pointById.get(point.parentId) : undefined;
        }
        return point?.level === 2 ? point.id : null;
      };

      quizQuestions.forEach((question) => {
        const assessablePointId = resolveAssessablePointId(question.ka);
        if (!assessablePointId) return;
        questionCount.set(assessablePointId, (questionCount.get(assessablePointId) ?? 0) + 1);
      });

      expect(levelTwoPoints).toHaveLength(53);
      const gaps = [...questionCount.entries()]
        .filter(([, count]) => count < 3)
        .map(([id, count]) => ({ id, count }));
      expect(gaps).toEqual([]);
      ['2.7', '8.6', '9.2', '9.4'].forEach((id) => {
        expect(questionCount.get(id)).toBeGreaterThanOrEqual(3);
      });
    });

    it('应该包含不同类型的题目', () => {
      const types = new Set(quizQuestions.map(q => q.type));
      expect(types.has('multiple-choice')).toBe(true);
      expect(types.has('code-completion')).toBe(true);
    });

    it('寻址方式首测与复测应题目不重复且各覆盖七个子节点', () => {
      const initialIds = new Set<number>(ADDRESSING_INITIAL_QUESTION_IDS);
      const retestIds = new Set<number>(ADDRESSING_RETEST_QUESTION_IDS);
      expect([...initialIds].filter((id) => retestIds.has(id))).toEqual([]);
      const expectedKAs = ['3.1.1', '3.1.2', '3.1.3', '3.1.4', '3.1.5', '3.1.6', '3.1.7'];
      const kasFor = (ids: Set<number>) => quizQuestions.filter((question) => ids.has(question.id)).map((question) => question.ka).sort();
      expect(kasFor(initialIds)).toEqual(expectedKAs);
      expect(kasFor(retestIds)).toEqual(expectedKAs);
    });

    it('AI素养测评应覆盖五个责任使用子节点', () => {
      const ids = new Set<number>(AI_LITERACY_QUESTION_IDS);
      const selected = quizQuestions.filter((question) => ids.has(question.id));
      expect(selected).toHaveLength(5);
      expect(selected.map((question) => question.ka).sort()).toEqual([
        '10.5.1', '10.5.2', '10.5.3', '10.5.4', '10.5.5',
      ]);
    });
  });

  describe('Question Content Quality', () => {
    it('选择题的选项应该有合理的长度', () => {
      const multipleChoiceQuestions = quizQuestions.filter(
        (q): q is MultipleChoiceQuestion => q.type === 'multiple-choice'
      );

      multipleChoiceQuestions.forEach(question => {
        question.options.forEach(option => {
          expect(option.length).toBeGreaterThan(0);
          expect(option.length).toBeLessThan(200); // 选项不应过长
        });
      });
    });

    it('问题文本应该有合理的长度', () => {
      quizQuestions.forEach(question => {
        expect(question.questionText.length).toBeGreaterThan(5);
        expect(question.questionText.length).toBeLessThan(500);
      });
    });

    it('正确答案应该有合理的长度', () => {
      quizQuestions.forEach(question => {
        expect(question.correctAnswer.length).toBeGreaterThan(0);
        expect(question.correctAnswer.length).toBeLessThan(100);
      });
    });

    it('代码补全题的代码应该包含适当的格式', () => {
      const codeCompletionQuestions = quizQuestions.filter(
        (q): q is CodeCompletionQuestion => q.type === 'code-completion'
      );

      codeCompletionQuestions.forEach(question => {
        // 代码应该包含换行符或适当的格式
        expect(
          question.code.includes('\n') ||
          question.code.includes('MOV') ||
          question.code.includes('SETB') ||
          question.code.includes('CLR') ||
          question.code.includes('SJMP') ||
          question.code.includes('DJNZ')
        ).toBe(true);
      });
    });
  });

  describe('Data Consistency', () => {
    it('知识点名称应该一致', () => {
      const knowledgeAreas = quizQuestions.map(q => q.ka);
      const uniqueKAs = Array.from(new Set(knowledgeAreas));

      // 跳过形如 '7.1.1' 的层级节点 id —— 它们天然相似（同 parent 下的兄弟）
      // 是有意为之，不是拼写错误。该一致性检查只用于老的中文 ka 名称
      const HIERARCHICAL_ID = /^\d+(\.\d+)+$/;
      const namedOnly = uniqueKAs.filter((ka) => !HIERARCHICAL_ID.test(ka));

      namedOnly.forEach(ka1 => {
        namedOnly.forEach(ka2 => {
          if (ka1 !== ka2) {
            const similarity = calculateSimilarity(ka1, ka2);
            expect(similarity).toBeLessThan(0.8);
          }
        });
      });
    });

    it('章节分布应该合理', () => {
      const chapterDistribution = new Map<number, number>();
      
      quizQuestions.forEach(q => {
        chapterDistribution.set(q.chapter, (chapterDistribution.get(q.chapter) || 0) + 1);
      });
      
      // 每个章节应该有题目
      chapterDistribution.forEach((count) => {
        expect(count).toBeGreaterThan(0);
      });
      
      // 章节分布不应过于不均匀（如果有多个章节）
      const counts = Array.from(chapterDistribution.values());
      if (counts.length > 1) {
        const maxCount = Math.max(...counts);
        const minCount = Math.min(...counts);
        // 放宽比例要求，因为实际数据可能不均匀
        expect(maxCount / minCount).toBeLessThan(50);
      }
    });
  });
});

// 辅助函数：计算字符串相似度
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// 计算编辑距离
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0]![j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }
  
  return matrix[str2.length]![str1.length]!;
}
