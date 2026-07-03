'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  CheckCircle,
  Info,
  Bug,
  Wrench,
  Sparkles,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface DiagnosticResult {
  id: string;
  severity: 'error' | 'warning' | 'info';
  line: number; // 1-based；0 表示整体性提示
  message: string;
  description: string;
  suggestion?: string;
}

// ---------- 8051 汇编静态检查（与 src/lib/simulator.ts 的解析规则对齐） ----------

// 指令助记符 → 操作数个数（与仿真器支持的指令集一致）
const MNEMONIC_OPERANDS: Record<string, number> = {
  NOP: 0, RET: 0, RETI: 0,
  AJMP: 1, LJMP: 1, SJMP: 1, JMP: 1,
  ACALL: 1, LCALL: 1,
  JZ: 1, JNZ: 1, JC: 1, JNC: 1,
  JB: 2, JNB: 2, JBC: 2,
  DJNZ: 2, CJNE: 3,
  MOV: 2, MOVC: 2, MOVX: 2,
  PUSH: 1, POP: 1,
  XCH: 2, XCHD: 2, SWAP: 1,
  ADD: 2, ADDC: 2, SUBB: 2,
  INC: 1, DEC: 1, MUL: 1, DIV: 1, DA: 1,
  ANL: 2, ORL: 2, XRL: 2,
  CLR: 1, CPL: 1,
  RL: 1, RLC: 1, RR: 1, RRC: 1,
  SETB: 1,
};

// 跳转/调用类指令中"标号"所在的操作数下标
const LABEL_OPERAND_INDEX: Record<string, number> = {
  AJMP: 0, LJMP: 0, SJMP: 0, JMP: 0, ACALL: 0, LCALL: 0,
  JZ: 0, JNZ: 0, JC: 0, JNC: 0,
  JB: 1, JNB: 1, JBC: 1,
  DJNZ: 1, CJNE: 2,
};

// 已知寄存器/SFR/位名，作为标号引用时排除
const KNOWN_NAMES = new Set([
  'A', 'AB', 'B', 'C', 'DPTR', 'PC', 'ACC', 'PSW', 'SP', 'DPL', 'DPH',
  'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
  'P0', 'P1', 'P2', 'P3', 'PCON', 'TCON', 'TMOD', 'TL0', 'TL1', 'TH0', 'TH1',
  'SCON', 'SBUF', 'IE', 'IP', 'T2CON', 'RCAP2L', 'RCAP2H', 'TL2', 'TH2',
  'CY', 'AC', 'F0', 'RS1', 'RS0', 'OV', 'P',
  'TI', 'RI', 'TR0', 'TR1', 'TF0', 'TF1',
  'EA', 'ET0', 'ET1', 'EX0', 'EX1', 'ES', 'IT0', 'IE0', 'IT1', 'IE1',
]);

function isNumberLiteral(s: string): boolean {
  const u = s.toUpperCase();
  return /^[0-9][0-9A-F]*H$/.test(u) // 30H / 0FDH
    || /^[01]+B$/.test(u)            // 01010101B
    || /^0X[0-9A-F]+$/.test(u)       // 0x30
    || /^[0-9]+$/.test(u)            // 十进制
    || /^'.'$/.test(s);              // 字符字面量
}

// 判断操作数是否为"标号引用"：普通标识符，且不是寄存器/SFR/数字/间接寻址
function isLabelReference(op: string): boolean {
  const u = op.toUpperCase();
  if (!/^[A-Z_]\w*$/.test(u)) return false;
  if (KNOWN_NAMES.has(u)) return false;
  return !isNumberLiteral(u);
}

// 疑似 C 代码特征
function looksLikeCCode(code: string): boolean {
  return /#include|void\s+main|sbit\s+\w+|unsigned\s+(char|int)|while\s*\(|for\s*\([^)]*;|printf\s*\(|\w+\s*\([^)]*\)\s*\{/.test(code)
    || (code.includes('{') && code.includes('}'));
}

