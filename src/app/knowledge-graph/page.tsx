import { Suspense } from 'react';
import { HyperKnowledgeGraphPage } from '@/components/hyper/HyperKnowledgeGraphPage';

export default function KnowledgeGraphPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">正在加载知识图谱...</div>}>
      <HyperKnowledgeGraphPage />
    </Suspense>
  );
}
