import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from './use-toast';
import { calculateLearningCompletion, type LearningMetrics } from '@/lib/learning-completion';
import { processAchievementResponse } from '@/hooks/use-achievement-notifications';

// 扩展Error类型以支持自定义属性
interface ExtendedError extends Error {
  code?: string;
  retryable?: boolean;
}

// Throttle utility function
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastCallArgs: Parameters<T> | null = null;
  
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastCallArgs) {
          func.apply(this, lastCallArgs);
          lastCallArgs = null;
        }
      }, limit);
    } else {
      lastCallArgs = args;
    }
  };
}

interface TrackProgressOptions {
  moduleId: string;
  chapterId: string;
  pathId?: string;
  metadata?: Record<string, any>;
  autoSaveInterval?: number; // in milliseconds, default 30 seconds
  minReadingTime?: number; // minimum time to consider as reading, default 5 seconds
  totalExercises?: number; // total exercises in the chapter
  contentType?: 'theory' | 'practice' | 'mixed'; // content type for completion calculation
}

interface ProgressState {
  isSaving: boolean;
  lastSaved: Date | null;
  error: Error | null;
  totalTimeSpent: number;
  pageViews: number;
  isTracking: boolean;
  responseData: any | null;
  interactions: {
    notes: number;
    highlights: number;
    codeExecutions: number;
    questions: number;
    clicks?: number;
    scrolls?: number;
    keystrokes?: number;
  };
  completionDetails?: {
    completionPercentage: number;
    isCompleted: boolean;
    details: {
      readingScore: number;
      timeScore: number;
      interactionScore: number;
      quizScore: number;
    };
    suggestions: string[];
  };
}

type ServerLearningProgressRecord = {
  progress?: number;
  timeSpent?: number; // seconds (as stored in DB)
  lastAccessAt?: string | Date | null;
  status?: string | null;
};

type PendingLearningEvent = {
  eventType: string;
  targetType: string;
  targetId: string;
  moduleId?: string;
  chapterId?: string;
  duration?: number;
  progress?: number;
  clientTime: string;
  metadata?: Record<string, unknown>;
};

