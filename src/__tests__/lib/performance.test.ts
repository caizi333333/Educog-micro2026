import { PerformanceMonitor } from '@/lib/performance-test-adapter';

describe('性能监控系统', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    // 清除所有指标
    monitor.clearMetrics();
  });

  describe('PerformanceMonitor 基本功能', () => {
    it('应该正确初始化', () => {
      expect(monitor).toBeDefined();
      expect(monitor.getAverageMetrics()).toEqual({
        renderTime: 0,
        apiCallTime: 0,
        totalLoadTime: 0,
        memoryUsage: 0
      });
    });

    it('应该正确启动和结束计时器', () => {
      const timerId = monitor.startTimer('test-operation');
      expect(typeof timerId).toBe('string');
      expect(timerId.length).toBeGreaterThan(0);

      // 模拟一些延迟
      const startTime = Date.now();
      const duration = monitor.endTimer(timerId);
      const endTime = Date.now();

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThanOrEqual(endTime - startTime + 10); // 允许10ms误差
    });

    it('应该处理无效的计时器ID', () => {
      const duration = monitor.endTimer('invalid-timer-id');
      expect(duration).toBe(0);
    });

    it('应该正确记录指标', () => {
      monitor.recordMetric('renderTime', 100);
      monitor.recordMetric('apiCallTime', 200);
      monitor.recordMetric('totalLoadTime', 300);
      monitor.recordMetric('memoryUsage', 50);

      const metrics = monitor.getAverageMetrics();
      expect(metrics.renderTime).toBe(100);
      expect(metrics.apiCallTime).toBe(200);
      expect(metrics.totalLoadTime).toBe(300);
      expect(metrics.memoryUsage).toBe(50);
    });

    it('应该正确计算平均值', () => {
      // 记录多个渲染时间
      monitor.recordMetric('renderTime', 100);
      monitor.recordMetric('renderTime', 200);
      monitor.recordMetric('renderTime', 300);

      const metrics = monitor.getAverageMetrics();
      expect(metrics.renderTime).toBe(200); // (100 + 200 + 300) / 3
    });

    it('应该正确清除指标', () => {
      monitor.recordMetric('renderTime', 100);
      monitor.recordMetric('apiCallTime', 200);

      let metrics = monitor.getAverageMetrics();
      expect(metrics.renderTime).toBe(100);
      expect(metrics.apiCallTime).toBe(200);

      monitor.clearMetrics();
      metrics = monitor.getAverageMetrics();
      expect(metrics.renderTime).toBe(0);
      expect(metrics.apiCallTime).toBe(0);
      expect(metrics.totalLoadTime).toBe(0);
      expect(metrics.memoryUsage).toBe(0);
    });
  });

  describe('性能指标类型', () => {
    it('应该正确处理所有指标类型', () => {
      const metricTypes = ['renderTime', 'apiCallTime', 'totalLoadTime', 'memoryUsage'] as const;
      
      metricTypes.forEach((type, index) => {
        const value = (index + 1) * 100;
        monitor.recordMetric(type, value);
      });

      const metrics = monitor.getAverageMetrics();
      expect(metrics.renderTime).toBe(100);
      expect(metrics.apiCallTime).toBe(200);
      expect(metrics.totalLoadTime).toBe(300);
      expect(metrics.memoryUsage).toBe(400);
    });

    it('应该处理负数值', () => {
      monitor.recordMetric('renderTime', -100);
      const metrics = monitor.getAverageMetrics();
      expect(metrics.renderTime).toBe(-100);
    });

    it('应该处理零值', () => {
      monitor.recordMetric('renderTime', 0);
      const metrics = monitor.getAverageMetrics();
      expect(metrics.renderTime).toBe(0);
    });

    it('应该处理小数值', () => {
      monitor.recordMetric('renderTime', 123.456);
      const metrics = monitor.getAverageMetrics();
      expect(metrics.renderTime).toBeCloseTo(123.456, 3);
    });
  });

  describe('计时器管理', () => {
    it('应该生成唯一的计时器ID', () => {
      const timer1 = monitor.startTimer('operation1');
      const timer2 = monitor.startTimer('operation2');
      const timer3 = monitor.startTimer('operation1'); // 相同操作名

      expect(timer1).not.toBe(timer2);
      expect(timer1).not.toBe(timer3);
      expect(timer2).not.toBe(timer3);
    });

    it('应该处理多个并发计时器', () => {
      const timer1 = monitor.startTimer('operation1');
      const timer2 = monitor.startTimer('operation2');

      // 模拟不同的执行时间
      setTimeout(() => {
        const duration1 = monitor.endTimer(timer1);
        expect(duration1).toBeGreaterThanOrEqual(0);
      }, 10);

      setTimeout(() => {
        const duration2 = monitor.endTimer(timer2);
        expect(duration2).toBeGreaterThanOrEqual(0);
      }, 20);
    });

    it('应该处理重复结束同一个计时器', () => {
      const timerId = monitor.startTimer('test');
      
      const duration1 = monitor.endTimer(timerId);
      expect(duration1).toBeGreaterThanOrEqual(0);
      
      // 第二次结束应该返回0
      const duration2 = monitor.endTimer(timerId);
      expect(duration2).toBe(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理空字符串计时器名称', () => {
      const timerId = monitor.startTimer('');
      expect(typeof timerId).toBe('string');
      
      const duration = monitor.endTimer(timerId);
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('应该处理非常大的指标值', () => {
      const largeValue = Number.MAX_SAFE_INTEGER;
      monitor.recordMetric('renderTime', largeValue);
      
      const metrics = monitor.getAverageMetrics();
      expect(metrics.renderTime).toBe(largeValue);
    });

    it('应该处理非常小的指标值', () => {
      const smallValue = Number.MIN_VALUE;
      monitor.recordMetric('renderTime', smallValue);
      
      const metrics = monitor.getAverageMetrics();
      expect(metrics.renderTime).toBe(smallValue);
    });

    it('应该处理大量指标记录', () => {
      // 记录1000个指标
      for (let i = 0; i < 1000; i++) {
        monitor.recordMetric('renderTime', i);
      }

      const metrics = monitor.getAverageMetrics();
      // 平均值应该是 (0 + 1 + ... + 999) / 1000 = 499.5
      expect(metrics.renderTime).toBeCloseTo(499.5, 1);
    });
  });

  describe('报告功能', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('应该正确输出性能报告', () => {
      monitor.recordMetric('renderTime', 100);
      monitor.recordMetric('apiCallTime', 200);
      monitor.recordMetric('totalLoadTime', 300);
      monitor.recordMetric('memoryUsage', 50);

      monitor.reportToConsole();

      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls;
      
      // 检查是否包含性能指标信息
      const output = calls.map(call => call.join(' ')).join(' ');
      expect(output).toContain('性能监控报告');
      expect(output).toContain('100');
      expect(output).toContain('200');
      expect(output).toContain('300');
      expect(output).toContain('50');
    });

    it('应该在没有数据时输出空报告', () => {
      monitor.reportToConsole();

      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls;
      const output = calls.map(call => call.join(' ')).join(' ');
      
      expect(output).toContain('性能监控报告');
      expect(output).toContain('0');
    });
  });

  describe('内存管理', () => {
    it('应该正确清理计时器', () => {
      const timer1 = monitor.startTimer('test1');
      const timer2 = monitor.startTimer('test2');
      
      // 结束一个计时器
      monitor.endTimer(timer1);
      
      // 清除指标应该也清除计时器
      monitor.clearMetrics();
      
      // 尝试结束已清除的计时器应该返回0
      const duration = monitor.endTimer(timer2);
      expect(duration).toBe(0);
    });

    it('应该处理内存泄漏预防', () => {
      // 创建大量计时器但不结束它们
      const timers = [];
      for (let i = 0; i < 1000; i++) {
        timers.push(monitor.startTimer(`test-${i}`));
      }

      // 清除指标应该清理所有计时器
      monitor.clearMetrics();

      // 尝试结束这些计时器应该都返回0
      timers.forEach(timer => {
        const duration = monitor.endTimer(timer);
        expect(duration).toBe(0);
      });
    });
  });
});