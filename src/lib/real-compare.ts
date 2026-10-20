/**
 * 虚实对照：解析实体套件串口回传的 JSON 遥测帧，与虚拟环境模型读数比对。
 * 实体端固件约定每帧一行 {"temp":25.4,"humi":61,"alarm":0,"ts":12345}，
 * 解析对串口日志噪声宽容（只抽取行内 JSON 对象），与 proj04 遥测格式一致。
 */

export interface RealSample {
  temp: number;
  humi: number;
  alarm?: number;
  ts?: number;
}

export interface CompareReport {
  count: number;
  tempAvg: number;
  tempMin: number;
  tempMax: number;
  humiAvg: number;
  humiMin: number;
  humiMax: number;
  alarmCount: number;
  /** 与虚拟参照的偏差（null = 未提供参照） */
  tempDev: number | null;
  humiDev: number | null;
  /** 对照结论分级：good / ok / poor / none */
  verdict: 'good' | 'ok' | 'poor' | 'none';
  verdictText: string;
}

const FRAME_RE = /\{[^{}]*"temp"\s*:\s*-?\d+(?:\.\d+)?[^{}]*\}/g;

/** 从串口日志文本中抽取遥测帧；返回样本与无法解析的行数 */
export function parseRealTelemetry(text: string): { samples: RealSample[]; badLines: number } {
  const samples: RealSample[] = [];
  let badLines = 0;
  const matches = text.match(FRAME_RE) ?? [];
  for (const raw of matches) {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const temp = Number(obj.temp);
      const humi = Number(obj.humi);
      if (!Number.isFinite(temp) || !Number.isFinite(humi)) { badLines++; continue; }
      // 物理合理性护栏：丢弃传感器故障帧（DHT11 断线常吐 NaN/0/超量程值）
      if (temp < -20 || temp > 60 || humi < 0 || humi > 100) { badLines++; continue; }
      samples.push({
        temp,
        humi,
        alarm: typeof obj.alarm === 'number' ? obj.alarm : undefined,
        ts: typeof obj.ts === 'number' ? obj.ts : undefined,
      });
    } catch {
      badLines++;
    }
  }
  return { samples, badLines };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * 生成对照报告。
 * virtualTemp/virtualHumi：同一时刻虚拟环境模型的读数（学生应先把工况调到与实测环境相近）。
 * 判定：|ΔT|≤2°C 且 |ΔH|≤10%RH → good；|ΔT|≤4°C 且 |ΔH|≤20%RH → ok；否则 poor。
 */
export function compareWithVirtual(
  samples: RealSample[],
  virtualTemp: number | null,
  virtualHumi: number | null,
): CompareReport {
  if (samples.length === 0) {
    return {
      count: 0, tempAvg: 0, tempMin: 0, tempMax: 0,
      humiAvg: 0, humiMin: 0, humiMax: 0, alarmCount: 0,
      tempDev: null, humiDev: null, verdict: 'none', verdictText: '未解析到有效遥测帧',
    };
  }
  const temps = samples.map((s) => s.temp);
  const humis = samples.map((s) => s.humi);
  const tempAvg = mean(temps);
  const humiAvg = mean(humis);
  const tempDev = virtualTemp === null ? null : Math.abs(tempAvg - virtualTemp);
  const humiDev = virtualHumi === null ? null : Math.abs(humiAvg - virtualHumi);

  let verdict: CompareReport['verdict'] = 'none';
  let verdictText = '已统计实测数据；提供虚拟参照读数后给出一致性判定';
  if (tempDev !== null && humiDev !== null) {
    if (tempDev <= 2 && humiDev <= 10) {
      verdict = 'good';
      verdictText = '一致性良好：实测与虚拟模型偏差在传感器精度范围内，虚实对照达标';
    } else if (tempDev <= 4 && humiDev <= 20) {
      verdict = 'ok';
      verdictText = '基本吻合：偏差略超传感器标称精度，建议核对实测环境与工况选择是否匹配';
    } else {
      verdict = 'poor';
      verdictText = '偏差较大：请确认实测环境与所选工况一致、实体传感器工作正常';
    }
  }

  return {
    count: samples.length,
    tempAvg, tempMin: Math.min(...temps), tempMax: Math.max(...temps),
    humiAvg, humiMin: Math.min(...humis), humiMax: Math.max(...humis),
    alarmCount: samples.filter((s) => s.alarm === 1).length,
    tempDev, humiDev, verdict, verdictText,
  };
}