// 对输入逐行做真实的静态检查，返回带真实行号的诊断结果
function runStaticCheck(code: string): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  const lines = code.split('\n');
  const labels = new Set<string>();
  const symbols = new Set<string>();
  // 待复核的标号引用：[行号, 标号]
  const labelRefs: Array<[number, string]> = [];
  let instructionCount = 0;
  let hasEnd = false;
  let id = 0;
  const push = (r: Omit<DiagnosticResult, 'id'>) => results.push({ id: String(++id), ...r });

  // 第一遍：收集标号与符号定义
  lines.forEach((raw, i) => {
    const cleaned = raw.replace(/;.*$/, '').trim();
    if (!cleaned) return;
    const symMatch = cleaned.match(/^([A-Z_]\w*)\s+(?:EQU|BIT|DATA)\s+(.+)$/i);
    if (symMatch) {
      symbols.add(symMatch[1].toUpperCase());
      return;
    }
    const labelMatch = cleaned.match(/^(\w+):/);
    if (labelMatch) {
      const name = labelMatch[1].toUpperCase();
      if (labels.has(name)) {
        push({
          severity: 'warning',
          line: i + 1,
          message: `标号 ${labelMatch[1]} 重复定义`,
          description: '同名标号出现多次，跳转目标将以最后一次定义为准，容易引起逻辑混乱。',
          suggestion: '为每个标号使用唯一名称。',
        });
      }
      labels.add(name);
    }
  });

  // 第二遍：逐行检查指令
  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const cleaned = raw.replace(/;.*$/, '').trim();
    if (!cleaned) return;
    // 符号定义行
    if (/^[A-Z_]\w*\s+(?:EQU|BIT|DATA)\s+/i.test(cleaned)) return;
    // 纯标号行
    if (/^\w+:$/.test(cleaned)) return;

    const match = cleaned.match(/^(\w+:)?\s*(\w+)\s*(.*)$/);
    if (!match) {
      push({
        severity: 'error',
        line: lineNo,
        message: '无法解析该行',
        description: `"${cleaned}" 不符合 [标号:] 助记符 [操作数] 的汇编格式。`,
        suggestion: '检查是否有多余的符号或拼写错误。',
      });
      return;
    }
    const [, , mnemonicRaw, operandsStr] = match;
    const mnemonic = mnemonicRaw.toUpperCase();
    const operands = operandsStr ? operandsStr.split(',').map(s => s.trim()).filter(Boolean) : [];

    // 汇编伪指令
    if (mnemonic === 'END') { hasEnd = true; instructionCount++; return; }
    if (mnemonic === 'ORG') {
      if (!operands[0] || !isNumberLiteral(operands[0])) {
        push({
          severity: 'error',
          line: lineNo,
          message: 'ORG 伪指令地址无效',
          description: `ORG 需要一个数值地址作为操作数，当前为 "${operandsStr || '(空)'}"。`,
          suggestion: '写成如 ORG 0000H 的形式。',
        });
      }
      return;
    }
    if (mnemonic === 'DB' || mnemonic === 'DW' || mnemonic === 'DS') {
      if (!operandsStr.trim()) {
        push({
          severity: 'error',
          line: lineNo,
          message: `${mnemonic} 伪指令缺少数据`,
          description: `${mnemonic} 后面必须跟至少一个数据项。`,
          suggestion: `例如：TAB: ${mnemonic === 'DB' ? 'DB 3FH,06H,5BH' : mnemonic === 'DW' ? 'DW 1234H' : 'DS 8'}`,
        });
      }
      instructionCount++;
      return;
    }

    // 未知助记符
    if (!(mnemonic in MNEMONIC_OPERANDS)) {
      push({
        severity: 'error',
        line: lineNo,
        message: `未知助记符 "${mnemonicRaw}"`,
        description: '不是 8051 指令集中的助记符，也不是 ORG/DB/DW/DS/EQU/END 等伪指令。',
        suggestion: '检查拼写，例如 MOV / SETB / SJMP / DJNZ。',
      });
      return;
    }
    instructionCount++;

    // 操作数个数检查
    const expected = MNEMONIC_OPERANDS[mnemonic];
    if (operands.length !== expected) {
      const maybeMissingComma = operands.length < expected && /\S\s+\S/.test(operandsStr.trim());
      push({
        severity: 'error',
        line: lineNo,
        message: `${mnemonic} 操作数个数不对（需要 ${expected} 个，实际 ${operands.length} 个）`,
        description: maybeMissingComma
          ? `操作数 "${operandsStr.trim()}" 中可能缺少逗号分隔。`
          : `请核对 ${mnemonic} 指令的标准格式。`,
        suggestion: maybeMissingComma ? '在操作数之间加上英文逗号，例如 MOV A,#30H。' : undefined,
      });
      return;
    }

    // 跳转/调用目标标号登记（第二遍结束后统一复核）
    const labelIdx = LABEL_OPERAND_INDEX[mnemonic];
    if (labelIdx !== undefined && operands[labelIdx]) {
      const target = operands[labelIdx];
      if (isLabelReference(target)) {
        labelRefs.push([lineNo, target]);
      }
    }
  });

  // 标号引用复核
  for (const [lineNo, target] of labelRefs) {
    const u = target.toUpperCase();
    if (!labels.has(u) && !symbols.has(u)) {
      push({
        severity: 'error',
        line: lineNo,
        message: `标号 ${target} 未定义`,
        description: '跳转/调用目标在程序中找不到对应的标号定义。',
        suggestion: `在目标位置添加 "${target}:" 标号，或修正拼写。`,
      });
    }
  }

  // 整体性提示
  if (instructionCount > 0 && !hasEnd) {
    push({
      severity: 'info',
      line: 0,
      message: '程序末尾缺少 END 伪指令',
      description: '规范的 8051 汇编程序应以 END 结束。',
      suggestion: '在最后一行添加 END。',
    });
  }
  if (instructionCount === 0) {
    push({
      severity: 'warning',
      line: 0,
      message: '未识别到任何指令',
      description: '输入内容中没有可识别的 8051 汇编指令。',
      suggestion: '请粘贴 8051 汇编代码，例如 MOV A,#30H。',
    });
  }

  return results;
}

