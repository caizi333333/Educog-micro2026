'use client';

import { lazy } from 'react';
import { Loader2 } from 'lucide-react';

// 懒加载组件
export const LazyAnalytics = lazy(() => import('@/app/analytics/page'));
export const LazySimulation = lazy(() => import('@/app/simulation/page'));
export const LazyQuiz = lazy(() => import('@/app/quiz/page'));
export const LazyKnowledgeGraph = lazy(() => import('@/app/knowledge-graph/page'));
export const LazyLearningPath = lazy(() => import('@/app/learning-path/page'));
export const LazyProfile = lazy(() => import('@/app/profile/page'));
export const LazySettings = lazy(() => import('@/app/settings/page'));

// 通用加载组件
export const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">正在加载页面...</p>
    </div>
  </div>
);

// 错误边界组件
export const LazyErrorBoundary = ({ error, retry }: { error: Error; retry: () => void }) => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center space-y-4">
      <h2 className="text-lg font-semibold text-destructive">页面加载失败</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button 
        onClick={retry}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        重试
      </button>
    </div>
  </div>
);