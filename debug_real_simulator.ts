// 使用真实的Simulator类进行调试
const { Simulator } = require('./src/lib/simulator');

console.log('开始使用真实Simulator调试...');

const simulator = new Simulator();

const code = `
  ORG 0000H
  MOV A, #55H
  END
  MOV A, #AAH
`;

console.log('测试代码:');
console.log(code);

console.log('\n=== 开始测试 ===');
console.log('初始状态:', {
  terminated: simulator.state.terminated,
  pc: simulator.state.pc,
  A: simulator.state.registers.A
});

console.log('\n调用updateCode...');
simulator.updateCode(code);
console.log('updateCode后状态:', {
  terminated: simulator.state.terminated,
  pc: simulator.state.pc,
  A: simulator.state.registers.A
});

console.log('\n第一步: MOV A, #55H');
const state1 = simulator.step();
console.log('第一步后状态:', {
  terminated: simulator.state.terminated,
  pc: simulator.state.pc,
  A: simulator.state.registers.A
});
console.log('step返回的状态:', {
  terminated: state1.terminated,
  pc: state1.pc,
  A: state1.registers.A
});

console.log('\n第二步: END');
const state2 = simulator.step();
console.log('第二步后状态:', {
  terminated: simulator.state.terminated,
  pc: simulator.state.pc,
  A: simulator.state.registers.A
});
console.log('step返回的状态:', {
  terminated: state2.terminated,
  pc: state2.pc,
  A: state2.registers.A
});

console.log('\n=== 测试结果 ===');
console.log(`simulator.state.terminated: ${simulator.state.terminated}`);
console.log(`simulator.state.registers.A: 0x${simulator.state.registers.A.toString(16)}`);
console.log(`state2.terminated: ${state2.terminated}`);
console.log(`state2.registers.A: 0x${state2.registers.A.toString(16)}`);

if (simulator.state.terminated && simulator.state.registers.A === 0x55) {
  console.log('\n✅ 测试通过！');
} else {
  console.log('\n❌ 测试失败！');
  console.log(`terminated期望true，实际${simulator.state.terminated}`);
  console.log(`A寄存器期望0x55，实际0x${simulator.state.registers.A.toString(16)}`);
}

// 检查指令映射 - 跳过私有属性访问
console.log('\n=== 指令映射检查 ===');
console.log('无法访问私有属性，跳过指令映射检查');

// 尝试第三步，看看是否会继续执行
console.log('\n第三步: 尝试再次step');
const state3 = simulator.step();
console.log('第三步后状态:', {
  terminated: simulator.state.terminated,
  pc: simulator.state.pc,
  A: simulator.state.registers.A
});
console.log('step返回的状态:', {
  terminated: state3.terminated,
  pc: state3.pc,
  A: state3.registers.A
});