// ---------- 组件 ----------

const ErrorDiagnostic: React.FC = () => {
  const [code, setCode] = useState('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [isCCode, setIsCCode] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // 真实静态检查：本地逐行分析，行号与输入一一对应
  const runDiagnostic = () => {
    if (!code.trim()) {
      toast.error('请输入要诊断的代码');
      return;
    }
    setAiExplanation('');
    if (looksLikeCCode(code)) {
      setIsCCode(true);
      setDiagnostics([]);
      setHasRun(true);
      return;
    }
    setIsCCode(false);
    const results = runStaticCheck(code);
    setDiagnostics(results);
    setHasRun(true);
    toast.success(results.length > 0 ? `检查完成，发现 ${results.length} 个问题` : '检查完成，未发现语法问题');
  };

  // DeepSeek 叠加解释：走既有 /api/ai/chat 通道，失败不影响静态结果
  const explainWithAI = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      toast.error('请先登录后再使用 AI 解释');
      return;
    }
    setAiLoading(true);
    try {
      const issueLines = diagnostics
        .map(d => `- ${d.line > 0 ? `第${d.line}行：` : ''}${d.message}`)
        .join('\n');
      const question = `请针对下面的8051汇编代码和静态检查结果，用中文简要解释每个问题的原因，并给出修改建议（不要代写完整程序）：\n\n代码：\n${code.slice(0, 2000)}\n\n静态检查结果：\n${issueLines || '- 未发现语法问题，请从逻辑角度给出改进建议'}`;
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const answer = json?.data?.answer;
      if (!answer) throw new Error('empty answer');
      setAiExplanation(answer);
    } catch (err) {
      console.warn('AI explanation failed:', err);
      toast.error('AI 解释暂不可用，请稍后重试（静态检查结果不受影响）');
    } finally {
      setAiLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-300" />;
      case 'info': return <Info className="h-4 w-4 text-cyan-300" />;
      default: return <CheckCircle className="h-4 w-4 text-slate-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'bg-red-500/10 text-red-300 border-red-500/30';
      case 'warning': return 'bg-amber-500/10 text-amber-200 border-amber-500/30';
      case 'info': return 'bg-cyan-500/10 text-cyan-200 border-cyan-500/30';
      default: return 'bg-white/[0.04] text-slate-300 border-white/[0.1]';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-50">汇编错误诊断</h1>
        <p className="text-slate-400">对 8051 汇编代码逐行静态检查，可叠加 AI 解释帮助理解错误原因</p>
      </div>

      {/* 代码输入区域 */}
      <Card>
        <CardHeader>
          <CardTitle>代码输入</CardTitle>
          <CardDescription>
            请输入 8051 汇编代码，系统将进行逐行静态检查（未知助记符、缺逗号、标号未定义等）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={`请输入 8051 汇编代码，例如：

ORG 0000H
MAIN:
    MOV A, #0FEH
    MOV P1, A
LOOP:
    RL A
    MOV P1, A
    ACALL DELAY
    SJMP LOOP
DELAY:
    MOV R7, #200
D1: MOV R6, #250
D2: DJNZ R6, D2
    DJNZ R7, D1
    RET
END`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
          />
          <div className="flex gap-4">
            <Button onClick={runDiagnostic} className="flex-1">
              <Bug className="mr-2 h-4 w-4" />
              静态诊断
            </Button>
            {hasRun && !isCCode && (
              <Button
                onClick={explainWithAI}
                disabled={aiLoading}
                variant="outline"
                className="flex-1"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI 分析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI 解释诊断结果
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 结果展示 */}
      {hasRun && (
        isCCode ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              检测到输入可能是 C 语言代码。当前仅支持 8051 汇编静态诊断，C 代码问题建议在"智能问答"中描述具体现象提问。
            </AlertDescription>
          </Alert>
        ) : diagnostics.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">诊断结果</h2>
              <div className="flex gap-2">
                <Badge variant="destructive">
                  {diagnostics.filter(d => d.severity === 'error').length} 错误
                </Badge>
                <Badge variant="secondary">
                  {diagnostics.filter(d => d.severity === 'warning').length} 警告
                </Badge>
                <Badge variant="outline">
                  {diagnostics.filter(d => d.severity === 'info').length} 提示
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              {diagnostics.map((diagnostic) => (
                <Card key={diagnostic.id} className={`border-l-4 ${getSeverityColor(diagnostic.severity)}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(diagnostic.severity)}
                      <CardTitle className="text-lg">
                        {diagnostic.line > 0 ? `第${diagnostic.line}行：` : ''}{diagnostic.message}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-slate-300">{diagnostic.description}</p>
                    {diagnostic.suggestion && (
                      <Alert>
                        <Wrench className="h-4 w-4" />
                        <AlertDescription>
                          <strong>修改建议：</strong>{diagnostic.suggestion}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
              <p className="text-slate-200 font-medium">静态检查未发现语法问题</p>
              <p className="text-slate-500 text-sm mt-2">如运行结果不符合预期，可点击"AI 解释诊断结果"获取逻辑层面的建议</p>
            </CardContent>
          </Card>
        )
      )}

      {/* AI 解释（DeepSeek 叠加，可选） */}
      {aiExplanation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-300" />
              AI 解释
            </CardTitle>
            <CardDescription>由 DeepSeek 结合课程知识库生成，仅供理解参考</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">
              {aiExplanation}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ErrorDiagnostic;
