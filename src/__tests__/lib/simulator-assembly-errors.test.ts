/**
 * 装配期合法性校验测试——对齐真实汇编器行为：
 * 非法助记符/操作数组合/未定义符号/转移超范围 → 不产生可执行程序。
 * 此前仿真器对非法代码静默跳过（unknown mnemonic → pc++），学生看不到任何报错。
 */
import { Simulator } from '@/lib/simulator';
import { validateAssemblyCode } from '@/lib/syntax-validator';
import { experimentConfigs } from '@/lib/experiment-config';

function simOf(line: string, extra = ''): Simulator {
  return new Simulator(`ORG 0000H\n${line}\n${extra}\nEND`);
}

describe('装配错误：非法指令被拒执行（对齐真实工具链）', () => {
  it('未知助记符报错且不执行', () => {
    const sim = simOf('FOO A');
    expect(sim.state.assemblyErrors.length).toBeGreaterThan(0);
    expect(sim.state.assemblyErrors[0].message).toContain('未知指令');
    sim.stepBatch(10);
    expect(sim.state.registers.A).toBe(0); // 什么都没执行
    expect(sim.state.terminated).toBe(true);
  });

  it.each([
    ['MOV R1, R2', '寄存器之间不能直接传送'],
    ['PUSH A', 'PUSH ACC'],
    ['POP A', 'POP ACC'],
    ['ADD R1, A', ''],
    ['MOVX A, 30H', ''],
    ['MUL A, B', ''],
    ['MOV DPTR, A', ''],
    ['SETB A', ''],
    ['DEC DPTR', ''],
    ['DJNZ A, L', ''],
    ['CJNE R1, A, L', ''],
    ['MOV R8, A', ''],
    ['XCH A, B, C', ''],
  ])('%s → 装配错误', (line, hint) => {
    const sim = simOf(`${line}\nL: NOP`);
    expect(sim.state.assemblyErrors.length).toBeGreaterThan(0);
    if (hint) expect(sim.state.assemblyErrors[0].message).toContain(hint);
  });

  it('@R2~@R7 间接寄存器报明确错误', () => {
    const sim = simOf('MOV @R2, A');
    expect(sim.state.assemblyErrors[0].message).toContain('@R0 或 @R1');
  });

  it('跳转到未定义标号报错（此前静默落到下一条）', () => {
    const sim = simOf('SJMP FAR_AWAY');
    expect(sim.state.assemblyErrors.length).toBeGreaterThan(0);
    expect(sim.state.assemblyErrors[0].message).toContain('未定义');
  });

  it('8 位立即数超范围报错', () => {
    expect(simOf('MOV A, #300H').state.assemblyErrors[0].message).toContain('8位');
    expect(simOf('MOV R7, #256').state.assemblyErrors.length).toBeGreaterThan(0);
  });

  it('MOV DPTR 是 16 位立即数：1234H 合法、12345H 报错', () => {
    expect(simOf('MOV DPTR, #1234H').state.assemblyErrors).toEqual([]);
    const bad = simOf('MOV DPTR, #12345H');
    expect(bad.state.assemblyErrors[0].message).toContain('16位');
  });

  it('位寻址：可位寻址字节放行、不可位寻址报错', () => {
    expect(simOf('SETB 20H.0').state.assemblyErrors).toEqual([]);   // RAM 位区
    expect(simOf('SETB P1.3').state.assemblyErrors).toEqual([]);    // 端口位
    expect(simOf('SETB TR0').state.assemblyErrors).toEqual([]);     // 命名位
    expect(simOf('SETB 30H.0').state.assemblyErrors.length).toBeGreaterThan(0); // 30H 不可位寻址
    expect(simOf('SETB SBUF.0').state.assemblyErrors.length).toBeGreaterThan(0); // SBUF 不可位寻址
  });

  it('SJMP 超出相对转移范围报错', () => {
    const sim = new Simulator(`ORG 0000H\nSJMP FAR\nORG 0200H\nFAR: NOP\nEND`);
    expect(sim.state.assemblyErrors.some(e => e.message.includes('超出范围'))).toBe(true);
  });

  it('AJMP 跨 2KB 页报错', () => {
    // AJMP 位于 0000H，下一条指令在 0002H（页 0x000），目标 0800H 在页 0x800 —— 跨页非法
    const sim = new Simulator(`ORG 0000H\nAJMP TARGET\nORG 0800H\nTARGET: NOP\nEND`);
    expect(sim.state.assemblyErrors.some(e => e.message.includes('2KB'))).toBe(true);
  });

  it('AJMP 同页目标不误报', () => {
    const sim = new Simulator(`ORG 07FEH\nAJMP TARGET\nORG 0900H\nTARGET: NOP\nEND`);
    // 0x800 与 0x900 同属 0x800-0xFFF 页
    expect(sim.state.assemblyErrors).toEqual([]);
  });

  it('reset() 后装配错误仍然保持（不会复活坏代码）', () => {
    const sim = simOf('MOV R1, R2');
    sim.reset();
    expect(sim.state.assemblyErrors.length).toBeGreaterThan(0);
    sim.stepBatch(5);
    expect(sim.state.registers.A).toBe(0);
  });
});

