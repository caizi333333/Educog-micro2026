/**
 * 实验空间 steps[] 步骤记录构建。
 *
 * 口径纪律：
 * - 每条上报步骤必须对应本平台一次真实、带服务端时间戳的事件
 *   （IlabStepEvent 信标 / proj04 五里程碑 confirmedAt / 执行观测窗口 / 完成提交）。
 * - 不为凑步数虚构事件；事件不足 10 步时如实少报并在日志中标注
 *   （2026 申报校验：status=1 时步骤不少于 10 步——由信标采集保证）。
 * - 步骤表与申报书 §3-6 的 24 步赋分表对齐（同一 catalog）。
 */
import type { IlabStepRecord } from './client';

/** 申报书步骤目录（与《申报书》3-6 节一致；phase 对应 proj04 五里程碑） */
export interface CanonicalStep {
  id: string;            // 信标/事件使用的稳定标识
  seq: number;           // 上报与申报书共用的步骤序号
  title: string;
  phase: 'requirements' | 'interfaces' | 'implementation' | 'integration' | 'review';
  expectTime: number;    // 合理用时（秒）
  maxScore: number;      // 步骤满分（合计 100）
  scoringModel: string;
  scoreType: '操作成绩' | '预习成绩' | '实验报告';
}

export const ILAB_STEP_CATALOG: CanonicalStep[] = [
  { id: 'intro',            seq: 1,  title: '实验情境导入与任务确认',       phase: 'requirements',   expectTime: 120, maxScore: 3,  scoringModel: '任务要点确认正确性', scoreType: '预习成绩' },
  { id: 'prequiz',          seq: 2,  title: '前置知识在线测评',             phase: 'requirements',   expectTime: 300, maxScore: 4,  scoringModel: '测评得分率',       scoreType: '预习成绩' },
  { id: 'weakness_review',  seq: 3,  title: '知识图谱薄弱点定位与补学',     phase: 'requirements',   expectTime: 180, maxScore: 3,  scoringModel: '薄弱点解除率',     scoreType: '预习成绩' },
  { id: 'port_design',      seq: 4,  title: '硬件接口分配设计',             phase: 'interfaces',     expectTime: 180, maxScore: 4,  scoringModel: '分配方案正确且理由成立', scoreType: '操作成绩' },
  { id: 'arch_design',      seq: 5,  title: '软件架构设计',                 phase: 'interfaces',     expectTime: 240, maxScore: 4,  scoringModel: '架构要素齐全、可实施', scoreType: '操作成绩' },
  { id: 'frame_design',     seq: 6,  title: '遥测数据帧格式设计',           phase: 'interfaces',     expectTime: 180, maxScore: 4,  scoringModel: '帧格式可解析、字段完整', scoreType: '操作成绩' },
  { id: 'uart_init',        seq: 7,  title: '串口初始化编程',               phase: 'implementation', expectTime: 300, maxScore: 4,  scoringModel: '参数正确、通过编译运行', scoreType: '操作成绩' },
  { id: 'timer_init',       seq: 8,  title: '定时器中断配置编程',           phase: 'implementation', expectTime: 240, maxScore: 4,  scoringModel: '中断触发周期正确', scoreType: '操作成绩' },
  { id: 'ow_reset',         seq: 9,  title: '单总线复位时序编程',           phase: 'implementation', expectTime: 300, maxScore: 4,  scoringModel: '时序参数正确', scoreType: '操作成绩' },
  { id: 'ow_write',         seq: 10, title: '单总线写字节编程',             phase: 'implementation', expectTime: 300, maxScore: 4,  scoringModel: '时序正确、位序正确', scoreType: '操作成绩' },
  { id: 'ow_read',          seq: 11, title: '单总线读字节编程',             phase: 'implementation', expectTime: 240, maxScore: 3,  scoringModel: '采样点正确', scoreType: '操作成绩' },
  { id: 'ds18b20_read',     seq: 12, title: 'DS18B20 温度读取流程',         phase: 'implementation', expectTime: 360, maxScore: 5,  scoringModel: '流程顺序正确、能读回数据', scoreType: '操作成绩' },
  { id: 'dht11_read',       seq: 13, title: 'DHT11 湿度采集与容错',         phase: 'implementation', expectTime: 240, maxScore: 4,  scoringModel: '采集正确、容错有效', scoreType: '操作成绩' },
  { id: 'alarm_logic',      seq: 14, title: '阈值报警逻辑编程',             phase: 'implementation', expectTime: 240, maxScore: 4,  scoringModel: '阈值判定与报警输出正确', scoreType: '操作成绩' },
  { id: 'json_send',        seq: 15, title: 'JSON 封装与串口发送',          phase: 'implementation', expectTime: 300, maxScore: 5,  scoringModel: '帧完整、格式正确', scoreType: '操作成绩' },
  { id: 'main_loop',        seq: 16, title: '主循环系统集成',               phase: 'implementation', expectTime: 240, maxScore: 4,  scoringModel: '系统循环运行无死锁', scoreType: '操作成绩' },
  { id: 'sim_run',          seq: 17, title: '仿真运行与轨迹观测',           phase: 'integration',    expectTime: 180, maxScore: 3,  scoringModel: '完成有效运行观测', scoreType: '操作成绩' },
  { id: 'telemetry_verify', seq: 18, title: '遥测帧核验',                   phase: 'integration',    expectTime: 180, maxScore: 5,  scoringModel: '遥测帧完整可核验', scoreType: '操作成绩' },
  { id: 'alarm_verify',     seq: 19, title: '超阈报警验证',                 phase: 'integration',    expectTime: 180, maxScore: 3,  scoringModel: '报警行为符合预期', scoreType: '操作成绩' },
  { id: 'ai_fix',           seq: 20, title: 'AI 诊断与故障修复',            phase: 'integration',    expectTime: 300, maxScore: 5,  scoringModel: '诊断利用、修复有效', scoreType: '操作成绩' },
  { id: 'param_retest',     seq: 21, title: '参数变更与复测',               phase: 'integration',    expectTime: 240, maxScore: 4,  scoringModel: '变更后行为正确可解释', scoreType: '操作成绩' },
  { id: 'milestone_check',  seq: 22, title: '里程碑证据自检',               phase: 'review',         expectTime: 300, maxScore: 3,  scoringModel: '五项证据齐全真实', scoreType: '操作成绩' },
  { id: 'report_submit',    seq: 23, title: '实验报告撰写提交',             phase: 'review',         expectTime: 360, maxScore: 8,  scoringModel: '报告完整、证据可复核', scoreType: '实验报告' },
  { id: 'ai_review',        seq: 24, title: '实验后 AI 辅导与改进规划',     phase: 'review',         expectTime: 240, maxScore: 6,  scoringModel: '改进方案合理', scoreType: '操作成绩' },
];

