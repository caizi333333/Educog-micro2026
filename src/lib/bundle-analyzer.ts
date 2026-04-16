// Bundle分析工具
export interface BundleAnalysis {
  totalSize: number;
  gzippedSize: number;
  modules: ModuleInfo[];
  duplicates: DuplicateModule[];
  recommendations: string[];
}

export interface ModuleInfo {
  name: string;
  size: number;
  gzippedSize: number;
  type: 'js' | 'css' | 'image' | 'font' | 'other';
  isVendor: boolean;
  isAsync: boolean;
}

export interface DuplicateModule {
  name: string;
  count: number;
  totalSize: number;
  locations: string[];
}

class BundleAnalyzer {
  private static instance: BundleAnalyzer;
  private moduleRegistry = new Map<string, ModuleInfo>();
  private loadedModules = new Set<string>();

  static getInstance(): BundleAnalyzer {
    if (!BundleAnalyzer.instance) {
      BundleAnalyzer.instance = new BundleAnalyzer();
    }
    return BundleAnalyzer.instance;
  }

  // 注册模块信息
  registerModule(info: ModuleInfo): void {
    this.moduleRegistry.set(info.name, info);
  }

  // 标记模块已加载
  markModuleLoaded(moduleName: string): void {
    this.loadedModules.add(moduleName);
  }

  // 分析Bundle
  analyze(): BundleAnalysis {
    const modules = Array.from(this.moduleRegistry.values());
    const totalSize = modules.reduce((sum, mod) => sum + mod.size, 0);
    const gzippedSize = modules.reduce((sum, mod) => sum + mod.gzippedSize, 0);
    
    const duplicates = this.findDuplicates(modules);
    const recommendations = this.generateRecommendations(modules, duplicates);

    return {
      totalSize,
      gzippedSize,
      modules: modules.sort((a, b) => b.size - a.size),
      duplicates,
      recommendations,
    };
  }

  private findDuplicates(modules: ModuleInfo[]): DuplicateModule[] {
    const moduleCount = new Map<string, { count: number; size: number; locations: string[] }>();
    
    modules.forEach(mod => {
      const baseName = this.getBaseName(mod.name);
      if (!moduleCount.has(baseName)) {
        moduleCount.set(baseName, { count: 0, size: 0, locations: [] });
      }
      const info = moduleCount.get(baseName)!;
      info.count++;
      info.size += mod.size;
      info.locations.push(mod.name);
    });

    return Array.from(moduleCount.entries())
      .filter(([, info]) => info.count > 1)
      .map(([name, info]) => ({
        name,
        count: info.count,
        totalSize: info.size,
        locations: info.locations,
      }))
      .sort((a, b) => b.totalSize - a.totalSize);
  }

  private getBaseName(moduleName: string): string {
    // 提取模块的基本名称，忽略版本号和路径
    return moduleName.split('/').pop()?.split('@')[0] || moduleName;
  }

  private generateRecommendations(modules: ModuleInfo[], duplicates: DuplicateModule[]): string[] {
    const recommendations: string[] = [];
    
    // 检查大型模块
    const largeModules = modules.filter(mod => mod.size > 100 * 1024); // 100KB+
    if (largeModules.length > 0) {
      recommendations.push(
        `发现 ${largeModules.length} 个大型模块 (>100KB)，考虑代码分割或懒加载：${largeModules.slice(0, 3).map(m => m.name).join(', ')}`
      );
    }

    // 检查重复模块
    if (duplicates.length > 0) {
      const topDuplicates = duplicates.slice(0, 3);
      recommendations.push(
        `发现 ${duplicates.length} 个重复模块，考虑去重：${topDuplicates.map(d => d.name).join(', ')}`
      );
    }

    // 检查未使用的vendor模块
    const vendorModules = modules.filter(mod => mod.isVendor && !this.loadedModules.has(mod.name));
    if (vendorModules.length > 0) {
      recommendations.push(
        `发现 ${vendorModules.length} 个未使用的第三方模块，考虑移除或懒加载`
      );
    }

    // 检查同步加载的大型模块
    const largeSyncModules = modules.filter(mod => !mod.isAsync && mod.size > 50 * 1024);
    if (largeSyncModules.length > 0) {
      recommendations.push(
        `发现 ${largeSyncModules.length} 个同步加载的大型模块，考虑异步加载以提升首屏性能`
      );
    }

    // 检查图片资源
    const imageModules = modules.filter(mod => mod.type === 'image');
    const largeImages = imageModules.filter(mod => mod.size > 200 * 1024); // 200KB+
    if (largeImages.length > 0) {
      recommendations.push(
        `发现 ${largeImages.length} 个大型图片资源，考虑压缩或使用WebP格式`
      );
    }

    // 检查CSS模块
    const cssModules = modules.filter(mod => mod.type === 'css');
    const totalCssSize = cssModules.reduce((sum, mod) => sum + mod.size, 0);
    if (totalCssSize > 100 * 1024) {
      recommendations.push(
        `CSS总大小为 ${Math.round(totalCssSize / 1024)}KB，考虑CSS代码分割和压缩`
      );
    }

    return recommendations;
  }

