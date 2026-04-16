'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useTrackProgress } from '@/hooks/useTrackProgress';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, CheckCircle, Save, BookOpen, ClipboardCheck, PenTool, Bookmark, AlertCircle, StickyNote, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMissingRequirements } from '@/lib/learning-completion';
import { NoteTaking } from '@/components/ui/note-taking';
import { SimpleProgressIndicator } from '@/components/ui/progress-indicator-legacy';

interface LearningModuleWithProgressProps {
  moduleId: string;
  chapterId: string;
  pathId?: string;
  children: React.ReactNode;
  className?: string;
  totalExercises?: number;
  onQuizClick?: () => void;
  onExerciseClick?: () => void;
  onNotesClick?: () => void;
}

export function LearningModuleWithProgress({
  moduleId,
  chapterId,
  pathId,
  children,
  className,
  totalExercises = 0,
  onQuizClick,
  onExerciseClick,
  onNotesClick,
}: LearningModuleWithProgressProps) {
  const [showRequirements, setShowRequirements] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [completionData, setCompletionData] = useState<any>(null);
  const [hasNotes, setHasNotes] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Use consistent metadata values for SSR and client
  const clientMetadata = {
    userAgent: 'SSR',
    screenResolution: 'Unknown',
  };

  // Memoize the options to prevent unnecessary re-renders
  const trackingOptions = useMemo(() => ({
    moduleId,
    chapterId,
    pathId,
    metadata: clientMetadata,
    autoSaveInterval: 300000, // Save every 5 minutes
    minReadingTime: 30000, // Minimum 30 seconds to count as reading
    totalExercises,
  }), [moduleId, chapterId, pathId, totalExercises]);

  const {
    isSaving,
    lastSaved,
    totalTimeSpent,
    progress,
    error,
    forceSync,
    responseData,
    hydrateFromServer,
  } = useTrackProgress(trackingOptions);

  // 避免重复拉取/重复 hydrate
  const hasHydratedFromServerRef = useRef(false);

  // Use ref to track previous responseData to prevent infinite loops
  const prevResponseDataRef = useRef<any>(null);
  
  // Update completion data when response changes (with stability check)
  useEffect(() => {
    if (responseData && JSON.stringify(responseData) !== JSON.stringify(prevResponseDataRef.current)) {
      prevResponseDataRef.current = responseData;
      setCompletionData(responseData);
    }
  }, [responseData]); // Only depend on responseData

  // 无感恢复：组件挂载后从服务端拉取该章节进度并回填到 hook
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasHydratedFromServerRef.current) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    hasHydratedFromServerRef.current = true;

    const fetchAndHydrate = async () => {
      try {
        const qs = new URLSearchParams();
        qs.set('moduleId', moduleId);
        qs.set('chapterId', chapterId);
        if (pathId) qs.set('pathId', pathId);

        const res = await fetch(`/api/learning-progress?${qs.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) return;

        const json = await res.json();
        const record = Array.isArray(json?.progress) ? json.progress[0] : null;
        if (!record) return;

        // 回填 hook 的内部 refs/state（只增不减）
        hydrateFromServer(record);

        // 立刻把 UI 进度条抬起来（否则要等下次保存返回）
        setCompletionData((prev: any) => ({
          ...(typeof prev === 'object' && prev ? prev : {}),
          actualCompletion: typeof record.progress === 'number' ? record.progress : prev?.actualCompletion,
          isCompleted: record.status === 'COMPLETED',
          hydrated: true,
        }));
      } catch {
        // silent: 无感恢复失败不影响学习
      }
    };

    void fetchAndHydrate();
  }, [moduleId, chapterId, pathId, hydrateFromServer]);

  // Format time spent for display
  const formatTimeSpent = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  };

  // Handle manual save/complete
  const handleComplete = async () => {
    try {
      await forceSync();
    } catch (error) {
      console.error('Failed to mark as complete:', error);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Progress Tracking Status Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Completion Progress */}
              <div className="flex items-center gap-2">
                <Progress value={Math.max(0, Math.min(100, completionData?.actualCompletion || progress || 0))} className="w-32 h-2" />
                <span className="text-sm text-muted-foreground">{Math.round(completionData?.actualCompletion || progress || 0)}%</span>
              </div>

              {/* Time Spent */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{formatTimeSpent(totalTimeSpent)}</span>
              </div>

              {/* Completion Requirements Toggle */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowRequirements(!showRequirements)}
                className="gap-1"
              >
                <AlertCircle className="w-4 h-4" />
                学习要求
              </Button>

              {/* Sidebar Toggle */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSidebar(!showSidebar)}
                className="gap-1"
              >
                <StickyNote className="w-4 h-4" />
                笔记收藏
                {showSidebar ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {/* Save Status */}
              <SimpleProgressIndicator
                isSaving={isSaving}
                lastSaved={lastSaved}
                error={error}
              />

              {/* Complete Button */}
              {progress < 100 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleComplete}
                  disabled={isSaving}
                >
                  标记为完成
                </Button>
              )}

              {progress >= 100 && (
                <Badge className="gap-1" variant="default">
                  <CheckCircle className="w-4 h-4" />
                  已完成
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <Progress value={Math.max(0, Math.min(100, completionData?.actualCompletion || progress || 0))} className="h-1 rounded-none" />
      </div>

      {/* Completion Requirements Panel */}
      {showRequirements && (
        <div className="sticky top-[65px] z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <Card className="container mx-auto px-4 py-4 my-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">完成本章节需要：</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Reading Progress */}
                <div className="flex items-center gap-2">
                  <BookOpen className={cn("w-4 h-4", progress >= 90 ? "text-green-500" : "text-muted-foreground")} />
                  <span className="text-sm">阅读进度达到 90%</span>
                  {progress >= 90 && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                </div>

                {/* Minimum Time */}
                <div className="flex items-center gap-2">
                  <Clock className={cn("w-4 h-4", totalTimeSpent >= 300000 ? "text-green-500" : "text-muted-foreground")} />
                  <span className="text-sm">学习时间达到 5 分钟</span>
                  {totalTimeSpent >= 300000 && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                </div>

                {/* Quiz Completion */}
                <div className="flex items-center gap-2">
                  <ClipboardCheck className={cn("w-4 h-4", completionData?.completionCriteria?.quizCompleted ? "text-green-500" : "text-muted-foreground")} />
                  <span className="text-sm">完成章节测验（60分以上）</span>
                  {completionData?.completionCriteria?.quizCompleted && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                  {!completionData?.completionCriteria?.quizCompleted && onQuizClick && (
                    <Button size="sm" variant="link" onClick={onQuizClick} className="ml-auto p-0 h-auto">
                      去测验
                    </Button>
                  )}
                </div>

                {/* Exercises */}
                {totalExercises > 0 && (
                  <div className="flex items-center gap-2">
                    <PenTool className={cn("w-4 h-4", (completionData?.completionCriteria?.exercisesCompleted || 0) >= totalExercises * 0.8 ? "text-green-500" : "text-muted-foreground")} />
                    <span className="text-sm">完成 80% 的练习题</span>
                    {(completionData?.completionCriteria?.exercisesCompleted || 0) >= totalExercises * 0.8 && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                    {(completionData?.completionCriteria?.exercisesCompleted || 0) < totalExercises * 0.8 && onExerciseClick && (
                      <Button size="sm" variant="link" onClick={onExerciseClick} className="ml-auto p-0 h-auto">
                        去练习
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Missing Requirements */}
              {completionData?.completionCriteria && !completionData?.isCompleted && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    {getMissingRequirements(completionData.completionCriteria).join('，')}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="relative flex gap-8">
          {/* Main Content Area */}
          <div className={cn(
            "flex-1 transition-all duration-300 ease-in-out",
            showSidebar ? "lg:pr-8" : "pr-0"
          )}>
            {children}
          </div>
          
          {/* Collapsible Side Panel for Notes */}
          <div className={cn(
            "fixed right-0 top-20 h-[calc(100vh-5rem)] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-l shadow-lg transition-all duration-300 ease-in-out z-20",
            showSidebar ? "translate-x-0 w-80" : "translate-x-full w-0"
          )}>
            <div className={cn(
              "h-full overflow-y-auto p-6 transition-opacity duration-300",
              showSidebar ? "opacity-100" : "opacity-0"
            )}>
              {showSidebar && (
                <NoteTaking
                  moduleId={moduleId}
                  chapterId={chapterId}
                  onNotesUpdate={(hasNotes) => {
                    setHasNotes(hasNotes);
                    // Remove automatic sync on notes update to prevent excessive requests
                    // The useTrackProgress hook will handle auto-save automatically
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Example usage in a learning page:
/*
import { LearningModuleWithProgress } from '@/components/LearningModuleWithProgress';

export default function LearningPage() {
  return (
    <LearningModuleWithProgress
      moduleId="module-1"
      chapterId="chapter-1"
      pathId="path-123"
    >
      <article className="prose prose-gray dark:prose-invert max-w-none">
        <h1>Chapter 1: Introduction to Microprocessors</h1>
        <p>Your learning content goes here...</p>
        // ... rest of your content
      </article>
    </LearningModuleWithProgress>
  );
}
*/
