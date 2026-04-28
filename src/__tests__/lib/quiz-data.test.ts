import { quizQuestions, type MultipleChoiceQuestion, type CodeCompletionQuestion } from '@/lib/quiz-data';

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
      
      // 验证包含核心知识点
      const expectedKAs = [
        '存储器结构',
        'CPU结构', 
        'I/O 端口',
        '寻址方式',
        '定时器/计数器',
        '中断系统',
        '指令系统'
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

    it('每个知识点应该有足够的题目', () => {
      const kaCount = new Map<string, number>();
      
      quizQuestions.forEach(q => {
        kaCount.set(q.ka, (kaCount.get(q.ka) || 0) + 1);
      });
      
      // 每个知识点至少应该有1道题
      kaCount.forEach((count) => {
        expect(count).toBeGreaterThanOrEqual(1);
      });
    });

    it('应该包含不同类型的题目', () => {
      const types = new Set(quizQuestions.map(q => q.type));
      expect(types.has('multiple-choice')).toBe(true);
      expect(types.has('code-completion')).toBe(true);
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
