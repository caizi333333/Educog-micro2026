import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { aiStudyAssistant, type AiStudyAssistantInput, type AiStudyAssistantOutput } from '@/ai/flows/ai-study-assistant';
import { studentData } from '@/lib/mock-data';

export type Message = {
  role: 'user' | 'model';
  content: string;
  chapters?: AiStudyAssistantOutput['relevantChapters'];
  videos?: AiStudyAssistantOutput['relevantVideos'];
};

const initialMessages: Message[] = [
  {
    role: 'model',
    content: `你好，${studentData.profile.name}同学！我是你的AI学习伙伴"芯智育才"。关于8051微控制器，有什么可以帮你的吗？你可以问我关于课程概念、代码示例或学习建议的问题。`,
  }
];

export const useAiAssistant = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const historyForApi = messages.map(m => ({ role: m.role, content: [{text: m.content}] }));
      const assistantInput: AiStudyAssistantInput = { question: input, history: historyForApi };
      
      const result = await aiStudyAssistant(assistantInput);
      
      // 添加安全检查
      if (!result || !result.answer) {
        throw new Error('Invalid response from AI assistant');
      }
      
      const modelMessage: Message = {
        role: 'model',
        content: result.answer,
        chapters: result.relevantChapters,
        videos: result.relevantVideos,
      };
      setMessages((prev) => [...prev, modelMessage]);

    } catch (error) {
      console.error("Error calling AI assistant:", error);
      toast({
        variant: "destructive",
        title: "请求失败",
        description: "抱歉，与AI助教通信时发生错误，请稍后再试。",
      });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    scrollAreaRef,
    handleSubmit,
    handleKeyDown
  };
};