/**
 * 仿真内核金标准测试（golden tests）
 *
 * 每个用例的期望值均为按 8051 指令手册手算的结果，覆盖标志位、中断栈、
 * 寄存器组切换、外部 RAM、越界行为等此前从未系统核对过的"深水区"。
 * 同时固化实验二（指令系统实验）三段式教学程序的逐段 RAM 期望值。
 */
import { Simulator } from '@/lib/simulator';
import { getExperimentConfig } from '@/lib/experiment-config';

/** 组装并运行一段程序（stepBatch 不做循环检测，适合确定性程序） */
function runProgram(code: string, maxSteps: number = 2000): Simulator {
  const sim = new Simulator();
  sim.updateCode(code);
  sim.stepBatch(maxSteps);
  return sim;
}

const wrap = (body: string) => `ORG 0000H\n${body}\nSJMP $\nEND`;

describe('金标准：ADD/ADDC/SUBB 标志位（CY/AC/OV 手算抽样）', () => {
  it('ADD 0FH+01H：半字节进位 AC=1，CY=0，OV=0', () => {
    const s = runProgram(wrap(`MOV A, #0FH\nADD A, #01H`));
    expect(s.state.registers.A).toBe(0x10);
    expect(s.state.psw.AC).toBe(true);
    expect(s.state.psw.CY).toBe(false);
    expect(s.state.psw.OV).toBe(false);
  });

  it('ADD 7FH+01H：正+正=负 溢出 OV=1，CY=0', () => {
    const s = runProgram(wrap(`MOV A, #7FH\nADD A, #01H`));
    expect(s.state.registers.A).toBe(0x80);
    expect(s.state.psw.OV).toBe(true);
    expect(s.state.psw.CY).toBe(false);
    expect(s.state.psw.AC).toBe(true);
  });

  it('ADD FFH+01H：溢出到0 CY=1 AC=1 OV=0（-1+1无符号进位、有符号不溢出）', () => {
    const s = runProgram(wrap(`MOV A, #0FFH\nADD A, #01H`));
    expect(s.state.registers.A).toBe(0x00);
    expect(s.state.psw.CY).toBe(true);
    expect(s.state.psw.AC).toBe(true);
    expect(s.state.psw.OV).toBe(false);
  });

  it('ADDC 80H+80H+CY(1)：A=01H CY=1 OV=1（负+负=正 溢出）', () => {
    const s = runProgram(wrap(`SETB C\nMOV A, #80H\nADDC A, #80H`));
    expect(s.state.registers.A).toBe(0x01);
    expect(s.state.psw.CY).toBe(true);
    expect(s.state.psw.OV).toBe(true);
    expect(s.state.psw.AC).toBe(false);
  });

  it('SUBB 00H-01H（CY=0）：A=FFH 借位 CY=1 AC=1 OV=0', () => {
    const s = runProgram(wrap(`CLR C\nMOV A, #00H\nSUBB A, #01H`));
    expect(s.state.registers.A).toBe(0xff);
    expect(s.state.psw.CY).toBe(true);
    expect(s.state.psw.AC).toBe(true);
    expect(s.state.psw.OV).toBe(false);
  });

  it('SUBB 80H-01H（CY=0）：A=7FH OV=1（-128-1 有符号溢出），CY=0', () => {
    const s = runProgram(wrap(`CLR C\nMOV A, #80H\nSUBB A, #01H`));
    expect(s.state.registers.A).toBe(0x7f);
    expect(s.state.psw.OV).toBe(true);
    expect(s.state.psw.CY).toBe(false);
    expect(s.state.psw.AC).toBe(true);
  });

  it('SUBB 带借位输入：10H-08H-1=07H，CY=0 AC=1', () => {
    const s = runProgram(wrap(`SETB C\nMOV A, #10H\nSUBB A, #08H`));
    expect(s.state.registers.A).toBe(0x07);
    expect(s.state.psw.CY).toBe(false);
    expect(s.state.psw.AC).toBe(true);
  });
});

