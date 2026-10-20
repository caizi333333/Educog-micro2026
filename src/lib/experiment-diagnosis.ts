// AI 实验诊断的纯逻辑部分：快照文本化、实验背景、诊断结果解析。
// 与 API 路由分离以便单测（路由依赖 prisma/auth，纯函数不依赖）。

import { getExperimentConfig } from '@/lib/experiment-config';

export interface DiagnosisSnapshot {
  registers?: Record<string, number | string>;
  portValues?: Record<string, number>;
  pc?: number;
  currentLine?: number;
  currentInstruction?: string;
  uartTail?: string;
  timers?: Record<string, number | boolean>;
  environment?: Record<string, unknown>;
  deviceNotes?: string[];
}

export interface DiagnosisResult {
  observation: string;
  diagnosis: string;
  hints: string[];
  nextCheck: string;
}

export const DIAGNOSIS_SYSTEM_PROMPT = `你是"芯智育才"8051单片机虚拟仿真实验的 AI 诊断助教。学生会把自己实验代码和当前仿真状态快照（寄存器、端口、PC、当前指令、串口收发、定时器、环境模型读数）发给你，请你诊断"他现在卡在哪、为什么"。

教学纪律（必须遵守）：
1. 绝不给出可直接照抄的完整解题代码——只指出问题位置、解释原因、给下一步排查方向；
2. 诊断必须引用快照中的具体证据（如"P3.7 复位后 60μs 内未拉低""SBUF 缓冲区无数据""PC 停在第 N 行"），不许空谈；
3. 提示分 2~3 条，由浅入深：先指出最可能的问题，再给自查手段，最后给一个引导性反问；
4. 若快照显示程序运行正常，如实说明并建议学生去验证哪个环节；
5. 用精炼中文回答。

输出严格 JSON（不要任何额外文字）：
{"observation":"快照中你注意到的客观现象一句话","diagnosis":"最可能的原因判断","hints":["提示1","提示2","引导性反问"],"nextCheck":"建议学生下一步具体观察/验证什么"}`;

export function experimentBrief(experimentId: string): string {
  const cfg = getExperimentConfig(experimentId);
  if (!cfg) return '';
  const lines = [
    `实验：${cfg.title}`,
    `目标：${cfg.objectives.slice(0, 6).join('；')}`,
  ];
  if (experimentId === 'proj04') {
    lines.push(
      'proj04 器件映射：DS18B20 在 P3.7（1-Wire：复位/存在脉冲→0xCC→0x44 转换→0xBE 读暂存器→CRC8）；DHT11 在 P3.4（20ms 起始→80+80μs 应答→40bit 脉宽解码→校验和）；蜂鸣器 P3.5；通风风机 P3.3（扩展，可使环境模型降温形成闭环）。',
      '遥测：UART 周期输出 JSON 帧 {"temp":xx.x,"humi":xx,"alarm":x}。温湿度由大棚环境模型实时演化，可切工况场景。',
      '诚实边界：LCD1602 为空接口、EEPROM 为扩展项——学生若在这两处报错属预期，引导回主线任务。',
    );
  }
  return lines.join('\n');
}

export function snapshotText(snapshot: DiagnosisSnapshot): string {
  const parts: string[] = [];
  if (snapshot.registers) parts.push(`寄存器: ${JSON.stringify(snapshot.registers)}`);
  if (snapshot.portValues) parts.push(`端口: ${JSON.stringify(snapshot.portValues)}`);
  if (snapshot.pc !== undefined) parts.push(`PC: ${snapshot.pc}`);
  if (snapshot.currentLine !== undefined) parts.push(`当前源码行: ${snapshot.currentLine + 1}`);
  if (snapshot.currentInstruction) parts.push(`当前指令: ${snapshot.currentInstruction}`);
  if (snapshot.timers) parts.push(`定时器: ${JSON.stringify(snapshot.timers)}`);
  if (snapshot.uartTail) parts.push(`串口收发尾部: ${snapshot.uartTail.slice(-800)}`);
  if (snapshot.environment) parts.push(`环境模型: ${JSON.stringify(snapshot.environment)}`);
  if (snapshot.deviceNotes?.length) parts.push(`器件侧注记: ${snapshot.deviceNotes.join(' | ')}`);
  return parts.join('\n') || '(无可用快照)';
}

export function parseDiagnosis(raw: string): DiagnosisResult {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(trimmed) as Partial<DiagnosisResult>;
    if (typeof parsed.diagnosis === 'string' && parsed.diagnosis) {
      return {
        observation: typeof parsed.observation === 'string' ? parsed.observation : '',
        diagnosis: parsed.diagnosis,
        hints: Array.isArray(parsed.hints)
          ? parsed.hints.filter((h): h is string => typeof h === 'string').slice(0, 4)
          : [],
        nextCheck: typeof parsed.nextCheck === 'string' ? parsed.nextCheck : '',
      };
    }
  } catch {
    // 模型未按 JSON 输出时把原文当诊断结论兜底
  }
  return { observation: '', diagnosis: trimmed.slice(0, 1500), hints: [], nextCheck: '' };
}
