import {
  experiments,
  getExperimentConfig,
  getExperimentsByCategory,
  checkPrerequisites
} from '@/lib/experiment-config';

describe('Experiment Configuration', () => {
  describe('experiments array', () => {
    it('应该包含所有实验配置', () => {
      expect(experiments).toBeDefined();
      expect(Array.isArray(experiments)).toBe(true);
      expect(experiments.length).toBeGreaterThan(0);
    });

    it('每个实验应该有必需的字段', () => {
      experiments.forEach((experiment) => {
        expect(experiment.id).toBeDefined();
        expect(experiment.title).toBeDefined();
        expect(experiment.category).toBeDefined();
        expect(experiment.difficulty).toBeDefined();
        expect(experiment.duration).toBeDefined();
        expect(Array.isArray(experiment.objectives)).toBe(true);
        expect(Array.isArray(experiment.prerequisites)).toBe(true);
        expect(Array.isArray(experiment.knowledgePoints)).toBe(true);
        expect(Array.isArray(experiment.hardwareRequirements)).toBe(true);
        expect(experiment.code).toBeDefined();
        expect(Array.isArray(experiment.expectedResults)).toBe(true);
        expect(Array.isArray(experiment.troubleshooting)).toBe(true);
        expect(Array.isArray(experiment.extensions)).toBe(true);
      });
    });

    it('实验ID应该是唯一的', () => {
      const ids = experiments.map(exp => exp.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('应该包含不同难度级别的实验', () => {
      const difficulties = [...new Set(experiments.map(exp => exp.difficulty))];
      expect(difficulties.length).toBeGreaterThan(1);
      expect(difficulties).toContain('basic');
      expect(difficulties).toContain('intermediate');
      // 'advanced'难度是可选的，不是必需的
    });

    it('应该包含不同类别的实验', () => {
      const categories = [...new Set(experiments.map(exp => exp.category))];
      expect(categories.length).toBeGreaterThan(1);
    });
  });

  describe('getExperimentConfig function', () => {
    it('应该根据ID返回正确的实验配置', () => {
      const firstExperiment = experiments[0];
      if (firstExperiment) {
        const result = getExperimentConfig(firstExperiment.id);
        
        expect(result).toBeDefined();
        expect(result?.id).toBe(firstExperiment.id);
        expect(result?.title).toBe(firstExperiment.title);
      }
    });

    it('应该对不存在的ID返回undefined', () => {
      const result = getExperimentConfig('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('应该处理空字符串ID', () => {
      const result = getExperimentConfig('');
      expect(result).toBeUndefined();
    });

    it('应该处理null和undefined ID', () => {
      const result1 = getExperimentConfig(null as any);
      const result2 = getExperimentConfig(undefined as any);
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });
  });

  describe('getExperimentsByCategory function', () => {
    it('应该根据类别返回实验列表', () => {
      const firstCategory = experiments[0].category;
      const result = getExperimentsByCategory(firstCategory);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach(exp => {
        expect(exp.category).toBe(firstCategory);
      });
    });

    it('应该对不存在的类别返回空数组', () => {
      const result = getExperimentsByCategory('non-existent-category');
      expect(result).toEqual([]);
    });

    it('应该处理空字符串类别', () => {
      const result = getExperimentsByCategory('');
      expect(Array.isArray(result)).toBe(true);
    });

    it('应该返回所有匹配类别的实验', () => {
      const categories = [...new Set(experiments.map(exp => exp.category))];
      
      categories.forEach(category => {
        const result = getExperimentsByCategory(category);
        const expectedCount = experiments.filter(exp => exp.category === category).length;
        expect(result.length).toBe(expectedCount);
      });
    });
  });

  describe('checkPrerequisites function', () => {
    it('应该检查实验的前置条件', () => {
      const experimentId = experiments[0].id;
      const completedExperiments: string[] = [];
      
      const result = checkPrerequisites(experimentId, completedExperiments);
      
      expect(result).toBeDefined();
      expect(typeof result.satisfied).toBe('boolean');
      expect(Array.isArray(result.missing)).toBe(true);
    });

    it('应该对不存在的实验返回错误', () => {
      const result = checkPrerequisites('non-existent-id', []);
      
      expect(result.satisfied).toBe(false);
      expect(result.missing).toContain('实验不存在');
    });

    it('应该正确处理基础实验', () => {
      const basicExperiments = experiments.filter(exp => exp.difficulty === 'basic');
      
      if (basicExperiments.length > 0) {
        const result = checkPrerequisites(basicExperiments[0].id, []);
        // 基础实验通常不需要前置条件
        expect(result.satisfied).toBe(true);
      }
    });

    it('应该正确处理中级实验的前置条件', () => {
      const intermediateExperiments = experiments.filter(exp => exp.difficulty === 'intermediate');
      
      if (intermediateExperiments.length > 0) {
        // 没有完成基础实验的情况
        const result1 = checkPrerequisites(intermediateExperiments[0].id, []);
        
        // 完成了基础实验的情况
        const result2 = checkPrerequisites(intermediateExperiments[0].id, ['exp01']);
        
        // 至少其中一个应该有不同的结果
        expect(result1.satisfied !== result2.satisfied || 
               result1.missing.length !== result2.missing.length).toBe(true);
      }
    });

    it('应该处理空的已完成实验列表', () => {
      const experimentId = experiments[0].id;
      const result = checkPrerequisites(experimentId, []);
      
      expect(result).toBeDefined();
      expect(typeof result.satisfied).toBe('boolean');
      expect(Array.isArray(result.missing)).toBe(true);
    });
  });

  describe('实验内容验证', () => {
    it('所有实验应该有有效的汇编代码', () => {
      experiments.forEach((experiment) => {
        expect(experiment.code).toBeDefined();
        expect(typeof experiment.code).toBe('string');
        expect(experiment.code.length).toBeGreaterThan(0);
        
        // 检查是否包含基本的汇编指令结构
        expect(experiment.code).toMatch(/ORG|MOV|LJMP|END/i);
      });
    });

    it('所有实验应该有明确的学习目标', () => {
      experiments.forEach((experiment) => {
        expect(experiment.objectives.length).toBeGreaterThan(0);
        experiment.objectives.forEach(objective => {
          expect(typeof objective).toBe('string');
          expect(objective.length).toBeGreaterThan(0);
        });
      });
    });

    it('所有实验应该有预期结果', () => {
      experiments.forEach((experiment) => {
        expect(experiment.expectedResults.length).toBeGreaterThan(0);
        experiment.expectedResults.forEach(result => {
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        });
      });
    });

    it('所有实验应该有故障排除指南', () => {
      experiments.forEach((experiment) => {
        expect(experiment.troubleshooting.length).toBeGreaterThan(0);
        experiment.troubleshooting.forEach(item => {
          expect(item.issue).toBeDefined();
          expect(item.solution).toBeDefined();
          expect(typeof item.issue).toBe('string');
          expect(typeof item.solution).toBe('string');
        });
      });
    });

    it('实验持续时间应该合理', () => {
      experiments.forEach((experiment) => {
        expect(experiment.duration).toBeGreaterThan(0);
        // 部分实验为综合实验/项目实践，允许更长时长（<= 8 小时）
        expect(experiment.duration).toBeLessThanOrEqual(480);
      });
    });

    it('实验应该有知识点说明', () => {
      experiments.forEach((experiment) => {
        expect(experiment.knowledgePoints.length).toBeGreaterThan(0);
        experiment.knowledgePoints.forEach(point => {
          expect(typeof point).toBe('string');
          expect(point.length).toBeGreaterThan(0);
        });
      });
    });

    it('实验应该有硬件需求说明', () => {
      experiments.forEach((experiment) => {
        expect(experiment.hardwareRequirements.length).toBeGreaterThan(0);
        experiment.hardwareRequirements.forEach(requirement => {
          expect(typeof requirement).toBe('string');
          expect(requirement.length).toBeGreaterThan(0);
        });
      });
    });
  });
});
