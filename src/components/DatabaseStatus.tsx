'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useApiCall, errorHandlerPresets } from '@/lib/api-error-handler';

interface DatabaseHealth {
  timestamp: string;
  database: {
    isConnected: boolean;
    latency?: number;
    error?: string;
    info: {
      provider: string;
      host: string;
      port: string;
      database: string;
      hasCredentials: boolean;
    };
  };
  recommendations: string[];
}

export function DatabaseStatus() {
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const { loading, error, execute } = useApiCall<DatabaseHealth>({
    ...errorHandlerPresets.userAction,
    onRetry: (attempt) => {
      setRetryCount(attempt);
    },
    onError: (apiError) => {
      // 设置错误状态的健康数据
      setHealth({
        timestamp: new Date().toISOString(),
        database: {
          isConnected: false,
          error: apiError.message,
          info: {
            provider: '未知',
            host: '未知',
            port: '未知',
            database: '未知',
            hasCredentials: false,
          },
        },
        recommendations: [
          '检查应用程序是否正常运行',
          '确认API端点可访问',
          '检查网络连接状态'
        ],
      });
    },
  });

  const checkHealth = async () => {
    setRetryCount(0);
    try {
      const data = await execute(async () => {
        const response = await fetch('/api/health/database');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      });
      
      setHealth(data);
      setLastChecked(new Date());
    } catch (err) {
      // Error is already handled by useApiCall
      console.error('Health check failed:', err);
    }
  };

  useEffect(() => {
    checkHealth();
    // 每30秒自动检查一次
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // const getStatusColor = () => {
  //   if (!health) return 'gray';
  //   return health.database.isConnected ? 'green' : 'red';
  // };

  const getStatusIcon = () => {
    if (loading) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (error) return <AlertCircle className="h-4 w-4 text-red-500" />;
    if (!health) return <Database className="h-4 w-4" />;
    return health.database.isConnected ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <AlertCircle className="h-4 w-4 text-red-500" />
    );
  };

  const formatLatency = (latency?: number) => {
    if (!latency) return 'N/A';
    if (latency < 100) return `${latency}ms (优秀)`;
    if (latency < 300) return `${latency}ms (良好)`;
    if (latency < 1000) return `${latency}ms (一般)`;
    return `${latency}ms (较慢)`;
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          数据库连接状态
        </CardTitle>
        <CardDescription>
          实时监控数据库连接健康状态
          {lastChecked && (
            <span className="ml-2 text-xs text-muted-foreground">
              最后检查: {lastChecked.toLocaleTimeString()}
            </span>
          )}
          {retryCount > 0 && (
            <span className="ml-2 text-xs text-yellow-600">
              重试次数: {retryCount}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {health && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">连接状态:</span>
              <Badge variant={health.database.isConnected ? 'default' : 'destructive'}>
                {health.database.isConnected ? '已连接' : '连接失败'}
              </Badge>
            </div>

            {health.database.isConnected && health.database.latency && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">响应延迟:</span>
                <span className="text-sm">{formatLatency(health.database.latency)}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">数据库类型:</span>
                <p className="text-muted-foreground">{health.database.info.provider}</p>
              </div>
              <div>
                <span className="font-medium">主机:</span>
                <p className="text-muted-foreground truncate">{health.database.info.host}</p>
              </div>
              <div>
                <span className="font-medium">端口:</span>
                <p className="text-muted-foreground">{health.database.info.port}</p>
              </div>
              <div>
                <span className="font-medium">数据库:</span>
                <p className="text-muted-foreground">{health.database.info.database}</p>
              </div>
            </div>

            {(health.database.error || error) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>错误详情:</strong> {health.database.error || error?.message}
                  {error?.status && (
                    <span className="ml-2 text-xs">
                      (状态码: {error.status})
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {health.recommendations.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">
                  {health.database.isConnected ? '状态正常' : '建议操作'}:
                </span>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {health.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-xs mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <div className="flex gap-2">
          <Button
            onClick={checkHealth}
            disabled={loading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                检查中...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                重新检查
              </>
            )}
          </Button>
          
          {((health && !health.database.isConnected) || error) && (
            <Button
              onClick={() => window.open('/TROUBLESHOOTING.md', '_blank')}
              variant="outline"
              size="sm"
            >
              查看故障排除指南
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}