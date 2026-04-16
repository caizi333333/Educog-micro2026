# useTrackProgress Hook Documentation

## Overview

The `useTrackProgress` hook automatically tracks and saves user learning progress, providing seamless integration with the learning management system.

## Features

- **Automatic Progress Tracking**: Tracks reading progress based on scroll position
- **Time Tracking**: Monitors actual reading time with idle detection
- **Auto-Save**: Saves progress at configurable intervals
- **Debouncing**: Prevents excessive API calls
- **Offline Support**: Uses `navigator.sendBeacon` for reliable tracking on page unload
- **Visual Feedback**: Provides save status and progress indicators
- **Error Handling**: Gracefully handles authentication and network errors

## Basic Usage

```typescript
import { useTrackProgress } from '@/hooks/useTrackProgress';

function LearningModule() {
  const {
    isSaving,
    lastSaved,
    totalTimeSpent,
    progress,
    error,
    pauseTracking,
    resumeTracking,
    forceSync,
  } = useTrackProgress({
    moduleId: 'module-1',
    chapterId: 'chapter-1',
    pathId: 'learning-path-123', // optional
    metadata: { /* optional metadata */ },
    autoSaveInterval: 30000, // 30 seconds
    minReadingTime: 5000, // 5 seconds
  });

  return (
    <div>
      <p>Progress: {progress}%</p>
      <p>Time spent: {totalTimeSpent}ms</p>
      {isSaving && <p>Saving...</p>}
    </div>
  );
}
```

## Parameters

### Required
- `moduleId` (string): The ID of the current learning module
- `chapterId` (string): The ID of the current chapter

### Optional
- `pathId` (string): The ID of the learning path
- `metadata` (object): Additional metadata to track
- `autoSaveInterval` (number): Auto-save interval in milliseconds (default: 30000)
- `minReadingTime` (number): Minimum time to consider as reading (default: 5000)

## Return Values

- `isSaving` (boolean): Whether progress is currently being saved
- `lastSaved` (Date | null): Timestamp of last successful save
- `error` (Error | null): Any error that occurred during saving
- `totalTimeSpent` (number): Total time spent on the page in milliseconds
- `pageViews` (number): Number of times the page was viewed
- `isTracking` (boolean): Whether tracking is currently active
- `progress` (number): Reading progress percentage (0-100)
- `pauseTracking` (function): Pause progress tracking
- `resumeTracking` (function): Resume progress tracking
- `forceSync` (function): Force save with 100% completion

## Advanced Example

```typescript
// In a learning page component
export default function LearningPage() {
  const { moduleId, chapterId } = useParams();
  
  const {
    progress,
    totalTimeSpent,
    isSaving,
    error,
    forceSync,
  } = useTrackProgress({
    moduleId,
    chapterId,
    metadata: {
      deviceType: 'desktop',
      browser: navigator.userAgent,
    },
  });

  const handleCompleteChapter = async () => {
    await forceSync(); // Mark as 100% complete
    router.push('/next-chapter');
  };

  if (error?.message === '未登录') {
    return <LoginPrompt />;
  }

  return (
    <article>
      <ProgressBar value={progress} />
      <div>阅读时间: {Math.round(totalTimeSpent / 1000)}秒</div>
      {/* Learning content */}
      <Button onClick={handleCompleteChapter}>
        完成本章
      </Button>
    </article>
  );
}
```

## Implementation Notes

1. **Authentication**: The hook requires a valid JWT token in localStorage
2. **Scroll Tracking**: Progress is calculated based on vertical scroll position
3. **Activity Detection**: Tracks mouse, keyboard, scroll, and touch events
4. **Idle Detection**: Pauses tracking after 2 minutes of inactivity
5. **Tab Visibility**: Saves progress when tab becomes hidden
6. **Unload Handling**: Uses sendBeacon API for reliable tracking on page close

## Best Practices

1. Place the hook at the top level of your learning component
2. Use the `LearningModuleWithProgress` wrapper component for standard implementations
3. Handle authentication errors appropriately
4. Consider showing visual feedback for save status
5. Use `forceSync()` for manual chapter completion
6. Avoid calling the hook conditionally - use `pauseTracking()` instead