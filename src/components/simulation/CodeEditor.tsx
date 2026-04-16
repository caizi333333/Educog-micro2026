'use client';

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { validateAssemblyCode, type ValidationResult } from '@/lib/syntax-validator';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import SyntaxHighlighter from './SyntaxHighlighter';

interface CodeEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
  breakpoints: number[];
  onBreakpointToggle: (line: number) => void;
  currentLine: number;
  isRunning: boolean;
  onRun: () => void;
  onStep: () => void;
  onReset: () => void;
  onStop: () => void;
  onSave?: (() => void) | undefined;
  onComplete?: (() => void) | undefined;
  selectedExperiment?: string | null;
  className?: string;
}

const LINE_HEIGHT = 20;

const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onCodeChange,
  breakpoints,
  onBreakpointToggle,
  currentLine,
  isRunning,
  className,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);

  const validation: ValidationResult = useMemo(() => {
    return validateAssemblyCode(code);
  }, [code]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const top = el.scrollTop;
    const left = el.scrollLeft;
    setScrollTop(top);
    setScrollLeft(left);
    if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = top;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = top;
      highlightRef.current.scrollLeft = left;
    }
  }, []);

  const handleCursorChange = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const textBefore = ta.value.substring(0, pos);
    const line = textBefore.split('\n').length;
    const col = pos - textBefore.lastIndexOf('\n');
    setCursorLine(line);
    setCursorCol(col);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab insertion
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      onCodeChange(newCode);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
  }, [code, onCodeChange]);

  const lines = code.split('\n');
  const errorLines = new Set(validation.errors.map(e => e.line));
  const warningLines = new Set(validation.warnings.map(w => w.line));
  const errorCount = validation.errors.length;
  const warnCount = validation.warnings.length;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Editor body */}
      <div className="flex-1 flex min-h-0 bg-[#1e1e2e] relative overflow-hidden">
        {/* Gutter */}
        <div
          ref={lineNumbersRef}
          className="w-[60px] flex-shrink-0 overflow-hidden select-none bg-[#181825] border-r border-[#313244]"
          style={{ lineHeight: `${LINE_HEIGHT}px` }}
        >
          <div className="py-3">
            {lines.map((_, i) => {
              const lineNum = i + 1;
              const hasBP = breakpoints.includes(lineNum);
              const isCurrent = currentLine === lineNum;
              const hasError = errorLines.has(lineNum);
              const hasWarning = warningLines.has(lineNum);

              return (
                <div
                  key={lineNum}
                  className={cn(
                    "h-5 flex items-center justify-end pr-2 cursor-pointer text-[11px] font-mono relative group",
                    isCurrent && "bg-[#45475a]/50",
                    hasBP && "bg-red-500/10",
                  )}
                  onClick={() => onBreakpointToggle(lineNum)}
                >
                  {/* Error/warning indicator in gutter */}
                  {hasError && !hasBP && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-sm bg-red-500/80" />
                  )}
                  {hasWarning && !hasError && !hasBP && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-sm bg-yellow-500/60" />
                  )}

                  {/* Breakpoint dot */}
                  {hasBP && (
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)] group-hover:scale-110 transition-transform" />
                  )}

                  {/* Current line arrow */}
                  {isCurrent && !hasBP && (
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2">
                      <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-transparent border-l-yellow-400 drop-shadow-[0_0_3px_rgba(250,204,21,0.6)]" />
                    </div>
                  )}

                  <span className={cn(
                    "tabular-nums transition-colors",
                    isCurrent
                      ? "text-yellow-400 font-bold"
                      : cursorLine === lineNum
                        ? "text-[#a6adc8]"
                        : "text-[#585b70]"
                  )}>
                    {lineNum}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Code area: highlight overlay + textarea */}
        <div className="flex-1 relative min-w-0 overflow-hidden">
          {/* Current line highlight with left accent */}
          {currentLine > 0 && (
            <div
              className="absolute left-0 right-0 pointer-events-none z-[1]"
              style={{
                top: `${12 + (currentLine - 1) * LINE_HEIGHT - scrollTop}px`,
                height: `${LINE_HEIGHT}px`,
              }}
            >
              <div className="absolute inset-0 bg-[#f9e2af]/8" />
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#f9e2af] shadow-[0_0_8px_rgba(249,226,175,0.4)]" />
            </div>
          )}

          {/* Active cursor line highlight (dim) */}
          {currentLine <= 0 && cursorLine > 0 && (
            <div
              className="absolute left-0 right-0 bg-[#313244]/30 pointer-events-none z-[1]"
              style={{
                top: `${12 + (cursorLine - 1) * LINE_HEIGHT - scrollTop}px`,
                height: `${LINE_HEIGHT}px`,
              }}
            />
          )}

          {/* Error line highlights */}
          {Array.from(errorLines).map(ln => (
            <div
              key={`err-${ln}`}
              className="absolute left-0 right-0 bg-red-500/8 border-l-2 border-red-500/50 pointer-events-none z-[1]"
              style={{
                top: `${12 + (ln - 1) * LINE_HEIGHT - scrollTop}px`,
                height: `${LINE_HEIGHT}px`,
              }}
            />
          ))}

          {/* Syntax highlighting overlay (read-only, behind textarea) */}
          <div
            ref={highlightRef}
            className="absolute inset-0 overflow-hidden pointer-events-none z-[2]"
            aria-hidden="true"
          >
            <SyntaxHighlighter
              code={code}
              className="px-4 py-3"
              style={{
                transform: `translate(${-scrollLeft}px, ${-scrollTop}px)`,
              }}
            />
          </div>

          {/* Transparent textarea (captures input) */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            onScroll={handleScroll}
            onClick={handleCursorChange}
            onKeyUp={handleCursorChange}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 w-full h-full px-4 py-3 font-mono text-[13px] bg-transparent border-0 resize-none focus:outline-none focus:ring-0 caret-[#89b4fa] selection:bg-[#585b70]/60 z-[3]"
            style={{
              color: 'transparent',
              caretColor: '#89b4fa',
              lineHeight: `${LINE_HEIGHT}px`,
              tabSize: 4,
              WebkitTextFillColor: 'transparent',
            }}
            placeholder="在此输入 8051 汇编代码..."
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#181825] border-t border-[#313244] text-[11px] flex-shrink-0">
        <div className="flex items-center gap-3">
          {errorCount > 0 ? (
            <div className="flex items-center gap-1 text-red-400">
              <AlertCircle className="w-3 h-3" />
              <span>{errorCount} 错误</span>
            </div>
          ) : warnCount > 0 ? (
            <div className="flex items-center gap-1 text-yellow-400">
              <AlertTriangle className="w-3 h-3" />
              <span>{warnCount} 警告</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>语法正确</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-[#6c7086]">
          <span>行 {cursorLine}, 列 {cursorCol}</span>
          <span className="text-[#45475a]">|</span>
          <span>{lines.length} 行</span>
          <span className="text-[#45475a]">|</span>
          <span>8051 ASM</span>
          <span className="text-[#45475a]">|</span>
          <span>UTF-8</span>
        </div>
      </div>

      {/* Validation errors panel */}
      {errorCount + warnCount > 0 && (
        <div className="max-h-28 overflow-auto bg-[#1e1e2e] border-t border-[#313244] flex-shrink-0">
          <div className="px-3 py-1.5 space-y-0.5">
            {validation.errors.map((err, i) => (
              <div key={`e${i}`} className="flex items-start gap-2 text-[11px] py-0.5 hover:bg-[#313244]/30 px-1 rounded cursor-pointer transition-colors">
                <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-red-300">
                  <span className="text-red-400/70 font-mono">[{err.line}:{err.column}]</span> {err.message}
                </span>
              </div>
            ))}
            {validation.warnings.map((warn, i) => (
              <div key={`w${i}`} className="flex items-start gap-2 text-[11px] py-0.5 hover:bg-[#313244]/30 px-1 rounded cursor-pointer transition-colors">
                <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                <span className="text-yellow-300">
                  <span className="text-yellow-400/70 font-mono">[{warn.line}:{warn.column}]</span> {warn.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
