import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  experiments,
  OFFICIAL_EXPERIMENT_IDS,
  getExperimentConfig,
  getExperimentsByCategory,
  checkPrerequisites,
  collectExperimentObservation,
  createExperimentObservation,
  validateExperimentObservation,
  hasProj04TelemetryFrame,
  PROJ04_MIN_OBSERVATION_STEPS,
} from '@/lib/experiment-config';
import { knowledgePoints, resolveKnowledgeResourceHref } from '@/lib/knowledge-points';
import { getTeachingContent } from '@/lib/teaching-content';
import { Simulator } from '@/lib/simulator';

describe('Original experiment programs with available canvas inputs', () => {
  it.each(experiments)('$id reaches its observation gate without editing the program', experiment => {
    const simulator = new Simulator(experiment.code);
    simulator.setBuzzerPin(experiment.peripheral?.buzzerPin ?? null);
    let observation = createExperimentObservation();
    let inputApplied = false;
    const ready = (): boolean => experiment.id === 'exp02'
      ? observation.steps >= 20
      : experiment.id === 'proj04'
        ? observation.steps >= PROJ04_MIN_OBSERVATION_STEPS && hasProj04TelemetryFrame(observation.uartText)
        : validateExperimentObservation(experiment.id, observation).ok;
    for (let index = 0; index < 22000 && !ready(); index++) {
      const batch = simulator.stepBatch(257);
      const state = simulator.getState();
      observation = collectExperimentObservation(observation, state, batch.executed);
      if (index >= 4 && !inputApplied) {
        switch (experiment.id) {
          case 'exp05': simulator.setPortBit('P3', 1, false); break;
          case 'exp08': simulator.pulsePortBit('P3', 2); break;
          case 'proj02':
            for (let bit = 0; bit < 8; bit++) simulator.setPortBit('P0', bit, ((127 >> bit) & 1) === 1);
            break;
          case 'proj03': expect(simulator.receiveUartByte('F'.charCodeAt(0))).toBe(true); break;
        }
        inputApplied = true;
      }
      if (state.terminated) break;
    }
    expect({ id: experiment.id, ready: ready(), steps: observation.steps }).toEqual({
      id: experiment.id, ready: true, steps: expect.any(Number),
    });
  });

  it('proj03 handles all remote commands and leaves the stack balanced', () => {
    const simulator = new Simulator(getExperimentConfig('proj03')!.code);
    simulator.stepBatch(1000);
    for (const [command, expected] of [['F', 5], ['B', 10], ['L', 4], ['R', 1], ['S', 0]] as const) {
      expect(simulator.receiveUartByte(command.charCodeAt(0))).toBe(true);
      simulator.stepBatch(1000);
      // Stop on the top-level loop so a transient single-bit motor write is not mistaken for a settled state.
      for (let index = 0; index < 100 && simulator.getState().registers.SP !== 0x60; index++) simulator.step();
      expect(simulator.getState().portValues.P2 & 15).toBe(expected);
      expect(simulator.getState().uart.RI).toBe(false);
      expect(simulator.getState().registers.SP).toBe(0x60);
    }
  });

  it('proj03 switches modes through serial reception and handles both obstacle inputs', () => {
    const simulator = new Simulator(getExperimentConfig('proj03')!.code);
    simulator.stepBatch(1000);
    expect(simulator.receiveUartByte('1'.charCodeAt(0))).toBe(true);
    simulator.stepBatch(1000);
    expect(simulator.getState().ram[0x30]).toBe(1);
    for (const [bit, turn] of [[2, 1], [3, 4]]) {
      simulator.pulsePortBit('P3', bit);
      simulator.stepBatch(100);
      expect(simulator.getState().portValues.P2 & 15).toBe(turn);
      simulator.stepBatch(100000);
      expect(simulator.getState().portValues.P3 & (1 << bit)).not.toBe(0);
      expect(simulator.getState().portValues.P2 & 15).toBe(5);
    }
    expect(simulator.receiveUartByte('2'.charCodeAt(0))).toBe(true);
    simulator.stepBatch(1000);
    expect(simulator.getState().ram[0x30]).toBe(2);
    for (const [input, motion] of [[5, 5], [6, 4], [3, 1], [7, 0]]) {
      for (let bit = 0; bit < 3; bit++) simulator.setPortBit('P1', bit, ((input >> bit) & 1) === 1);
      simulator.stepBatch(1000);
      for (let index = 0; index < 100 && simulator.getState().registers.SP !== 0x60; index++) simulator.step();
      expect(simulator.getState().portValues.P2 & 15).toBe(motion);
    }
    expect(simulator.receiveUartByte('0'.charCodeAt(0))).toBe(true);
    simulator.stepBatch(1000);
    expect(simulator.getState().ram[0x30]).toBe(0);
    expect(simulator.getState().portValues.P2 & 15).toBe(0);
  });

  it('exp09 displays welcome text and echoes actual received characters exactly once', () => {
    // 12MHz、TH1=0FDH：每字符约 960 机器周期，14 字符的欢迎帧约 13.4ms
    const simulator = new Simulator(getExperimentConfig('exp09')!.code);
    simulator.stepBatch(20000);
    expect(simulator.getState().uart.transmitBuffer).toBe('HELLO WORLD!\r\n');
    for (const character of ['A', '0', '~', ' ']) {
      expect(simulator.receiveUartByte(character.charCodeAt(0))).toBe(true);
      expect(simulator.receiveUartByte(66)).toBe(false);
      simulator.stepBatch(3000);
    }
    expect(simulator.getState().uart.transmitBuffer).toBe('HELLO WORLD!\r\nA0~ ');
    expect(simulator.getState().uart.receiveBuffer).toBe('A0~ ');
    expect(simulator.getState().registers.SP).toBe(7);
  });

  it.each([1, -1])('exp08 produces the expected half-step order for direction %i', direction => {
    const simulator = new Simulator(getExperimentConfig('exp08')!.code);
    simulator.stepBatch(1000);
    expect(simulator.getState().ram[0x26]).toBe(0xf6);
    expect(simulator.getState().ram[0x27]).toBe(0);
    if (direction === -1) {
      simulator.pulsePortBit('P3', 3);
      simulator.stepBatch(10000);
    }
    simulator.pulsePortBit('P3', 2);
    simulator.stepBatch(10000);
    const phases = [0x10, 0x30, 0x20, 0x60, 0x40, 0xc0, 0x80, 0x90];
    const observed: number[] = [];
    for (let index = 0; index < 200 && observed.length < 10; index++) {
      simulator.stepBatch(257);
      const phase = simulator.getState().portValues.P1 & 0xf0;
      if (phases.includes(phase) && observed.at(-1) !== phase) observed.push(phase);
    }
    expect(observed).toHaveLength(10);
    for (let index = 1; index < observed.length; index++) {
      expect(phases.indexOf(observed[index])).toBe((phases.indexOf(observed[index - 1]) + direction + 8) % 8);
    }
    simulator.pulsePortBit('P3', 2);
    simulator.stepBatch(10000);
    expect(simulator.getState().ram[0x22] & 1).toBe(0);
    expect(simulator.getState().portValues.P1 & 0xf0).toBe(0);
  });

  it('exp08 obeys speed limits and stops after exactly 100 timer-driven steps', () => {
    const simulator = new Simulator(getExperimentConfig('exp08')!.code);
    simulator.stepBatch(1000);
    const press = (bit: number): void => { simulator.pulsePortBit('P3', bit); simulator.stepBatch(10000); };
    for (let index = 0; index < 6; index++) press(4);
    expect(simulator.getState().ram[0x23]).toBe(9);
    expect(simulator.getState().ram[0x26]).toBe(0xfe);
    for (let index = 0; index < 10; index++) press(5);
    expect(simulator.getState().ram[0x23]).toBe(1);
    expect(simulator.getState().ram[0x26]).toBe(0xe0);
    simulator.pulsePortBit('P3', 6);
    let started = false;
    for (let index = 0; index < 4000; index++) {
      simulator.stepBatch(257);
      const state = simulator.getState();
      if (state.ram[0x22] & 1) started = true;
      if (started && !(state.ram[0x22] & 1)) break;
    }
    expect(started).toBe(true);
    expect(simulator.getState().ram[0x22] & 1).toBe(0);
    expect(simulator.getState().timers.TR0).toBe(false);
    expect(simulator.getState().timers.overflowCount0).toBe(100);
  });

  it('exp08 changes the very next energized phase when reversing an already running motor', () => {
    const simulator = new Simulator(getExperimentConfig('exp08')!.code);
    const phases = [0x10, 0x30, 0x20, 0x60, 0x40, 0xc0, 0x80, 0x90];
    simulator.stepBatch(1000);
    simulator.pulsePortBit('P3', 2);
    simulator.stepBatch(20000);
    for (const direction of [0, 1]) {
      simulator.pulsePortBit('P3', 3);
      const observed: number[] = [];
      for (let index = 0; index < 30000 && observed.length < 5; index++) {
        simulator.stepBatch(1);
        const state = simulator.state;
        const phase = state.portValues.P1 & 0xf0;
        if ((state.ram[0x21] & 1) === direction && phases.includes(phase) && observed.at(-1) !== phase) observed.push(phase);
      }
      expect(observed).toHaveLength(5);
      for (let index = 1; index < observed.length; index++) {
        expect(phases.indexOf(observed[index])).toBe((phases.indexOf(observed[index - 1]) + (direction ? 1 : -1) + 8) % 8);
      }
    }
  });
});

