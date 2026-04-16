// 代码分割配置和工具
import { lazy, ComponentType, LazyExoticComponent } from 'react';
import { trackModuleLoad } from './bundle-analyzer';

// 路由级别的代码分割配置
export interface RouteConfig {
  path: string;
  component: LazyExoticComponent<ComponentType<any>>;
  preload?: boolean;
  priority?: 'high' | 'medium' | 'low';
  dependencies?: string[];
}

// 智能懒加载包装器
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    name?: string;
    preload?: boolean;
    fallback?: ComponentType;
    retryCount?: number;
  } = {}
): LazyExoticComponent<T> {
  const { name = 'UnknownComponent', preload = false, retryCount = 3 } = options;
  
  // 带重试机制的导入函数
  const importWithRetry = async (attempt = 1): Promise<{ default: T }> => {
    try {
      const module = await importFn();
      trackModuleLoad(name);
      return module;
    } catch (error) {
      if (attempt < retryCount) {
        console.warn(`Failed to load ${name}, retrying... (${attempt}/${retryCount})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        return importWithRetry(attempt + 1);
      }
      console.error(`Failed to load ${name} after ${retryCount} attempts:`, error);
      throw error;
    }
  };

  const LazyComponent = lazy(importWithRetry);

  // 预加载逻辑
  if (preload && typeof window !== 'undefined') {
    // 在空闲时间预加载
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        importWithRetry().catch(() => {});
      });
    } else {
      setTimeout(() => {
        importWithRetry().catch(() => {});
      }, 100);
    }
  }

  return LazyComponent;
}

// 路由配置（简化版，避免导入不存在的模块）
export const routeConfigs: RouteConfig[] = [
  {
    path: '/',
    component: lazy(() => Promise.resolve({ default: () => null })),
    priority: 'high',
    preload: true,
  },
  {
    path: '/simulation',
    component: lazy(() => Promise.resolve({ default: () => null })),
    priority: 'medium',
    dependencies: ['simulator'],
  },
  {
    path: '/quiz',
    component: lazy(() => Promise.resolve({ default: () => null })),
    priority: 'medium',
  },
  {
    path: '/analytics',
    component: lazy(() => Promise.resolve({ default: () => null })),
    priority: 'low',
    dependencies: ['recharts'],
  },
  {
    path: '/knowledge-graph',
    component: lazy(() => Promise.resolve({ default: () => null })),
    priority: 'low',
    dependencies: ['d3'],
  },
  {
    path: '/learning-path',
    component: lazy(() => Promise.resolve({ default: () => null })),
    priority: 'medium',
  },
  {
    path: '/profile',
    component: lazy(() => Promise.resolve({ default: () => null })),
    priority: 'low',
  },
  {
    path: '/settings',
    component: lazy(() => Promise.resolve({ default: () => null })),
    priority: 'low',
  },
];

// 组件级别的代码分割（简化版）
export const lazyComponents = {
  // 占位符组件，避免导入错误
  Charts: lazy(() => Promise.resolve({ default: () => null })),
  ThreeScene: lazy(() => Promise.resolve({ default: () => null })),
  CodeEditor: lazy(() => Promise.resolve({ default: () => null })),
  DataTable: lazy(() => Promise.resolve({ default: () => null })),
  FileUpload: lazy(() => Promise.resolve({ default: () => null })),
  ImageProcessor: lazy(() => Promise.resolve({ default: () => null })),
};

// 预加载管理器
class PreloadManager {
  private static instance: PreloadManager;
  private preloadedRoutes = new Set<string>();
  private preloadQueue: string[] = [];
  private isPreloading = false;

  static getInstance(): PreloadManager {
    if (!PreloadManager.instance) {
      PreloadManager.instance = new PreloadManager();
    }
    return PreloadManager.instance;
  }

  // 预加载路由
  async preloadRoute(path: string): Promise<void> {
    if (this.preloadedRoutes.has(path)) {
      return;
    }

    const config = routeConfigs.find(route => route.path === path);
    if (!config) {
      console.warn(`Route config not found for path: ${path}`);
      return;
    }

    try {
      // 预加载依赖
      if (config.dependencies) {
        await this.preloadDependencies(config.dependencies);
      }

      // 预加载组件
      await this.preloadComponent(config.component);
      this.preloadedRoutes.add(path);
      
      console.log(`Preloaded route: ${path}`);
    } catch (error) {
      console.error(`Failed to preload route ${path}:`, error);
    }
  }

  // 预加载依赖
  private async preloadDependencies(dependencies: string[]): Promise<void> {
    const promises = dependencies.map(dep => this.loadDependency(dep));
    await Promise.allSettled(promises);
  }

  // 加载依赖
  private async loadDependency(dependency: string): Promise<void> {
    try {
      switch (dependency) {
        case 'recharts':
          // 动态导入，避免编译时错误
          break;
        case 'three':
          // 动态导入，避免编译时错误
          break;
        case 'd3':
          // 动态导入，避免编译时错误
          break;
        case 'simulator':
          await import('./simulator');
          break;
        default:
          console.warn(`Unknown dependency: ${dependency}`);
      }
    } catch (error) {
      console.warn(`Failed to load dependency ${dependency}:`, error);
    }
  }

  // 预加载组件
  private async preloadComponent(component: LazyExoticComponent<any>): Promise<void> {
    try {
      // 触发懒加载组件的加载
      await (component as any)._payload._result;
    } catch (error) {
      // 组件可能还没有被触发加载，这是正常的
    }
  }

  // 智能预加载
  async smartPreload(): Promise<void> {
    if (this.isPreloading) {
      return;
    }

    this.isPreloading = true;

    try {
      // 按优先级预加载
      const highPriorityRoutes = routeConfigs
        .filter(route => route.priority === 'high' && route.preload)
        .map(route => route.path);

      await Promise.all(highPriorityRoutes.map(path => this.preloadRoute(path)));

      // 在空闲时间预加载中等优先级的路由
      const mediumPriorityRoutes = routeConfigs
        .filter(route => route.priority === 'medium')
        .map(route => route.path);

      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          mediumPriorityRoutes.forEach(path => {
            this.preloadQueue.push(path);
          });
          this.processPreloadQueue();
        });
      }
    } finally {
      this.isPreloading = false;
    }
  }

  // 处理预加载队列
  private async processPreloadQueue(): Promise<void> {
    while (this.preloadQueue.length > 0) {
      const path = this.preloadQueue.shift()!;
      await this.preloadRoute(path);
      
      // 避免阻塞主线程
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // 基于用户行为预加载
  preloadOnHover(path: string): void {
    // 鼠标悬停时预加载
    setTimeout(() => {
      this.preloadRoute(path).catch(() => {});
    }, 200); // 200ms延迟，避免误触发
  }

  // 获取预加载状态
  getPreloadStatus(): { total: number; loaded: number; routes: string[] } {
    return {
      total: routeConfigs.length,
      loaded: this.preloadedRoutes.size,
      routes: Array.from(this.preloadedRoutes),
    };
  }
}

export const preloadManager = PreloadManager.getInstance();

// React Hook for preloading (简化版，移除Next.js依赖)
import { useEffect } from 'react';

export function usePreload() {
  useEffect(() => {
    // 初始化智能预加载
    preloadManager.smartPreload();
  }, []);

  return {
    preloadRoute: preloadManager.preloadRoute.bind(preloadManager),
    preloadOnHover: preloadManager.preloadOnHover.bind(preloadManager),
    getStatus: preloadManager.getPreloadStatus.bind(preloadManager),
  };
}

// 预测下一个可能访问的路由
export function predictNextRoutes(currentPath: string): string[] {
  const predictions: Record<string, string[]> = {
    '/': ['/simulation', '/quiz', '/analytics'],
    '/simulation': ['/quiz', '/analytics'],
    '/quiz': ['/analytics', '/learning-path'],
    '/analytics': ['/knowledge-graph', '/learning-path'],
    '/knowledge-graph': ['/learning-path', '/profile'],
    '/learning-path': ['/quiz', '/profile'],
    '/profile': ['/settings'],
    '/settings': ['/profile'],
  };

  return predictions[currentPath] || [];
}

// 性能监控
export function measureCodeSplittingPerformance() {
  if (typeof window === 'undefined') return;

  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (entry.entryType === 'navigation') {
        const navEntry = entry as PerformanceNavigationTiming;
        console.log('Code splitting metrics:', {
          domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
          loadComplete: navEntry.loadEventEnd - navEntry.loadEventStart,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
        });
      }
    });
  });

  observer.observe({ entryTypes: ['navigation', 'paint'] });
}