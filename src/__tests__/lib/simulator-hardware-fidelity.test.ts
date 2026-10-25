/**
 * 硬件保真度测试：定时器/中断/串口/SFR 一致性。
 *
 * 期望值均按 MCS-51 用户手册（Intel 8051 Family User's Manual）手算，
 * 覆盖《微控制器原理及应用技术》《微控制器应用技术》两门课第5–7章的核心知识点：
 * 机器周期、定时器四种方式与 GATE/计数模式、两级中断优先级与嵌套、
 * 串口波特率由 T1 溢出率产生、SFR 字节与标志位的一致性。
 */
import { Simulator } from '@/lib/simulator';
import { getExperimentConfig } from '@/lib/experiment-config';

function load(code: string): Simulator {
  const sim = new Simulator();
  sim.updateCode(code);
  return sim;
}

function run(code: string, steps: number): Simulator {
  const sim = load(code);
  sim.stepBatch(steps);
  return sim;
}

const wrap = (body: string) => `ORG 0000H\n${body}\nSJMP $\nEND`;

describe('机器周期：定时器按机器周期计数（12MHz 下 1 机器周期 = 1µs）', () => {
  const timed = (instr: string) => load(wrap(`MOV TMOD,#01H\nMOV TH0,#00H\nMOV TL0,#00H\nSETB TR0\n${instr}`));

  it.each([
    ['NOP', 1],
    ['MOV A,#12H', 1],
    ['MOV 30H,#12H', 2],
    ['DJNZ R7,NEXT\nNEXT: NOP', 2],
    ['LJMP NEXT\nNEXT: NOP', 2],
    ['MUL AB', 4],
    ['DIV AB', 4],
    ['MOVX A,@DPTR', 2],
    ['MOVC A,@A+DPTR', 2],
    ['INC DPTR', 2],
  ])('%s 消耗 %i 个机器周期', (instr, cycles) => {
    const sim = timed(instr);
    sim.stepBatch(4); // TMOD/TH0/TL0/SETB TR0
    const before = sim.state.timers.TL0;
    sim.stepBatch(1);
    expect(sim.state.timers.TL0 - before).toBe(cycles);
  });
});

describe('软件延时可按机器周期精确核对', () => {
  it('实验5 DELAY_20MS 含 ACALL 共 20313 个机器周期（与指导书手算一致）', () => {
    const exp05 = getExperimentConfig('exp05')!.code;
    const delay = exp05.match(/DELAY_20MS:[\s\S]*?RET/)![0];
    const sim = run(`ORG 0000H
MOV TMOD,#01H
MOV TH0,#00H
MOV TL0,#00H
SETB TR0
ACALL DELAY_20MS
CLR TR0
SJMP $
${delay}
END`, 30000);
    const counted = (sim.state.timers.TH0 << 8) | sim.state.timers.TL0;
    // 计数含 SETB TR0 执行后的 1 个周期；CLR TR0 执行后 TR0 已为 0，不再计数
    expect(counted - 1).toBe(20313);
  });
});

describe('MUL/DIV 与奇偶标志', () => {
  it('MUL AB：80H×02H → B=01H A=00H，OV=1，CY=0', () => {
    const sim = run(wrap('SETB C\nMOV A,#80H\nMOV B,#02H\nMUL AB'), 4);
    expect(sim.state.registers.A).toBe(0x00);
    expect(sim.state.registers.B).toBe(0x01);
    expect(sim.state.psw.OV).toBe(true);
    expect(sim.state.psw.CY).toBe(false);
  });

  it('DIV AB：0FBH÷12H → A=0DH B=11H；除数为0时 OV=1', () => {
    const sim = run(wrap('MOV A,#0FBH\nMOV B,#12H\nDIV AB'), 3);
    expect(sim.state.registers.A).toBe(0x0d);
    expect(sim.state.registers.B).toBe(0x11);
    expect(sim.state.psw.OV).toBe(false);
    const z = run(wrap('MOV A,#10H\nMOV B,#00H\nDIV AB'), 3);
    expect(z.state.psw.OV).toBe(true);
  });

  it('奇偶标志 P 反映 A 中 1 的个数为奇数', () => {
    expect(run(wrap('MOV A,#07H'), 1).state.psw.P).toBe(true);
    expect(run(wrap('MOV A,#03H'), 1).state.psw.P).toBe(false);
  });
});

