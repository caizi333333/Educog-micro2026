import type { SimEnvironment } from '../sim-devices';

/**
 * 智慧大棚环境模型：为虚拟传感器提供随时间演化的真实温湿度源。
 *
 * 语义（教学模型，时间轴=指令计数≈µs）：
 * - 温度/湿度朝场景目标做一阶趋近（一阶惯性环节），叠加小幅随机扰动；
 * - 场景预设对应真实大棚工况：常态白天、午间高温（触发超阈报警验证）、
 *   夜间低温、通风干燥；
 * - 通风执行器（学生程序驱动 FAN 引脚）使有效目标偏向外界环境——
 *   温度被压回 ≤23.5°C、湿度下降，形成"采集→报警→执行→环境响应"的真实闭环。
 */

export interface GreenhouseState {
  /** 当前环境温湿度（随模型时间演化，UI 与传感器都读它） */
  temperature: number;   // °C
  humidity: number;      // %RH
  scenarioId: string;
  scenario: string;
  /** 通风风机运行中（由学生程序驱动 FAN 引脚置位） */
  fanOn: boolean;
}

export interface GreenhouseScenario {
  id: string;
  label: string;
  temperature: number;
  humidity: number;
}

export const GREENHOUSE_SCENARIOS: GreenhouseScenario[] = [
  { id: 'normal', label: '常态大棚 25°C / 65%', temperature: 25, humidity: 65 },
  { id: 'heat', label: '午间高温 38°C / 45%', temperature: 38, humidity: 45 },
  { id: 'night', label: '夜间低温 15°C / 80%', temperature: 15, humidity: 80 },
  { id: 'vent', label: '通风干燥 22°C / 40%', temperature: 22, humidity: 40 },
];

// 每 2048 条指令更新一次；趋近系数取 0.001 → 时间常数约 2M 条指令（≈2s 模型时间），
// 极速档下能在 1–2 秒内看到漂移，单步/低速档下也能观察到趋势。
const TICK_STRIDE = 2048;
const APPROACH_K = 0.001;
const NOISE_T = 0.06;   // °C
const NOISE_H = 0.15;   // %RH

// 通风开启时的环境钳位（外界环境）
const FAN_TEMP_CAP = 23.5;
const FAN_HUMI_CAP = 42;

export class GreenhouseEnvironment implements SimEnvironment<GreenhouseState> {
  public readonly state: GreenhouseState = {
    temperature: 25.2,
    humidity: 64.5,
    scenarioId: 'normal',
    scenario: '常态大棚 25°C / 65%',
    fanOn: false,
  };

  private targetTemp = 25;
  private targetHumi = 65;
  private lastTick = -1;

  public setScenario(id: string): void {
    const s = GREENHOUSE_SCENARIOS.find((x) => x.id === id);
    if (!s) return;
    this.targetTemp = s.temperature;
    this.targetHumi = s.humidity;
    this.state.scenarioId = s.id;
    this.state.scenario = s.label;
  }

  /** 直接设定目标工况（环境面板滑条） */
  public setTargets(temperature: number, humidity: number): void {
    this.targetTemp = Math.max(-10, Math.min(60, temperature));
    this.targetHumi = Math.max(10, Math.min(95, humidity));
    this.state.scenarioId = 'custom';
    this.state.scenario = '自定义工况';
  }

  /** 学生程序驱动的通风执行器状态（FAN 引脚锁存电平） */
  public setFan(on: boolean): void {
    this.state.fanOn = on;
  }

  public tick(now: number): void {
    if (this.lastTick < 0) { this.lastTick = now; return; }
    if (now - this.lastTick < TICK_STRIDE) return;
    this.lastTick = now;

    const effT = this.state.fanOn ? Math.min(this.targetTemp, FAN_TEMP_CAP) : this.targetTemp;
    const effH = this.state.fanOn ? Math.min(this.targetHumi, FAN_HUMI_CAP) : this.targetHumi;

    this.state.temperature = round1(
      this.state.temperature + (effT - this.state.temperature) * APPROACH_K + (Math.random() - 0.5) * NOISE_T,
    );
    this.state.humidity = round1(
      clamp(this.state.humidity + (effH - this.state.humidity) * APPROACH_K + (Math.random() - 0.5) * NOISE_H, 5, 99),
    );
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
