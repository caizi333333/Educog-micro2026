// 性能监控工具
class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers();
    }
  }

  private initializeObservers(): void {
    // 监控导航性能
    if ('PerformanceObserver' in window) {
      try {
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              this.recordMetric('page_load_time', navEntry.loadEventEnd - navEntry.fetchStart);
              this.recordMetric('dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.fetchStart);
              this.recordMetric('first_byte', navEntry.responseStart - navEntry.fetchStart);
            }
          }
        });
        navObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navObserver);
      } catch (error) {
        console.warn('Navigation observer not supported:', error);
      }

      // 监控资源加载性能
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;
              this.recordMetric('resource_load_time', resourceEntry.responseEnd - resourceEntry.fetchStart);
              
              // 分类监控不同类型的资源
              if (resourceEntry.name.includes('.js')) {
                this.recordMetric('js_load_time', resourceEntry.responseEnd - resourceEntry.fetchStart);
              } else if (resourceEntry.name.includes('.css')) {
                this.recordMetric('css_load_time', resourceEntry.responseEnd - resourceEntry.fetchStart);
              } else if (resourceEntry.name.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {
                this.recordMetric('image_load_time', resourceEntry.responseEnd - resourceEntry.fetchStart);
              }
            }
          }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (error) {
        console.warn('Resource observer not supported:', error);
      }

      // 监控用户交互性能
      try {
        const measureObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure') {
              this.recordMetric(entry.name, entry.duration);
            }
          }
        });
        measureObserver.observe({ entryTypes: ['measure'] });
        this.observers.push(measureObserver);
      } catch (error) {
        console.warn('Measure observer not supported:', error);
      }
    }
  }

  // 记录性能指标
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // 保持最近100个记录
    if (values.length > 100) {
      values.shift();
    }
  }

  // 开始性能测量
  startMeasure(name: string): void {
    if (typeof performance !== 'undefined') {
      performance.mark(`${name}-start`);
    }
  }

  // 结束性能测量
  endMeasure(name: string): number {
    if (typeof performance !== 'undefined') {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measures = performance.getEntriesByName(name, 'measure');
      if (measures.length > 0) {
        const lastMeasure = measures[measures.length - 1];
        const duration = lastMeasure?.duration ?? 0;
        this.recordMetric(name, duration);
        return duration;
      }
    }
    return 0;
  }

  // 获取性能统计
  getStats(metricName?: string): any {
    if (metricName) {
      const values = this.metrics.get(metricName) || [];
      return this.calculateStats(values);
    }

    const stats: any = {};
    for (const [name, values] of this.metrics.entries()) {
      stats[name] = this.calculateStats(values);
    }
    return stats;
  }

  private calculateStats(values: number[]): any {
    if (values.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p95: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95Index = Math.floor(sorted.length * 0.95) - 1;
    const p95 = sorted[p95Index] || max;

    return {
      count: values.length,
      avg: Math.round(avg * 100) / 100,
      min: min != null ? Math.round(min * 100) / 100 : 0,
      max: max != null ? Math.round(max * 100) / 100 : 0,
      p95: p95 != null ? Math.round(p95 * 100) / 100 : 0,
    };
  }

  // 获取Web Vitals指标
  getWebVitals(): Promise<any> {
    return new Promise((resolve) => {
      const vitals: any = {};

      // 获取FCP (First Contentful Paint)
      if (typeof performance !== 'undefined') {
        const fcpEntries = performance.getEntriesByName('first-contentful-paint');
        if (fcpEntries.length > 0) {
          vitals.fcp = fcpEntries[0]?.startTime;
        }

        // 获取LCP (Largest Contentful Paint)
        if ('PerformanceObserver' in window) {
          try {
            const lcpObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              if (entries.length > 0) {
                const lastEntry = entries[entries.length - 1];
                if (lastEntry) {
                  vitals.lcp = lastEntry.startTime;
                }
              }
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            
            // 在页面加载完成后获取结果
            setTimeout(() => {
              lcpObserver.disconnect();
              resolve(vitals);
            }, 2000);
          } catch (error) {
            resolve(vitals);
          }
        } else {
          resolve(vitals);
        }
      } else {
        resolve(vitals);
      }
    });
  }

  // 清理资源
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }

  // 导出性能报告
  exportReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' && navigator ? navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' && window && window.location ? window.location.href : 'Unknown',
      metrics: this.getStats(),
    };
    return JSON.stringify(report, null, 2);
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

// React Hook for performance monitoring
import { useEffect, useRef } from 'react';

export function usePerformanceMonitor(componentName: string) {
  const startTimeRef = useRef<number>();

  useEffect(() => {
    startTimeRef.current = performance.now();
    performanceMonitor.startMeasure(`component-${componentName}`);

    return () => {
      if (startTimeRef.current) {
        const duration = performance.now() - startTimeRef.current;
        performanceMonitor.recordMetric(`component-${componentName}-render`, duration);
        performanceMonitor.endMeasure(`component-${componentName}`);
      }
    };
  }, [componentName]);

  const measureAction = (actionName: string, action: () => void | Promise<void>) => {
    const measureName = `${componentName}-${actionName}`;
    performanceMonitor.startMeasure(measureName);
    
    const result = action();
    
    if (result instanceof Promise) {
      return result.finally(() => {
        performanceMonitor.endMeasure(measureName);
      });
    } else {
      performanceMonitor.endMeasure(measureName);
      return result;
    }
  };

  return { measureAction };
}

// 性能装饰器
export function measurePerformance(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const measureName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      performanceMonitor.startMeasure(measureName);
      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } finally {
        performanceMonitor.endMeasure(measureName);
      }
    };

    return descriptor;
  };
}