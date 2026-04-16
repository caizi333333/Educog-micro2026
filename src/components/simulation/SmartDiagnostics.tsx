import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SimulatorState } from '@/lib/simulator';
import type { DiagnosticResult } from '@/hooks/useSimulator';

interface SmartDiagnosticsProps {
  fault: string;
  result: DiagnosticResult | null;
  simulatorState: SimulatorState | null;
}

interface DiagnosticInfo {
  level: 'error' | 'success' | 'info';
  title: string;
  message: string;
  suggestions: string[];
}

export const SmartDiagnostics: React.FC<SmartDiagnosticsProps> = ({
  fault,
  result,
  simulatorState
}) => {
  const getDiagnostics = (): DiagnosticInfo => {
    if (fault) {
      return {
        level: 'error',
        title: '执行错误',
        message: fault,
        suggestions: [
          '检查指令拼写是否正确',
          '确认寄存器和地址范围',
          '验证程序逻辑和跳转标签'
        ]
      };
    }

    if (!result || !simulatorState) {
      return {
        level: 'info',
        title: '等待执行',
        message: '请点击"仿真执行"按钮开始程序仿真',
        suggestions: ['选择一个实验模板开始', '或编写自定义汇编代码']
      };
    }

    // 分析执行结果
    const pc = simulatorState.pc;
    const totalInstructions = simulatorState.memory.length;
    
    return {
      level: 'success',
      title: '执行正常',
      message: `程序计数器: ${pc.toString(16).toUpperCase().padStart(4, '0')}H`,
      suggestions: [
        `已执行 ${pc} / ${totalInstructions} 条指令`,
        '检查寄存器和端口状态',
        '使用单步调试观察程序执行'
      ]
    };
  };

  const diagnostics = getDiagnostics();
  
  const getIcon = () => {
    switch (diagnostics.level) {
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    switch (diagnostics.level) {
      case 'error':
        return 'destructive' as const;
      default:
        return 'default' as const;
    }
  };

  return (
    <div className="space-y-4">
      <Alert variant={getVariant()}>
        {getIcon()}
        <AlertDescription>
          <div className="space-y-2">
            <div className="font-semibold">{diagnostics.title}</div>
            <div>{diagnostics.message}</div>
            {diagnostics.suggestions.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium mb-1">建议:</div>
                <ul className="text-sm space-y-1">
                  {diagnostics.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};