describe('查表：MOVC A,@A+PC 以下一条指令地址为基址', () => {
  it('A=02H 时取到 PC+2 处的表项', () => {
    const sim = run(`ORG 0000H
MOV A,#02H
MOVC A,@A+PC
SJMP $
DB 55H
END`, 2);
    expect(sim.state.registers.A).toBe(0x55);
  });
});

describe('定时器方式', () => {
  it('方式0 为 13 位计数：TH0=0FFH、TL0=1FH 再计 1 次即溢出', () => {
    const sim = load(wrap('MOV TMOD,#00H\nMOV TH0,#0FFH\nMOV TL0,#1FH\nSETB TR0'));
    sim.stepBatch(4); // SETB TR0 本身的 1 个机器周期即计满溢出
    expect(sim.state.timers.TF0).toBe(true);
    expect(sim.state.timers.TH0).toBe(0);
    expect(sim.state.timers.TL0 & 0x1f).toBe(0);
  });

  it('方式3：TL0 由 TR0 控制并置 TF0，TH0 由 TR1 控制并置 TF1', () => {
    const sim = load(wrap('MOV TMOD,#03H\nMOV TL0,#0FEH\nMOV TH0,#0FEH\nSETB TR0\nSETB TR1\nNOP\nNOP\nNOP'));
    sim.stepBatch(8);
    expect(sim.state.timers.TF0).toBe(true);
    expect(sim.state.timers.TF1).toBe(true);
  });

  it('GATE=1 时仅在 INT0 引脚为高且 TR0=1 时计数', () => {
    const sim = load(wrap('MOV TMOD,#09H\nMOV TH0,#00H\nMOV TL0,#00H\nSETB TR0\nNOP\nNOP\nNOP\nNOP'));
    sim.setPortBit('P3', 2, false); // INT0 拉低
    sim.stepBatch(6);
    expect(sim.state.timers.TL0).toBe(0);
    sim.setPortBit('P3', 2, true);
    sim.stepBatch(2);
    expect(sim.state.timers.TL0).toBe(2);
  });

  it('C/T=1 计数模式：只对 T0 引脚（P3.4）下降沿计数，不对机器周期计数', () => {
    const sim = load(wrap('MOV TMOD,#05H\nMOV TH0,#00H\nMOV TL0,#00H\nSETB TR0\nLOOP: SJMP LOOP'));
    sim.stepBatch(10);
    expect(sim.state.timers.TL0).toBe(0);
    for (let i = 0; i < 3; i++) {
      sim.setPortBit('P3', 4, false);
      sim.stepBatch(2);
      sim.setPortBit('P3', 4, true);
      sim.stepBatch(2);
    }
    expect(sim.state.timers.TL0).toBe(3);
  });
});

describe('SFR 字节与标志位一致', () => {
  it('定时器溢出置 TF0 后，读 TCON 字节可见 TCON.5', () => {
    const sim = run(wrap('MOV TMOD,#02H\nMOV TH0,#0FEH\nMOV TL0,#0FEH\nSETB TR0\nNOP\nNOP\nNOP\nMOV A,TCON'), 9);
    expect(sim.state.timers.TF0).toBe(true);
    expect(sim.state.registers.A & 0x20).toBe(0x20);
  });

  it('PCON 可写可读（SMOD 位）', () => {
    const sim = run(wrap('MOV PCON,#80H\nMOV A,PCON'), 2);
    expect(sim.state.registers.A & 0x80).toBe(0x80);
  });

  it('IP 的命名位 PT0/PS 与 SCON 的命名位 REN/SM0/SM1 可直接位操作', () => {
    const sim = run(wrap('SETB PT0\nSETB PS\nSETB REN\nSETB SM1\nMOV A,IP\nMOV B,SCON'), 6);
    expect(sim.state.registers.A & 0x12).toBe(0x12);
    expect(sim.state.registers.B & 0x50).toBe(0x50);
  });
});