describe('装配错误不误伤合法代码', () => {
  it.each([
    'MOV A, #0FFH', 'MOV R7, #20', 'MOV 30H, A', 'MOV A, B', 'MOV B, A',
    'PUSH ACC', 'POP PSW', 'SETB TR0', 'CLR P2.3', 'CPL C', 'MOV C, P1.0',
    'MOV P1.2, C', 'ANL C, /P1.0', 'ORL C, P3.2', 'XCH A, @R1', 'XCHD A, @R0',
    'INC DPTR', 'INC 20H', 'DJNZ R7, $', 'CJNE A, #30H, NEQ', 'MOVC A, @A+DPTR',
    'MOVX A, @DPTR', 'MOVX @R1, A', 'MUL AB', 'DIV AB', 'SUBB A, @R0',
  ])('%s → 合法', (line) => {
    const sim = simOf(`${line}\nNEQ: NOP`);
    expect(sim.state.assemblyErrors).toEqual([]);
  });

  it('标号大小写不敏感（A51 行为）：sjmp loop 能找到 LOOP:', () => {
    const sim = new Simulator('ORG 0000H\nsjmp loop\nORG 0030H\nLOOP: MOV A, #55H\nNOP\nEND');
    expect(sim.state.assemblyErrors).toEqual([]);
    sim.stepBatch(2);
    expect(sim.state.registers.A).toBe(0x55);
  });

  it('CALL 作为 LCALL 别名真实调用（此前静默跳过、调用不发生）', () => {
    const sim = new Simulator('ORG 0000H\nCALL DELAY\nMOV A, #01H\nEND\nDELAY: MOV A, #42H\nRET');
    sim.stepBatch(10);
    expect(sim.state.registers.A).toBe(0x01); // CALL→DELAY 把 A 设为 42H，返回后 MOV A,#01H
    expect(sim.state.registers.SP).toBe(0x07); // 栈平衡：压栈+RET 弹出
  });

  it('全部 13 个实验/项目参考程序装配干净', () => {
    for (const exp of experimentConfigs) {
      const sim = new Simulator(exp.code);
      expect({ id: exp.id, errors: sim.state.assemblyErrors }).toEqual({ id: exp.id, errors: [] });
    }
  });
});

describe('编辑器校验器与内核共用同一规则表', () => {
  it('validateAssemblyCode 对非法形态报 error', () => {
    const r = validateAssemblyCode('MOV R1, R2\nSJMP NOWHERE\nEND');
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
    expect(r.isValid).toBe(false);
  });

  it('validateAssemblyCode 对 CALL 给警告而非错误（兼容写法）', () => {
    const r = validateAssemblyCode('CALL DELAY\nDELAY: RET\nEND');
    expect(r.errors).toEqual([]);
    expect(r.warnings.some(w => w.code === 'NONSTANDARD_CALL')).toBe(true);
  });

  it('validateAssemblyCode 不误伤 DJNZ R7,$ 与位操作', () => {
    const r = validateAssemblyCode('DJNZ R7, $\nANL C, /P1.0\nMOV C, P3.2\nEND');
    expect(r.errors).toEqual([]);
  });

  it('伪指令行不误报：USING/DB/DW/EQU/BIT 定义', () => {
    const r = validateAssemblyCode('LED BIT P1.0\nUSING 0\nTAB: DB 1,2,3\nSETB LED\nEND');
    expect(r.errors).toEqual([]);
  });
});