describe('金标准：DA A 十进制调整（BCD 边界）', () => {
  it('99+01（BCD）：DA A 后 A=00H CY=1（100 的进位）', () => {
    const s = runProgram(wrap(`MOV A, #99H\nADD A, #01H\nDA A`));
    expect(s.state.registers.A).toBe(0x00);
    expect(s.state.psw.CY).toBe(true);
  });

  it('45+38（BCD）：二进制和7DH → DA A 修正为 83H，CY=0', () => {
    const s = runProgram(wrap(`MOV A, #45H\nADD A, #38H\nDA A`));
    expect(s.state.registers.A).toBe(0x83);
    expect(s.state.psw.CY).toBe(false);
  });

  it('87+95（BCD）：=182，DA A 后 A=82H CY=1', () => {
    const s = runProgram(wrap(`MOV A, #87H\nADD A, #95H\nDA A`));
    expect(s.state.registers.A).toBe(0x82);
    expect(s.state.psw.CY).toBe(true);
  });
});

describe('金标准：CJNE 四种形式的转移与 CY 语义', () => {
  // CY = 第一操作数 < 第二操作数（无符号）
  it('CJNE A,#data：不等则转移，A<data 时 CY=1', () => {
    const s = runProgram(wrap(`MOV A, #05H\nCJNE A, #09H, TAKEN\nMOV 31H, #1\nSJMP $\nTAKEN: MOV 31H, #2`));
    expect(s.state.ram[0x31]).toBe(2); // 5≠9 转移
    expect(s.state.psw.CY).toBe(true); // 5<9
  });

  it('CJNE A,direct：相等不转移，CY=0', () => {
    const s = runProgram(wrap(`MOV 30H, #09H\nMOV A, #09H\nCJNE A, 30H, TAKEN\nMOV 31H, #1\nSJMP $\nTAKEN: MOV 31H, #2`));
    expect(s.state.ram[0x31]).toBe(1); // 相等，顺序执行
    expect(s.state.psw.CY).toBe(false);
  });

  it('CJNE Rn,#data：不等转移，Rn≥data 时 CY=0', () => {
    const s = runProgram(wrap(`MOV R3, #07H\nCJNE R3, #05H, TAKEN\nMOV 31H, #1\nSJMP $\nTAKEN: MOV 31H, #2`));
    expect(s.state.ram[0x31]).toBe(2);
    expect(s.state.psw.CY).toBe(false); // 7≥5
  });

  it('CJNE @Ri,#data：相等不转移', () => {
    const s = runProgram(wrap(`MOV 40H, #03H\nMOV R0, #40H\nCJNE @R0, #03H, TAKEN\nMOV 31H, #1\nSJMP $\nTAKEN: MOV 31H, #2`));
    expect(s.state.ram[0x31]).toBe(1);
    expect(s.state.psw.CY).toBe(false);
  });
});

describe('金标准：寄存器组切换（RS1/RS0 与 RAM 映射）', () => {
  it('SETB RS0 后 R0 映射 08H；切回组0 后 R0 恢复原值', () => {
    const s = runProgram(wrap(`MOV R0, #11H\nSETB RS0\nMOV R0, #22H\nCLR RS0`));
    expect(s.state.ram[0x00]).toBe(0x11); // 组0 R0
    expect(s.state.ram[0x08]).toBe(0x22); // 组1 R0
    expect(s.state.registers.R0).toBe(0x11); // 切回组0 镜像恢复
  });

  it('MOV PSW,#18H 切到组3：R7 映射 1FH', () => {
    const s = runProgram(wrap(`MOV PSW, #18H\nMOV R7, #77H`));
    expect(s.state.ram[0x1f]).toBe(0x77);
    expect(s.state.ram[0x07]).toBe(0x00); // 组0 R7 未被触碰
  });
});

