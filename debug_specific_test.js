// 调试具体的测试失败场景
console.log('开始调试程序终止测试...');

// 模拟测试中的代码
const code = `
  ORG 0000H
  MOV A, #55H
  END
  MOV A, #AAH
`;

console.log('测试代码:');
console.log(code);

// 模拟Simulator类的行为
class TestSimulator {
  constructor() {
    this.state = {
      terminated: false,
      registers: { A: 0 },
      pc: 0,
      ram: {},
      memory: []
    };
    this.instructions = [];
    this.instructionMap = new Map();
  }
  
  updateCode(code) {
    console.log('\n=== updateCode 开始 ===');
    // 重置状态
    this.state = {
      terminated: false,
      registers: { A: 0 },
      pc: 0,
      ram: {},
      memory: []
    };
    this.instructions = [];
    this.instructionMap.clear();
    
    console.log('状态已重置:', this.state);
    
    // 解析代码
    const lines = code.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith(';'));
    let currentAddress = 0;
    
    for (const line of lines) {
      if (line.startsWith('ORG')) {
        const match = line.match(/ORG\s+(\w+)/);
        if (match) {
          currentAddress = parseInt(match[1].replace('H', ''), 16);
        }
        continue;
      }
      
      const parts = line.split(/\s+/);
      const mnemonic = parts[0];
      const operands = parts.slice(1).join(' ').split(',').map(op => op.trim()).filter(Boolean);
      
      const instruction = {
        mnemonic: mnemonic.toUpperCase(),
        operands,
        address: currentAddress,
        line: 0
      };
      
      this.instructions.push(instruction);
      this.instructionMap.set(currentAddress, instruction);
      
      console.log(`解析指令: ${instruction.mnemonic} at ${currentAddress}, operands: [${operands.join(', ')}]`);
      
      currentAddress += 1;
    }
    
    // 设置初始PC
    if (this.instructions.length > 0) {
      this.state.pc = this.instructions[0].address;
    }
    
    console.log(`解析完成，PC设置为: ${this.state.pc}`);
    console.log('=== updateCode 结束 ===\n');
  }
  
  step() {
    console.log(`\n=== step 开始，PC: ${this.state.pc}, terminated: ${this.state.terminated} ===`);
    
    if (this.state.terminated) {
      console.log('程序已终止，直接返回');
      return this.getState();
    }
    
    const instr = this.instructionMap.get(this.state.pc);
    if (!instr) {
      console.log('找不到指令，程序终止');
      this.state.terminated = true;
      return this.getState();
    }
    
    console.log(`执行指令: ${instr.mnemonic}, operands: [${instr.operands.join(', ')}]`);
    this.execute(instr);
    
    console.log(`step 结束，PC: ${this.state.pc}, terminated: ${this.state.terminated}`);
    console.log('=== step 结束 ===\n');
    return this.getState();
  }
  
  execute(instr) {
    console.log(`\n--- execute 开始: ${instr.mnemonic} ---`);
    
    switch (instr.mnemonic) {
      case 'MOV':
        console.log('执行MOV指令');
        if (instr.operands[0] === 'A' && instr.operands[1] === '#55H') {
          this.state.registers.A = 0x55;
          console.log('设置A寄存器为0x55');
        }
        this.state.pc++;
        console.log(`PC递增到: ${this.state.pc}`);
        break;
      case 'END':
        console.log('执行END指令');
        this.executeEND();
        console.log('END指令执行完毕，立即返回');
        return; // 立即返回，不递增PC
      default:
        console.log('未知指令，递增PC');
        this.state.pc++;
        break;
    }
    
    console.log('--- execute 结束 ---\n');
  }
  
  executeEND() {
    console.log('\n*** executeEND 开始 ***');
    console.log('设置terminated为true');
    this.state.terminated = true;
    console.log(`terminated现在是: ${this.state.terminated}`);
    console.log('*** executeEND 结束 ***\n');
  }
  
  getState() {
    // 返回状态的深拷贝
    const state = JSON.parse(JSON.stringify(this.state));
    console.log('getState返回:', state);
    return state;
  }
}

// 执行测试
const simulator = new TestSimulator();

console.log('=== 开始模拟测试 ===');
console.log('初始状态:', simulator.state);

console.log('\n调用updateCode...');
simulator.updateCode(code);

console.log('\n第一步: MOV A, #55H');
simulator.step();
console.log('第一步后A寄存器:', simulator.state.registers.A);

console.log('\n第二步: END');
const finalState = simulator.step();

console.log('\n=== 最终结果 ===');
console.log('simulator.state.terminated:', simulator.state.terminated);
console.log('simulator.state.registers.A:', simulator.state.registers.A);
console.log('finalState.terminated:', finalState.terminated);
console.log('finalState.registers.A:', finalState.registers.A);

if (simulator.state.terminated && simulator.state.registers.A === 0x55) {
  console.log('\n✅ 测试应该通过！');
} else {
  console.log('\n❌ 测试失败！');
  console.log(`terminated期望true，实际${simulator.state.terminated}`);
  console.log(`A寄存器期望0x55，实际0x${simulator.state.registers.A.toString(16)}`);
}