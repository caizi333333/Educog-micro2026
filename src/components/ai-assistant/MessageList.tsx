import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bot, Loader2, BookOpen, MonitorPlay } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { studentData } from '@/lib/mock-data';
import type { Message } from '@/hooks/useAiAssistant';

// 去除Markdown格式的函数
const removeMarkdownFormat = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // 去除粗体 **text**
    .replace(/\*(.*?)\*/g, '$1')     // 去除斜体 *text*
    .replace(/__(.*?)__/g, '$1')    // 去除粗体 __text__
    .replace(/_(.*?)_/g, '$1')      // 去除斜体 _text_
    .replace(/`(.*?)`/g, '$1')      // 去除行内代码 `code`
    .replace(/#{1,6}\s+/g, '')      // 去除标题 # ## ### 等
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 去除链接格式 [text](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // 去除图片格式 ![alt](url)
    .replace(/```[\s\S]*?```/g, '')  // 去除代码块
    .replace(/^\s*[-*+]\s+/gm, '')  // 去除列表标记
    .replace(/^\s*\d+\.\s+/gm, '') // 去除有序列表标记
    .replace(/^\s*>\s+/gm, '')      // 去除引用标记
    .replace(/\n{3,}/g, '\n\n')     // 减少多余的换行
    .trim();
};

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  scrollAreaRef
}) => {
  return (
    <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
      <div className="space-y-6">
        {messages.map((message, index) => (
          <div key={index} className={cn("flex items-start gap-4", message.role === 'user' && "justify-end")}>
            {message.role === 'model' && (
              <Avatar className="h-9 w-9 border-2 border-primary/50">
                <AvatarFallback><Bot /></AvatarFallback>
              </Avatar>
            )}
            <div className={cn("max-w-2xl p-4 rounded-xl", message.role === 'user' ? "bg-blue-100 text-blue-900 border border-blue-200" : "bg-gray-50 text-gray-900 border border-gray-200")}>
              <p className="whitespace-pre-wrap">
                {message.role === 'model' ? removeMarkdownFormat(message.content) : message.content}
              </p>
              
              {message.chapters && message.chapters.length > 0 && (
                <div className="mt-4 space-y-2 pt-4 border-t border-dashed">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4"/>推荐阅读
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {message.chapters.map(ch => (
                      <Button key={ch.chapter} size="sm" variant="outline" asChild>
                        <Link href={`/#item-${ch.chapter}`}>{ch.title}</Link>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {message.videos && message.videos.length > 0 && (
                <div className="mt-4 space-y-2 pt-4 border-t border-dashed">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <MonitorPlay className="w-4 h-4"/>相关视频
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {message.videos.map(vid => (
                      <Button key={vid.title} size="sm" variant="outline" asChild>
                        <a href={vid.embedUrl} target="_blank" rel="noopener noreferrer">{vid.title}</a>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {message.role === 'user' && (
              <Avatar className="h-9 w-9">
                <AvatarImage src={studentData.profile.avatarUrl} data-ai-hint="man portrait"/>
                <AvatarFallback>{studentData.profile.initial}</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-4">
            <Avatar className="h-9 w-9 border-2 border-primary/50">
              <AvatarFallback><Bot /></AvatarFallback>
            </Avatar>
            <div className="max-w-2xl p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin"/>
              <span className="text-sm text-gray-700">AI 助教正在思考中...</span>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};