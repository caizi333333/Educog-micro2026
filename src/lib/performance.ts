interface PerformanceMetrics {
  renderTime: number;
  apiCallTime: number;
  totalLoadTime: number;
  memoryUsage?: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private timers: Map<string, number> = new Map();

  startTimer(key: string): void {
    this.timers.set(key, performance.now());
  }

  endTimer(key: string): number {
    const startTime = this.timers.get(key);
    if (!startTime) return 0;
    
    const duration = performance.now() - startTime;
    this.timers.delete(key);
    return duration;
  }

  recordMetric(page: string, metric: Partial<PerformanceMetrics>): void {
    const metrics = this.metrics.get(page) || [];
    metrics.push({
      renderTime: metric.renderTime || 0,
      apiCallTime: metric.apiCallTime || 0,
      totalLoadTime: metric.totalLoadTime || 0,
      memoryUsage: (performance as any).memory?.usedJSHeapSize
    });
    
    // Keep only last 50 metrics per page
    if (metrics.length > 50) {
      metrics.shift();
    }
    
    this.metrics.set(page, metrics);
  }

  getAverageMetrics(page: string): PerformanceMetrics | null {
    const metrics = this.metrics.get(page);
    if (!metrics || metrics.length === 0) return null;
    
    const sum = metrics.reduce((acc, curr) => ({
      renderTime: acc.renderTime + curr.renderTime,
      apiCallTime: acc.apiCallTime + curr.apiCallTime,
      totalLoadTime: acc.totalLoadTime + curr.totalLoadTime,
      memoryUsage: (acc.memoryUsage || 0) + (curr.memoryUsage || 0)
    }), { renderTime: 0, apiCallTime: 0, totalLoadTime: 0, memoryUsage: 0 });
    
    return {
      renderTime: sum.renderTime / metrics.length,
      apiCallTime: sum.apiCallTime / metrics.length,
      totalLoadTime: sum.totalLoadTime / metrics.length,
      memoryUsage: (sum.memoryUsage || 0) / metrics.length
    };
  }

  reportToConsole(page: string): void {
    const avg = this.getAverageMetrics(page);
    if (!avg) return;
    
    if (process.env.NODE_ENV === 'development') {
      console.table({
        Page: page,
        'Avg Render Time': `${avg.renderTime.toFixed(2)}ms`,
        'Avg API Time': `${avg.apiCallTime.toFixed(2)}ms`,
        'Avg Total Load': `${avg.totalLoadTime.toFixed(2)}ms`,
        'Avg Memory': avg.memoryUsage ? `${(avg.memoryUsage / 1024 / 1024).toFixed(2)}MB` : 'N/A'
      });
    }
  }

  clearMetrics(page?: string): void {
    if (page) {
      this.metrics.delete(page);
    } else {
      this.metrics.clear();
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();
export { PerformanceMonitor };