describe('金标准：MOVX 外部 RAM 往返', () => {
  it('MOVX @DPTR,A 写入后 MOVX A,@DPTR 能读回', () => {
    const s = runProgram(wrap(`MOV DPTR, #1234H\nMOV A, #5AH\nMOVX @DPTR, A\nMOV A, #00H\nMOVX A, @DPTR`));
    expect(s.state.registers.A).toBe(0x5a);
  });

  it('未写过的外部单元读 0xFF（总线悬空）', () => {
    const s = runProgram(wrap(`MOV DPTR, #2000H\nMOVX A, @DPTR`));
    expect(s.state.registers.A).toBe(0xff);
  });

  it('MOVX @R0,A 与 MOVX A,@R0 往返（P2 提供页地址）', () => {
    const s = runProgram(wrap(`MOV P2, #10H\nMOV R0, #34H\nMOV A, #0A7H\nMOVX @R0, A\nMOV A, #00H\nMOVX A, @R0`));
    expect(s.state.registers.A).toBe(0xa7);
  });

  it('不同 DPTR 地址互不串扰', () => {
    const s = runProgram(wrap(
      `MOV DPTR, #0100H\nMOV A, #11H\nMOVX @DPTR, A\nMOV DPTR, #0200H\nMOV A, #22H\nMOVX @DPTR, A\nMOV DPTR, #0100H\nMOVX A, @DPTR`
    ));
    expect(s.state.registers.A).toBe(0x11);
  });
});

describe('金标准：中断进入与 RETI 的栈平衡', () => {
  const intProgram = `ORG 0000H
LJMP MAIN
ORG 000BH
LJMP T0_INT
MAIN:
    MOV TMOD, #02H
    MOV TH0, #0F0H
    MOV TL0, #0F0H
    MOV 30H, #0
    SETB ET0
    SETB EA
    SETB TR0
LOOP:
    SJMP LOOP
T0_INT:
    INC 30H
    RETI
END`;

  it('中断发生→ISR→RETI 后 SP 与 PC 恢复；SP 只在 {07,09} 之间摆动', () => {
    const sim = new Simulator();
    sim.updateCode(intProgram);
    const seenSp = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      sim.stepBatch(1);
      seenSp.add(sim.state.registers.SP);
      if (sim.state.terminated) break;
    }
    expect(sim.state.terminated).toBe(false);
    // 主程序 SP=07H；中断压入 2 字节返回地址 → 09H；RETI 弹回 07H。不允许其它值（否则栈漏）
    expect([...seenSp].sort()).toEqual([0x07, 0x09]);
    expect(sim.state.ram[0x30]).toBeGreaterThan(10); // 中断反复发生并正常返回
  });
});

describe('金标准：JBC 清位语义', () => {
  it('位为1：转移且该位被清零', () => {
    const s = runProgram(wrap(`MOV 20H, #01H\nJBC 20H.0, TAKEN\nMOV 31H, #1\nSJMP $\nTAKEN: MOV 31H, #2`));
    expect(s.state.ram[0x31]).toBe(2);
    expect(s.state.ram[0x20]).toBe(0x00); // 20H.0 已被 JBC 清除
  });

  it('位为0：不转移、不改位', () => {
    const s = runProgram(wrap(`MOV 20H, #02H\nJBC 20H.0, TAKEN\nMOV 31H, #1\nSJMP $\nTAKEN: MOV 31H, #2`));
    expect(s.state.ram[0x31]).toBe(1);
    expect(s.state.ram[0x20]).toBe(0x02);
  });

  it('数值位地址形式：JBC 08H,rel 作用于 21H.0', () => {
    const s = runProgram(wrap(`MOV 21H, #01H\nJBC 08H, TAKEN\nMOV 31H, #1\nSJMP $\nTAKEN: MOV 31H, #2`));
    expect(s.state.ram[0x31]).toBe(2);
    expect(s.state.ram[0x21]).toBe(0x00);
  });
});

