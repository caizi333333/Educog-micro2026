// 模拟完整的测试流程
console.log('开始模拟完整测试流程...');

// 模拟Simulator类的关键部分
class MockSimulator {
  constructor() {
    this.state = {
      terminated: false,
      registers: { A: 0 },
      pc: 0
    };
    this.instructions = [];
    this.instructionMap = new Map();
    this.labels = new Map();
  }
  
  updateCode(code) {
    console.log('调用updateCode，重置状态');
    this.state = {
      terminated: false,
      registers: { A: 0 },
      pc: 0
    };
    this.instructions = [];
    this.instructionMap.clear();
    this.labels.clear();
    
    // 简化的代码解析
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
        address: currentAddress
      };
      
      this.instructions.push(instruction);
      this.instructionMap.set(currentAddress, instruction);
      
      console.log(`解析指令: ${instruction.mnemonic} at address ${currentAddress}`);
      
      currentAddress += 1; // 简化，每个指令占1个地址
    }
    
    // 设置初始PC
    if (this.instructions.length > 0) {
      this.state.pc = this.instructions[0].address;
    }
    
    console.log(`解析完成，共${this.instructions.length}条指令，初始PC: ${this.state.pc}`);
  }
  
  step() {
    console.log(`\n=== step开始，PC: ${this.state.pc}, terminated: ${this.state.terminated} ===`);
    
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
    
    console.log(`执行指令: ${instr.mnemonic}`);
    this.execute(instr);
    
    console.log(`step结束，PC: ${this.state.pc}, terminated: ${this.state.terminated}`);
    return this.getState();
  }
  
  execute(instr) {
    switch (instr.mnemonic) {
      case 'MOV':
        console.log('执行MOV指令');
        if (instr.operands[0] === 'A' && instr.operands[1] === '#55H') {
          this.state.registers.A = 0x55;
        }
        this.state.pc++;
        break;
      case 'END':
        console.log('执行END指令');
        this.executeEND();
        return; // 立即返回，不递增PC
      default:
        console.log('未知指令，递增PC');
        this.state.pc++;
        break;
    }
  }
  
  executeEND() {
    console.log('executeEND: 设置terminated为true');
    this.state.terminated = true;
  }
  
  getState() {
    // 返回状态的深拷贝
    return JSON.parse(JSON.stringify(this.state));
  }
}

// 执行测试
const simulator = new MockSimulator();

const code = `
  ORG 0000H
  MOV A, #55H
  END
  MOV A, #AAH
`;

console.log('=== 测试开始 ===');
console.log('初始状态:', simulator.state);

console.log('\n调用updateCode...');
simulator.updateCode(code);
console.log('updateCode后状态:', simulator.state);

console.log('\n第一步: MOV A, #55H');
simulator.step();
console.log('第一步后状态:', simulator.state);

console.log('\n第二步: END');
simulator.step();
console.log('第二步后状态:', simulator.state);

console.log('\n第三步: 尝试再次step');
simulator.step();
console.log('第三步后状态:', simulator.state);

console.log('\n=== 测试结果 ===');
console.log(`terminated是否为true: ${simulator.state.terminated}`);
console.log(`A寄存器是否为0x55: 0x${simulator.state.registers.A.toString(16)}`);

if (simulator.state.terminated && simulator.state.registers.A === 0x55) {
  console.log('✅ 测试通过！');
} else {
  console.log('❌ 测试失败！');
}