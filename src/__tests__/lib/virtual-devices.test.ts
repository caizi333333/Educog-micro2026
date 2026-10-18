import { Simulator } from '@/lib/simulator';
import { getExperimentConfig } from '@/lib/experiment-config';
import { GreenhouseEnvironment } from '@/lib/devices/greenhouse-env';
import { Ds18b20Device } from '@/lib/devices/ds18b20';
import { Dht11Device } from '@/lib/devices/dht11';

/**
 * 虚拟传感器集成测试：模板代码通过真实 1-Wire/DHT11 协议与器件交互，
 * 读数必须来自环境模型而非硬编码。
 */

function makeGreenhouseSim() {
  const sim = new Simulator(getExperimentConfig('proj04')!.code);
  const env = new GreenhouseEnvironment();
  sim.attachEnvironment(env);
  sim.attachDevice('P3', 7, new Ds18b20Device(env));
  sim.attachDevice('P3', 4, new Dht11Device(env));
  return { sim, env };
}

function runUntil(sim: Simulator, predicate: () => boolean, maxInstr = 6_000_000): boolean {
  let spent = 0;
  while (spent < maxInstr && !predicate() && !sim.state.terminated) {
    sim.stepBatch(50_000);
    spent += 50_000;
  }
  return predicate();
}

describe('虚拟传感器建模（proj04 智慧大棚）', () => {
  it('DS18B20 按真实 1-Wire 协议回送环境模型温度，不再是固定 25°C', () => {
    const { sim, env } = makeGreenhouseSim();
    env.setTargets(28.0, 55);
    // 先让环境收敛（τ≈2M 指令），再跑满一轮采集
    runUntil(sim, () => env.state.temperature > 27.0, 6_000_000);
    const got = runUntil(
      sim,
      () => sim.state.ram[0x40] !== 0 || sim.state.ram[0x41] !== 0,
      3_000_000,
    );
    expect(got).toBe(true);
    const raw = (sim.state.ram[0x40] << 8) | sim.state.ram[0x41]; // TEMP_H=40H, TEMP_L=41H
    const readTemp = raw / 16;
    expect(readTemp).not.toBe(25.0); // 排除老的硬编码 0190H 兜底
    expect(Math.abs(readTemp - env.state.temperature)).toBeLessThan(0.6);
  });

  it('DHT11 走真实单总线时序读出湿度（含校验和），非 MOV #65 硬编码', () => {
    const { sim, env } = makeGreenhouseSim();
    env.setTargets(25, 55);
    // 先等环境收敛；再等到一帧校验和自洽的完整接收（50H..54H），
    // 此刻 HUMI(42H) 必等于缓冲湿度字节——协议端到端正确的确定性标志
    runUntil(sim, () => Math.abs(env.state.humidity - 55) < 1.5, 8_000_000);
    let envAtRead = 0;
    const checksumOk = () => {
      const ok =
        ((sim.state.ram[0x50] + sim.state.ram[0x51] + sim.state.ram[0x52] + sim.state.ram[0x53]) & 0xFF) ===
          sim.state.ram[0x54] && sim.state.ram[0x42] === sim.state.ram[0x50] && sim.state.ram[0x42] > 0;
      if (ok) envAtRead = env.state.humidity; // 命中瞬间的环境值——后续漂移不影响断言
      return ok;
    };
    const got = runUntil(sim, checksumOk, 4_000_000);
    expect(got).toBe(true);
    expect(Math.abs(sim.state.ram[0x42] - Math.round(envAtRead))).toBeLessThanOrEqual(2);
  });

  it('遥测帧携带环境实时值而非固定 25/65', () => {
    const { sim, env } = makeGreenhouseSim();
    env.setTargets(27.5, 50);
    // 先等环境收敛，再断言收敛后发出的帧（避免采到收敛途中的读数）
    runUntil(sim, () => Math.abs(env.state.temperature - 27.5) < 0.5 && Math.abs(env.state.humidity - 50) < 1.5, 8_000_000);
    const sentBefore = sim.state.uart.transmitBuffer.length;
    const got = runUntil(
      sim,
      () => /\{"temp":\d+,"humi":\d+\}/.test(sim.state.uart.transmitBuffer.slice(sentBefore)),
      6_000_000,
    );
    expect(got).toBe(true);
    const frame = sim.state.uart.transmitBuffer.slice(sentBefore).match(/\{"temp":(\d+),"humi":(\d+)\}/);
    expect(frame).not.toBeNull();
    expect(Math.abs(Number(frame![1]) - env.state.temperature)).toBeLessThan(2.5);
    expect(Math.abs(Number(frame![2]) - env.state.humidity)).toBeLessThan(3);
    expect(sim.state.uart.transmitBuffer).not.toContain('{"temp":25,"humi":65}');
  });

  it('切换到"午间高温"场景后温度超阈，蜂鸣器真实置位（步骤19可验证）', () => {
    const { sim, env } = makeGreenhouseSim();
    env.setScenario('heat');
    const alarmed = runUntil(
      sim,
      () => (sim.state.portValues.P3 & 0x20) !== 0 || (sim.state.ram[0x43] & 1) !== 0,
      9_000_000,
    );
    expect(alarmed).toBe(true);
  });

  it('不挂器件时总线悬空读回全1，模板兜底逻辑仍给出25°C（向后兼容）', () => {
    const sim = new Simulator(getExperimentConfig('proj04')!.code);
    const got = runUntil(sim, () => sim.state.ram[0x40] === 0x01 && sim.state.ram[0x41] === 0x90, 3_000_000);
    expect(got).toBe(true);
  });
});
