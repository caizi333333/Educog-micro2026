import { performanceMonitor, measurePerformance } from '@/lib/performance-monitor';

// Mock performance API
const mockPerformance = {
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(),
  now: jest.fn(() => Date.now())
};

// Mock PerformanceObserver
class MockPerformanceObserver {
  private callback: (list: any) => void;
  static readonly supportedEntryTypes: readonly string[] = ['mark', 'measure', 'resource', 'navigation'];

  constructor(callback: (list: any) => void) {
    this.callback = callback;
  }

  observe() {}
  disconnect() {}
}

// Setup global mocks
Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

Object.defineProperty(global, 'PerformanceObserver', {
  value: MockPerformanceObserver as any,
  writable: true
});

// 只在window不存在时定义
if (!global.window) {
  Object.defineProperty(global, 'window', {
    value: {
      PerformanceObserver: MockPerformanceObserver,
      location: { href: 'http://localhost:3000' }
    },
    writable: true,
    configurable: true
  });
} else {
  // 如果window已存在，只更新需要的属性
  global.window.PerformanceObserver = MockPerformanceObserver as any;
}

Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Test Browser)'
  },
  writable: true
});

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 清除所有指标
    performanceMonitor.cleanup();
  });

  describe('单例模式', () => {
    it('应该返回同一个实例', () => {
      const instance1 = performanceMonitor;
      const instance2 = performanceMonitor;
      expect(instance1).toBe(instance2);
    });
  });

  describe('recordMetric', () => {
    it('应该能够记录性能指标', () => {
      performanceMonitor.recordMetric('test_metric', 100);
      performanceMonitor.recordMetric('test_metric', 200);
      performanceMonitor.recordMetric('test_metric', 150);
      
      const stats = performanceMonitor.getStats('test_metric');
      expect(stats.count).toBe(3);
      expect(stats.avg).toBe(150);
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(200);
    });

    it('应该限制指标记录数量为100', () => {
      // 记录101个值
      for (let i = 0; i < 101; i++) {
        performanceMonitor.recordMetric('large_metric', i);
      }
      
      const stats = performanceMonitor.getStats('large_metric');
      expect(stats.count).toBe(100);
      expect(stats.min).toBe(1); // 第一个值(0)应该被移除
    });

    it('应该为不同的指标名称分别记录', () => {
      performanceMonitor.recordMetric('metric1', 100);
      performanceMonitor.recordMetric('metric2', 200);
      
      const stats1 = performanceMonitor.getStats('metric1');
      const stats2 = performanceMonitor.getStats('metric2');
      
      expect(stats1.avg).toBe(100);
      expect(stats2.avg).toBe(200);
    });
  });

  describe('startMeasure和endMeasure', () => {
    it('应该调用performance.mark和performance.measure', () => {
      mockPerformance.getEntriesByName.mockReturnValue([
        { duration: 150 }
      ]);
      
      performanceMonitor.startMeasure('test_operation');
      const duration = performanceMonitor.endMeasure('test_operation');
      
      expect(mockPerformance.mark).toHaveBeenCalledWith('test_operation-start');
      expect(mockPerformance.mark).toHaveBeenCalledWith('test_operation-end');
      expect(mockPerformance.measure).toHaveBeenCalledWith(
        'test_operation',
        'test_operation-start',
        'test_operation-end'
      );
      expect(duration).toBe(150);
    });

    it('应该在performance不可用时返回0', () => {
      const originalPerformance = global.performance;
      // @ts-ignore
      global.performance = undefined;
      
      performanceMonitor.startMeasure('test');
      const duration = performanceMonitor.endMeasure('test');
      
      expect(duration).toBe(0);
      
      global.performance = originalPerformance;
    });

    it('应该在没有测量结果时返回0', () => {
      mockPerformance.getEntriesByName.mockReturnValue([]);
      
      performanceMonitor.startMeasure('test');
      const duration = performanceMonitor.endMeasure('test');
      
      expect(duration).toBe(0);
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      values.forEach(value => {
        performanceMonitor.recordMetric('test_stats', value);
      });
      
      const stats = performanceMonitor.getStats('test_stats');
      
      expect(stats.count).toBe(10);
      expect(stats.avg).toBe(55);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(100);
      expect(stats.p95).toBe(90); // 95th percentile for 10 values: floor(10 * 0.95) - 1 = 8, so values[8] = 90
    });

    it('应该为空数据返回零值统计', () => {
      const stats = performanceMonitor.getStats('nonexistent_metric');
      
      expect(stats.count).toBe(0);
      expect(stats.avg).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.p95).toBe(0);
    });

    it('应该返回所有指标的统计信息', () => {
      performanceMonitor.recordMetric('metric1', 100);
      performanceMonitor.recordMetric('metric2', 200);
      
      const allStats = performanceMonitor.getStats();
      
      expect(allStats).toHaveProperty('metric1');
      expect(allStats).toHaveProperty('metric2');
      expect(allStats.metric1.avg).toBe(100);
      expect(allStats.metric2.avg).toBe(200);
    });

    it('应该正确计算95th百分位数', () => {
      // 测试边界情况
      performanceMonitor.recordMetric('single_value', 42);
      const singleStats = performanceMonitor.getStats('single_value');
      expect(singleStats.p95).toBe(42);
      
      // 测试多个值
      const values = Array.from({ length: 20 }, (_, i) => i + 1); // 1-20
      values.forEach(value => {
        performanceMonitor.recordMetric('p95_test', value);
      });
      
      const p95Stats = performanceMonitor.getStats('p95_test');
      expect(p95Stats.p95).toBe(19); // floor(20 * 0.95) = 19, so values[18] = 19
    });
  });

  describe('getWebVitals', () => {
    it('应该返回Web Vitals指标', async () => {
      mockPerformance.getEntriesByName.mockReturnValue([
        { startTime: 1500 }
      ]);
      
      const vitals = await performanceMonitor.getWebVitals();
      
      expect(vitals).toHaveProperty('fcp');
      expect(vitals.fcp).toBe(1500);
    });

    it('应该在performance不可用时返回空对象', async () => {
      const originalPerformance = global.performance;
      // @ts-ignore
      global.performance = undefined;
      
      const vitals = await performanceMonitor.getWebVitals();
      
      expect(vitals).toEqual({});
      
      global.performance = originalPerformance;
    });
  });

  describe('cleanup', () => {
    it('应该清理所有观察者和指标', () => {
      performanceMonitor.recordMetric('test_cleanup', 100);
      
      let statsBeforeCleanup = performanceMonitor.getStats('test_cleanup');
      expect(statsBeforeCleanup.count).toBe(1);
      
      performanceMonitor.cleanup();
      
      let statsAfterCleanup = performanceMonitor.getStats('test_cleanup');
      expect(statsAfterCleanup.count).toBe(0);
    });
  });

  describe('exportReport', () => {
    it('应该导出包含所有信息的性能报告', () => {
      performanceMonitor.recordMetric('export_test', 123);
      
      const report = performanceMonitor.exportReport();
      const parsedReport = JSON.parse(report);
      
      expect(parsedReport).toHaveProperty('timestamp');
      expect(parsedReport).toHaveProperty('userAgent');
      expect(parsedReport).toHaveProperty('url');
      expect(parsedReport).toHaveProperty('metrics');
      expect(parsedReport.metrics).toHaveProperty('export_test');
      expect(parsedReport.userAgent).toBe('Mozilla/5.0 (Test Browser)');
      expect(parsedReport.url).toBe('http://localhost/');
    });

    it('应该在浏览器环境不可用时使用默认值', () => {
      const originalNavigator = global.navigator;
      const originalWindow = global.window;
      
      // @ts-ignore
      global.navigator = undefined;
      // @ts-ignore
      global.window = undefined;
      
      const report = performanceMonitor.exportReport();
      const parsedReport = JSON.parse(report);
      
      expect(parsedReport.userAgent).toBe('Unknown');
      expect(parsedReport.url).toBe('http://localhost/');
      
      global.navigator = originalNavigator;
      global.window = originalWindow;
    });
  });

  describe('数值精度', () => {
    it('应该将统计值四舍五入到两位小数', () => {
      performanceMonitor.recordMetric('precision_test', 10.123456);
      performanceMonitor.recordMetric('precision_test', 20.987654);
      
      const stats = performanceMonitor.getStats('precision_test');
      
      expect(stats.avg).toBe(15.56); // (10.123456 + 20.987654) / 2 = 15.555555 -> 15.56
      expect(stats.min).toBe(10.12); // 10.123456 -> 10.12
      expect(stats.max).toBe(20.99); // 20.987654 -> 20.99
    });
  });

  describe('边界条件', () => {
    it('应该处理负数值', () => {
      performanceMonitor.recordMetric('negative_test', -10);
      performanceMonitor.recordMetric('negative_test', -5);
      
      const stats = performanceMonitor.getStats('negative_test');
      
      expect(stats.avg).toBe(-7.5);
      expect(stats.min).toBe(-10);
      expect(stats.max).toBe(-5);
    });

    it('应该处理零值', () => {
      performanceMonitor.recordMetric('zero_test', 0);
      performanceMonitor.recordMetric('zero_test', 0);
      
      const stats = performanceMonitor.getStats('zero_test');
      
      expect(stats.avg).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.p95).toBe(0);
    });

    it('应该处理非常大的数值', () => {
      const largeValue = Number.MAX_SAFE_INTEGER;
      performanceMonitor.recordMetric('large_test', largeValue);
      
      const stats = performanceMonitor.getStats('large_test');
      
      expect(stats.avg).toBe(largeValue);
      expect(stats.min).toBe(largeValue);
      expect(stats.max).toBe(largeValue);
    });
  });
});