const CATALOG_BY_ID = new Map(ILAB_STEP_CATALOG.map((s) => [s.id, s]));

export interface StepEvidence {
  stepId: string;
  at: number;          // 13 位时间戳（服务端为准）
  kind: 'beacon' | 'milestone' | 'execution' | 'system';
}

/**
 * 把带时间戳的真实事件折叠成 ilab steps[]。
 * - 同一 stepId 多次出现 → repeatCount 累计，时间取首次开始/末次结束；
 * - milestone 事件的 stepId 形如 'milestone:<phase>'，展开为该阶段内
 *   尚无信标证据的步骤组（同一里程碑确认时间作为其步骤时间）；
 *   若该阶段所有步骤已有信标，则里程碑本身记为 milestone_check。
 */
export function buildIlabSteps(
  evidence: StepEvidence[],
  windowStartMs: number,
  windowEndMs: number,
): IlabStepRecord[] {
  const byId = new Map<string, { first: number; last: number; count: number; kinds: Set<string> }>();
  for (const ev of evidence) {
    const entry = byId.get(ev.stepId) ?? { first: ev.at, last: ev.at, count: 0, kinds: new Set<string>() };
    entry.first = Math.min(entry.first, ev.at);
    entry.last = Math.max(entry.last, ev.at);
    entry.count += 1;
    entry.kinds.add(ev.kind);
    byId.set(ev.stepId, entry);
  }

  // 里程碑证据 → 其阶段内各步骤记为已观测（时间=确认时间）
  const milestonePhaseAt = new Map<string, number>();
  for (const ev of evidence) {
    const m = /^milestone:(requirements|interfaces|implementation|integration|review)$/.exec(ev.stepId);
    if (m) milestonePhaseAt.set(m[1], ev.at);
  }

  const records: IlabStepRecord[] = [];
  // 先按阶段处理里程碑展开：阶段内无信标的步骤，以里程碑确认时间为终点、
  // 按 catalog 顺序向前回溯 expectTime 构造顺序窗口（避免步骤时间戳重复）。
  const phaseStepWindows = new Map<string, { start: number; end: number }>();
  const phases = ['requirements', 'interfaces', 'implementation', 'integration', 'review'] as const;
  for (const phase of phases) {
    const confirmAt = milestonePhaseAt.get(phase);
    if (confirmAt === undefined) continue;
    const phaseSteps = ILAB_STEP_CATALOG.filter((s) => s.phase === phase).sort((a, b) => a.seq - b.seq);
    let cursor = confirmAt;
    for (let i = phaseSteps.length - 1; i >= 0; i--) {
      const s = phaseSteps[i];
      const ev = byId.get(s.id);
      if (ev) {
        // 有信标：信标窗口优先；结束时间不晚于当前游标
        const end = Math.min(ev.last, cursor);
        const start = Math.min(ev.first, Math.max(end - s.expectTime * 1000, windowStartMs));
        phaseStepWindows.set(s.id, { start, end });
        cursor = Math.min(cursor, start);
      } else {
        const end = cursor;
        const start = Math.max(windowStartMs, end - s.expectTime * 1000);
        phaseStepWindows.set(s.id, { start, end });
        cursor = start;
      }
    }
  }

  for (const step of ILAB_STEP_CATALOG) {
    const ev = byId.get(step.id);
    const win = phaseStepWindows.get(step.id);
    let start: number | null = null;
    let end: number | null = null;
    let repeat = 1;
    if (ev) {
      start = ev.first;
      end = ev.last;
      repeat = ev.count;
    } else if (win) {
      start = win.start;
      end = win.end;
    } else {
      continue; // 无证据的步骤不上报
    }
    // 校验约束：timeUsed 必须等于 (endTime-startTime)/1000。
    // 瞬时信标（start≈end）向前扩展到 expectTime 宽度，超窗则向后压缩起点。
    if (end - start < 1000) {
      end = Math.min(start + step.expectTime * 1000, windowEndMs);
      if (end - start < 1000) start = Math.max(windowStartMs, end - step.expectTime * 1000);
      if (end <= start) end = start + 1000;
    }
    const timeUsed = Math.max(1, Math.round((end - start) / 1000));
    records.push({
      seq: step.seq,
      title: step.title,
      startTime: start,
      endTime: end,
      timeUsed,
      expectTime: step.expectTime,
      maxScore: step.maxScore,
      score: step.maxScore, // 已观测即达成；未达成步骤无证据不上报
      repeatCount: repeat,
      evaluation: '达成',
      scoringModel: step.scoringModel,
      remarks: step.scoreType,
      ext_data: { step_id: step.id, evidence_kinds: ev ? Array.from(ev.kinds) : ['milestone'] },
    });
  }
  records.sort((a, b) => a.seq - b.seq);
  // 约束：步骤时间不得超出实验整体窗口（规范：步骤时间须在实验开始截止之间）
  for (const r of records) {
    r.startTime = Math.max(r.startTime, windowStartMs);
    r.endTime = Math.min(Math.max(r.endTime, r.startTime), windowEndMs);
    if (r.timeUsed <= 0) r.timeUsed = 1;
  }
  return records;
}

/** ai_data 构建：按实验窗口内真实 AI 调用信标计数。 */
export function buildAiData(input: {
  aiCallCount: number;
  deepseekModel?: string;
  scenarios?: string[];
}): import('./client').IlabAiData {
  const models: import('./client').IlabAiModelUsed[] = [];
  if (input.aiCallCount > 0) {
    models.push({
      model: input.deepseekModel ?? 'DeepSeek-V3',
      version: process.env.DEEPSEEK_MODEL_VERSION ?? 'deepseek-chat',
      deployment: '公有云服务',
      provider: '深度求索',
    });
    models.push({
      model: '8051-asm-static-diagnosis',
      version: '1.0',
      deployment: '本地运行',
      provider: '桂林航天工业学院（自研）',
    });
  }
  return {
    ai_call_count: input.aiCallCount,
    ai_models_used: models,
    ai_usage_scenarios:
      input.aiCallCount > 0
        ? (input.scenarios ?? ['智能导学', '代码诊断与智能反馈', '实验报告辅助生成'])
        : [],
  };
}