describe('Experiment Configuration', () => {
  describe('experiments array', () => {
    it('应该包含所有实验配置', () => {
      expect(experiments).toBeDefined();
      expect(Array.isArray(experiments)).toBe(true);
      expect(experiments.length).toBeGreaterThan(0);
    });

    it('每个实验应该有必需的字段', () => {
      experiments.forEach((experiment) => {
        expect(experiment.id).toBeDefined();
        expect(experiment.title).toBeDefined();
        expect(experiment.category).toBeDefined();
        expect(experiment.difficulty).toBeDefined();
        expect(experiment.duration).toBeDefined();
        expect(Array.isArray(experiment.objectives)).toBe(true);
        expect(Array.isArray(experiment.prerequisites)).toBe(true);
        expect(Array.isArray(experiment.knowledgePoints)).toBe(true);
        expect(Array.isArray(experiment.hardwareRequirements)).toBe(true);
        expect(experiment.code).toBeDefined();
        expect(Array.isArray(experiment.expectedResults)).toBe(true);
        expect(Array.isArray(experiment.troubleshooting)).toBe(true);
        expect(Array.isArray(experiment.extensions)).toBe(true);
      });
    });

    it('实验ID应该是唯一的', () => {
      const ids = experiments.map(exp => exp.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('正式实验目录应与可执行配置一致且不含孤儿项目', () => {
      expect(OFFICIAL_EXPERIMENT_IDS).toEqual(experiments.map((experiment) => experiment.id));
      expect(OFFICIAL_EXPERIMENT_IDS).toEqual([
        'exp01', 'exp02', 'exp03', 'exp04', 'exp05', 'exp06', 'exp07', 'exp08', 'exp09',
        'proj01', 'proj02', 'proj03', 'proj04',
      ]);
      expect(OFFICIAL_EXPERIMENT_IDS.some((id) => /^proj0[5-8]$/.test(id))).toBe(false);
    });

    it('实验报告模板入口应指向已有可访问文件', () => {
      const resource = knowledgePoints
        .flatMap((point) => point.resources ?? [])
        .find((item) => item.refId === 'doc-report-template');

      expect(resource).toBeDefined();
      expect(resource?.url).toBe('/resources/course/microcontroller-lab-report-1-8.pdf');
      expect(resolveKnowledgeResourceHref(resource!, 9)).toBe(resource?.url);
      expect(existsSync(join(process.cwd(), 'public', resource!.url!.slice(1)))).toBe(true);
    });

    it('知识资源中的实验入口应全部归属正式目录', () => {
      const experimentResources = knowledgePoints
        .flatMap((point) => point.resources ?? [])
        .filter((resource) => resource.type === 'experiment');

      expect(experimentResources).toHaveLength(31);
      experimentResources.forEach((resource) => {
        expect(resource.refId).toBeDefined();
        expect(OFFICIAL_EXPERIMENT_IDS).toContain(resource.refId);
        expect(resolveKnowledgeResourceHref(resource)).toBe(
          `/simulation?experiment=${resource.refId}`,
        );
      });
    });

    it('应该包含不同难度级别的实验', () => {
      const difficulties = [...new Set(experiments.map(exp => exp.difficulty))];
      expect(difficulties.length).toBeGreaterThan(1);
      expect(difficulties).toContain('basic');
      expect(difficulties).toContain('intermediate');
      // 'advanced'难度是可选的，不是必需的
    });

    it('应该包含不同类别的实验', () => {
      const categories = [...new Set(experiments.map(exp => exp.category))];
      expect(categories.length).toBeGreaterThan(1);
    });
  });

  describe('getExperimentConfig function', () => {
    it('应该根据ID返回正确的实验配置', () => {
      const firstExperiment = experiments[0];
      if (firstExperiment) {
        const result = getExperimentConfig(firstExperiment.id);
        
        expect(result).toBeDefined();
        expect(result?.id).toBe(firstExperiment.id);
        expect(result?.title).toBe(firstExperiment.title);
      }
    });

    it('应该对不存在的ID返回undefined', () => {
      const result = getExperimentConfig('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('应该处理空字符串ID', () => {
      const result = getExperimentConfig('');
      expect(result).toBeUndefined();
    });

    it('应该处理null和undefined ID', () => {
      const result1 = getExperimentConfig(null as any);
      const result2 = getExperimentConfig(undefined as any);
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });
  });

  describe('getExperimentsByCategory function', () => {
    it('应该根据类别返回实验列表', () => {
      const firstCategory = experiments[0].category;
      const result = getExperimentsByCategory(firstCategory);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach(exp => {
        expect(exp.category).toBe(firstCategory);
      });
    });

    it('应该对不存在的类别返回空数组', () => {
      const result = getExperimentsByCategory('non-existent-category');
      expect(result).toEqual([]);
    });

    it('应该处理空字符串类别', () => {
      const result = getExperimentsByCategory('');
      expect(Array.isArray(result)).toBe(true);
    });

    it('应该返回所有匹配类别的实验', () => {
      const categories = [...new Set(experiments.map(exp => exp.category))];
      
      categories.forEach(category => {
        const result = getExperimentsByCategory(category);
        const expectedCount = experiments.filter(exp => exp.category === category).length;
        expect(result.length).toBe(expectedCount);
      });
    });
  });

  describe('checkPrerequisites function', () => {
    it('应该检查实验的前置条件', () => {
      const experimentId = experiments[0].id;
      const completedExperiments: string[] = [];
      
      const result = checkPrerequisites(experimentId, completedExperiments);
      
      expect(result).toBeDefined();
      expect(typeof result.satisfied).toBe('boolean');
      expect(Array.isArray(result.missing)).toBe(true);
    });

    it('应该对不存在的实验返回错误', () => {
      const result = checkPrerequisites('non-existent-id', []);
      
      expect(result.satisfied).toBe(false);
      expect(result.missing).toContain('实验不存在');
    });

    it('应该正确处理基础实验', () => {
      const basicExperiments = experiments.filter(exp => exp.difficulty === 'basic');
      
      if (basicExperiments.length > 0) {
        const result = checkPrerequisites(basicExperiments[0].id, []);
        // 基础实验通常不需要前置条件
        expect(result.satisfied).toBe(true);
      }
    });

    it('应该正确处理中级实验的前置条件', () => {
      const intermediateExperiments = experiments.filter(exp => exp.difficulty === 'intermediate');
      
      if (intermediateExperiments.length > 0) {
        // 没有完成基础实验的情况
        const result1 = checkPrerequisites(intermediateExperiments[0].id, []);
        
        // 完成了基础实验的情况
        const result2 = checkPrerequisites(intermediateExperiments[0].id, ['exp01']);
        
        // 至少其中一个应该有不同的结果
        expect(result1.satisfied !== result2.satisfied || 
               result1.missing.length !== result2.missing.length).toBe(true);
      }
    });

    it('应该处理空的已完成实验列表', () => {
      const experimentId = experiments[0].id;
      const result = checkPrerequisites(experimentId, []);
      
      expect(result).toBeDefined();
      expect(typeof result.satisfied).toBe('boolean');
      expect(Array.isArray(result.missing)).toBe(true);
    });
  });

  describe('exp05 四路独立按键的实际执行', () => {
    function makeKeyboardSimulator() {
      const simulator = new Simulator(getExperimentConfig('exp05')!.code);
      simulator.stepBatch(64);
      expect(simulator.state.ram[0x21]).toBe(0);
      expect(simulator.state.portValues.P0).toBe(0xff);
      return simulator;
    }

    it.each([0, 1, 2, 3])('键%i应稳定输出自身编码，长按只接受一次，释放后重按可再次接受', (key) => {
      const simulator = makeKeyboardSimulator();
      simulator.setPortBit('P3', key, false);
      simulator.stepBatch(20_000);
      expect(simulator.state.portValues.P0).toBe(key);
      expect(simulator.state.ram[0x20]).toBe(key);
      expect(simulator.state.ram[0x21]).toBe(1);

      simulator.stepBatch(100_000);
      expect(simulator.state.ram[0x21]).toBe(1);
      simulator.setPortBit('P3', key, true);
      simulator.stepBatch(20_000);
      simulator.setPortBit('P3', key, false);
      simulator.stepBatch(20_000);
      expect(simulator.state.ram[0x21]).toBe(2);
      expect(simulator.state.portValues.P0).toBe(key);
      expect(simulator.state.interrupts.EA).toBe(false);
      expect(simulator.state.portValues.P1).toBe(0xff);
    });

    it('两次采样之间换键应拒绝本次候选，全部释放后新键才可接受', () => {
      const simulator = makeKeyboardSimulator();
      simulator.setPortBit('P3', 0, false);
      simulator.stepBatch(100); // 已保存候选，但尚未完成确认延时。
      expect(simulator.state.ram[0x22]).toBe(0);
      simulator.setPortBit('P3', 0, true);
      simulator.setPortBit('P3', 3, false);
      simulator.stepBatch(30_000);
      expect(simulator.state.ram[0x21]).toBe(0);
      expect(simulator.state.portValues.P0).toBe(0xff);

      simulator.setPortBit('P3', 3, true);
      simulator.stepBatch(20_000);
      simulator.setPortBit('P3', 3, false);
      simulator.stepBatch(20_000);
      expect(simulator.state.ram[0x21]).toBe(1);
      expect(simulator.state.portValues.P0).toBe(3);
    });

    it('确认期间释放或同时多键都不能接受候选键', () => {
      for (const nextInput of ['released', 'multiple'] as const) {
        const simulator = makeKeyboardSimulator();
        simulator.setPortBit('P3', 1, false);
        simulator.stepBatch(100);
        expect(simulator.state.ram[0x22]).toBe(1);
        if (nextInput === 'released') simulator.setPortBit('P3', 1, true);
        else simulator.setPortBit('P3', 2, false);
        simulator.stepBatch(30_000);
        expect(simulator.state.ram[0x21]).toBe(0);
        expect(simulator.state.portValues.P0).toBe(0xff);
      }
    });

    it('同时多键不能被误作全部释放，也不能重新允许接受按键', () => {
      const simulator = makeKeyboardSimulator();
      simulator.setPortBit('P3', 0, false);
      simulator.setPortBit('P3', 1, false);
      simulator.stepBatch(30_000);
      expect(simulator.state.ram[0x21]).toBe(0);
      simulator.setPortBit('P3', 1, true);
      simulator.stepBatch(20_000);
      expect(simulator.state.ram[0x21]).toBe(1);

      simulator.setPortBit('P3', 1, false);
      simulator.stepBatch(20_000);
      simulator.setPortBit('P3', 0, true);
      simulator.stepBatch(20_000);
      expect(simulator.state.ram[0x21]).toBe(1);
      expect(simulator.state.portValues.P0).toBe(0);
    });

    it('短暂回高后再次拉低不能绕过释放确认', () => {
      const simulator = makeKeyboardSimulator();
      simulator.setPortBit('P3', 2, false);
      simulator.stepBatch(20_000);
      simulator.setPortBit('P3', 2, true);
      simulator.stepBatch(100);
      simulator.setPortBit('P3', 2, false);
      simulator.stepBatch(30_000);
      expect(simulator.state.ram[0x21]).toBe(1);
    });

    it('完整按键处理应保护工作寄存器且不覆盖计数变量', () => {
      const simulator = makeKeyboardSimulator();
      const initialRegisters = Array.from({ length: 8 }, (_, index) => 0x30 + index);
      simulator.state.ram.set(initialRegisters, 0);
      simulator.state.registers.B = 0x5a;
      simulator.state.registers.DPL = 0x12;
      simulator.state.registers.DPH = 0x34;
      simulator.setPortBit('P3', 3, false);
      simulator.stepBatch(20_000);
      expect(Array.from(simulator.state.ram.slice(0, 8))).toEqual(initialRegisters);
      expect(simulator.state.registers).toMatchObject({ B: 0x5a, DPL: 0x12, DPH: 0x34, SP: 0x2f });
      expect(simulator.state.ram[0x21]).toBe(1);
    });

    it('应按实际延时指令复算12MHz且每机器周期12个晶振周期时的理论间隔', () => {
      const code = getExperimentConfig('exp05')!.code;
      const delayBody = code.split('\nDELAY_20MS:')[1]!.split('\nEND')[0]!;
      const simulator = new Simulator(`ORG 0000H\nMOV SP, #2FH\nACALL DELAY_20MS\nEND\nDELAY_20MS:${delayBody}`);
      simulator.step(); // 初始化堆栈不计入子程序调用时间。
      const machineCycles: Record<string, number> = { ACALL: 2, PUSH: 2, MOV: 1, DJNZ: 2, POP: 2, RET: 2 };
      let cycles = 0;
      for (let index = 0; index < 20_000 && !simulator.state.terminated; index += 1) {
        const { trace } = simulator.stepWithTrace();
        const mnemonic = trace.instruction.split(' ')[0]!;
        if (mnemonic === 'END') break;
        expect(machineCycles[mnemonic]).toBeDefined();
        cycles += machineCycles[mnemonic]!;
      }
      expect(simulator.state.terminated).toBe(true);
      expect(cycles).toBe(20_313);
      expect((cycles * 12 / 12_000_000) * 1000).toBeCloseTo(20.313, 6);
      expect(getTeachingContent('exp05').theory.map(section => section.content).join(' ')).toContain('约20.313ms');
    });

    it('应将exp05关联到独立按键，矩阵和按键中断保留为理论内容', () => {
      expect(knowledgePoints.find(point => point.id === '8.2.1')?.appliedIn).toContain('exp05');
      for (const id of ['8.2.2', '5.3.3', '5.6.1']) {
        expect(knowledgePoints.find(point => point.id === id)?.appliedIn ?? []).not.toContain('exp05');
      }
      const comparison = knowledgePoints.find(point => point.id === '5.3')?.resources?.find(resource => resource.refId === 'exp05');
      expect(comparison?.title).toContain('不含外部中断');
      const experiment = getExperimentConfig('exp05')!;
      expect(experiment.peripheral?.keys?.map(key => key.label)).toEqual(['键0', '键1', '键2', '键3']);
      expect(experiment.peripheral?.label).toContain('四路独立按键');
    });
  });

  describe('实验内容验证', () => {
    it('串口示例应发出欢迎帧，且重装值在课件晶振条件下对应9600bit/s', () => {
      const experiment = getExperimentConfig('exp09')!;
      const simulator = new Simulator();
      simulator.updateCode(experiment.code);
      for (let step = 0; step < 30000 && !simulator.state.uart.transmitBuffer.includes('HELLO WORLD!\r\n'); step += 1) {
        simulator.step();
      }
      expect(simulator.state.uart.transmitBuffer).toContain('HELLO WORLD!\r\n');
      expect(simulator.state.timers.TMOD & 0xf0).toBe(0x20);
      expect(experiment.code).toMatch(/ANL PCON, #7FH/);
      // 最新第6章课件第45、47页：12T、SMOD=0、11.0592MHz。
      const divisor = 12 * 32 * (256 - simulator.state.timers.TH1);
      expect(11_059_200 / divisor).toBe(9600);
      const errorPercentAt12MHz = ((12_000_000 / divisor) / 9600 - 1) * 100;
      expect(errorPercentAt12MHz).toBeCloseTo(8.50694, 4);
    });

    it('大纲实验主题学时与平台拓展项目应分开，不能把自编项目合计进16学时', () => {
      const matchedPracticeIds = ['exp01', 'exp02', 'exp03', 'exp04', 'exp06', 'exp07', 'exp08'];
      matchedPracticeIds.forEach((id) => {
        const mapping = getTeachingContent(id).syllabusMapping!;
        expect(mapping.hours).toBe(2);
        expect(mapping.hoursLabel).toContain('大纲实验');
      });
      ['proj01', 'proj02', 'proj03', 'proj04'].forEach((id) => {
        const mapping = getTeachingContent(id).syllabusMapping!;
        expect(mapping.hours).toBe(0);
        expect(mapping.hoursLabel).toBe('平台拓展项目');
      });
      expect(getTeachingContent('exp09').syllabusMapping?.hoursLabel).toBe('对应理论章节');
      expect(getTeachingContent('exp05').syllabusMapping?.hours).toBe(0);
    });

    it('路灯示例应按程序初值说明约3.91Hz的观察时序，不能称为无闪烁照明', () => {
      const experiment = getExperimentConfig('proj02')!;
      const high = Number.parseInt(experiment.code.match(/MOV TH0, #([0-9A-F]+)H/i)![1]!, 16);
      const low = Number.parseInt(experiment.code.match(/MOV TL0, #([0-9A-F]+)H/i)![1]!, 16);
      const timerCounts = 65536 - ((high << 8) | low);
      const pwmHz = 12_000_000 / (12 * timerCounts * 256);
      expect(pwmHz).toBeCloseTo(3.90625, 5);
      expect(experiment.expectedResults.join(' ')).toContain('会闪烁');
      expect(getTeachingContent('proj02').theory.map((section) => section.content).join(' ')).toContain('约3.91Hz');
    });

    it('所有实验应该有有效的汇编代码', () => {
      experiments.forEach((experiment) => {
        expect(experiment.code).toBeDefined();
        expect(typeof experiment.code).toBe('string');
        expect(experiment.code.length).toBeGreaterThan(0);
        
        // 检查是否包含基本的汇编指令结构
        expect(experiment.code).toMatch(/ORG|MOV|LJMP|END/i);
      });
    });

    it('所有实验应该有明确的学习目标', () => {
      experiments.forEach((experiment) => {
        expect(experiment.objectives.length).toBeGreaterThan(0);
        experiment.objectives.forEach(objective => {
          expect(typeof objective).toBe('string');
          expect(objective.length).toBeGreaterThan(0);
        });
      });
    });

    it('所有实验应该有预期结果', () => {
      experiments.forEach((experiment) => {
        expect(experiment.expectedResults.length).toBeGreaterThan(0);
        experiment.expectedResults.forEach(result => {
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        });
      });
    });

    it('所有实验应该有故障排除指南', () => {
      experiments.forEach((experiment) => {
        expect(experiment.troubleshooting.length).toBeGreaterThan(0);
        experiment.troubleshooting.forEach(item => {
          expect(item.issue).toBeDefined();
          expect(item.solution).toBeDefined();
          expect(typeof item.issue).toBe('string');
          expect(typeof item.solution).toBe('string');
        });
      });
    });

    it('实验持续时间应该合理', () => {
      experiments.forEach((experiment) => {
        expect(experiment.duration).toBeGreaterThan(0);
        // 部分实验为综合实验/项目实践，允许更长时长（<= 8 小时）
        expect(experiment.duration).toBeLessThanOrEqual(480);
      });
    });

    it('实验应该有知识点说明', () => {
      experiments.forEach((experiment) => {
        expect(experiment.knowledgePoints.length).toBeGreaterThan(0);
        experiment.knowledgePoints.forEach(point => {
          expect(typeof point).toBe('string');
          expect(point.length).toBeGreaterThan(0);
        });
      });
    });

    it('实验应该有硬件需求说明', () => {
      experiments.forEach((experiment) => {
        expect(experiment.hardwareRequirements.length).toBeGreaterThan(0);
        experiment.hardwareRequirements.forEach(requirement => {
          expect(typeof requirement).toBe('string');
          expect(requirement.length).toBeGreaterThan(0);
        });
      });
    });
  });
});