export function useTrackProgress(options: TrackProgressOptions) {
  const {
    moduleId,
    chapterId,
    pathId,
    metadata = {},
    totalExercises = 0,
    contentType = 'mixed',
  } = options;

  // 使用useRef来存储配置值，避免useEffect无限重新渲染
  const autoSaveIntervalRef = useRef(options.autoSaveInterval || 1800000); // 30 minutes
  const minReadingTimeRef = useRef(options.minReadingTime || 30000); // 30 seconds
  const pathIdRef = useRef(pathId);
  const moduleIdRef = useRef(moduleId);
  const chapterIdRef = useRef(chapterId);
  const metadataRef = useRef(metadata);
  const contentTypeRef = useRef(contentType);
  const totalExercisesRef = useRef(totalExercises);
  
  // 更新ref值
  pathIdRef.current = pathId;
  moduleIdRef.current = moduleId;
  chapterIdRef.current = chapterId;
  metadataRef.current = metadata;
  contentTypeRef.current = contentType;
  totalExercisesRef.current = totalExercises;

  const { toast } = useToast();

  const [state, setState] = useState<ProgressState>({
    isSaving: false,
    lastSaved: null,
    error: null,
    totalTimeSpent: 0,
    pageViews: 0,
    isTracking: true,
    responseData: null,
    interactions: {
      notes: 0,
      highlights: 0,
      codeExecutions: 0,
      questions: 0,
      clicks: 0,
      scrolls: 0,
      keystrokes: 0,
    },
  });
  const [currentProgress, setCurrentProgress] = useState(0);

  // Refs to track time and prevent multiple saves
  const startTimeRef = useRef<number>(Date.now());
  // 最近一次“有效活动”时间；初始化为 0 以确保首次交互能被记录
  const lastActiveTimeRef = useRef<number>(0);
  const lastSaveTimeRef = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef<boolean>(true);
  const hasUnsavedChangesRef = useRef<boolean>(false);
  const progressRef = useRef<number>(0);
  const completionDetailsRef = useRef<Record<string, unknown> | null>(null);
  const saveRetryCountRef = useRef(0);
  const maxRetries = 3;

  // Calculate progress based on comprehensive learning metrics
  const calculateProgress = useCallback(() => {
    if (typeof window === 'undefined') return progressRef.current;
    
    // Get current time spent in minutes (减慢时间计算)
    const currentTimeSpent = (Date.now() - startTimeRef.current) / 1000 / 60;
    const totalTimeSpentMinutes = (state.totalTimeSpent / 1000 / 60) + (currentTimeSpent * 0.5); // 时间计算减半
    
    // Calculate scroll-based reading progress (0-100)
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPosition = window.scrollY;
    const readingProgress = scrollHeight > 0 ? Math.min((scrollPosition / scrollHeight) * 100, 100) : 0;
    
    // Create learning metrics
    const metrics: LearningMetrics = {
      readingProgress: Math.max(progressRef.current, readingProgress), // Never go backward
      timeSpentMinutes: totalTimeSpentMinutes,
      interactions: state.interactions,
      requiredTimeMinutes: 10, // Default 10 minutes (增加所需时间)
    };
    
    // Calculate comprehensive completion
    const completion = calculateLearningCompletion(metrics, contentType);
    
    // Don't update state here to avoid circular dependency
    // Store completion details in a ref instead
    completionDetailsRef.current = completion;
    
    // Use the comprehensive completion percentage, but never go backward
    const newProgress = Math.max(progressRef.current, completion.completionPercentage);
    
    progressRef.current = newProgress;
    setCurrentProgress(newProgress);
    return newProgress;
  }, [state.totalTimeSpent, state.interactions, contentType]);

  // Refs for AbortController management
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Simplified request management
  const isRequestInProgressRef = useRef<boolean>(false);
  const requestQueueRef = useRef<Array<{ timeSpent: number; progress?: number; resolve: () => void; reject: (error: Error) => void; abortController?: AbortController; status?: string }>>([]);
  const eventQueueRef = useRef<PendingLearningEvent[]>([]);
  
  // Circuit breaker for error handling
  const circuitBreakerRef = useRef({
    failureCount: 0,
    lastFailureTime: 0,
    state: 'CLOSED' as 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  });

  // Circuit breaker check
  const checkCircuitBreaker = useCallback(() => {
    const breaker = circuitBreakerRef.current;
    const now = Date.now();
    
    if (breaker.state === 'OPEN') {
      // Check if we should try half-open
      if (now - breaker.lastFailureTime > 60000) { // 1 minute cooldown
        breaker.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    
    return true;
  }, []);
  
  // Enhanced queue reset function
  const resetQueue = useCallback(() => {
    requestQueueRef.current.forEach(req => {
      if (req.abortController && !req.abortController.signal.aborted) {
        req.abortController.abort();
      }
    });
    requestQueueRef.current = [];
    isRequestInProgressRef.current = false;
    saveRetryCountRef.current = 0;
    hasUnsavedChangesRef.current = false;
    setState(prev => ({ ...prev, isSaving: false }));
  }, []);

  // Basic queue health check
  const checkQueueHealth = useCallback(() => {
    const queueSize = requestQueueRef.current.length;
    
    // Simple queue size limit
    if (queueSize > 3) {
      console.warn(`Queue overloaded (${queueSize} requests), clearing queue`);
      requestQueueRef.current = [];
      return true;
    }
    
    return false;
  }, []);

  const enqueueLearningEvent = useCallback((eventType: string, metadata: Record<string, unknown> = {}) => {
    eventQueueRef.current.push({
      eventType,
      targetType: 'CHAPTER',
      targetId: chapterIdRef.current,
      moduleId: moduleIdRef.current,
      chapterId: chapterIdRef.current,
      progress: Math.round(progressRef.current),
      clientTime: new Date().toISOString(),
      metadata: {
        source: 'useTrackProgress',
        contentType: contentTypeRef.current,
        ...metadata,
      },
    });

    if (eventQueueRef.current.length > 100) {
      eventQueueRef.current = eventQueueRef.current.slice(-100);
    }
  }, []);

  const flushLearningEvents = useCallback(async () => {
    if (typeof window === 'undefined' || eventQueueRef.current.length === 0) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const events = eventQueueRef.current.splice(0, 100);
    try {
      const response = await fetch('/api/learning-events/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        eventQueueRef.current = [...events, ...eventQueueRef.current].slice(-100);
      }
    } catch {
      eventQueueRef.current = [...events, ...eventQueueRef.current].slice(-100);
    }
  }, []);

  // Enhanced queue processing with better error handling
  const processRequestQueue = useCallback(async () => {
    if (isRequestInProgressRef.current || requestQueueRef.current.length === 0) {
      return;
    }
    
    // Check queue health
    if (checkQueueHealth()) {
      return;
    }
    
    // Process only the latest request
    const request = requestQueueRef.current.shift();
    if (!request) return;
    
    try {
      await saveProgressInternal(request.timeSpent, request.progress);
      request.resolve();
    } catch (error) {
      const standardError = error instanceof Error ? error : new Error('Unknown error');
      
      // Enhanced error categorization
      if (standardError.name === 'AbortError' || standardError.message.includes('aborted')) {
        request.resolve(); // Resolve to avoid error propagation for abort errors
      } else if (standardError.message.includes('认证失效') || standardError.message.includes('未登录')) {
        // Authentication errors should not be retried
        request.reject(standardError);
      } else {
        // Other errors can be retried
        request.reject(standardError);
      }
    }
    
    // Process next request with adaptive delay
    if (requestQueueRef.current.length > 0) {
      const delay = Math.min(2000 * Math.max(1, circuitBreakerRef.current.failureCount), 10000);
      setTimeout(processRequestQueue, delay);
    }
  }, [checkQueueHealth]);
  
  // Save progress to the API with improved queue management
  const saveProgress = useCallback(async (timeSpent: number, progress?: number) => {
    // Don't save if tracking is disabled or if time spent is too short
    if (!state.isTracking || (timeSpent < minReadingTimeRef.current && !progress)) {
      return;
    }

    // If a request is already in progress, add to simple queue
    if (isRequestInProgressRef.current) {
      return new Promise<void>((resolve, reject) => {
        const maxQueueSize = 3; // Simple small queue
        
        if (requestQueueRef.current.length >= maxQueueSize) {
          // Simply reject new requests if queue is full
          reject(new Error('Request queue full'));
          return;
        }
        
        requestQueueRef.current.push({ timeSpent, progress, resolve, reject });
      });
    }
    
    return saveProgressInternal(timeSpent, progress);
  }, [state.isTracking]);
  
  // Internal save function with actual implementation
  const saveProgressInternal = useCallback(async (timeSpent: number, progress?: number) => {
    // Check circuit breaker
    if (!checkCircuitBreaker()) {
      const error = new Error('服务暂时不可用，请稍后重试');
      error.stack = new Error().stack;
      throw error;
    }
    
    // Set request in progress flag
    isRequestInProgressRef.current = true;

    // Prevent concurrent saves (legacy check)
    if (state.isSaving) {
      hasUnsavedChangesRef.current = true;
      isRequestInProgressRef.current = false;
      return;
    }
    
    // Add rate limiting - don't save more than once every 30 seconds
    const now = Date.now();
    if (lastSaveTimeRef.current && (now - lastSaveTimeRef.current) < 30000) {
      hasUnsavedChangesRef.current = true;
      isRequestInProgressRef.current = false;
      return;
    }

    // Component is ready to save

    setState(prev => ({ ...prev, isSaving: true }));

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token || token.trim() === '') {
        console.warn('用户未登录或token无效，跳过进度保存');
        setState(prev => ({ ...prev, isSaving: false }));
        return;
      }
      
      const currentProgress = progress ?? calculateProgress();

      // Properly manage AbortController lifecycle
      // Cancel previous request if it exists and is still pending
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort('New request initiated');
      }
      
      // Create new AbortController for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      // Set a reasonable timeout for better UX
      const timeoutId = setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort('Request timeout after 15 seconds');
        }
      }, 15000); // 15 second timeout

      const response = await fetch('/api/learning-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          pathId: pathIdRef.current,
          moduleId: moduleIdRef.current,
          chapterId: chapterIdRef.current,
          progress: currentProgress,
          timeSpent: Math.round(timeSpent / 1000), // Convert to seconds
          action: 'TRACK_PROGRESS',
          metadata: {
            ...metadataRef.current,
            // Limit interactions to prevent large payloads
            interactions: {
              clicks: Math.min(state.interactions.clicks || 0, 100),
              scrolls: Math.min(state.interactions.scrolls || 0, 50),
              keystrokes: Math.min(state.interactions.keystrokes || 0, 200),
              notes: Math.min(state.interactions.notes, 10),
              highlights: Math.min(state.interactions.highlights, 20),
              codeExecutions: Math.min(state.interactions.codeExecutions, 10),
              questions: Math.min(state.interactions.questions, 5),
            },
            completionDetails: completionDetailsRef.current,
            contentType: contentTypeRef.current,
          },
          totalExercises: totalExercisesRef.current,
          notes: localStorage.getItem(`notes-${moduleIdRef.current}-${chapterIdRef.current}`) || null,
          bookmarks: localStorage.getItem(`bookmarks-${moduleIdRef.current}-${chapterIdRef.current}`) || null,
        }),
      });
      
      clearTimeout(timeoutId);
      
      // Clear AbortController reference on successful completion
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '服务器响应格式错误' }));
        
        // 根据错误代码提供更具体的错误信息
        let errorMessage = errorData.error || '保存进度失败';
        
        if (response.status === 401) {
          errorMessage = '认证失效，请重新登录';
        } else if (response.status === 503) {
          errorMessage = '服务器暂时不可用，请稍后重试';
        } else if (response.status === 409) {
          errorMessage = '数据冲突，正在重新同步';
        }
        
        const error = new Error(errorMessage);
        (error as ExtendedError).code = errorData.code;
        (error as ExtendedError).retryable = errorData.retryable;
        throw error;
      }

      const responseData = await response.json();
      
      // Process achievement notifications
      processAchievementResponse(responseData);
      
      // Reset circuit breaker on success
      const breaker = circuitBreakerRef.current;
      breaker.failureCount = 0;
      breaker.state = 'CLOSED';
      
      // Clear request in progress flag
      isRequestInProgressRef.current = false;
      
      setState(prev => ({
        ...prev,
        isSaving: false,
        lastSaved: new Date(),
        error: null,
        totalTimeSpent: prev.totalTimeSpent + timeSpent,
        responseData: responseData,
      }));

      // Update last save time for rate limiting
      lastSaveTimeRef.current = Date.now();

      // 更新进度状态和引用
      if (progress !== undefined) {
        progressRef.current = progress;
        setCurrentProgress(progress);
      }

      hasUnsavedChangesRef.current = false;
      saveRetryCountRef.current = 0; // Reset retry count on successful save
      
      // Process next request in queue
      setTimeout(processRequestQueue, 100);

      // Show subtle success feedback
      const finalProgress = progress !== undefined ? progress : currentProgress;
      if (finalProgress >= 100) {
        toast({
          title: "章节已完成",
          description: "您已完成本章节的学习",
          duration: 3000,
        });
      }
    } catch (error) {
      // Standardize error object
      let standardError: Error;
      if (error instanceof Error) {
        standardError = error;
        // Ensure error has stack trace
        if (!standardError.stack) {
          standardError.stack = new Error().stack;
        }
      } else {
        standardError = new Error(String(error));
        standardError.stack = new Error().stack;
      }
      
      console.error('保存进度失败:', standardError);
      console.error('Error type:', typeof standardError);
      console.error('Error name:', standardError.name);
      console.error('Error message:', standardError.message);
      console.error('Error stack:', standardError.stack);
      
      // Update circuit breaker on failure
      const breaker = circuitBreakerRef.current;
      breaker.failureCount += 1;
      breaker.lastFailureTime = Date.now();
      
      // Open circuit breaker if too many failures (更保守的策略)
      if (breaker.failureCount >= 3) {
        breaker.state = 'OPEN';
        // 设置更长的恢复时间
        setTimeout(() => {
          breaker.state = 'HALF_OPEN';
          breaker.failureCount = 0;
        }, 600000); // 10分钟后重置
      }
      
      // Clear request in progress flag
       isRequestInProgressRef.current = false;
       
       // Clear AbortController reference on error
       if (abortControllerRef.current) {
         abortControllerRef.current = null;
       }
       
       // Process next request in queue
       setTimeout(processRequestQueue, 1000);
      
      // Update state after error
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: standardError,
      }));

      // Enhanced AbortError handling
      if (standardError.name === 'AbortError') {
        // Only retry timeout aborts, not user-initiated aborts
        if (standardError.message.includes('timeout') && saveRetryCountRef.current < 2) {
          saveRetryCountRef.current += 1;
          const retryDelay = Math.min(5000 * saveRetryCountRef.current, 15000); // Cap at 15 seconds
          
          setTimeout(() => {
            // Double-check conditions before retry
            if (hasUnsavedChangesRef.current && 
                !isRequestInProgressRef.current && 
                state.isTracking) {
              const timeSpent = Date.now() - startTimeRef.current;
              saveProgressInternal(timeSpent).catch(retryError => {
                console.error('Retry failed:', retryError);
                // Don't show toast for retry failures to avoid spam
              });
            }
          }, retryDelay);
          hasUnsavedChangesRef.current = true;
          return;
        } else if (standardError.message.includes('timeout')) {
          // Max retries reached for timeout
          toast({
            title: "保存超时",
            description: "学习进度保存超时，数据已暂存，将在网络恢复时自动重试。",
            variant: "destructive",
            duration: 5000,
          });
        }
        
        // For non-timeout aborts (user navigation, etc.), silently mark as unsaved
        hasUnsavedChangesRef.current = true;
        return;
      }

      // Enhanced error categorization and handling
      if (error instanceof Error) {
        const errorCode = (error as ExtendedError).code;
        const isRetryable = (error as ExtendedError).retryable;
        
        if (error.message === '未登录' || error.message.includes('认证失效') || error.message.includes('401')) {
          // Authentication errors - don't retry, clear token
          console.warn('用户认证失效，清除本地token');
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
          }
          toast({
            title: "认证失效",
            description: "请重新登录以继续保存学习进度",
            variant: "destructive",
            duration: 5000,
          });
          // Reset retry count and don't mark as unsaved for auth errors
          saveRetryCountRef.current = 0;
          return;
        } else if (errorCode === 'DUPLICATE_RECORD') {
          // Duplicate record - silent handling, consider as success
          hasUnsavedChangesRef.current = false;
          saveRetryCountRef.current = 0;
          setState(prev => ({ ...prev, lastSaved: new Date(), error: null }));
          return;
        } else if (error.message.includes('服务暂时不可用') || error.message.includes('503')) {
          // Service unavailable - longer retry delay
          if (saveRetryCountRef.current < 2) {
            saveRetryCountRef.current += 1;
            const retryDelay = 30000 * saveRetryCountRef.current; // 30s, 60s
            setTimeout(() => {
              if (hasUnsavedChangesRef.current && !isRequestInProgressRef.current && state.isTracking) {
                const timeSpent = Date.now() - startTimeRef.current;
                saveProgressInternal(timeSpent).catch(retryError => {
                  console.error('Service retry failed:', retryError);
                });
              }
            }, retryDelay);
            hasUnsavedChangesRef.current = true;
          } else {
            toast({
              title: "服务暂时不可用",
              description: "学习进度暂存本地，服务恢复后将自动同步",
              variant: "destructive",
              duration: 5000,
            });
            hasUnsavedChangesRef.current = true;
          }
        } else if ((error.message.includes('网络') || error.message.includes('连接') || 
                   error.message.includes('fetch') || error.message.includes('Failed to fetch') ||
                   errorCode === 'DATABASE_CONNECTION' || isRetryable) && saveRetryCountRef.current < 2) {
          // Network and retryable errors - exponential backoff
          saveRetryCountRef.current += 1;
          const retryDelay = Math.min(5000 * Math.pow(2, saveRetryCountRef.current - 1), 20000); // 5s, 10s max
          setTimeout(() => {
            if (hasUnsavedChangesRef.current && !isRequestInProgressRef.current && state.isTracking) {
              const timeSpent = Date.now() - startTimeRef.current;
              saveProgressInternal(timeSpent).catch(retryError => {
                console.error('Network retry failed:', retryError);
              });
            }
          }, retryDelay);
          hasUnsavedChangesRef.current = true;
        } else {
          // Non-retryable errors or max retries reached
          const isMaxRetries = saveRetryCountRef.current >= 2;
          toast({
            title: isMaxRetries ? "保存失败" : "保存错误",
            description: isMaxRetries 
              ? "多次重试失败，数据已暂存，请检查网络连接" 
              : (error.message || "学习进度保存失败，请稍后重试"),
            variant: "destructive",
            duration: isMaxRetries ? 8000 : 5000,
          });
          hasUnsavedChangesRef.current = true;
        }
      }
    }
  }, [state.isSaving, state.interactions]); // 简化依赖

  // 防抖保存：把频繁触发收敛为一次保存（真正的“保存裁决”由 saveProgress 负责）
  const debouncedSave = useCallback((timeSpent: number) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Adaptive delay based on circuit breaker state
    const baseDelay = 2000; // 2 seconds（可快速响应“无感保存”）
    const breaker = circuitBreakerRef.current;
    const delay = breaker.state === 'OPEN' ? baseDelay * 5 : baseDelay;

    saveTimeoutRef.current = setTimeout(() => {
      if (!isRequestInProgressRef.current && 
          hasUnsavedChangesRef.current && 
          state.isTracking) {
        if (checkCircuitBreaker()) {
          saveProgress(timeSpent).catch(error => {
            console.error('Debounced save failed:', error);
            // Don't show toast for debounced save failures to avoid spam
          });
        }
      }
    }, delay);
  }, [saveProgress, state.isTracking, checkCircuitBreaker]);

  // 更严格的用户活动跟踪
  const trackActivity = useCallback((event?: Event) => {
    const now = Date.now();
    
    // 防抖：限制活动跟踪频率，避免过度触发
    if (lastActiveTimeRef.current && (now - lastActiveTimeRef.current) < 30000) {
      return; // 30秒内不重复跟踪
    }

    // 只在用户不活跃超过15分钟时重置计时器
    const timeSinceLastActive = lastActiveTimeRef.current ? (now - lastActiveTimeRef.current) : Infinity;

    lastActiveTimeRef.current = now;
    isActiveRef.current = true;
    hasUnsavedChangesRef.current = true;
    const eventType = event?.type ? `USER_${event.type.toUpperCase()}` : 'USER_ACTIVITY';
    enqueueLearningEvent(eventType, {
      action: eventType,
      component: 'learning-content',
      interactions: state.interactions,
    });

    if (timeSinceLastActive > 900000) { // 15分钟
      startTimeRef.current = now;
    }
  }, [enqueueLearningEvent, state.interactions]);

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // Page is hidden, save progress immediately
      const timeSpent = Date.now() - startTimeRef.current;
      if (timeSpent >= minReadingTimeRef.current) {
        saveProgress(timeSpent);
      }
      flushLearningEvents();
      isActiveRef.current = false;
    } else {
      // Page is visible again, reset timer
      startTimeRef.current = Date.now();
      isActiveRef.current = true;
    }
  }, [flushLearningEvents, saveProgress]);

  // Handle page unload
  const handleBeforeUnload = useCallback((_e: BeforeUnloadEvent) => {
    const timeSpent = Date.now() - startTimeRef.current;
    if (timeSpent >= minReadingTimeRef.current || hasUnsavedChangesRef.current) {
      // Try to save progress on page unload
      const token = localStorage.getItem('accessToken');
      if (token && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const data = {
            pathId: pathIdRef.current,
            moduleId: moduleIdRef.current,
            chapterId: chapterIdRef.current,
            progress: calculateProgress(),
            timeSpent: Math.round(timeSpent / 1000),
            action: 'TRACK_PROGRESS',
            metadata: metadataRef.current,
          };

          // Use sendBeacon for reliable unload tracking
          // Note: sendBeacon doesn't support custom headers, so we include token in body
          const dataWithAuth = {
            ...data,
            token: token
          };
          
          const blob = new Blob([JSON.stringify(dataWithAuth)], { type: 'application/json' });
          const success = navigator.sendBeacon('/api/learning-progress', blob);
          
          if (!success) {
            console.warn('Failed to send beacon on page unload');
          }
        } catch (error) {
          console.warn('Error during page unload save:', error);
        }
      }
    }
    if (eventQueueRef.current.length > 0) {
      const token = localStorage.getItem('accessToken');
      if (token && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const events = eventQueueRef.current.splice(0, 100);
        const blob = new Blob([JSON.stringify({ token, events })], { type: 'application/json' });
        navigator.sendBeacon('/api/learning-events/batch', blob);
      }
    }
  }, [calculateProgress]);

  // 简化的滚动处理防抖
  const throttledScrollHandler = useRef(
    throttle(() => {
      const previousProgress = progressRef.current;
      const newProgress = calculateProgress();
      // 简化的进度变化检查，减少不必要的活动跟踪
      if (Math.abs(newProgress - previousProgress) > 15) { // 进一步提高阈值到15%
        enqueueLearningEvent('SCROLL_PROGRESS', {
          action: 'SCROLL_PROGRESS',
          component: 'learning-content',
        });
        trackActivity();
      }
    }, 10000) // 增加到10秒，大幅减少频率
  ).current;

  // Set up event listeners and intervals
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    // Component is now mounted and ready
    
    // Track initial page view
    setState(prev => ({ ...prev, pageViews: prev.pageViews + 1 }));
    
    // Enhanced network status monitoring with better recovery logic
    const handleOnline = () => {
      // Reset circuit breaker on network recovery
      const breaker = circuitBreakerRef.current;
      if (breaker.state === 'OPEN') {
        breaker.state = 'HALF_OPEN';
        breaker.failureCount = Math.max(0, breaker.failureCount - 1); // Reduce failure count
      }
      
      if (hasUnsavedChangesRef.current && !isRequestInProgressRef.current && state.isTracking) {
        // Reset retry counter for fresh start
        saveRetryCountRef.current = 0;
        const timeSpent = Date.now() - startTimeRef.current;
        
        // Staggered retry with network stability check
        setTimeout(() => {
          if (hasUnsavedChangesRef.current && 
              !isRequestInProgressRef.current && 
              navigator.onLine && 
              state.isTracking) {
            saveProgressInternal(timeSpent).catch(error => {
              console.error('Network recovery save failed:', error);
              // Don't show toast immediately after network recovery to avoid spam
            });
          }
        }, 3000); // Reduced to 3 seconds for better UX
      }
    };
    
    const handleOffline = () => {
      // Network connection lost - no action needed
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set up activity tracking
    const activityEvents = ['mousedown', 'keydown', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, trackActivity);
    });
    
    // Set up scroll tracking for progress calculation with throttling
    window.addEventListener('scroll', throttledScrollHandler);

    // Set up visibility tracking
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up unload tracking
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 自动保存机制（默认 30 分钟，可由 options.autoSaveInterval 覆盖）
    const intervalMs = autoSaveIntervalRef.current;
    const autoSaveIntervalId = setInterval(() => {
      if (isActiveRef.current && hasUnsavedChangesRef.current) {
        // 简化的条件检查
        const now = Date.now();
        const timeSinceLastSave = lastSaveTimeRef.current ? (now - lastSaveTimeRef.current) : Infinity;
        
        // 检查条件：距离上次保存超过 interval + 有足够的学习时间
        if (timeSinceLastSave > intervalMs) {
          const timeSpent = now - startTimeRef.current;
          if (timeSpent >= minReadingTimeRef.current) {
            // interval 本身已经很稀疏 + saveProgress 内部有 30s 最小间隔裁决
            // 这里直接保存，避免 interval 太小导致“防抖永远触发不到”的问题
            saveProgress(timeSpent).catch(() => {
              // silent
            });
          }
        }
      }
    }, intervalMs);

    // 简化的健康检查机制 - 每15分钟检查一次
    const healthCheckInterval = setInterval(() => {
      // 只检查熔断器状态
      const breaker = circuitBreakerRef.current;
      const now = Date.now();
      if (breaker.state === 'OPEN' && 
          now - breaker.lastFailureTime > 600000) { // 10 minutes
        breaker.state = 'HALF_OPEN';
        breaker.failureCount = 0;
      }
    }, 900000); // 15 minutes

    const learningEventFlushInterval = setInterval(() => {
      flushLearningEvents().catch(() => {
        // silent
      });
    }, 60000);

    // Cleanup function
    return () => {
      
      // Don't cancel pending requests on unmount to avoid AbortError
      // Let them complete naturally
      
      // Save any remaining progress (but don't wait for it)
      const timeSpent = Date.now() - startTimeRef.current;
      if (timeSpent >= minReadingTimeRef.current) {
        // Use a synchronous approach for cleanup save
        try {
          const token = localStorage.getItem('accessToken');
          if (token) {
            const data = {
              pathId: pathIdRef.current,
              moduleId: moduleIdRef.current,
              chapterId: chapterIdRef.current,
              progress: calculateProgress(),
              timeSpent: Math.round(timeSpent / 1000),
              action: 'TRACK_PROGRESS',
              metadata: metadataRef.current,
            };
            
            // Use sendBeacon for reliable cleanup
            if (navigator.sendBeacon) {
              const blob = new Blob([JSON.stringify({ ...data, token })], { type: 'application/json' });
              navigator.sendBeacon('/api/learning-progress', blob);
            }
          }
        } catch (error) {
          console.warn('Failed to save progress during cleanup:', error);
        }
      }

      // Clear all event listeners
      activityEvents.forEach(event => {
        document.removeEventListener(event, trackActivity);
      });
      window.removeEventListener('scroll', throttledScrollHandler);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      // Clear intervals and timeouts
      clearInterval(autoSaveIntervalId);
      clearInterval(healthCheckInterval);
      clearInterval(learningEventFlushInterval);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []); // 移除所有依赖以防止无限重新渲染，使用ref存储动态值

  // Public methods
  const pauseTracking = useCallback(() => {
    setState(prev => ({ ...prev, isTracking: false }));
  }, []);

  const resumeTracking = useCallback(() => {
    setState(prev => ({ ...prev, isTracking: true }));
    startTimeRef.current = Date.now();
  }, []);

  const forceSync = useCallback(async (forceComplete: boolean = true) => {
    
    try {
      // Perform health check and auto-recovery if needed
      checkQueueHealth();

      // Smart queue management - try to clear some space first
      const queueSize = requestQueueRef.current.length;
      if (queueSize > 8) {
        console.warn(`Queue is busy (${queueSize} requests), attempting to optimize...`);

        // Try to clear completed or failed requests
        requestQueueRef.current = requestQueueRef.current.filter(req => 
          req.status === 'pending' || req.status === 'retrying'
        );
        
        const newQueueSize = requestQueueRef.current.length;
        
        // If still too many requests, wait a bit and try again
        if (newQueueSize > 10) {
          console.warn('Queue still busy, waiting before force sync...');
          
          // Wait for up to 3 seconds for queue to clear
          let waitTime = 0;
          const maxWait = 3000;
          const checkInterval = 500;
          
          while (waitTime < maxWait && requestQueueRef.current.length > 8) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waitTime += checkInterval;
            
            // Clean up completed requests during wait
            requestQueueRef.current = requestQueueRef.current.filter(req => 
              req.status === 'pending' || req.status === 'retrying'
            );
          }
          
          // If queue is still too busy, try emergency reset
          if (requestQueueRef.current.length > 10) {
            console.warn('Queue still overloaded, performing emergency reset');
            resetQueue();
            // Wait a moment for reset to complete
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      const timeSpent = Date.now() - startTimeRef.current;
      if (forceComplete) {
        // Set progress to 100% and save
        progressRef.current = 100;
        setCurrentProgress(100);
        await saveProgress(timeSpent, 100); // Force 100% completion
      } else {
        // Just sync current progress
        await saveProgress(timeSpent, progressRef.current);
      }
    } catch (error) {
      console.error('强制同步失败:', error);
      
      // Enhanced error handling with recovery suggestions
      if (error instanceof Error) {
        if (error.message.includes('queue overflow') || error.message.includes('系统正忙')) {
          // Provide recovery option
          resetQueue();
          throw new Error('系统正忙，已自动重置，请稍后重试');
        }
      }
      
      // Re-throw the error so calling code can handle it appropriately
      throw error;
    }
  }, [saveProgress, checkQueueHealth, resetQueue]);

  /**
   * 将服务端已有进度“无感回填”到当前会话（用于刷新/换设备后恢复）
   * - 不触发保存
   * - 只增不减（与服务端逻辑一致）
   */
  const hydrateFromServer = useCallback((record: ServerLearningProgressRecord | null | undefined) => {
    if (!record) return;

    const serverProgress = typeof record.progress === 'number'
      ? Math.max(0, Math.min(100, record.progress))
      : 0;

    const serverTimeSpentMs = typeof record.timeSpent === 'number'
      ? Math.max(0, record.timeSpent) * 1000
      : 0;

    // 只增不减：用服务端进度“抬高”当前进度，而不是覆盖
    const nextProgress = Math.max(progressRef.current, serverProgress);
    progressRef.current = nextProgress;
    setCurrentProgress(nextProgress);

    // 用服务端累计时长抬高本地累计时长（不覆盖本地更大值）
    setState(prev => ({
      ...prev,
      totalTimeSpent: Math.max(prev.totalTimeSpent, serverTimeSpentMs),
      lastSaved: record.lastAccessAt ? new Date(record.lastAccessAt) : prev.lastSaved,
      // 提供给外层组件一个“已恢复”的信号（可选使用）
      responseData: {
        ...(typeof prev.responseData === 'object' && prev.responseData ? prev.responseData : {}),
        hydrated: true,
        hydratedProgress: nextProgress,
        hydratedStatus: record.status ?? null,
      },
    }));

    // 视为已与服务端对齐，避免立刻触发自动保存/重试
    hasUnsavedChangesRef.current = false;
    lastSaveTimeRef.current = Date.now();
    startTimeRef.current = Date.now();
  }, []);

  // Track interactions
  const trackInteraction = useCallback((type: 'notes' | 'highlights' | 'codeExecutions' | 'questions') => {
    setState(prev => ({
      ...prev,
      interactions: {
        ...prev.interactions,
        [type]: prev.interactions[type] + 1,
      },
    }));
    hasUnsavedChangesRef.current = true;
    trackActivity(); // Trigger activity tracking
  }, [trackActivity]);

  return {
    ...state,
    pauseTracking,
    resumeTracking,
    forceSync,
    hydrateFromServer,
    trackInteraction,
    progress: currentProgress,
    responseData: state.responseData,
    completionDetails: completionDetailsRef.current,
    resetQueue, // Expose queue reset for emergency use
    queueSize: requestQueueRef.current.length, // Expose queue size for monitoring
  };
}
