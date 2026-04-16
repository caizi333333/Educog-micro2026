import React from 'react';
import { cn } from '@/lib/utils';

interface RegisterDisplayProps {
  name: string;
  value: string;
  isUpdating?: boolean;
  description?: string;
  previousValue?: string;
}

export const RegisterDisplay: React.FC<RegisterDisplayProps> = ({ 
  name, 
  value, 
  isUpdating, 
  description,
  previousValue 
}) => {
  const hasChanged = previousValue && previousValue !== value;
  
  return (
    <div className={cn(
      "group relative p-3 rounded-lg border transition-all duration-200",
      isUpdating 
        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
        : hasChanged
        ? "border-green-500 bg-green-50/50 dark:bg-green-950/20" 
        : "border-gray-200 bg-gray-50/50 dark:bg-gray-900/20"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">{name}</span>
          {isUpdating && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
          {hasChanged && <div className="w-2 h-2 bg-green-500 rounded-full" />}
        </div>
        <span className={cn(
          "font-mono text-sm font-medium",
          hasChanged ? "text-green-600" : "text-foreground"
        )}>
          {value}
        </span>
      </div>
      {description && (
        <div className="text-xs text-muted-foreground mt-1">{description}</div>
      )}
    </div>
  );
};