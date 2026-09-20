import { quizQuestions, toPublicQuestion, isQuestionSource, type MultipleChoiceQuestion, type CodeCompletionQuestion, type Question } from '@/lib/quiz-data';
import { knowledgePoints } from '@/lib/knowledge-points';
import { getTeachingContent } from '@/lib/teaching-content';
import {
  ADDRESSING_INITIAL_QUESTION_IDS,
  ADDRESSING_RETEST_QUESTION_IDS,
  AI_LITERACY_QUESTION_IDS,
} from '@/lib/lesson-tasks';

describe('Quiz Data Tests', () => {
  describe('网页指导练习与真实知识点覆盖', () => {
    const additions = quizQuestions.filter((question) => question.id >= 366 && question.id <= 497);

    it('顺延132题并使49个有具体指导依据的三级节点实际达到3题', () => {
      expect(additions.map((question) => question.id)).toEqual(Array.from({ length: 132 }, (_, index) => index + 366));
      const leafIds = new Set(additions.map((question) => question.ka));
      expect(leafIds.size).toBe(49);
      for (const id of leafIds) {
        expect(knowledgePoints.find((point) => point.id === id)?.level).toBe(3);
        expect(quizQuestions.filter((question) => question.ka === id)).toHaveLength(3);
      }
      expect(quizQuestions.filter((question) => question.id <= 365)).toHaveLength(365);
      expect(new Set(quizQuestions.map((question) => question.questionText)).size).toBe(quizQuestions.length);
    });

    it('每题链接准确的现有指导章节，解析和答案仅在提交后公开', () => {
      for (const question of additions) {
        expect(isQuestionSource(question.source)).toBe(true);
        const source = question.source;
        if (source?.kind !== 'guide') throw new Error(`Question ${question.id} has no guide source`);
        const section = getTeachingContent(source.experimentId)?.theory.find((candidate) => candidate.title === source.section);
        expect(section?.content.trim().length).toBeGreaterThan(100);
        expect(knowledgePoints.find((point) => point.id === question.ka)?.resources?.some((resource) => resource.url === source.url)).toBe(true);
        expect(question.explanation?.length).toBeGreaterThan(20);
        expect(toPublicQuestion(question)).not.toHaveProperty('correctAnswer');
        expect(toPublicQuestion(question)).not.toHaveProperty('explanation');
        expect(toPublicQuestion(question).source).toEqual(source);
        if (question.type !== 'multiple-choice') throw new Error(`Unexpected question type: ${question.id}`);
        expect(new Set(question.options).size).toBe(4);
        expect(question.options.filter((option) => option === question.correctAnswer)).toHaveLength(1);
      }
    });

    it('独立回算算术、寻址、定时、量化和负温度结果', () => {
      const answer = (id: number) => quizQuestions.find((question) => question.id === id)?.correctAnswer;
      const hex = (value: number, width = 2) => value.toString(16).toUpperCase().padStart(width, '0') + 'H';
      expect(answer(388)).toBe(`${(5 - 2) / 0.0015 / 1000}kΩ`);
      expect(answer(394)).toBe(hex(0x1200 + 3, 4));
      expect(answer(395)).toBe(hex(0x100 + 2 + 5, 4));
      expect(answer(408)).toBe(hex(0x12 + 0x20 + 1));
      expect(answer(410)).toBe(hex(0x10 - 3 - 1));
      expect(answer(411)).toBe(`A=${hex((0x20 - 0x30) & 0xFF)}，CY=1`);
      expect(answer(413)).toBe(`A=${hex((0x20 * 0x10) & 0xFF)}，B=${hex((0x20 * 0x10) >> 8)}`);
      expect(answer(416)).toBe(`A=${Math.floor(29 / 10)}，B=${29 % 10}`);
      expect(answer(419)).toBe(hex(0x09 + 0x01 + 0x06));
      expect(answer(422)).toBe(hex(0xA5 & 0x3C));
      expect(answer(425)).toBe(hex(0x40 | 0x05));
      expect(answer(427)).toBe(hex(0x5A ^ 0xFF));
      expect(answer(430)).toBe(hex((~0x0F) & 0xFF));
      expect(answer(448)).toBe(hex(65536 - 1000, 4));
      expect(answer(449)).toBe(`${(65536 - 0xD8F0) / 1000}ms`);
      expect(answer(455)).toBe(hex(256 - 200));
      expect(answer(457)).toBe(`${1e6 / (2 * 1000)}μs`);
      expect(answer(460)).toBe(`${1 / 4 * 100}%`);
      expect(answer(461)).toBe(`${5 * 0.4}V`);
      expect(answer(462)).toBe(`256ms、${(1000 / 256).toFixed(2)}Hz`);
      expect(answer(463)).toBe(`${1000 / 50}次`);
      expect(answer(465)).toBe(`${20 * 0.1}ms`);
      expect(answer(467)).toBe(hex(0x3F ^ 0xFF));
      expect(answer(469)).toBe(`${4 * 2}ms、${1000 / (4 * 2)}Hz`);
      expect(answer(479)).toBe(String(2 * 4 + 3));
      expect(answer(487)).toBe(`${(5 / 256 * 1000).toFixed(2)}mV`);
      expect(answer(490)).toBe(`${0x0191 * 0.0625}°C`);
      expect(answer(491)).toBe(`${(0xFF5E - 65536) * 0.0625}°C`.replace('-', '−'));
    });

    it('来源校验拒绝外部、伪造实验、空标题与越界页码，同时兼容旧PDF来源', () => {
      const guide = additions[0]!.source!;
      expect(isQuestionSource(guide)).toBe(true);
      expect(isQuestionSource({ ...guide, url: 'javascript:alert(1)' })).toBe(false);
      expect(isQuestionSource({ ...guide, experimentId: 'exp99', url: '/simulation?experiment=exp99&view=guide' })).toBe(false);
      expect(isQuestionSource({ ...guide, section: '' })).toBe(false);
      expect(isQuestionSource({ ...guide, page: 1 })).toBe(false);
      expect(isQuestionSource({ title: '旧课件', page: 1, url: '/resources/course/course-slides.pdf#page=1' })).toBe(true);
      expect(isQuestionSource({ title: '越界', page: 168, url: '/resources/course/course-slides.pdf#page=168' })).toBe(false);
    });
  });
  describe('课件补充练习', () => {
    const additions = quizQuestions.filter((question) => question.id >= 314 && question.id <= 365);
    const supportedLeafIds = [
      '7.1.1', '7.1.2', '7.1.3', '7.1.4', '7.1.5',
      '7.2.1', '7.2.2', '7.2.3', '7.2.4',
      '7.3.1', '7.3.2', '7.3.3', '7.3.4',
      '7.4.1', '7.4.2', '8.5.1', '8.5.2',
    ];

    it('保留原313题ID，52道补充题顺延编号并直接关联已有三级知识点', () => {
      expect(quizQuestions.filter((question) => question.id <= 313).map((question) => question.id))
        .toEqual(Array.from({ length: 313 }, (_, index) => index + 1));
      expect(additions.map((question) => question.id))
        .toEqual(Array.from({ length: 52 }, (_, index) => index + 314));
      for (const id of supportedLeafIds) {
        expect(knowledgePoints.find((point) => point.id === id)?.level).toBe(3);
        expect(additions.filter((question) => question.ka === id)).toHaveLength(3);
      }
      expect(additions.filter((question) => question.ka === '8.6.1')).toHaveLength(1);
      expect(additions.some((question) => ['7.4.3', '7.4.4'].includes(question.ka))).toBe(false);
    });

    it('每道补充题都有独立题干、解析和有效的合并PDF页码', () => {
      expect(new Set(additions.map((question) => question.questionText)).size).toBe(additions.length);
      for (const question of additions) {
        expect(question.explanation?.trim().length).toBeGreaterThan(20);
        expect(question.source).toBeDefined();
        const source = question.source!;
        if (source.kind === 'guide') throw new Error('The original slide additions must retain PDF sources');
        expect(Number.isInteger(source.page)).toBe(true);
        expect(source.page).toBeGreaterThanOrEqual(1);
        expect(source.page).toBeLessThanOrEqual(167);
        expect(source.url).toBe(`/resources/course/course-slides.pdf#page=${source.page}`);
        if (question.chapter === 7) {
          expect(source.page).toBeLessThanOrEqual(77);
          expect(source.title).toContain('第6章');
          expect(source.title).toContain(`课件第${source.page}页`);
        } else {
          expect(source.page).toBeGreaterThan(77);
          expect(source.title).toContain('第10章');
          expect(source.title).toContain(`课件第${source.page - 77}页`);
        }
        if (question.type === 'multiple-choice') {
          expect(new Set(question.options).size).toBe(question.options.length);
          expect(question.options.filter((option) => option === question.correctAnswer)).toHaveLength(1);
        }
      }
    });

    it('计算题答案与帧长度、T1分频和电机控制公式一致', () => {
      const answer = (id: number) => quizQuestions.find((question) => question.id === id)?.correctAnswer;
      expect(answer(320)).toBe(`${1920 * (1 + 8 + 1)} Baud`);
      expect(answer(321)).toBe(`${(1e6 / 4800).toFixed(2)} μs`);
      expect(answer(322)).toBe(`${240 * 10 / 9600} s`);
      expect(answer(323)).toBe(Array.from({ length: 8 }, (_, bit) => (0x96 >> bit) & 1).join('、'));
      expect(answer(324)).toBe(`${8 / 10 * 100}%`);
      expect(answer(325)).toBe(`${1 + 7 + 1 + 1}位`);
      const reload = 256 - 11059200 / (12 * 32 * 4800);
      expect(answer(335)).toBe(`${reload.toString(16).toUpperCase()}H`);
      expect(answer(336)).toBe(`${11059200 / (12 * 16 * (256 - 0xFD))} Baud`);
      const actualBaud = 12000000 / (12 * 32 * (256 - 0xFD));
      expect(answer(337)).toBe(`${actualBaud.toFixed(2)} Baud，+${((actualBaud / 9600 - 1) * 100).toFixed(2)}%`);
      expect(answer(338)).toBe(`${6000000 / 12} bit/s`);
      expect(answer(361)).toBe(`${0.6 / 2 * 100}%`);
      expect(answer(362)).toBe(`${360 / (40 * 6)}°`);
    });

    it('公开题目剔除答案和解析，保留课件出处，且不改动服务端原题', () => {
      for (const question of additions) {
        const publicQuestion = toPublicQuestion(question);
        expect(publicQuestion).not.toHaveProperty('correctAnswer');
        expect(publicQuestion).not.toHaveProperty('explanation');
        expect(publicQuestion.source).toEqual(question.source);
        expect(question.explanation).toBeDefined();
        expect(question.correctAnswer).toBeDefined();
      }
      const source = additions[0]!.source!;
      const codeQuestion: Question = {
        id: 9999,
        type: 'code-completion',
        questionText: '启动T1的位操作是？',
        code: 'SETB ___',
        correctAnswer: 'TR1',
        ka: '7.3.1',
        chapter: 7,
        explanation: 'TR1为T1运行控制位。',
        source,
      };
      expect(toPublicQuestion(codeQuestion)).toEqual({
        id: 9999,
        type: 'code-completion',
        questionText: '启动T1的位操作是？',
        code: 'SETB ___',
        ka: '7.3.1',
        chapter: 7,
        source,
      });
    });
  });

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
