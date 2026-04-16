'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StickyNote, Bookmark, Save, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Note {
  id: string;
  text: string;
  timestamp: Date;
  position?: { x: number; y: number };
}

interface NoteTakingProps {
  moduleId: string;
  chapterId: string;
  onNotesUpdate?: (hasNotes: boolean) => void;
  className?: string;
}

export function NoteTaking({ moduleId, chapterId, onNotesUpdate, className }: NoteTakingProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const { toast } = useToast();

  // Load notes and bookmarks from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storageKey = `notes-${moduleId}-${chapterId}`;
    const bookmarkKey = `bookmarks-${moduleId}-${chapterId}`;
    
    const savedNotes = localStorage.getItem(storageKey);
    const savedBookmarks = localStorage.getItem(bookmarkKey);
    
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
    }
    
    if (savedBookmarks) {
      setBookmarks(JSON.parse(savedBookmarks));
    }
  }, [moduleId, chapterId]);

  // Save notes to localStorage and notify parent
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storageKey = `notes-${moduleId}-${chapterId}`;
    localStorage.setItem(storageKey, JSON.stringify(notes));
    
    if (onNotesUpdate) {
      onNotesUpdate(notes.length > 0 || bookmarks.length > 0);
    }
  }, [notes, bookmarks, moduleId, chapterId, onNotesUpdate]);

  // Save bookmarks to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const bookmarkKey = `bookmarks-${moduleId}-${chapterId}`;
    localStorage.setItem(bookmarkKey, JSON.stringify(bookmarks));
  }, [bookmarks, moduleId, chapterId]);

  const addNote = () => {
    if (!newNoteText.trim()) return;

    const newNote: Note = {
      id: Date.now().toString(),
      text: newNoteText,
      timestamp: new Date(),
    };

    setNotes([...notes, newNote]);
    setNewNoteText('');
    setIsAddingNote(false);

    toast({
      title: '笔记已添加',
      description: '您的学习笔记已保存',
    });
  };

  const editNote = (id: string) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      setEditingNoteId(id);
      setEditingNoteText(note.text);
    }
  };

  const saveEditedNote = () => {
    if (!editingNoteText.trim()) return;

    setNotes(notes.map(note => 
      note.id === editingNoteId 
        ? { ...note, text: editingNoteText, timestamp: new Date() }
        : note
    ));

    setEditingNoteId(null);
    setEditingNoteText('');

    toast({
      title: '笔记已更新',
      description: '您的学习笔记已更新',
    });
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(note => note.id !== id));
    
    toast({
      title: '笔记已删除',
      description: '您的学习笔记已删除',
    });
  };

  const toggleBookmark = () => {
    const currentSection = `${moduleId}-${chapterId}`;
    
    if (bookmarks.includes(currentSection)) {
      setBookmarks(bookmarks.filter(b => b !== currentSection));
      toast({
        title: '书签已移除',
        description: '已从书签中移除此章节',
      });
    } else {
      setBookmarks([...bookmarks, currentSection]);
      toast({
        title: '书签已添加',
        description: '已将此章节添加到书签',
      });
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isBookmarked = bookmarks.includes(`${moduleId}-${chapterId}`);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddingNote(true)}
          className="gap-2"
        >
          <StickyNote className="w-4 h-4" />
          添加笔记
        </Button>
        
        <Button
          variant={isBookmarked ? "default" : "outline"}
          size="sm"
          onClick={toggleBookmark}
          className="gap-2"
        >
          <Bookmark className={cn("w-4 h-4", isBookmarked && "fill-current")} />
          {isBookmarked ? '已收藏' : '收藏章节'}
        </Button>
      </div>

      {/* Add Note Form */}
      {isAddingNote && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">添加学习笔记</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="记录您的学习心得和重点..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={addNote} disabled={!newNoteText.trim()}>
                <Save className="w-4 h-4 mr-1" />
                保存
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setIsAddingNote(false);
                  setNewNoteText('');
                }}
              >
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      {notes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">我的笔记 ({notes.length})</span>
          </div>
          
          {notes.map((note) => (
            <Card key={note.id} className="p-3">
              {editingNoteId === note.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editingNoteText}
                    onChange={(e) => setEditingNoteText(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEditedNote}>
                      <Save className="w-4 h-4 mr-1" />
                      保存
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setEditingNoteId(null);
                        setEditingNoteText('');
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(note.timestamp)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => editNote(note.id)}
                        className="h-7 px-2"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteNote(note.id)}
                        className="h-7 px-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Status Badge */}
      {(notes.length > 0 || isBookmarked) && (
        <div className="flex gap-2">
          {notes.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {notes.length} 条笔记
            </Badge>
          )}
          {isBookmarked && (
            <Badge variant="secondary" className="text-xs">
              已收藏
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}