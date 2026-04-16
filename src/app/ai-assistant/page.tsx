'use client';

import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle } from 'lucide-react';
import AIAssistant from '@/components/AIAssistant';

export default function AiAssistantPageWrapper() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            请先登录以使用AI智能助手功能。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <AIAssistant />;
}
