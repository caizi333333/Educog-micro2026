// 测试适配器，用于匹配测试文件的期望API
interface TestPerformanceMetrics {
  renderTime: number;
  apiCallTime: number;
  totalLoadTime: number;
  memoryUsage: number;
}

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private timers: Map<string, number> = new Map();
  private timerCounter = 0;

  startTimer(operation: string): string {
    const timerId = `${operation}-${this.timerCounter++}-${Date.now()}`;
    this.timers.set(timerId, performance.now());
    return timerId;
  }

  endTimer(timerId: string): number {
    const startTime = this.timers.get(timerId);
    if (!startTime) return 0;
    
    const duration = performance.now() - startTime;
    this.timers.delete(timerId);
    return duration;
  }

  recordMetric(type: keyof TestPerformanceMetrics, value: number): void {
    if (!this.metrics.has(type)) {
      this.metrics.set(type, []);
    }
    const values = this.metrics.get(type)!;
    values.push(value);
    
    // 保持最近1000个记录（用于测试）
    if (values.length > 1000) {
      values.shift();
    }
  }

  getAverageMetrics(): TestPerformanceMetrics {
    const result: TestPerformanceMetrics = {
      renderTime: 0,
      apiCallTime: 0,
      totalLoadTime: 0,
      memoryUsage: 0
    };

    for (const [type, values] of this.metrics.entries()) {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        (result as any)[type] = sum / values.length;
      }
    }

    return result;
  }

  clearMetrics(): void {
    this.metrics.clear();
    this.timers.clear(); // 也清理计时器
  }

  reportToConsole(): void {
    const metrics = this.getAverageMetrics();
    console.log('性能监控报告');
    console.log(`渲染时间: ${metrics.renderTime}ms`);
    console.log(`API调用时间: ${metrics.apiCallTime}ms`);
    console.log(`总加载时间: ${metrics.totalLoadTime}ms`);
    console.log(`内存使用: ${metrics.memoryUsage}MB`);
  }
}