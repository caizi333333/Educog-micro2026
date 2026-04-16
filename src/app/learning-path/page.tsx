
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { LearningPathClient } from './learning-path-client';

// This is a Server Component that now reads searchParams and passes them to the client.
export default async function LearningPathPage({ searchParams }: { searchParams: Promise<{ weakKAs?: string }> }) {
    const resolvedSearchParams = await searchParams;
    const weakKAsParam = resolvedSearchParams.weakKAs;

    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-[calc(100vh-theme(spacing.28))]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">正在加载学习计划...</p>
            </div>
        }>
            <LearningPathClient {...(weakKAsParam ? { weakKAsParam } : {})} />
        </Suspense>
    );
}
