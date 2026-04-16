import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface MessageInputProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  input,
  setInput,
  isLoading,
  onSubmit,
  onKeyDown
}) => {
  return (
    <div className="p-6 pt-0 border-t">
      <form onSubmit={onSubmit} className="flex gap-4 items-start">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="输入你的问题..."
          rows={1}
          className="flex-1 resize-none"
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};