import {
  POINTS_CONFIG,
  PointsActivity,
  calculateQuizPoints,
  calculateTimePoints,
  calculateStreakBonus
} from '@/lib/points-system';

describe('Points System', () => {
  describe('POINTS_CONFIG', () => {
    it('应该有正确的学习活动积分配置', () => {
      expect(POINTS_CONFIG.COMPLETE_MODULE).toBe(50);
      expect(POINTS_CONFIG.COMPLETE_CHAPTER).toBe(20);
      expect(POINTS_CONFIG.DAILY_LOGIN).toBe(10);
      expect(POINTS_CONFIG.LEARNING_STREAK).toBe(15);
      expect(POINTS_CONFIG.TIME_MILESTONE).toBe(30);
    });

    it('应该有正确的测验活动积分配置', () => {
      expect(POINTS_CONFIG.COMPLETE_QUIZ).toBe(25);
      expect(POINTS_CONFIG.PERFECT_SCORE).toBe(100);
      expect(POINTS_CONFIG.QUIZ_PASS).toBe(40);
    });

    it('应该有正确的实验活动积分配置', () => {
      expect(POINTS_CONFIG.COMPLETE_EXPERIMENT).toBe(75);
      expect(POINTS_CONFIG.FIRST_EXPERIMENT).toBe(50);
      expect(POINTS_CONFIG.ALL_EXPERIMENTS).toBe(200);
    });

    it('应该有正确的成就奖励积分配置', () => {
      expect(POINTS_CONFIG.UNLOCK_ACHIEVEMENT).toBe(25);
      expect(POINTS_CONFIG.BRONZE_ACHIEVEMENT).toBe(50);
      expect(POINTS_CONFIG.SILVER_ACHIEVEMENT).toBe(100);
      expect(POINTS_CONFIG.GOLD_ACHIEVEMENT).toBe(200);
    });

    it('所有积分值应该为正数', () => {
      Object.values(POINTS_CONFIG).forEach(points => {
        expect(points).toBeGreaterThan(0);
        expect(Number.isInteger(points)).toBe(true);
      });
    });
  });

  describe('calculateQuizPoints', () => {
    it('应该为满分测验计算正确积分', () => {
      const points = calculateQuizPoints(100);
      const expected = POINTS_CONFIG.COMPLETE_QUIZ + POINTS_CONFIG.PERFECT_SCORE;
      expect(points).toBe(expected);
      expect(points).toBe(125); // 25 + 100
    });

    it('应该为及格测验计算正确积分', () => {
      const points = calculateQuizPoints(80);
      const expected = POINTS_CONFIG.COMPLETE_QUIZ + POINTS_CONFIG.QUIZ_PASS;
      expect(points).toBe(expected);
      expect(points).toBe(65); // 25 + 40
    });

    it('应该为刚好及格的测验计算正确积分', () => {
      const points = calculateQuizPoints(60);
      const expected = POINTS_CONFIG.COMPLETE_QUIZ + POINTS_CONFIG.QUIZ_PASS;
      expect(points).toBe(expected);
      expect(points).toBe(65); // 25 + 40
    });

    it('应该为不及格测验只给基础积分', () => {
      const points = calculateQuizPoints(50);
      expect(points).toBe(POINTS_CONFIG.COMPLETE_QUIZ);
      expect(points).toBe(25);
    });

    it('应该为0分测验只给基础积分', () => {
      const points = calculateQuizPoints(0);
      expect(points).toBe(POINTS_CONFIG.COMPLETE_QUIZ);
      expect(points).toBe(25);
    });

    it('应该处理边界值', () => {
      // 59分 - 不及格
      expect(calculateQuizPoints(59)).toBe(25);
      
      // 60分 - 刚好及格
      expect(calculateQuizPoints(60)).toBe(65);
      
      // 99分 - 高分但不满分
      expect(calculateQuizPoints(99)).toBe(65);
      
      // 100分 - 满分
      expect(calculateQuizPoints(100)).toBe(125);
    });

    it('应该处理无效输入', () => {
      // 负数分数
      expect(calculateQuizPoints(-10)).toBe(25);
      
      // 超过100分
      expect(calculateQuizPoints(110)).toBe(125);
    });
  });

  describe('calculateTimePoints', () => {
    it('应该为新的学习小时计算正确积分', () => {
      const previousTime = 0; // 0秒
      const currentTime = 3600; // 1小时
      const points = calculateTimePoints(currentTime, previousTime);
      expect(points).toBe(30); // 1小时 * 30积分
    });

    it('应该为多个新小时计算正确积分', () => {
      const previousTime = 3600; // 1小时
      const currentTime = 10800; // 3小时
      const points = calculateTimePoints(currentTime, previousTime);
      expect(points).toBe(60); // 2新小时 * 30积分
    });

    it('应该为不足一小时的学习时间返回0积分', () => {
      const previousTime = 0;
      const currentTime = 1800; // 30分钟
      const points = calculateTimePoints(currentTime, previousTime);
      expect(points).toBe(0);
    });

    it('应该正确处理跨小时边界的情况', () => {
      const previousTime = 3000; // 50分钟
      const currentTime = 4200; // 70分钟
      const points = calculateTimePoints(currentTime, previousTime);
      expect(points).toBe(30); // 跨越了一个小时边界
    });

    it('应该处理相同时间的情况', () => {
      const time = 7200; // 2小时
      const points = calculateTimePoints(time, time);
      expect(points).toBe(0);
    });

    it('应该处理大量学习时间', () => {
      const previousTime = 0;
      const currentTime = 36000; // 10小时
      const points = calculateTimePoints(currentTime, previousTime);
      expect(points).toBe(300); // 10小时 * 30积分
    });

    it('应该处理时间倒退的异常情况', () => {
      const previousTime = 7200; // 2小时
      const currentTime = 3600; // 1小时
      const points = calculateTimePoints(currentTime, previousTime);
      expect(points).toBe(-30); // -1小时 * 30积分
    });
  });

  describe('calculateStreakBonus', () => {
    it('应该为短连续天数计算基础奖励', () => {
      expect(calculateStreakBonus(1)).toBe(15); // 1倍乘数
      expect(calculateStreakBonus(3)).toBe(15); // 1倍乘数
      expect(calculateStreakBonus(6)).toBe(15); // 1倍乘数
    });

    it('应该为一周连续计算2倍奖励', () => {
      expect(calculateStreakBonus(7)).toBe(30); // 2倍乘数
      expect(calculateStreakBonus(10)).toBe(30); // 2倍乘数
      expect(calculateStreakBonus(13)).toBe(30); // 2倍乘数
    });

    it('应该为两周连续计算3倍奖励', () => {
      expect(calculateStreakBonus(14)).toBe(45); // 3倍乘数
      expect(calculateStreakBonus(20)).toBe(45); // 3倍乘数
    });

    it('应该为三周连续计算4倍奖励', () => {
      expect(calculateStreakBonus(21)).toBe(60); // 4倍乘数
      expect(calculateStreakBonus(27)).toBe(60); // 4倍乘数
    });

    it('应该为四周连续计算5倍奖励', () => {
      expect(calculateStreakBonus(28)).toBe(75); // 5倍乘数
      expect(calculateStreakBonus(34)).toBe(75); // 5倍乘数
    });

    it('应该限制最大乘数为5倍', () => {
      expect(calculateStreakBonus(35)).toBe(75); // 最大5倍乘数
      expect(calculateStreakBonus(50)).toBe(75); // 最大5倍乘数
      expect(calculateStreakBonus(100)).toBe(75); // 最大5倍乘数
    });

    it('应该处理0天连续', () => {
      expect(calculateStreakBonus(0)).toBe(15); // 1倍乘数
    });

    it('应该处理负数天数', () => {
      expect(calculateStreakBonus(-5)).toBe(15); // 1倍乘数
    });

    it('应该验证乘数计算逻辑', () => {
      // 验证乘数计算公式: Math.min(Math.floor(streakDays / 7) + 1, 5)
      expect(calculateStreakBonus(0)).toBe(15);  // floor(0/7) + 1 = 1
      expect(calculateStreakBonus(6)).toBe(15);  // floor(6/7) + 1 = 1
      expect(calculateStreakBonus(7)).toBe(30);  // floor(7/7) + 1 = 2
      expect(calculateStreakBonus(13)).toBe(30); // floor(13/7) + 1 = 2
      expect(calculateStreakBonus(14)).toBe(45); // floor(14/7) + 1 = 3
      expect(calculateStreakBonus(21)).toBe(60); // floor(21/7) + 1 = 4
      expect(calculateStreakBonus(28)).toBe(75); // floor(28/7) + 1 = 5
      expect(calculateStreakBonus(35)).toBe(75); // min(floor(35/7) + 1, 5) = 5
    });
  });

  describe('PointsActivity接口', () => {
    it('应该能够创建有效的积分活动对象', () => {
      const activity: PointsActivity = {
        userId: 'user123',
        points: 50,
        type: 'COMPLETE_MODULE',
        description: '完成模块学习',
        metadata: {
          moduleId: 'module1',
          completedAt: new Date().toISOString()
        }
      };

      expect(activity.userId).toBe('user123');
      expect(activity.points).toBe(50);
      expect(activity.type).toBe('COMPLETE_MODULE');
      expect(activity.description).toBe('完成模块学习');
      expect(activity.metadata).toBeDefined();
      expect(activity.metadata?.moduleId).toBe('module1');
    });

    it('应该支持不带metadata的积分活动', () => {
      const activity: PointsActivity = {
        userId: 'user456',
        points: 25,
        type: 'DAILY_LOGIN',
        description: '每日登录奖励'
      };

      expect(activity.metadata).toBeUndefined();
    });
  });

  describe('积分系统集成测试', () => {
    it('应该为完整的学习会话计算正确的总积分', () => {
      // 模拟一个完整的学习会话
      let totalPoints = 0;

      // 每日登录
      totalPoints += POINTS_CONFIG.DAILY_LOGIN;

      // 学习2小时
      totalPoints += calculateTimePoints(7200, 0);

      // 完成一个章节
      totalPoints += POINTS_CONFIG.COMPLETE_CHAPTER;

      // 完成测验并获得85分
      totalPoints += calculateQuizPoints(85);

      // 7天连续学习奖励
      totalPoints += calculateStreakBonus(7);

      const expected = 10 + 60 + 20 + 65 + 30; // 185
      expect(totalPoints).toBe(expected);
      expect(totalPoints).toBe(185);
    });

    it('应该为成就解锁计算正确积分', () => {
      const bronzePoints = POINTS_CONFIG.UNLOCK_ACHIEVEMENT + POINTS_CONFIG.BRONZE_ACHIEVEMENT;
      const silverPoints = POINTS_CONFIG.UNLOCK_ACHIEVEMENT + POINTS_CONFIG.SILVER_ACHIEVEMENT;
      const goldPoints = POINTS_CONFIG.UNLOCK_ACHIEVEMENT + POINTS_CONFIG.GOLD_ACHIEVEMENT;

      expect(bronzePoints).toBe(75);  // 25 + 50
      expect(silverPoints).toBe(125); // 25 + 100
      expect(goldPoints).toBe(225);   // 25 + 200
    });
  });
});