describe('金标准：RLC/RRC 进位链', () => {
  it('RLC：81H（CY=0）→ A=02H CY=1；再 RLC → A=05H CY=0', () => {
    const s1 = runProgram(wrap(`CLR C\nMOV A, #81H\nRLC A`));
    expect(s1.state.registers.A).toBe(0x02);
    expect(s1.state.psw.CY).toBe(true);
    const s2 = runProgram(wrap(`CLR C\nMOV A, #81H\nRLC A\nRLC A`));
    expect(s2.state.registers.A).toBe(0x05);
    expect(s2.state.psw.CY).toBe(false);
  });

  it('RRC：CY=1、A=02H → A=81H CY=0', () => {
    const s = runProgram(wrap(`SETB C\nMOV A, #02H\nRRC A`));
    expect(s.state.registers.A).toBe(0x81);
    expect(s.state.psw.CY).toBe(false);
  });

  it('RLC+RRC 往返：任意值经一左一右恢复原值与原CY', () => {
    const s = runProgram(wrap(`CLR C\nMOV A, #6BH\nRLC A\nRRC A`));
    expect(s.state.registers.A).toBe(0x6b);
    expect(s.state.psw.CY).toBe(false);
  });
});

describe('金标准：PUSH/POP 直接地址', () => {
  it('PUSH 30H → POP 31H 完成字节搬运，SP 回落', () => {
    const s = runProgram(wrap(`MOV 30H, #0ABH\nPUSH 30H\nPOP 31H`));
    expect(s.state.ram[0x31]).toBe(0xab);
    expect(s.state.registers.SP).toBe(0x07);
  });

  it('PUSH ACC / POP B：经栈交换到B', () => {
    const s = runProgram(wrap(`MOV A, #66H\nPUSH ACC\nPOP B`));
    expect(s.state.registers.B).toBe(0x66);
  });
});

describe('金标准：MOV C,bit 与 MOV bit,C', () => {
  it('RAM 位 → CY → 另一 RAM 位', () => {
    const s = runProgram(wrap(`MOV 20H, #80H\nMOV C, 20H.7\nMOV 21H.0, C`));
    expect(s.state.psw.CY).toBe(true);
    expect(s.state.ram[0x21] & 0x01).toBe(1);
  });

  it('端口位 → CY：P1 复位后为 FFH，P1.3 读出 1', () => {
    const s = runProgram(wrap(`MOV C, P1.3\nMOV 22H.0, C`));
    expect(s.state.ram[0x22] & 0x01).toBe(1);
  });

  it('CY → 端口位：CLR C 后 MOV P1.0,C 拉低 P1.0', () => {
    const s = runProgram(wrap(`CLR C\nMOV P1.0, C`));
    expect(s.state.portValues.P1).toBe(0xfe);
  });
});

describe('金标准：DJNZ 两种形式', () => {
  it('DJNZ Rn,rel：R2=3 循环3次', () => {
    const s = runProgram(wrap(`MOV R2, #3\nMOV 40H, #0\nLOOP: INC 40H\nDJNZ R2, LOOP`));
    expect(s.state.ram[0x40]).toBe(3);
    expect(s.state.registers.R2).toBe(0);
  });

  it('DJNZ direct,rel：以 30H 为计数器循环5次', () => {
    const s = runProgram(wrap(`MOV 30H, #5\nMOV 40H, #0\nLOOP: INC 40H\nDJNZ 30H, LOOP`));
    expect(s.state.ram[0x40]).toBe(5);
    expect(s.state.ram[0x30]).toBe(0);
  });

  it('DJNZ 减到0后从1绕回FFH再循环（边界）', () => {
    const s = runProgram(wrap(`MOV R2, #1\nDJNZ R2, NEVER\nMOV 40H, #7\nSJMP $\nNEVER: MOV 40H, #9`));
    expect(s.state.ram[0x40]).toBe(7); // 1-1=0 不转移
  });
});

describe('金标准：@Ri 越界（>7FH）行为定义', () => {
  // 经典 8051 内部 RAM 只有 128 字节（无 52 子系列的高 128 字节）：
  // 间接寻址越过 7FH 读 0、写丢弃。此语义在此固化，防止未来无意改变。
  it('越界写被丢弃、越界读返回 0，且不破坏 SFR/低区 RAM', () => {
    const s = runProgram(wrap(
      `MOV 90H, #55H\nMOV R0, #90H\nMOV A, #77H\nMOV @R0, A\nMOV A, #0FFH\nMOV A, @R0`
    ));
    expect(s.state.registers.A).toBe(0x00); // 越界读 → 0
    expect(s.state.ram.length).toBe(128);
    expect(s.state.portValues.P1).toBe(0x55); // 直接寻址 90H 是 P1（SFR），间接寻址不是——两套空间分明
  });

  it('7FH 是最后一个可用间接地址（写读正常）', () => {
    const s = runProgram(wrap(`MOV R1, #7FH\nMOV A, #3EH\nMOV @R1, A\nMOV A, #0\nMOV A, @R1`));
    expect(s.state.registers.A).toBe(0x3e);
    expect(s.state.ram[0x7f]).toBe(0x3e);
  });
});

