'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ProgressIndicatorProps {
  isSaving: boolean;
  lastSaved: Date | null;
  error: Error | null;
  className?: string;
}

export function ProgressIndicator({
  isSaving,
  lastSaved,
  error,
  className
}: ProgressIndicatorProps) {
  const [showSavedMessage, setShowSavedMessage] = useState(false);

  useEffect(() => {
    if (!isSaving && lastSaved && !error) {
      setShowSavedMessage(true);
      const timer = setTimeout(() => setShowSavedMessage(false), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSaving, lastSaved, error]);

  const getRelativeTime = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return '刚刚';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <AnimatePresence mode="wait">
        {isSaving && (
          <motion.div
            key="saving"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>保存中...</span>
          </motion.div>
        )}

        {!isSaving && showSavedMessage && lastSaved && !error && (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2 text-green-600"
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>已保存</span>
          </motion.div>
        )}

        {!isSaving && !showSavedMessage && lastSaved && !error && (
          <motion.div
            key="last-saved"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <Cloud className="h-3 w-3" />
            <span>上次保存: {getRelativeTime(lastSaved)}</span>
          </motion.div>
        )}

        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 text-destructive"
          >
            <CloudOff className="h-3 w-3" />
            <span>保存失败</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Simplified version without animations for better performance
export function SimpleProgressIndicator({
  isSaving,
  lastSaved,
  error,
  className
}: ProgressIndicatorProps) {
  if (isSaving) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>保存中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-destructive', className)}>
        <CloudOff className="h-3 w-3" />
        <span>保存失败</span>
      </div>
    );
  }

  if (lastSaved) {
    const seconds = Math.floor((new Date().getTime() - lastSaved.getTime()) / 1000);
    const isRecent = seconds < 5;
    
    return (
      <div className={cn(
        'flex items-center gap-2 text-sm',
        isRecent ? 'text-green-600' : 'text-muted-foreground',
        className
      )}>
        {isRecent ? (
          <>
            <CheckCircle2 className="h-3 w-3" />
            <span>已保存</span>
          </>
        ) : (
          <>
            <Cloud className="h-3 w-3" />
            <span>已自动保存</span>
          </>
        )}
      </div>
    );
  }

  return null;
}