  // 获取性能指标
  getPerformanceMetrics(): any {
    const modules = Array.from(this.moduleRegistry.values());
    const loadedCount = this.loadedModules.size;
    const totalCount = modules.length;
    
    return {
      totalModules: totalCount,
      loadedModules: loadedCount,
      loadingProgress: totalCount > 0 ? (loadedCount / totalCount) * 100 : 0,
      totalSize: modules.reduce((sum, mod) => sum + mod.size, 0),
      loadedSize: modules
        .filter(mod => this.loadedModules.has(mod.name))
        .reduce((sum, mod) => sum + mod.size, 0),
      vendorSize: modules
        .filter(mod => mod.isVendor)
        .reduce((sum, mod) => sum + mod.size, 0),
      appSize: modules
        .filter(mod => !mod.isVendor)
        .reduce((sum, mod) => sum + mod.size, 0),
    };
  }

  // 导出分析报告
  exportReport(): string {
    const analysis = this.analyze();
    const metrics = this.getPerformanceMetrics();
    
    const report = {
      timestamp: new Date().toISOString(),
      analysis,
      metrics,
      summary: {
        totalSizeMB: Math.round(analysis.totalSize / (1024 * 1024) * 100) / 100,
        gzippedSizeMB: Math.round(analysis.gzippedSize / (1024 * 1024) * 100) / 100,
        compressionRatio: analysis.totalSize > 0 ? Math.round((1 - analysis.gzippedSize / analysis.totalSize) * 100) : 0,
        moduleCount: analysis.modules.length,
        duplicateCount: analysis.duplicates.length,
      },
    };
    
    return JSON.stringify(report, null, 2);
  }

  // 清理数据
  clear(): void {
    this.moduleRegistry.clear();
    this.loadedModules.clear();
  }
}

export const bundleAnalyzer = BundleAnalyzer.getInstance();

// Webpack插件辅助函数（用于开发环境）
export function createBundleAnalyzerPlugin() {
  return {
    name: 'bundle-analyzer',
    generateBundle(_options: any, bundle: any) {
      Object.entries(bundle).forEach(([fileName, chunk]: [string, any]) => {
        if (chunk.type === 'chunk') {
          bundleAnalyzer.registerModule({
            name: fileName,
            size: chunk.code?.length || 0,
            gzippedSize: Math.round((chunk.code?.length || 0) * 0.3), // 估算gzip压缩后大小
            type: fileName.endsWith('.css') ? 'css' : 'js',
            isVendor: fileName.includes('vendor') || fileName.includes('node_modules'),
            isAsync: chunk.isDynamicEntry || false,
          });
        }
      });
    },
  };
}

// React Hook for bundle monitoring
import { useEffect, useState } from 'react';

export function useBundleAnalysis() {
  const [analysis, setAnalysis] = useState<BundleAnalysis | null>(null);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const updateAnalysis = () => {
      setAnalysis(bundleAnalyzer.analyze());
      setMetrics(bundleAnalyzer.getPerformanceMetrics());
    };

    updateAnalysis();
    
    // 定期更新分析结果
    const interval = setInterval(updateAnalysis, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return { analysis, metrics };
}

// 模块加载跟踪
export function trackModuleLoad(moduleName: string) {
  bundleAnalyzer.markModuleLoaded(moduleName);
  
  // 在开发环境下输出加载信息
  if (process.env.NODE_ENV === 'development') {
    console.log(`Module loaded: ${moduleName}`);
  }
}