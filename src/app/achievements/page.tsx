'use client';

import dynamic from 'next/dynamic';

// Dynamically import the enhanced achievements page to avoid SSR issues
const AchievementsV2Page = dynamic(
  () => import('./achievements-v2'),
  { 
    ssr: false,
    loading: () => (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">加载成就系统...</p>
          </div>
        </div>
      </div>
    )
  }
);

export default function AchievementsPage() {
  return <AchievementsV2Page />;
}