describe('中断优先级与嵌套', () => {
  const nested = (ip: string) => `ORG 0000H
LJMP MAIN
ORG 000BH
LJMP T0I
ORG 001BH
LJMP T1I
ORG 0030H
MAIN:
    MOV TMOD,#22H
    MOV TH1,#0FEH
    MOV TL1,#0FEH
    MOV TH0,#0F0H
    MOV TL0,#0F0H
    MOV 30H,#00H
    MOV IP,#${ip}
    MOV IE,#8AH
    SETB TR1
    SJMP $
T1I:
    CLR TR1
    SETB TR0
T1L: SJMP T1L
T0I:
    INC 30H
    RETI
END`;

  it('PT0=1：高优先级 T0 能打断正在执行的低优先级 T1 服务程序', () => {
    const sim = run(nested('02H'), 3000);
    expect(sim.state.ram[0x30]).toBeGreaterThan(0);
  });

  it('同级（IP=00H）不能互相打断：T1 服务程序未返回前 T0 不被响应', () => {
    const sim = run(nested('00H'), 3000);
    expect(sim.state.ram[0x30]).toBe(0);
  });

  it('同时挂起时高优先级先响应：PT1=1 时 T1 先于 T0', () => {
    const sim = run(`ORG 0000H
LJMP MAIN
ORG 000BH
MOV 31H,#0BH
SJMP $
ORG 001BH
MOV 31H,#1BH
SJMP $
ORG 0030H
MAIN:
    MOV IP,#08H
    SETB TF0
    SETB TF1
    MOV IE,#8AH
    SJMP $
END`, 20);
    expect(sim.state.ram[0x31]).toBe(0x1b);
  });
});

describe('串口：波特率由 T1 溢出率产生，发送需要时间', () => {
  const tx = (setup: string) => load(`ORG 0000H
MOV SCON,#50H
${setup}
MOV SBUF,#41H
WAIT: JNB TI,WAIT
CLR TI
MOV 32H,#01H
SJMP $
END`);

  it('T1 未启动时 TI 永不置位（经典"忘了 SETB TR1"故障可复现）', () => {
    const sim = tx('MOV TMOD,#20H\nMOV TH1,#0FDH\nMOV TL1,#0FDH');
    sim.stepBatch(20000);
    expect(sim.state.ram[0x32]).toBe(0);
  });

  it('T1 方式2 TH1=0FDH、SMOD=0：TI 在停止位开始时置位，即起始位+8 数据位 = 9×32×3 = 864 个机器周期', () => {
    const sim = tx('MOV TMOD,#20H\nMOV TH1,#0FDH\nMOV TL1,#0FDH\nSETB TR1');
    sim.stepBatch(6);
    expect(sim.state.uart.TI).toBe(false);
    // 从写 SBUF 起用 T0 计机器周期：T0 方式1 由程序外部启动不便，这里直接累计 JNB 循环（每次 2 周期）
    let cycles = 0;
    while (!sim.state.uart.TI && cycles < 5000) { sim.stepBatch(1); cycles += 2; }
    expect(sim.state.uart.TI).toBe(true);
    expect(Math.abs(cycles - 864)).toBeLessThanOrEqual(6);
    sim.stepBatch(20);
    expect(sim.state.ram[0x32]).toBe(1);
    expect(sim.state.uart.transmitBuffer).toContain('A');
  });

  it('SMOD=1 时波特率加倍，发送耗时约减半', () => {
    const cyclesUntilDone = (setup: string) => {
      const sim = tx(setup);
      let n = 0;
      while (sim.state.ram[0x32] !== 1 && n < 20000) { sim.stepBatch(1); n++; }
      return n;
    };
    const slow = cyclesUntilDone('MOV TMOD,#20H\nMOV TH1,#0FDH\nMOV TL1,#0FDH\nSETB TR1');
    const fast = cyclesUntilDone('MOV PCON,#80H\nMOV TMOD,#20H\nMOV TH1,#0FDH\nMOV TL1,#0FDH\nSETB TR1');
    expect(fast).toBeLessThan(slow * 0.6);
  });

  it('TI 置位后 SCON 字节同步可见 SCON.1', () => {
    const sim = tx('MOV TMOD,#20H\nMOV TH1,#0FDH\nMOV TL1,#0FDH\nSETB TR1');
    let guard = 0;
    while (!sim.state.uart.TI && guard++ < 20000) sim.stepBatch(1);
    expect(sim.state.uart.TI).toBe(true);
    expect(sim.state.uart.SCON & 0x02).toBe(0x02);
  });
});
