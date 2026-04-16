import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationError } from '@/lib/syntax-validator';

interface ValidationPanelProps {
  errors: ValidationError[];
  warnings: ValidationError[];
  isValid: boolean;
  className?: string;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({
  errors,
  warnings,
  isValid,
  className
}) => {
  const totalIssues = errors.length + warnings.length;

  if (totalIssues === 0 && isValid) {
    return (
      <div className={cn(
        "bg-emerald-50 border border-emerald-200 rounded-lg p-4",
        className
      )}>
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-800">
            代码语法检查通过
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-white border border-slate-200 rounded-lg shadow-sm",
      className
    )}>
      {/* 头部统计 */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-red-50 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">代码验证</h3>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 text-xs">
          {errors.length > 0 && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-red-700 font-medium">{errors.length} 错误</span>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              <span className="text-amber-700 font-medium">{warnings.length} 警告</span>
            </div>
          )}
        </div>
      </div>

      {/* 错误和警告列表 */}
      <div className="max-h-64 overflow-y-auto">
        {/* 错误列表 */}
        {errors.map((error, index) => (
          <ValidationItem
            key={`error-${index}`}
            item={error}
            type="error"
          />
        ))}
        
        {/* 警告列表 */}
        {warnings.map((warning, index) => (
          <ValidationItem
            key={`warning-${index}`}
            item={warning}
            type="warning"
          />
        ))}
      </div>

      {/* 底部提示 */}
      {totalIssues > 0 && (
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-slate-600">
              {errors.length > 0 
                ? '请修复所有错误后再运行程序' 
                : '警告不会阻止程序运行，但建议修复以提高代码质量'
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

interface ValidationItemProps {
  item: ValidationError;
  type: 'error' | 'warning';
}

const ValidationItem: React.FC<ValidationItemProps> = ({ item, type }) => {
  const isError = type === 'error';
  
  return (
    <div className={cn(
      "flex items-start space-x-3 p-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors",
      isError ? "bg-red-50/30" : "bg-amber-50/30"
    )}>
      {/* 图标 */}
      <div className={cn(
        "flex-shrink-0 p-1 rounded-full mt-0.5",
        isError ? "bg-red-100" : "bg-amber-100"
      )}>
        {isError ? (
          <AlertCircle className="w-3 h-3 text-red-600" />
        ) : (
          <AlertTriangle className="w-3 h-3 text-amber-600" />
        )}
      </div>
      
      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            isError 
              ? "bg-red-100 text-red-700" 
              : "bg-amber-100 text-amber-700"
          )}>
            第 {item.line} 行
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {item.code}
          </span>
        </div>
        
        <p className={cn(
          "text-sm leading-relaxed",
          isError ? "text-red-800" : "text-amber-800"
        )}>
          {item.message}
        </p>
      </div>
    </div>
  );
};

export default ValidationPanel;