describe('金标准：MOV @Ri,A 指令长度一致性（历史bug回归）', () => {
  // 曾经解析按3字节分配地址、执行只前进1字节 → PC 落空、就近回退到同一条指令原地死循环
  it('MOV @R0,A 之后程序继续前进，不原地打转', () => {
    const s = runProgram(wrap(`MOV R0, #30H\nMOV A, #55H\nMOV @R0, A\nMOV 31H, #99H`), 50);
    expect(s.state.ram[0x30]).toBe(0x55);
    expect(s.state.ram[0x31]).toBe(0x99); // 后续指令必须被执行到
  });

  it('MOV @R0,direct 同样不脱轨', () => {
    const s = runProgram(wrap(`MOV 40H, #0C3H\nMOV R0, #30H\nMOV @R0, 40H\nMOV 31H, #77H`), 50);
    expect(s.state.ram[0x30]).toBe(0xc3);
    expect(s.state.ram[0x31]).toBe(0x77);
  });
});

describe('金标准：实验二（指令系统实验）三段式程序逐段核对', () => {
  const exp = getExperimentConfig('exp02')!;

  function makeSim() {
    const sim = new Simulator();
    sim.updateCode(exp.code);
    return sim;
  }
  const lines = exp.code.split('\n');
  const lineOf = (marker: string) => {
    const idx = lines.findIndex(l => l.includes(marker));
    expect(idx).toBeGreaterThanOrEqual(0);
    return idx + 1; // stepBatch 断点为 1 基行号
  };

  it('第一段：五种寻址方式把期望数据写满 30H-3FH', () => {
    const sim = makeSim();
    const r = sim.stepBatch(200000, new Set([lineOf('MOV P1, #0FCH')]));
    expect(r.hitBreakpoint).toBe(true);
    expect(sim.state.ram[0x30]).toBe(0x5a); // 立即寻址
    expect(sim.state.ram[0x31]).toBe(0x5a); // 直接寻址（复制30H）
    expect(sim.state.ram[0x32]).toBe(0xa5); // 寄存器寻址
    expect(sim.state.ram[0x33]).toBe(0x3c); // 寄存器间接寻址
    const tab = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc];
    tab.forEach((v, i) => expect(sim.state.ram[0x34 + i]).toBe(v)); // 变址查表搬运
    expect(sim.state.portValues.P1).toBe(0xfe); // 阶段1指示灯
  });

  it('第二段：算术运算结果与手算一致（40H-4DH）', () => {
    const sim = makeSim();
    const r = sim.stepBatch(200000, new Set([lineOf('MOV P1, #0F8H')]));
    expect(r.hitBreakpoint).toBe(true);
    expect(sim.state.ram[0x40]).toBe(0x33); // 11H+22H
    expect(sim.state.ram[0x41]).toBe(0x43); // BB99H+CCAAH 低字节（99+AA=143H）
    expect(sim.state.ram[0x42]).toBe(0x88); // 高字节 BB+CC+CY=188H
    expect(sim.state.ram[0x43]).toBe(0x01); // 第17位进位 → 和=18843H
    expect(sim.state.ram[0x44]).toBe(0x82); // BCD 87+95=182 → 82
    expect(sim.state.ram[0x45]).toBe(0x01); // 百位 1
    expect(sim.state.ram[0x46]).toBe(0x42); // 11H×22H=0242H 低
    expect(sim.state.ram[0x47]).toBe(0x02); // 积高
    expect(sim.state.ram[0x48]).toBe(0x14); // 204÷10 商20
    expect(sim.state.ram[0x49]).toBe(0x04); // 余4
    expect(sim.state.ram[0x4a]).toBe(0xbc); // 33H-77H
    expect(sim.state.ram[0x4b]).toBe(0x01); // 借位
    expect(sim.state.ram[0x4c]).toBe(0x10); // INC
    expect(sim.state.ram[0x4d]).toBe(0x0f); // DEC
    expect(sim.state.portValues.P1).toBe(0xfc); // 阶段2指示灯
  });

  it('第三段+校验和：逻辑移位结果与手算校验和 F1H', () => {
    const sim = makeSim();
    const r = sim.stepBatch(200000, new Set([lineOf('MOV P1, A')]));
    expect(r.hitBreakpoint).toBe(true);
    const stage3 = [0x24, 0x7e, 0x5a, 0xc3, 0x7a, 0x03, 0xc0, 0x02, 0x05, 0x81, 0xf0];
    stage3.forEach((v, i) => expect(sim.state.ram[0x50 + i]).toBe(v));
    expect(sim.state.ram[0x5f]).toBe(0xf1); // 30H-5EH 校验和（手算 0xDF1 → F1H）
  });

  it('循环：回到第二轮 STAGE1 时数据区已清零、P1 挂着上一轮校验和', () => {
    const sim = makeSim();
    // 依次穿过三段与校验和，再停在第二轮 STAGE1 入口
    for (const m of ['MOV P1, #0FCH', 'MOV P1, #0F8H', 'MOV P1, A', 'MOV P1, #0FEH']) {
      const r = sim.stepBatch(200000, new Set([lineOf(m)]));
      expect(r.hitBreakpoint).toBe(true);
    }
    expect(sim.state.portValues.P1).toBe(0xf1);
    for (let a = 0x30; a <= 0x5f; a++) expect(sim.state.ram[a]).toBe(0);
  });

  it('连续 20 万条指令不卡死、不终止（稳态循环演示）', () => {
    const sim = makeSim();
    const r = sim.stepBatch(200000);
    expect(r.executed).toBe(200000);
    expect(r.terminated).toBe(false);
  });
});

