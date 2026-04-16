'use client';

import React, { useState, useRef, memo, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Code, Bug, BookOpen, Brain } from 'lucide-react';
import { MessageList } from '@/components/ai-assistant/MessageList';
import { MessageInput } from '@/components/ai-assistant/MessageInput';
import CodeGenerator from '@/components/ai-assistant/CodeGenerator';
import ErrorDiagnostic from '@/components/ai-assistant/ErrorDiagnostic';
import LearningPathRecommendation from '@/components/ai-assistant/LearningPathRecommendation';
import IntelligentQA from '@/components/ai-assistant/IntelligentQA';
import { useAiAssistant } from '@/hooks/useAiAssistant';

const AIAssistant: React.FC = memo(() => {
  const [activeTab, setActiveTab] = useState('chat');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    input,
    setInput,
    isLoading,
    handleSubmit,
    handleKeyDown
  } = useAiAssistant();

  // 缓存标签页配置
  const tabsConfig = useMemo(() => [
    { value: 'chat', icon: MessageSquare, label: '智能问答' },
    { value: 'code', icon: Code, label: '代码生成' },
    { value: 'debug', icon: Bug, label: '错误诊断' },
    { value: 'learning', icon: BookOpen, label: '学习路径' },
    { value: 'qa', icon: Brain, label: '智能问答' }
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
          您的专属AI学习伙伴，提供智能问答、代码生成、错误诊断和学习路径推荐
        </p>
      </div>

      {/* 功能选项卡 */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {tabsConfig.map(({ value, icon: Icon, label }) => (
            <TabsTrigger key={value} value={value} className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 智能聊天 */}
        <TabsContent value="chat" className="space-y-4">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                AI智能对话
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 mb-4">
                <MessageList messages={messages} isLoading={isLoading} scrollAreaRef={scrollAreaRef} />
              </div>
              <MessageInput
                input={input}
                setInput={setInput}
                isLoading={isLoading}
                onSubmit={handleSubmit}
                onKeyDown={handleKeyDown}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 代码生成 */}
        <TabsContent value="code">
          <CodeGenerator />
        </TabsContent>

        {/* 错误诊断 */}
        <TabsContent value="debug">
          <ErrorDiagnostic />
        </TabsContent>

        {/* 学习路径推荐 */}
        <TabsContent value="learning">
          <LearningPathRecommendation />
        </TabsContent>

        {/* 智能问答 */}
        <TabsContent value="qa">
          <IntelligentQA />
        </TabsContent>
      </Tabs>
    </div>
  );
});

AIAssistant.displayName = 'AIAssistant';

export default AIAssistant;