describe('measurePerformance装饰器', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    performanceMonitor.cleanup();
  });

  it('应该测量方法执行时间', async () => {
    class TestClass {
      async testMethod(delay: number = 0) {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        return 'result';
      }
    }

    // 手动应用装饰器
    const decorator = measurePerformance('test_method');
    const descriptor = {
      value: TestClass.prototype.testMethod,
      writable: true,
      enumerable: false,
      configurable: true
    };
    decorator(TestClass.prototype, 'testMethod', descriptor);
    TestClass.prototype.testMethod = descriptor.value;

    mockPerformance.getEntriesByName.mockReturnValue([
      { duration: 50 }
    ]);

    const instance = new TestClass();
    const result = await instance.testMethod();

    expect(result).toBe('result');
    expect(mockPerformance.mark).toHaveBeenCalledWith('test_method-start');
    expect(mockPerformance.mark).toHaveBeenCalledWith('test_method-end');
    expect(mockPerformance.measure).toHaveBeenCalledWith(
      'test_method',
      'test_method-start',
      'test_method-end'
    );
  });

  it('应该使用默认的测量名称', async () => {
    class TestClass {
      async defaultNameMethod() {
        return 'result';
      }
    }

    // 手动应用装饰器
    const decorator = measurePerformance();
    const descriptor = {
      value: TestClass.prototype.defaultNameMethod,
      writable: true,
      enumerable: false,
      configurable: true
    };
    decorator(TestClass.prototype, 'defaultNameMethod', descriptor);
    TestClass.prototype.defaultNameMethod = descriptor.value;

    mockPerformance.getEntriesByName.mockReturnValue([
      { duration: 25 }
    ]);

    const instance = new TestClass();
    await instance.defaultNameMethod();

    expect(mockPerformance.mark).toHaveBeenCalledWith('TestClass.defaultNameMethod-start');
    expect(mockPerformance.mark).toHaveBeenCalledWith('TestClass.defaultNameMethod-end');
  });

  it('应该在方法抛出异常时仍然结束测量', async () => {
    class TestClass {
      async errorMethod() {
        throw new Error('Test error');
      }
    }

    // 手动应用装饰器
    const decorator = measurePerformance('error_method');
    const descriptor = {
      value: TestClass.prototype.errorMethod,
      writable: true,
      enumerable: false,
      configurable: true
    };
    decorator(TestClass.prototype, 'errorMethod', descriptor);
    TestClass.prototype.errorMethod = descriptor.value;

    mockPerformance.getEntriesByName.mockReturnValue([
      { duration: 10 }
    ]);

    const instance = new TestClass();
    
    await expect(instance.errorMethod()).rejects.toThrow('Test error');
    
    expect(mockPerformance.mark).toHaveBeenCalledWith('error_method-start');
    expect(mockPerformance.mark).toHaveBeenCalledWith('error_method-end');
  });
});
