'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 过滤掉路由预取相关的错误，避免干扰用户体验
    if (
      error.message.includes('ERR_ABORTED') ||
      error.message.includes('fetch') ||
      error.message.includes('_rsc') ||
      error.name === 'AbortError'
    ) {
      console.warn('Route prefetch error (ignored):', error.message);
      // 重置错误状态，不显示错误界面
      this.setState({ hasError: false, error: undefined });
      return;
    }

    console.error('Error caught by boundary:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback: Fallback } = this.props;
      
      if (Fallback) {
        return <Fallback error={this.state.error} retry={this.retry} />;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto bg-destructive/10 rounded-full p-3 w-fit mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">出现了一些问题</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground text-sm">
                {this.state.error.message || '页面加载时遇到了错误，请稍后重试。'}
              </p>
              <Button onClick={this.retry} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                重试
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// 路由错误处理 Hook
export function useRouteErrorHandler() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // 过滤掉路由预取相关的错误
      if (
        event.reason?.message?.includes('ERR_ABORTED') ||
        event.reason?.message?.includes('_rsc') ||
        event.reason?.name === 'AbortError'
      ) {
        console.warn('Route prefetch error (handled):', event.reason?.message);
        event.preventDefault(); // 阻止错误冒泡
        return;
      }
    };

    const handleError = (event: ErrorEvent) => {
      // 过滤掉路由预取相关的错误
      if (
        event.message?.includes('ERR_ABORTED') ||
        event.message?.includes('_rsc') ||
        event.error?.name === 'AbortError'
      ) {
        console.warn('Route prefetch error (handled):', event.message);
        event.preventDefault(); // 阻止错误冒泡
        return;
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);
}