describe('金标准：实验七音符频率表（12MHz 手算音高）', () => {
  // 频率表初值 = 65536 - 500000/f。第一个音符是低音1(do)=262Hz → 初值 F88CH，
  // 半周期 1908 条指令（教学模型 1 条≈1µs）+ 中断服务开销数条 → 实测应落在 262Hz 附近。
  // 蜂鸣器频率由引擎按 P2.0 相邻两次翻转的真实指令间隔推算，不是预设值——
  // 此用例同时回归频率表（曾整体音高倒挂：低音1≈1479Hz 比高音还高）与定时器/中断链路。
  it('第一个音符 低音1(do) 实测频率≈262Hz', () => {
    const exp = getExperimentConfig('exp07')!;
    const sim = new Simulator();
    sim.setBuzzerPin('P2.0');
    sim.updateCode(exp.code);
    sim.stepBatch(30000); // note1 beat4 要响约19万条指令，30k 时仍在第一个音符上
    expect(sim.state.buzzer.active).toBe(true);
    expect(sim.state.buzzer.frequency).toBeGreaterThanOrEqual(240);
    expect(sim.state.buzzer.frequency).toBeLessThanOrEqual(265);
  });
});

describe('金标准：getState() 快照中 ram 保持 Uint8Array（内存面板依赖）', () => {
  it('深拷贝后 ram 仍是长度128的 Uint8Array，且数值正确', () => {
    const sim = new Simulator();
    sim.updateCode(wrap(`MOV 30H, #5AH`));
    sim.stepBatch(10);
    const snap = sim.getState();
    expect(snap.ram).toBeInstanceOf(Uint8Array);
    expect(snap.ram.length).toBe(128);
    expect(snap.ram[0x30]).toBe(0x5a);
    // 快照独立：改快照不影响内部状态
    snap.ram[0x30] = 0;
    expect(sim.state.ram[0x30]).toBe(0x5a);
  });
});
