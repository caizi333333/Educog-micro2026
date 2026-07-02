'use client';

import React, { useState, useMemo, useCallback, memo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bug, Brain } from 'lucide-react';
import ErrorDiagnostic from '@/components/ai-assistant/ErrorDiagnostic';
import IntelligentQA from '@/components/ai-assistant/IntelligentQA';

// AI助教只保留"智能问答 + 错误诊断"两个真实功能：
// 辅助答疑与诊断，设边界、不代替学生写代码/作答。
const AIAssistant: React.FC = memo(() => {
  const [activeTab, setActiveTab] = useState('qa');

  // 缓存标签页配置
  const tabsConfig = useMemo(() => [
    { value: 'qa', icon: Brain, label: '智能问答' },
    { value: 'debug', icon: Bug, label: '错误诊断' }
  ], []);

  // 缓存标签页切换处理函数
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 标题区域 */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Brain className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            AI智能助手
          </h1>
        </div>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          基于课程知识库的AI辅助答疑与汇编错误诊断，帮助你理解问题，不代替你完成作答
        </p>
      </div>

      {/* 功能选项卡 */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          {tabsConfig.map(({ value, icon: Icon, label }) => (
            <TabsTrigger key={value} value={value} className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 智能问答 */}
        <TabsContent value="qa">
          <IntelligentQA />
        </TabsContent>

        {/* 错误诊断 */}
        <TabsContent value="debug">
          <ErrorDiagnostic />
        </TabsContent>
      </Tabs>
    </div>
  );
});

AIAssistant.displayName = 'AIAssistant';

export default AIAssistant;
